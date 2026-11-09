use serde::{Deserialize, Serialize};

pub const LOBBY_PATH: &str = "/lol-lobby/v2/lobby";

// The lobby also lists the party and their summoner names; only the queue and
// the player's own role picks are kept.

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawLobby {
    #[serde(default)]
    game_config: RawConfig,
    #[serde(default)]
    local_member: RawMember,
}

#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct RawConfig {
    #[serde(default)]
    queue_id: i64,
}

#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct RawMember {
    #[serde(default)]
    first_position_preference: String,
    #[serde(default)]
    second_position_preference: String,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Lobby {
    pub queue_id: i64,
    /// `TOP`, `JUNGLE`, `MIDDLE`, `BOTTOM`, `UTILITY` or `FILL`; none until picked.
    pub first_position: Option<String>,
    pub second_position: Option<String>,
}

fn position(raw: String) -> Option<String> {
    let upper = raw.to_uppercase();
    matches!(upper.as_str(), "TOP" | "JUNGLE" | "MIDDLE" | "BOTTOM" | "UTILITY" | "FILL").then_some(upper)
}

/// The lobby as the app needs it; a delete event or odd data gives none.
pub fn parse(value: serde_json::Value) -> Option<Lobby> {
    let raw: RawLobby = serde_json::from_value(value).ok()?;
    Some(Lobby {
        queue_id: raw.game_config.queue_id,
        first_position: position(raw.local_member.first_position_preference),
        second_position: position(raw.local_member.second_position_preference),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keeps_queue_and_roles_and_drops_the_party() {
        let lobby = serde_json::json!({
            "gameConfig": { "queueId": 420, "maxLobbySize": 5 },
            "localMember": { "firstPositionPreference": "MIDDLE", "secondPositionPreference": "BOTTOM", "summonerName": "Someone", "puuid": "secret" },
            "members": [{ "summonerName": "Friend" }]
        });
        let parsed = parse(lobby).unwrap();
        assert_eq!(parsed, Lobby { queue_id: 420, first_position: Some("MIDDLE".into()), second_position: Some("BOTTOM".into()) });
        let json = serde_json::to_string(&parsed).unwrap();
        assert!(!json.contains("Someone") && !json.contains("Friend") && !json.contains("secret"));
    }

    #[test]
    fn unselected_roles_are_none_and_fill_is_kept() {
        let lobby = serde_json::json!({
            "gameConfig": { "queueId": 440 },
            "localMember": { "firstPositionPreference": "UNSELECTED", "secondPositionPreference": "fill" }
        });
        let parsed = parse(lobby).unwrap();
        assert_eq!(parsed.first_position, None);
        assert_eq!(parsed.second_position.as_deref(), Some("FILL"));
    }

    #[test]
    fn modes_without_roles_still_have_a_queue() {
        let parsed = parse(serde_json::json!({ "gameConfig": { "queueId": 450 }, "localMember": {} })).unwrap();
        assert_eq!(parsed.queue_id, 450);
        assert_eq!(parsed.first_position, None);
    }

    #[test]
    fn a_delete_event_has_no_lobby() {
        assert!(parse(serde_json::Value::Null).is_none());
    }
}
