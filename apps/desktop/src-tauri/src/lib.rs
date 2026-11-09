mod lcu;
mod live;

use lcu::champ_select::ChampSelect;
use lcu::writes::{ItemBlock, RuneImport, RunePage};
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Emitter, Manager, WindowEvent};
use lcu::lobby::Lobby;
use lcu::{LobbyState, ChampSelectState, LcuApi, LcuState, LcuStatus};
use live::{LiveGame, OverlayState};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

#[tauri::command]
fn lcu_status(state: tauri::State<'_, LcuState>) -> LcuStatus {
    state.current()
}

#[tauri::command]
fn champ_select(state: tauri::State<'_, ChampSelectState>) -> Option<ChampSelect> {
    state.current()
}

#[tauri::command]
fn lobby(state: tauri::State<'_, LobbyState>) -> Option<Lobby> {
    state.current()
}

#[tauri::command]
fn live_game(state: tauri::State<'_, OverlayState>) -> Option<LiveGame> {
    state.current()
}

#[tauri::command]
fn live_loading(state: tauri::State<'_, OverlayState>) -> bool {
    state.loading.load(std::sync::atomic::Ordering::Relaxed)
}

#[tauri::command]
fn overlay_hidden(state: tauri::State<'_, OverlayState>) -> bool {
    state.hidden.load(std::sync::atomic::Ordering::Relaxed)
}

/// The settings live in the webview, so the main window reports the overlay switch here.
#[tauri::command]
fn set_overlay_enabled(app: tauri::AppHandle, state: tauri::State<'_, OverlayState>, enabled: bool) {
    state.set_enabled(&app, enabled);
}

#[tauri::command]
fn overlay_editing(state: tauri::State<'_, OverlayState>) -> bool {
    state.editing.load(std::sync::atomic::Ordering::Relaxed)
}

/// The overlay's own "Done" button ends editing without the shortcut.
#[tauri::command]
fn set_overlay_editing(app: tauri::AppHandle, editing: bool) {
    live::set_editing(&app, editing);
}

const NOT_CONNECTED: &str = "not connected to the League client";

#[tauri::command]
async fn import_runes(
    api: tauri::State<'_, LcuApi>,
    page: RunePage,
    replace_page_id: Option<i64>,
) -> Result<RuneImport, String> {
    let client = api.get().ok_or(NOT_CONNECTED)?;
    lcu::writes::import_runes(&client, &page, replace_page_id).await
}

#[tauri::command]
async fn import_spells(api: tauri::State<'_, LcuApi>, spells: [i64; 2]) -> Result<(), String> {
    let client = api.get().ok_or(NOT_CONNECTED)?;
    lcu::writes::import_spells(&client, spells).await
}

#[tauri::command]
async fn import_item_set(
    api: tauri::State<'_, LcuApi>,
    champion_id: i64,
    title: String,
    blocks: Vec<ItemBlock>,
) -> Result<bool, String> {
    let client = api.get().ok_or(NOT_CONNECTED)?;
    lcu::writes::import_item_set(&client, champion_id, &title, &blocks).await
}

/// The ten players of the game that is loading, for the scouting panel.
#[tauri::command]
async fn game_roster(api: tauri::State<'_, LcuApi>) -> Result<Vec<lcu::roster::RosterPlayer>, String> {
    let client = api.get().ok_or(NOT_CONNECTED)?;
    lcu::roster::current(&client).await
}

/// The player's solo queue tier (upper case), or none when unranked.
#[tauri::command]
async fn my_ranked_tier(api: tauri::State<'_, LcuApi>) -> Result<Option<String>, String> {
    let client = api.get().ok_or(NOT_CONNECTED)?;
    lcu::ranked::current(&client).await
}

/// Hovers or locks a champion in the player's open pick or ban; `kind` is "pick" or "ban".
#[tauri::command]
async fn champ_select_act(api: tauri::State<'_, LcuApi>, kind: String, champion_id: i64, lock: bool) -> Result<(), String> {
    let kind = lcu::actions::Kind::parse(&kind)?;
    let client = api.get().ok_or(NOT_CONNECTED)?;
    lcu::actions::act(&client, kind, champion_id, lock).await
}

#[tauri::command]
async fn accept_ready_check(api: tauri::State<'_, LcuApi>) -> Result<(), String> {
    let client = api.get().ok_or(NOT_CONNECTED)?;
    lcu::actions::accept_ready_check(&client).await
}

#[tauri::command]
async fn bench_swap(api: tauri::State<'_, LcuApi>, champion_id: i64) -> Result<(), String> {
    let client = api.get().ok_or(NOT_CONNECTED)?;
    lcu::actions::swap_from_bench(&client, champion_id).await
}

/// Champion ids the player can pick or ban right now (owned, not taken or banned).
#[tauri::command]
async fn available_champions(api: tauri::State<'_, LcuApi>, kind: String) -> Result<Vec<i64>, String> {
    let kind = lcu::actions::Kind::parse(&kind)?;
    let client = api.get().ok_or(NOT_CONNECTED)?;
    lcu::actions::available(&client, kind).await
}

/// Asks WebView2 to trim the main window's memory while it sits in the tray,
/// and to grow back once it is shown. Its scripts keep running either way,
/// so champ select still brings the window up.
#[cfg(windows)]
fn set_low_memory(window: &tauri::WebviewWindow, low: bool) {
    use webview2_com::Microsoft::Web::WebView2::Win32::{
        COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_LOW, COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_NORMAL, ICoreWebView2_19,
    };
    use std::sync::atomic::{AtomicU8, Ordering};
    use windows_core::Interface;
    // Resizes come in bursts while the window is dragged; skip the COM call
    // when the level hasn't changed.
    static LAST: AtomicU8 = AtomicU8::new(0);
    if LAST.swap(if low { 2 } else { 1 }, Ordering::Relaxed) == if low { 2 } else { 1 } {
        return;
    }
    let _ = window.with_webview(move |webview| {
        // SAFETY: COM calls on the controller Tauri hands out on its own thread.
        unsafe {
            let Ok(core) = webview.controller().CoreWebView2() else { return };
            let Ok(core) = core.cast::<ICoreWebView2_19>() else { return };
            let level = if low { COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_LOW } else { COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_NORMAL };
            let _ = core.SetMemoryUsageTargetLevel(level);
        }
    });
}

#[cfg(not(windows))]
fn set_low_memory(_window: &tauri::WebviewWindow, _low: bool) {}

/// Set by the webview while a game runs and Vizier isn't the window in front.
#[derive(Default)]
struct MainMemory {
    background: std::sync::atomic::AtomicBool,
}

/// Low while the main window can't be seen: in the tray, minimised, or
/// behind the game.
fn refresh_memory(window: &tauri::WebviewWindow) {
    let background = window.state::<MainMemory>().background.load(std::sync::atomic::Ordering::Relaxed);
    let away = !window.is_visible().unwrap_or(true) || window.is_minimized().unwrap_or(false);
    set_low_memory(window, away || background);
}

#[tauri::command]
fn set_background(window: tauri::WebviewWindow, state: tauri::State<'_, MainMemory>, background: bool) {
    state.background.store(background, std::sync::atomic::Ordering::Relaxed);
    refresh_memory(&window);
}

/// Overlay actions that have a hotkey, with the combination they start on.
/// The first two work whenever Vizier runs; the rest are manual timers that
/// are registered only while a game runs, so the combinations stay free in
/// every other app.
const DEFAULT_HOTKEYS: [(&str, &str); 23] = [
    ("toggle", "Ctrl+Shift+O"),
    ("edit", "Ctrl+Shift+L"),
    ("blue", "Ctrl+Shift+1"),
    ("red", "Ctrl+Shift+2"),
    ("gromp", "Ctrl+Shift+3"),
    ("wolves", "Ctrl+Shift+4"),
    ("raptors", "Ctrl+Shift+5"),
    ("krugs", "Ctrl+Shift+6"),
    ("scuttle", "Ctrl+Shift+7"),
    ("dragon", "Ctrl+Shift+D"),
    ("baron", "Ctrl+Shift+B"),
    ("stopwatch", "Ctrl+Shift+S"),
    ("custom", "Ctrl+Shift+T"),
    ("clear", "Ctrl+Shift+X"),
    ("skills", "Ctrl+Shift+K"),
    ("augments", "Ctrl+Shift+A"),
    ("build", "Ctrl+Shift+I"),
    ("reference", "Ctrl+Shift+J"),
    // An enemy used Flash: top, jungle, mid, bottom, support.
    ("flash1", "Ctrl+Shift+F1"),
    ("flash2", "Ctrl+Shift+F2"),
    ("flash3", "Ctrl+Shift+F3"),
    ("flash4", "Ctrl+Shift+F4"),
    ("flash5", "Ctrl+Shift+F5"),
];

fn is_timer_action(action: &str) -> bool {
    action != "toggle" && action != "edit"
}

/// Merges the player's choices over the defaults and refuses unknown actions,
/// unreadable combinations and a combination used twice.
fn resolve_hotkeys(overrides: &std::collections::HashMap<String, String>) -> Result<Vec<(String, Shortcut)>, String> {
    if let Some(unknown) = overrides.keys().find(|k| !DEFAULT_HOTKEYS.iter().any(|(a, _)| a == k)) {
        return Err(format!("unknown hotkey action {unknown}"));
    }
    let mut resolved: Vec<(String, Shortcut)> = Vec::new();
    for (action, default) in DEFAULT_HOTKEYS {
        let text = overrides.get(action).map(String::as_str).unwrap_or(default);
        let shortcut: Shortcut = text.parse().map_err(|_| format!("cannot read {text}"))?;
        if let Some((other, _)) = resolved.iter().find(|(_, s)| *s == shortcut) {
            return Err(format!("{text} is used by {other} and {action}"));
        }
        resolved.push((action.to_string(), shortcut));
    }
    Ok(resolved)
}

/// The overlay's current hotkeys, and whether a game is running.
#[derive(Default)]
struct Hotkeys {
    bindings: std::sync::Mutex<Vec<(String, Shortcut)>>,
    in_game: std::sync::atomic::AtomicBool,
}

impl Hotkeys {
    fn action_for(&self, shortcut: &Shortcut) -> Option<String> {
        self.bindings.lock().ok()?.iter().find(|(_, s)| s == shortcut).map(|(a, _)| a.clone())
    }
}

fn apply_hotkeys(app: &tauri::AppHandle, next: Vec<(String, Shortcut)>) {
    let state = app.state::<Hotkeys>();
    let in_game = state.in_game.load(std::sync::atomic::Ordering::Relaxed);
    let shortcuts = app.global_shortcut();
    let mut bindings = state.bindings.lock().expect("hotkeys lock");
    for (_, shortcut) in bindings.iter() {
        let _ = shortcuts.unregister(*shortcut);
    }
    for (action, shortcut) in &next {
        if is_timer_action(action) && !in_game {
            continue;
        }
        // Another app may own the combination; the overlay still works without it.
        if let Err(error) = shortcuts.register(*shortcut) {
            eprintln!("hotkey {action}: {error}");
        }
    }
    *bindings = next;
}

/// The settings page sends the player's own combinations, `{ action: "Ctrl+Shift+K" }`.
#[tauri::command]
fn set_hotkeys(app: tauri::AppHandle, bindings: std::collections::HashMap<String, String>) -> Result<(), String> {
    apply_hotkeys(&app, resolve_hotkeys(&bindings)?);
    Ok(())
}

pub fn set_timer_shortcuts(app: &tauri::AppHandle, on: bool) {
    let state = app.state::<Hotkeys>();
    state.in_game.store(on, std::sync::atomic::Ordering::Relaxed);
    let current: Vec<(String, Shortcut)> = state.bindings.lock().expect("hotkeys lock").clone();
    apply_hotkeys(app, current);
}

/// Passed by the autostart entry so a login start stays in the tray.
const TRAY_ACTION_EVENT: &str = "tray-action";

const MINIMIZED_ARG: &str = "--minimized";

fn show_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        set_low_memory(&window, false);
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

/// True when the player can currently see the main window.
#[tauri::command]
fn main_window_up(app: tauri::AppHandle) -> bool {
    app.get_webview_window("main").is_some_and(|w| w.is_visible().unwrap_or(false) && !w.is_minimized().unwrap_or(false))
}

/// Sends the main window to the tray while a game runs.
#[tauri::command]
fn hide_to_tray(app: tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
        set_low_memory(&window, true);
    }
}

#[tauri::command]
fn show_from_tray(app: tauri::AppHandle) {
    show_main_window(&app);
}

fn setup_tray(app: &tauri::App) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "Vizier\u{2019}i aç", true, None::<&str>)?;
    let draft = MenuItem::with_id(app, "champ_select", "Şampiyon seçimi", true, None::<&str>)?;
    let overlay = MenuItem::with_id(app, "overlay", "Overlay aç/kapat", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Çıkış", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &draft, &overlay, &quit])?;
    TrayIconBuilder::new()
        .icon(app.default_window_icon().cloned().expect("bundle has an icon"))
        .tooltip("Vizier")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => show_main_window(app),
            // The settings and the page live in the webview, so it does the work.
            "champ_select" | "overlay" => {
                if event.id.as_ref() == "champ_select" {
                    show_main_window(app);
                }
                let _ = app.emit(TRAY_ACTION_EVENT, event.id.as_ref());
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                show_main_window(tray.app_handle());
            }
        })
        .build(app)?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![MINIMIZED_ARG]),
        ))
        .manage(LcuState::default())
        .manage(ChampSelectState::default())
        .manage(LobbyState::default())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    if event.state != ShortcutState::Pressed {
                        return;
                    }
                    match app.state::<Hotkeys>().action_for(shortcut).as_deref() {
                        Some("toggle") => live::toggle_hidden(app),
                        Some("edit") => live::toggle_editing(app),
                        Some(timer) => live::timer_pressed(app, timer),
                        None => {}
                    }
                })
                .build(),
        )
        .manage(LcuApi::default())
        .manage(OverlayState::default())
        .manage(MainMemory::default())
        .manage(Hotkeys::default())
        .invoke_handler(tauri::generate_handler![
            lcu_status,
            champ_select,
            lobby,
            import_runes,
            import_spells,
            import_item_set,
            live_game,
            live_loading,
            overlay_hidden,
            set_overlay_enabled,
            overlay_editing,
            set_overlay_editing,
            set_background,
            set_hotkeys,
            game_roster,
            my_ranked_tier,
            champ_select_act,
            accept_ready_check,
            bench_swap,
            available_champions,
            main_window_up,
            hide_to_tray,
            show_from_tray
        ])
        .setup(|app| {
            setup_tray(app)?;
            if std::env::args().any(|arg| arg == MINIMIZED_ARG) {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                    set_low_memory(&window, true);
                }
            }
            lcu::spawn(app.handle().clone());
            live::spawn(app.handle().clone());
            if let Ok(defaults) = resolve_hotkeys(&Default::default()) {
                apply_hotkeys(app.handle(), defaults);
            }
            Ok(())
        })
        // Closing keeps Vizier in the tray so it can still react to champ select.
        .on_window_event(|window, event| {
            if window.label() == live::OVERLAY_LABEL {
                return;
            }
            match event {
                WindowEvent::CloseRequested { api, .. } => {
                    api.prevent_close();
                    let _ = window.hide();
                    if let Some(webview) = window.app_handle().get_webview_window(window.label()) {
                        set_low_memory(&webview, true);
                    }
                }
                // Minimising and restoring both arrive as a resize.
                WindowEvent::Resized(_) => {
                    if let Some(webview) = window.app_handle().get_webview_window(window.label()) {
                        refresh_memory(&webview);
                    }
                }
                _ => {}
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod hotkey_tests {
    use super::*;
    use std::collections::HashMap;

    #[test]
    fn defaults_resolve_without_clashes() {
        assert_eq!(resolve_hotkeys(&HashMap::new()).unwrap().len(), DEFAULT_HOTKEYS.len());
    }

    #[test]
    fn a_choice_replaces_the_default() {
        let overrides = HashMap::from([("toggle".to_string(), "Ctrl+Alt+H".to_string())]);
        let resolved = resolve_hotkeys(&overrides).unwrap();
        let toggle = resolved.iter().find(|(a, _)| a == "toggle").unwrap();
        assert_eq!(toggle.1, "Ctrl+Alt+H".parse::<Shortcut>().unwrap());
    }

    #[test]
    fn refuses_a_combination_used_twice() {
        let overrides = HashMap::from([("toggle".to_string(), "Ctrl+Shift+L".to_string())]);
        assert!(resolve_hotkeys(&overrides).is_err());
    }

    #[test]
    fn refuses_unknown_actions_and_unreadable_combinations() {
        assert!(resolve_hotkeys(&HashMap::from([("fly".to_string(), "Ctrl+F".to_string())])).is_err());
        assert!(resolve_hotkeys(&HashMap::from([("toggle".to_string(), "banana".to_string())])).is_err());
    }
}
