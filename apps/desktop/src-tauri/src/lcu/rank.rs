use serde::Serialize;
use serde_json::Value;

use super::LcuClient;

const RANKED_STATS: &str = "/lol-ranked/v1/current-ranked-stats";
const SOLO_QUEUE: &str = "RANKED_SOLO_5x5";

/// The player's ranked solo standing, as far as picking a rank bracket needs it.
#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SoloRank {
    /// Upper case, as Riot writes it: IRON ... CHALLENGER.
    pub tier: String,
    /// "I" to "IV"; empty for Master and above.
    pub division: String,
}

/// Reads the solo queue entry; None when the player is unranked this season.
pub fn parse(stats: &Value) -> Option<SoloRank> {
    let solo = stats["queueMap"][SOLO_QUEUE]
        .as_object()
        .map(|_| &stats["queueMap"][SOLO_QUEUE])
        .or_else(|| stats["queues"].as_array()?.iter().find(|q| q["queueType"] == SOLO_QUEUE))?;
    let tier = solo["tier"].as_str()?.trim().to_uppercase();
    if tier.is_empty() || tier == "NONE" {
        return None;
    }
    let division = solo["division"].as_str().unwrap_or_default().trim().to_uppercase();
    Some(SoloRank { tier, division: if division == "NA" { String::new() } else { division } })
}

/// The player's own solo queue rank; None while unranked.
pub async fn current(api: &LcuClient) -> Result<Option<SoloRank>, String> {
    let stats: Value = api.get(RANKED_STATS).await.map_err(|e| e.to_string())?;
    Ok(parse(&stats))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn reads_the_solo_queue_from_the_queue_map() {
        let stats = json!({
            "queueMap": {
                "RANKED_FLEX_SR": { "tier": "SILVER", "division": "I" },
                "RANKED_SOLO_5x5": { "tier": "GOLD", "division": "II", "leaguePoints": 40, "isProvisional": false }
            }
        });
        assert_eq!(parse(&stats), Some(SoloRank { tier: "GOLD".into(), division: "II".into() }));
    }

    #[test]
    fn falls_back_to_the_queue_list() {
        let stats = json!({
            "queues": [
                { "queueType": "RANKED_FLEX_SR", "tier": "BRONZE", "division": "IV" },
                { "queueType": "RANKED_SOLO_5x5", "tier": "emerald", "division": "III" }
            ]
        });
        assert_eq!(parse(&stats), Some(SoloRank { tier: "EMERALD".into(), division: "III".into() }));
    }

    #[test]
    fn apex_tiers_have_no_division() {
        let stats = json!({ "queueMap": { "RANKED_SOLO_5x5": { "tier": "MASTER", "division": "NA" } } });
        assert_eq!(parse(&stats), Some(SoloRank { tier: "MASTER".into(), division: String::new() }));
    }

    #[test]
    fn unranked_and_missing_queues_give_none() {
        assert_eq!(parse(&json!({ "queueMap": { "RANKED_SOLO_5x5": { "tier": "", "division": "NA" } } })), None);
        assert_eq!(parse(&json!({ "queueMap": { "RANKED_SOLO_5x5": { "tier": "NONE", "division": "NA" } } })), None);
        assert_eq!(parse(&json!({ "queueMap": { "RANKED_FLEX_SR": { "tier": "GOLD", "division": "I" } } })), None);
        assert_eq!(parse(&json!({})), None);
    }
}
