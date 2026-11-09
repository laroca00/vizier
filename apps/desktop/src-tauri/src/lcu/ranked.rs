use serde::Deserialize;
use serde_json::Value;

use super::LcuClient;

const RANKED_STATS: &str = "/lol-ranked/v1/current-ranked-stats";
const SOLO_QUEUE: &str = "RANKED_SOLO_5x5";

#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct RawQueue {
    #[serde(default)]
    queue_type: String,
    #[serde(default)]
    tier: String,
}

/// Solo queue tier in upper case (`GOLD`, `MASTER`...); none when unranked or the data is odd.
/// Only the tier is read: no LP, no division, nothing that identifies the account.
pub fn solo_tier(stats: &Value) -> Option<String> {
    let queue = stats["queueMap"].get(SOLO_QUEUE).cloned().and_then(|q| serde_json::from_value::<RawQueue>(q).ok()).or_else(|| {
        serde_json::from_value::<Vec<RawQueue>>(stats["queues"].clone()).ok()?.into_iter().find(|q| q.queue_type == SOLO_QUEUE)
    })?;
    let tier = queue.tier.to_uppercase();
    matches!(
        tier.as_str(),
        "IRON" | "BRONZE" | "SILVER" | "GOLD" | "PLATINUM" | "EMERALD" | "DIAMOND" | "MASTER" | "GRANDMASTER" | "CHALLENGER"
    )
    .then_some(tier)
}

/// The player's own solo queue tier from the client.
pub async fn current(api: &LcuClient) -> Result<Option<String>, String> {
    let stats: Value = api.get(RANKED_STATS).await.map_err(|e| e.to_string())?;
    Ok(solo_tier(&stats))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn reads_the_solo_tier_from_the_queue_map() {
        let stats = json!({
            "queueMap": {
                "RANKED_SOLO_5x5": { "tier": "PLATINUM", "division": "II", "leaguePoints": 40, "wins": 10 },
                "RANKED_FLEX_SR": { "tier": "GOLD" }
            },
            "puuid": "secret"
        });
        assert_eq!(solo_tier(&stats).as_deref(), Some("PLATINUM"));
    }

    #[test]
    fn falls_back_to_the_queue_list() {
        let stats = json!({ "queues": [{ "queueType": "RANKED_FLEX_SR", "tier": "GOLD" }, { "queueType": "RANKED_SOLO_5x5", "tier": "emerald" }] });
        assert_eq!(solo_tier(&stats).as_deref(), Some("EMERALD"));
    }

    #[test]
    fn unranked_and_odd_data_give_none() {
        assert_eq!(solo_tier(&json!({ "queueMap": { "RANKED_SOLO_5x5": { "tier": "" } } })), None);
        assert_eq!(solo_tier(&json!({ "queueMap": { "RANKED_SOLO_5x5": { "tier": "NA" } } })), None);
        assert_eq!(solo_tier(&json!({ "queueMap": { "RANKED_FLEX_SR": { "tier": "GOLD" } } })), None);
        assert_eq!(solo_tier(&json!({})), None);
    }
}
