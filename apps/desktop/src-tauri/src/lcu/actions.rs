use reqwest::Method;
use serde::Deserialize;
use serde_json::{Value, json};

use super::LcuClient;
use super::champ_select::SESSION_PATH;

const READY_CHECK_ACCEPT: &str = "/lol-matchmaking/v1/ready-check/accept";
const PICKABLE_PATH: &str = "/lol-champ-select/v1/pickable-champion-ids";
const BANNABLE_PATH: &str = "/lol-champ-select/v1/bannable-champion-ids";

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SessionActions {
    local_player_cell_id: i64,
    #[serde(default)]
    actions: Vec<Vec<RawAction>>,
}

#[derive(Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
struct RawAction {
    id: i64,
    actor_cell_id: i64,
    #[serde(default, rename = "type")]
    kind: String,
    #[serde(default)]
    is_in_progress: bool,
    #[serde(default)]
    completed: bool,
}

/// What a turn is called in the session: `pick` or `ban`.
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Kind {
    Pick,
    Ban,
}

impl Kind {
    fn name(self) -> &'static str {
        match self {
            Kind::Pick => "pick",
            Kind::Ban => "ban",
        }
    }
}

/// The local player's action that is open right now, if it is their turn.
fn current_action(session: &SessionActions, kind: Kind) -> Option<i64> {
    session
        .actions
        .iter()
        .flatten()
        .find(|a| a.actor_cell_id == session.local_player_cell_id && a.kind == kind.name() && a.is_in_progress && !a.completed)
        .map(|a| a.id)
}

fn action_body(champion_id: i64, lock: bool) -> Value {
    if lock { json!({ "championId": champion_id, "completed": true }) } else { json!({ "championId": champion_id }) }
}

/// Hovers (or, with `lock`, locks) the champion in the player's open pick or ban.
pub async fn act(api: &LcuClient, kind: Kind, champion_id: i64, lock: bool) -> Result<(), String> {
    let session: Value = api.get(SESSION_PATH).await.map_err(|e| e.to_string())?;
    let parsed: SessionActions = serde_json::from_value(session).map_err(|e| e.to_string())?;
    let id = current_action(&parsed, kind).ok_or("not your turn")?;
    api.send(Method::PATCH, &format!("{SESSION_PATH}/actions/{id}"), &action_body(champion_id, lock))
        .await
        .map_err(|e| e.to_string())
}

pub async fn accept_ready_check(api: &LcuClient) -> Result<(), String> {
    api.send(Method::POST, READY_CHECK_ACCEPT, &json!({})).await.map_err(|e| e.to_string())
}

/// Takes a champion from the shared ARAM bench.
pub async fn swap_from_bench(api: &LcuClient, champion_id: i64) -> Result<(), String> {
    api.send(Method::POST, &format!("{SESSION_PATH}/bench/swap/{champion_id}"), &json!({})).await.map_err(|e| e.to_string())
}

pub async fn available(api: &LcuClient, kind: Kind) -> Result<Vec<i64>, String> {
    let path = if kind == Kind::Pick { PICKABLE_PATH } else { BANNABLE_PATH };
    api.get(path).await.map_err(|e| e.to_string())
}

impl Kind {
    pub fn parse(text: &str) -> Result<Kind, String> {
        match text {
            "pick" => Ok(Kind::Pick),
            "ban" => Ok(Kind::Ban),
            other => Err(format!("unknown action kind {other}")),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn session() -> SessionActions {
        serde_json::from_value(json!({
            "localPlayerCellId": 2,
            "actions": [
                [{ "id": 1, "actorCellId": 2, "type": "ban", "isInProgress": false, "completed": true }],
                [{ "id": 5, "actorCellId": 7, "type": "ban", "isInProgress": true, "completed": false },
                 { "id": 6, "actorCellId": 2, "type": "ban", "isInProgress": true, "completed": false }],
                [{ "id": 11, "actorCellId": 2, "type": "pick", "isInProgress": false, "completed": false }]
            ]
        }))
        .unwrap()
    }

    #[test]
    fn finds_the_open_ban_of_the_local_player() {
        assert_eq!(current_action(&session(), Kind::Ban), Some(6));
    }

    #[test]
    fn no_pick_before_the_turn_comes() {
        assert_eq!(current_action(&session(), Kind::Pick), None);
    }

    #[test]
    fn ignores_other_players_and_finished_actions() {
        let mut s = session();
        s.local_player_cell_id = 3;
        assert_eq!(current_action(&s, Kind::Ban), None);
    }

    #[test]
    fn lock_completes_the_action() {
        assert_eq!(action_body(103, false), json!({ "championId": 103 }));
        assert_eq!(action_body(103, true), json!({ "championId": 103, "completed": true }));
    }

    #[test]
    fn parses_kinds() {
        assert_eq!(Kind::parse("ban"), Ok(Kind::Ban));
        assert!(Kind::parse("swap").is_err());
    }
}
