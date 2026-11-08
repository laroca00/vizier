use serde::{Deserialize, Serialize};

pub const SESSION_PATH: &str = "/lol-champ-select/v1/session";

// The session also carries player names and PUUIDs. Ranked champ select hides
// other players on purpose, so only what the draft itself shows is kept.

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawSession {
    local_player_cell_id: i64,
    #[serde(default)]
    my_team: Vec<RawMember>,
    #[serde(default)]
    their_team: Vec<RawMember>,
    #[serde(default)]
    bans: RawBans,
    #[serde(default)]
    actions: Vec<Vec<RawAction>>,
    #[serde(default)]
    bench_champions: Vec<RawBench>,
    #[serde(default)]
    rerolls_remaining: i64,
    timer: RawTimer,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawBench {
    #[serde(default)]
    champion_id: i64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawAction {
    actor_cell_id: i64,
    #[serde(default, rename = "type")]
    kind: String,
    #[serde(default)]
    is_in_progress: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawMember {
    cell_id: i64,
    #[serde(default)]
    champion_id: i64,
    #[serde(default)]
    champion_pick_intent: i64,
    #[serde(default)]
    assigned_position: String,
    #[serde(default)]
    spell1_id: i64,
    #[serde(default)]
    spell2_id: i64,
}

#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct RawBans {
    #[serde(default)]
    my_team_bans: Vec<i64>,
    #[serde(default)]
    their_team_bans: Vec<i64>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawTimer {
    phase: String,
    adjusted_time_left_in_phase: i64,
    internal_now_in_epoch_ms: i64,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Member {
    pub cell_id: i64,
    /// Locked champion, 0 until locked.
    pub champion_id: i64,
    /// Hovered champion before locking, 0 if none.
    pub pick_intent: i64,
    /// Empty outside role queues.
    pub position: String,
    pub spells: [i64; 2],
    pub is_local: bool,
}

/// Whose move the draft is waiting for. Actions only carry cell ids, so
/// nothing here names a player.
#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Turn {
    /// `ban` or `pick`.
    pub kind: String,
    pub mine: bool,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChampSelect {
    pub my_team: Vec<Member>,
    pub their_team: Vec<Member>,
    pub bans: Vec<i64>,
    pub phase: String,
    /// Champions on the shared bench in ARAM and Mayhem; empty elsewhere.
    pub bench: Vec<i64>,
    /// Rerolls the local player has left; 0 outside ARAM and Mayhem.
    pub rerolls_remaining: i64,
    /// None during planning, finalization and between turns.
    pub turn: Option<Turn>,
    /// Epoch milliseconds; the client and Vizier share the machine clock.
    pub phase_ends_at: i64,
}

fn member(raw: RawMember, local_cell: i64) -> Member {
    Member {
        cell_id: raw.cell_id,
        champion_id: raw.champion_id,
        pick_intent: raw.champion_pick_intent,
        position: raw.assigned_position,
        spells: [raw.spell1_id, raw.spell2_id],
        is_local: raw.cell_id == local_cell,
    }
}

fn turn(actions: &[Vec<RawAction>], local_cell: i64) -> Option<Turn> {
    let current: Vec<&RawAction> = actions
        .iter()
        .flatten()
        .filter(|a| a.is_in_progress && (a.kind == "ban" || a.kind == "pick"))
        .collect();
    let first = current.first()?;
    Some(Turn {
        kind: first.kind.clone(),
        mine: current.iter().any(|a| a.actor_cell_id == local_cell),
    })
}

pub fn parse(value: serde_json::Value) -> Option<ChampSelect> {
    let raw: RawSession = serde_json::from_value(value).ok()?;
    let local = raw.local_player_cell_id;
    let turn = turn(&raw.actions, local);
    Some(ChampSelect {
        my_team: raw.my_team.into_iter().map(|m| member(m, local)).collect(),
        their_team: raw.their_team.into_iter().map(|m| member(m, local)).collect(),
        bans: raw
            .bans
            .my_team_bans
            .into_iter()
            .chain(raw.bans.their_team_bans)
            .filter(|&id| id > 0)
            .collect(),
        bench: raw.bench_champions.into_iter().map(|b| b.champion_id).filter(|&id| id > 0).collect(),
        rerolls_remaining: raw.rerolls_remaining.max(0),
        phase: raw.timer.phase,
        turn,
        phase_ends_at: raw.timer.internal_now_in_epoch_ms + raw.timer.adjusted_time_left_in_phase,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keeps_draft_and_drops_identities() {
        let session = serde_json::json!({
            "localPlayerCellId": 2,
            "myTeam": [
                { "cellId": 2, "championId": 0, "championPickIntent": 103, "assignedPosition": "middle",
                  "spell1Id": 4, "spell2Id": 14, "gameName": "Someone", "puuid": "secret" },
                { "cellId": 3, "championId": 64, "assignedPosition": "jungle", "spell1Id": 11, "spell2Id": 4 }
            ],
            "theirTeam": [{ "cellId": 7, "championId": 0 }],
            "bans": { "myTeamBans": [238, -1], "theirTeamBans": [157] },
            "actions": [
                [{ "actorCellId": 2, "type": "ban", "isInProgress": false, "completed": true }],
                [{ "actorCellId": 7, "type": "pick", "isInProgress": true }, { "actorCellId": 2, "type": "pick", "isInProgress": true }]
            ],
            "timer": { "phase": "BAN_PICK", "adjustedTimeLeftInPhase": 25000, "internalNowInEpochMs": 1000 }
        });
        let parsed = parse(session).unwrap();
        assert_eq!(parsed.my_team[0].pick_intent, 103);
        assert!(parsed.my_team[0].is_local);
        assert!(!parsed.my_team[1].is_local);
        assert_eq!(parsed.bans, vec![238, 157]);
        assert_eq!(parsed.phase_ends_at, 26000);
        assert_eq!(parsed.turn, Some(Turn { kind: "pick".into(), mine: true }));
        let json = serde_json::to_string(&parsed).unwrap();
        assert!(!json.contains("Someone") && !json.contains("secret"));
    }

    #[test]
    fn reads_the_aram_bench_and_rerolls() {
        let session = serde_json::json!({
            "localPlayerCellId": 0,
            "myTeam": [{ "cellId": 0, "championId": 99 }],
            "benchEnabled": true,
            "benchChampions": [{ "championId": 103, "isPriority": false }, { "championId": 0 }, { "championId": 238 }],
            "rerollsRemaining": 2,
            "timer": { "phase": "BAN_PICK", "adjustedTimeLeftInPhase": 0, "internalNowInEpochMs": 0 }
        });
        let parsed = parse(session).unwrap();
        assert_eq!(parsed.bench, vec![103, 238]);
        assert_eq!(parsed.rerolls_remaining, 2);
    }

    #[test]
    fn sessions_without_a_bench_have_none() {
        let session = serde_json::json!({
            "localPlayerCellId": 0,
            "timer": { "phase": "BAN_PICK", "adjustedTimeLeftInPhase": 0, "internalNowInEpochMs": 0 }
        });
        let parsed = parse(session).unwrap();
        assert!(parsed.bench.is_empty());
        assert_eq!(parsed.rerolls_remaining, 0);
    }

    #[test]
    fn no_turn_outside_bans_and_picks() {
        let session = serde_json::json!({
            "localPlayerCellId": 0,
            "actions": [[{ "actorCellId": 0, "type": "ten_bans_reveal", "isInProgress": true }]],
            "timer": { "phase": "PLANNING", "adjustedTimeLeftInPhase": 0, "internalNowInEpochMs": 0 }
        });
        assert_eq!(parse(session).unwrap().turn, None);
    }
}
