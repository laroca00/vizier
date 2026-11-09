use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::LcuClient;

const GAMEFLOW_SESSION: &str = "/lol-gameflow/v1/session";

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawPlayer {
    #[serde(default)]
    puuid: String,
    #[serde(default)]
    champion_id: i64,
    #[serde(default)]
    selected_position: String,
}

#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct RawGameData {
    #[serde(default)]
    team_one: Vec<RawPlayer>,
    #[serde(default)]
    team_two: Vec<RawPlayer>,
}

/// One of the ten players on the loading screen. Only what scouting needs:
/// the id Riot's API takes, the champion and the role.
#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RosterPlayer {
    pub puuid: String,
    pub champion_id: i64,
    /// Lowercase LCU position; empty in modes without roles.
    pub position: String,
    /// 1 for the blue side, 2 for the red side.
    pub team: u8,
}

pub fn parse(session: &Value) -> Vec<RosterPlayer> {
    let data: RawGameData = serde_json::from_value(session["gameData"].clone()).unwrap_or_default();
    let side = |players: Vec<RawPlayer>, team: u8| {
        players
            .into_iter()
            .filter(|p| !p.puuid.is_empty() && p.champion_id > 0)
            .map(move |p| RosterPlayer { puuid: p.puuid, champion_id: p.champion_id, position: p.selected_position.to_lowercase(), team })
            .collect::<Vec<_>>()
    };
    let mut roster = side(data.team_one, 1);
    roster.extend(side(data.team_two, 2));
    roster
}

/// The players of the game being loaded; empty outside one.
pub async fn current(api: &LcuClient) -> Result<Vec<RosterPlayer>, String> {
    let session: Value = api.get(GAMEFLOW_SESSION).await.map_err(|e| e.to_string())?;
    Ok(parse(&session))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn reads_both_teams_and_skips_empty_slots() {
        let session = json!({
            "phase": "GameStart",
            "gameData": {
                "teamOne": [
                    { "puuid": "a", "championId": 103, "selectedPosition": "MIDDLE", "summonerName": "Someone" },
                    { "puuid": "", "championId": 64 }
                ],
                "teamTwo": [{ "puuid": "b", "championId": 238, "selectedPosition": "" }]
            }
        });
        let roster = parse(&session);
        assert_eq!(roster.len(), 2);
        assert_eq!(roster[0], RosterPlayer { puuid: "a".into(), champion_id: 103, position: "middle".into(), team: 1 });
        assert_eq!(roster[1].team, 2);
        assert!(!serde_json::to_string(&roster).unwrap().contains("Someone"));
    }

    #[test]
    fn no_game_data_is_an_empty_roster() {
        assert!(parse(&json!({ "phase": "Lobby" })).is_empty());
    }
}
