pub mod actions;
pub mod champ_select;
pub mod roster;
mod client;
pub mod writes;
mod credentials;

use std::sync::{Arc, Mutex};
use std::time::Duration;

use futures_util::{SinkExt, StreamExt};
use rustls::ClientConfig;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{AppHandle, Emitter, Manager};
use tokio_tungstenite::tungstenite::Message;

use champ_select::ChampSelect;
pub use client::{LcuClient, tls_config};
use client::Error;
use credentials::{Credentials, Finder};

pub const STATUS_EVENT: &str = "lcu-status";
pub const CHAMP_SELECT_EVENT: &str = "lcu-champ-select";
const POLL_INTERVAL: Duration = Duration::from_secs(2);

const PHASE_PATH: &str = "/lol-gameflow/v1/gameflow-phase";
const SUMMONER_PATH: &str = "/lol-summoner/v1/current-summoner";
const SESSION_PATH: &str = "/lol-gameflow/v1/session";
const REGION_PATH: &str = "/riotclient/region-locale";
/// Phases in which the gameflow session names a game that was actually played.
const GAME_PHASES: [&str; 4] = ["InProgress", "WaitingForStats", "PreEndOfGame", "EndOfGame"];

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct GameflowSession {
    game_data: GameData,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct GameData {
    game_id: i64,
}

async fn current_game_id(api: &LcuClient) -> Option<i64> {
    let session: GameflowSession = api.get(SESSION_PATH).await.ok()?;
    (session.game_data.game_id > 0).then_some(session.game_data.game_id)
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Summoner {
    pub game_name: String,
    pub tag_line: String,
    pub puuid: String,
    #[serde(default)]
    pub profile_icon_id: i64,
}

/// The account's server ("TR", "EUW") and the client's language ("tr_TR", "en_GB").
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegionLocale {
    pub region: String,
    pub locale: String,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(tag = "state", rename_all = "camelCase")]
pub enum LcuStatus {
    Disconnected,
    Connecting,
    #[serde(rename_all = "camelCase")]
    Connected {
        summoner: Option<Summoner>,
        phase: Option<String>,
        /// The current or most recent game; match-v5 calls it `TR1_<gameId>`.
        last_game_id: Option<i64>,
        region: Option<RegionLocale>,
    },
}

#[derive(Default)]
pub struct LcuState(Mutex<Option<LcuStatus>>);

impl LcuState {
    pub fn current(&self) -> LcuStatus {
        self.0.lock().unwrap().clone().unwrap_or(LcuStatus::Disconnected)
    }
}

/// The live client connection, for commands that write to the client.
#[derive(Default)]
pub struct LcuApi(Mutex<Option<Arc<LcuClient>>>);

impl LcuApi {
    pub fn get(&self) -> Option<Arc<LcuClient>> {
        self.0.lock().unwrap().clone()
    }
}

#[derive(Default)]
pub struct ChampSelectState(Mutex<Option<ChampSelect>>);

impl ChampSelectState {
    pub fn current(&self) -> Option<ChampSelect> {
        self.0.lock().unwrap().clone()
    }
}

fn publish_champ_select(app: &AppHandle, value: Option<ChampSelect>) {
    let state = app.state::<ChampSelectState>();
    let mut current = state.0.lock().unwrap();
    if *current != value {
        *current = value.clone();
        let _ = app.emit(CHAMP_SELECT_EVENT, value);
    }
}

fn publish(app: &AppHandle, status: LcuStatus) {
    let state = app.state::<LcuState>();
    let mut current = state.0.lock().unwrap();
    if current.as_ref() != Some(&status) {
        *current = Some(status.clone());
        let _ = app.emit(STATUS_EVENT, status);
    }
}

pub fn spawn(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let tls = match client::tls_config() {
            Ok(tls) => tls,
            Err(error) => {
                eprintln!("lcu: tls setup failed: {error}");
                return;
            }
        };
        let mut finder = Finder::new();
        loop {
            match finder.find() {
                Some(credentials) => {
                    publish(&app, LcuStatus::Connecting);
                    // A client that is still starting refuses the socket; stay
                    // in Connecting and retry instead of flickering to Disconnected.
                    if let Err(error) = session(&app, tls.clone(), &credentials).await {
                        eprintln!("lcu: session ended: {error}");
                    }
                    publish_champ_select(&app, None);
                    *app.state::<LcuApi>().0.lock().unwrap() = None;
                    publish(&app, LcuStatus::Connecting);
                }
                None => publish(&app, LcuStatus::Disconnected),
            }
            tokio::time::sleep(POLL_INTERVAL).await;
        }
    });
}

/// Runs until the client closes or restarts.
async fn session(app: &AppHandle, tls: Arc<ClientConfig>, credentials: &Credentials) -> Result<(), Error> {
    let api = Arc::new(LcuClient::new(&tls, credentials)?);
    let mut events = client::connect_events(tls, credentials).await?;
    for path in [PHASE_PATH, SUMMONER_PATH, champ_select::SESSION_PATH] {
        let topic = format!("OnJsonApiEvent{}", path.replace('/', "_"));
        events.send(Message::text(serde_json::json!([5, topic]).to_string())).await?;
    }

    // Both 404 until the player has logged in; the events fill them in later.
    let mut phase: Option<String> = api.get(PHASE_PATH).await.ok();
    let mut summoner: Option<Summoner> = api.get(SUMMONER_PATH).await.ok();
    // Fixed for the life of the client: a region change means a restart.
    let region: Option<RegionLocale> = api.get(REGION_PATH).await.ok();
    let mut last_game_id = if phase.as_deref().is_some_and(|p| GAME_PHASES.contains(&p)) {
        current_game_id(&api).await
    } else {
        None
    };
    publish(app, LcuStatus::Connected { summoner: summoner.clone(), phase: phase.clone(), last_game_id, region: region.clone() });
    *app.state::<LcuApi>().0.lock().unwrap() = Some(api.clone());
    // 404 outside champ select. Vizier may also start in the middle of one.
    let session: Option<Value> = api.get(champ_select::SESSION_PATH).await.ok();
    publish_champ_select(app, session.and_then(champ_select::parse));

    while let Some(message) = events.next().await {
        let Message::Text(text) = message? else { continue };
        let Some(event) = parse_event(&text) else { continue };
        match event.uri.as_str() {
            PHASE_PATH => {
                phase = event.data.as_str().map(str::to_owned);
                // Kept after the game ends so the app can open its analysis.
                if phase.as_deref() == Some("InProgress") || (last_game_id.is_none() && phase.as_deref().is_some_and(|p| GAME_PHASES.contains(&p))) {
                    last_game_id = current_game_id(&api).await.or(last_game_id);
                }
            }
            SUMMONER_PATH => summoner = serde_json::from_value(event.data).ok(),
            // A Delete event carries no data, which parses to None.
            champ_select::SESSION_PATH => {
                publish_champ_select(app, champ_select::parse(event.data));
                continue;
            }
            _ => continue,
        }
        publish(app, LcuStatus::Connected { summoner: summoner.clone(), phase: phase.clone(), last_game_id, region: region.clone() });
    }
    Ok(())
}

#[derive(Deserialize)]
struct ApiEvent {
    uri: String,
    #[serde(default)]
    data: Value,
}

/// WAMP 1.0 event frame: `[8, "<topic>", { uri, eventType, data }]`.
fn parse_event(text: &str) -> Option<ApiEvent> {
    let (code, _topic, event): (u8, String, ApiEvent) = serde_json::from_str(text).ok()?;
    (code == 8).then_some(event)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_phase_event() {
        let text = r#"[8,"OnJsonApiEvent_lol-gameflow_v1_gameflow-phase",{"data":"ChampSelect","eventType":"Update","uri":"/lol-gameflow/v1/gameflow-phase"}]"#;
        let event = parse_event(text).unwrap();
        assert_eq!(event.uri, PHASE_PATH);
        assert_eq!(event.data, "ChampSelect");
    }

    #[test]
    fn ignores_other_frames() {
        assert!(parse_event(r#"[0,"session","1","server"]"#).is_none());
    }

    #[test]
    fn riot_root_is_accepted() {
        client::tls_config().unwrap();
    }

    /// Needs a running League client: `cargo test -- --ignored`.
    #[tokio::test]
    #[ignore]
    async fn talks_to_running_client() {
        let credentials = Finder::new().find().expect("League client is not running");
        let tls = client::tls_config().unwrap();
        let api = LcuClient::new(&tls, &credentials).unwrap();
        let phase: String = api.get(PHASE_PATH).await.unwrap();
        println!("phase: {phase}");
        let mut events = client::connect_events(tls, &credentials).await.unwrap();
        events
            .send(Message::text(r#"[5,"OnJsonApiEvent_lol-gameflow_v1_gameflow-phase"]"#))
            .await
            .unwrap();
    }
}
