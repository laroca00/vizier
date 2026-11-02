//! In-game data from the Live Client Data API, and the overlay window that shows it.

use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, WebviewUrl, WebviewWindowBuilder};

use crate::lcu::tls_config;

pub const LIVE_EVENT: &str = "live-game";
pub const TOGGLE_EVENT: &str = "overlay-toggle";
pub const LOADING_EVENT: &str = "live-loading";
pub const EDIT_EVENT: &str = "overlay-edit";
pub const SCOREBOARD_EVENT: &str = "overlay-scoreboard";
pub const TIMER_EVENT: &str = "overlay-timer";
pub const OVERLAY_LABEL: &str = "overlay";
const URL: &str = "https://127.0.0.1:2999/liveclientdata/allgamedata";
const IN_GAME_INTERVAL: Duration = Duration::from_secs(1);
const IDLE_INTERVAL: Duration = Duration::from_secs(3);
/// A hidden overlay is closed after this, so a short gap between the loading
/// screen and the game doesn't rebuild it.
const CLOSE_AFTER: Duration = Duration::from_secs(30);
/// Must match the main window's in tauri.conf.json, or WebView2 refuses to
/// share one browser process between them. Autoplay lets timer alerts sound
/// in a window that is never clicked.
const BROWSER_ARGS: &str = "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection --autoplay-policy=no-user-gesture-required";

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AllGameData {
    active_player: ActivePlayer,
    all_players: Vec<Player>,
    events: EventList,
    game_data: GameStats,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ActivePlayer {
    #[serde(default)]
    riot_id: String,
    #[serde(default)]
    level: u32,
    #[serde(default)]
    current_gold: f64,
    #[serde(default)]
    abilities: Option<Abilities>,
}

#[derive(Deserialize)]
#[serde(rename_all = "PascalCase")]
struct Abilities {
    q: AbilityLevel,
    w: AbilityLevel,
    e: AbilityLevel,
    r: AbilityLevel,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AbilityLevel {
    #[serde(default)]
    ability_level: u32,
}

#[derive(Deserialize, Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Player {
    #[serde(default)]
    pub riot_id: String,
    /// `game_character_displayname_Ahri`; the suffix is the Data Dragon id.
    #[serde(default)]
    pub raw_champion_name: String,
    pub team: String,
    #[serde(default)]
    pub position: String,
    pub level: u32,
    #[serde(default)]
    pub items: Vec<Item>,
    pub scores: Scores,
}

#[derive(Deserialize, Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Item {
    #[serde(rename(deserialize = "itemID"))]
    pub item_id: u32,
    #[serde(default)]
    pub count: u32,
}

#[derive(Deserialize, Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Scores {
    pub kills: u32,
    pub deaths: u32,
    pub assists: u32,
    pub creep_score: u32,
    #[serde(default)]
    pub ward_score: f64,
}

#[derive(Deserialize)]
#[serde(rename_all = "PascalCase")]
struct EventList {
    events: Vec<RawEvent>,
}

#[derive(Deserialize)]
#[serde(rename_all = "PascalCase")]
struct RawEvent {
    event_name: String,
    event_time: f64,
    #[serde(default)]
    dragon_type: Option<String>,
    #[serde(default)]
    inhib_killed: Option<String>,
    #[serde(default)]
    killer_name: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct GameStats {
    game_time: f64,
    game_mode: String,
}

/// Only the events the overlay's timers use.
const KEPT_EVENTS: [&str; 4] = ["DragonKill", "BaronKill", "HeraldKill", "InhibKilled"];

#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GameEvent {
    pub name: String,
    pub time: f64,
    pub dragon_type: Option<String>,
    pub inhib_killed: Option<String>,
    pub killer_name: Option<String>,
}

/// What the overlay receives once a second.
#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LiveGame {
    pub game_time: f64,
    pub game_mode: String,
    pub me: String,
    pub level: u32,
    /// Unspent gold of the player.
    pub gold: f64,
    /// Ranks of Q, W, E and R.
    pub skills: [u32; 4],
    pub players: Vec<Player>,
    pub events: Vec<GameEvent>,
}

pub fn parse(json: &str) -> Result<LiveGame, serde_json::Error> {
    let data: AllGameData = serde_json::from_str(json)?;
    let skills = data
        .active_player
        .abilities
        .map(|a| [a.q.ability_level, a.w.ability_level, a.e.ability_level, a.r.ability_level])
        .unwrap_or_default();
    Ok(LiveGame {
        game_time: data.game_data.game_time,
        game_mode: data.game_data.game_mode,
        me: data.active_player.riot_id,
        level: data.active_player.level,
        // Whole gold is enough, and it keeps the once-a-second diff from firing on every tick of passive income.
        gold: data.active_player.current_gold.floor(),
        skills,
        players: data.all_players,
        events: data
            .events
            .events
            .into_iter()
            .filter(|e| KEPT_EVENTS.contains(&e.event_name.as_str()))
            .map(|e| GameEvent {
                name: e.event_name,
                time: e.event_time,
                dragon_type: e.dragon_type,
                inhib_killed: e.inhib_killed,
                killer_name: e.killer_name,
            })
            .collect(),
    })
}

/// Whether the player wants the overlay at all (settings) and whether they hid it with the hotkey.
#[derive(Default)]
pub struct OverlayState {
    enabled: AtomicBool,
    pub hidden: AtomicBool,
    /// The game process answers but the match hasn't started: the loading screen.
    pub loading: AtomicBool,
    /// The player is moving the overlay's boxes; it takes the mouse meanwhile.
    pub editing: AtomicBool,
    /// Whether the manual timer shortcuts are registered, i.e. a game was running last poll.
    timer_keys: AtomicBool,
    last: Mutex<Option<LiveGame>>,
    hidden_since: Mutex<Option<Instant>>,
}

impl OverlayState {
    pub fn set_enabled(&self, app: &AppHandle, enabled: bool) {
        self.enabled.store(enabled, Ordering::Relaxed);
        set_visible(app, self.should_show());
    }

    fn should_show(&self) -> bool {
        let active = self.last.lock().unwrap().is_some() || self.loading.load(Ordering::Relaxed) || self.editing.load(Ordering::Relaxed);
        self.enabled.load(Ordering::Relaxed) && active
    }

    pub fn current(&self) -> Option<LiveGame> {
        self.last.lock().unwrap().clone()
    }
}

/// The overlay can never be clicked or focused, so showing it doesn't pull
/// the game out of the foreground. It only exists while there is something
/// to show: a WebView2 renderer costs tens of megabytes even when hidden.
fn create_overlay(app: &AppHandle) -> tauri::Result<()> {
    let window = WebviewWindowBuilder::new(app, OVERLAY_LABEL, WebviewUrl::App("index.html".into()))
        .title("Vizier overlay")
        .transparent(true)
        .decorations(false)
        .shadow(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(false)
        .focused(false)
        .focusable(false)
        .visible(false)
        .additional_browser_args(BROWSER_ARGS)
        .build()?;
    if let Some(monitor) = window.primary_monitor()? {
        let position = monitor.position();
        let size = monitor.size();
        window.set_position(PhysicalPosition::new(position.x, position.y))?;
        window.set_size(PhysicalSize::new(size.width, size.height))?;
    }
    let editing = app.state::<OverlayState>().editing.load(Ordering::Relaxed);
    window.set_ignore_cursor_events(!editing)?;
    Ok(())
}

fn set_visible(app: &AppHandle, visible: bool) {
    let state = app.state::<OverlayState>();
    let mut hidden_since = state.hidden_since.lock().unwrap();
    match app.get_webview_window(OVERLAY_LABEL) {
        Some(window) if visible => {
            *hidden_since = None;
            if !window.is_visible().unwrap_or(false) {
                let _ = window.show();
            }
        }
        Some(window) => match *hidden_since {
            None => {
                *hidden_since = Some(Instant::now());
                let _ = window.hide();
            }
            Some(at) if at.elapsed() >= CLOSE_AFTER => {
                *hidden_since = None;
                let _ = window.destroy();
            }
            Some(_) => {}
        },
        None if visible => {
            *hidden_since = None;
            drop(hidden_since);
            if let Err(error) = create_overlay(app) {
                eprintln!("overlay: {error}");
                return;
            }
            if let Some(window) = app.get_webview_window(OVERLAY_LABEL) {
                let _ = window.show();
            }
        }
        None => {}
    }
}

/// Ctrl+Shift+L: lets the overlay take the mouse so its boxes can be dragged, and back.
pub fn set_editing(app: &AppHandle, editing: bool) {
    let state = app.state::<OverlayState>();
    state.editing.store(editing, Ordering::Relaxed);
    if let Some(window) = app.get_webview_window(OVERLAY_LABEL) {
        let _ = window.set_ignore_cursor_events(!editing);
    }
    set_visible(app, state.should_show());
    let _ = app.emit_to(OVERLAY_LABEL, EDIT_EVENT, editing);
}

pub fn toggle_editing(app: &AppHandle) {
    let editing = !app.state::<OverlayState>().editing.load(Ordering::Relaxed);
    set_editing(app, editing);
}

/// Windows only lets a topmost window stay above a fullscreen game while it
/// keeps asking; once a second is enough.
fn keep_on_top(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(OVERLAY_LABEL) {
        let _ = window.set_always_on_top(true);
    }
}

/// Whether Tab is held down while the game has focus, so the scoreboard is open.
#[cfg(windows)]
fn scoreboard_open() -> bool {
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{GetAsyncKeyState, VK_TAB};
    use windows_sys::Win32::UI::WindowsAndMessaging::{GetClassNameW, GetForegroundWindow};
    // SAFETY: plain Win32 queries with a buffer sized for them.
    unsafe {
        if GetAsyncKeyState(VK_TAB as i32) as u16 & 0x8000 == 0 {
            return false;
        }
        let mut class = [0u16; 64];
        let len = GetClassNameW(GetForegroundWindow(), class.as_mut_ptr(), class.len() as i32);
        String::from_utf16_lossy(&class[..len.max(0) as usize]) == "RiotWindowClass"
    }
}

#[cfg(not(windows))]
fn scoreboard_open() -> bool {
    false
}

/// Watches the Tab key during a game; reading the keyboard state doesn't touch the game.
fn spawn_scoreboard_watch(app: AppHandle) {
    std::thread::spawn(move || {
        let mut open = false;
        loop {
            let in_game = app.state::<OverlayState>().last.lock().unwrap().is_some();
            let now = in_game && scoreboard_open();
            if now != open {
                open = now;
                let _ = app.emit_to(OVERLAY_LABEL, SCOREBOARD_EVENT, open);
            }
            std::thread::sleep(if in_game { Duration::from_millis(40) } else { Duration::from_secs(1) });
        }
    });
}

pub fn timer_pressed(app: &AppHandle, timer: &str) {
    let _ = app.emit_to(OVERLAY_LABEL, TIMER_EVENT, timer);
}

pub fn toggle_hidden(app: &AppHandle) {
    let state = app.state::<OverlayState>();
    let hidden = !state.hidden.load(Ordering::Relaxed);
    state.hidden.store(hidden, Ordering::Relaxed);
    let _ = app.emit_to(OVERLAY_LABEL, TOGGLE_EVENT, hidden);
}

pub fn spawn(app: AppHandle) {
    spawn_scoreboard_watch(app.clone());
    tauri::async_runtime::spawn(async move {
        let http = match tls_config()
            .map_err(|e| e.to_string())
            .and_then(|tls| reqwest::Client::builder().use_preconfigured_tls((*tls).clone()).build().map_err(|e| e.to_string()))
        {
            Ok(http) => http,
            Err(error) => {
                eprintln!("live: client setup failed: {error}");
                return;
            }
        };
        loop {
            // Connection refused outside a game; loading screens answer 404.
            let (game, loading) = match http.get(URL).timeout(Duration::from_secs(2)).send().await {
                Ok(response) if response.status().is_success() => (response.text().await.ok().and_then(|body| parse(&body).ok()), false),
                Ok(response) => (None, response.status() == reqwest::StatusCode::NOT_FOUND),
                Err(_) => (None, false),
            };
            let in_game = game.is_some();
            let state = app.state::<OverlayState>();
            if state.timer_keys.swap(in_game, Ordering::Relaxed) != in_game {
                crate::set_timer_shortcuts(&app, in_game);
            }
            if state.loading.swap(loading, Ordering::Relaxed) != loading {
                let _ = app.emit_to(OVERLAY_LABEL, LOADING_EVENT, loading);
            }
            let changed = {
                let mut last = state.last.lock().unwrap();
                let changed = *last != game;
                *last = game.clone();
                changed
            };
            if changed {
                let _ = app.emit_to(OVERLAY_LABEL, LIVE_EVENT, game);
            }
            set_visible(&app, state.should_show());
            if in_game {
                keep_on_top(&app);
            }
            tokio::time::sleep(if in_game || loading { IN_GAME_INTERVAL } else { IDLE_INTERVAL }).await;
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE: &str = r#"{
      "activePlayer": {
        "riotId": "Vizier#TR1", "level": 7, "currentGold": 812.5,
        "abilities": {
          "Passive": {"displayName": "Essence Theft"},
          "Q": {"abilityLevel": 3}, "W": {"abilityLevel": 1}, "E": {"abilityLevel": 2}, "R": {"abilityLevel": 1}
        }
      },
      "allPlayers": [
        {"riotId": "Vizier#TR1", "rawChampionName": "game_character_displayname_Ahri", "championName": "Ahri",
         "team": "ORDER", "position": "MIDDLE", "level": 7,
         "items": [{"itemID": 1056, "count": 1, "slot": 0, "price": 400}],
         "scores": {"kills": 2, "deaths": 1, "assists": 3, "creepScore": 64, "wardScore": 4.2}}
      ],
      "events": {"Events": [
        {"EventID": 0, "EventName": "GameStart", "EventTime": 0.04},
        {"EventID": 3, "EventName": "DragonKill", "EventTime": 512.3, "DragonType": "Fire", "Stolen": "False", "KillerName": "Vizier", "Assisters": []},
        {"EventID": 4, "EventName": "InhibKilled", "EventTime": 900.0, "InhibKilled": "Barracks_T2_L1", "KillerName": "Vizier", "Assisters": []}
      ]},
      "gameData": {"gameMode": "CLASSIC", "gameTime": 640.5, "mapName": "Map11"}
    }"#;

    #[test]
    fn keeps_what_the_overlay_needs() {
        let game = parse(SAMPLE).unwrap();
        assert_eq!(game.me, "Vizier#TR1");
        assert_eq!(game.skills, [3, 1, 2, 1]);
        assert_eq!(game.gold, 812.0);
        assert_eq!(game.players[0].items, vec![Item { item_id: 1056, count: 1 }]);
        assert_eq!(game.players[0].scores.creep_score, 64);
        let names: Vec<_> = game.events.iter().map(|e| e.name.as_str()).collect();
        assert_eq!(names, ["DragonKill", "InhibKilled"]);
        assert_eq!(game.events[0].dragon_type.as_deref(), Some("Fire"));
    }
}
