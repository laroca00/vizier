use reqwest::Method;
use serde::{Deserialize, Serialize};
use serde_json::json;

use super::LcuClient;

const PAGES_PATH: &str = "/lol-perks/v1/pages";
const INVENTORY_PATH: &str = "/lol-perks/v1/inventory";
const MY_SELECTION_PATH: &str = "/lol-champ-select/v1/session/my-selection";
/// Pages Vizier writes carry this prefix; every other page belongs to the player.
pub const PAGE_PREFIX: &str = "Vizier";

#[derive(Deserialize, Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct RunePage {
    pub name: String,
    pub primary_style_id: i64,
    pub sub_style_id: i64,
    pub selected_perk_ids: Vec<i64>,
}

#[derive(Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
struct ExistingPage {
    id: i64,
    name: String,
    #[serde(default)]
    is_editable: bool,
    #[serde(default)]
    is_deletable: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Inventory {
    owned_page_count: usize,
}

#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct PageChoice {
    pub id: i64,
    pub name: String,
}

#[derive(Serialize, Debug, PartialEq)]
#[serde(tag = "status", rename_all = "camelCase")]
pub enum RuneImport {
    Imported,
    /// Every slot holds one of the player's pages; they pick which to replace.
    NeedsSlot { pages: Vec<PageChoice> },
}

#[derive(Debug, PartialEq)]
enum Target {
    Overwrite(i64),
    Create,
    Ask(Vec<PageChoice>),
}

fn choose_target(pages: &[ExistingPage], owned_slots: usize, replace: Option<i64>) -> Target {
    // Preset pages are neither editable nor deletable and don't use a slot.
    let custom: Vec<&ExistingPage> = pages.iter().filter(|p| p.is_editable && p.is_deletable).collect();
    if let Some(id) = replace.filter(|id| custom.iter().any(|p| p.id == *id)) {
        return Target::Overwrite(id);
    }
    if let Some(ours) = custom.iter().find(|p| p.name.starts_with(PAGE_PREFIX)) {
        return Target::Overwrite(ours.id);
    }
    if custom.len() < owned_slots {
        return Target::Create;
    }
    Target::Ask(custom.iter().map(|p| PageChoice { id: p.id, name: p.name.clone() }).collect())
}

pub async fn import_runes(api: &LcuClient, page: &RunePage, replace: Option<i64>) -> Result<RuneImport, String> {
    if !page.name.starts_with(PAGE_PREFIX) {
        return Err("rune page name must start with Vizier".into());
    }
    let pages: Vec<ExistingPage> = api.get(PAGES_PATH).await.map_err(|e| e.to_string())?;
    let inventory: Inventory = api.get(INVENTORY_PATH).await.map_err(|e| e.to_string())?;
    let mut body = json!({
        "name": page.name,
        "primaryStyleId": page.primary_style_id,
        "subStyleId": page.sub_style_id,
        "selectedPerkIds": page.selected_perk_ids,
        "current": true,
    });
    match choose_target(&pages, inventory.owned_page_count, replace) {
        Target::Overwrite(id) => {
            body["id"] = json!(id);
            api.send(Method::PUT, &format!("{PAGES_PATH}/{id}"), &body).await.map_err(|e| e.to_string())?;
        }
        Target::Create => api.send(Method::POST, PAGES_PATH, &body).await.map_err(|e| e.to_string())?,
        Target::Ask(pages) => return Ok(RuneImport::NeedsSlot { pages }),
    }
    Ok(RuneImport::Imported)
}

#[derive(Deserialize, Clone, Debug)]
pub struct ItemBlock {
    pub title: String,
    pub items: Vec<i64>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CurrentSummoner {
    summoner_id: i64,
}

/// Replaces our set for `champion_id` inside the player's item set document
/// and leaves every other set, including other apps', as it was.
fn merge_item_set(mut document: serde_json::Value, champion_id: i64, title: &str, blocks: &[ItemBlock], uid: &str) -> serde_json::Value {
    let ours = |set: &serde_json::Value| {
        set["title"].as_str().is_some_and(|t| t.starts_with(PAGE_PREFIX))
            && set["associatedChampions"].as_array().is_some_and(|c| c.iter().any(|id| id.as_i64() == Some(champion_id)))
    };
    let mut sets: Vec<serde_json::Value> = document["itemSets"].as_array().cloned().unwrap_or_default();
    sets.retain(|set| !ours(set));
    sets.push(json!({
        "uid": uid,
        "title": title,
        "type": "custom",
        "map": "any",
        "mode": "any",
        "associatedMaps": [11],
        "associatedChampions": [champion_id],
        "blocks": blocks.iter().map(|b| json!({
            "type": b.title,
            "items": b.items.iter().map(|id| json!({ "id": id.to_string(), "count": 1 })).collect::<Vec<_>>(),
        })).collect::<Vec<_>>(),
        "preferredItemSlots": [],
        "sortrank": 0,
        "startedFrom": "blank",
    }));
    document["itemSets"] = json!(sets);
    document
}

pub async fn import_item_set(api: &LcuClient, champion_id: i64, title: &str, blocks: &[ItemBlock]) -> Result<(), String> {
    if !title.starts_with(PAGE_PREFIX) {
        return Err("item set title must start with Vizier".into());
    }
    let summoner: CurrentSummoner = api.get("/lol-summoner/v1/current-summoner").await.map_err(|e| e.to_string())?;
    let path = format!("/lol-item-sets/v1/item-sets/{}/sets", summoner.summoner_id);
    let document: serde_json::Value = api.get(&path).await.map_err(|e| e.to_string())?;
    let uid = format!("vizier-{champion_id}");
    let merged = merge_item_set(document, champion_id, title, blocks, &uid);
    api.send(Method::PUT, &path, &merged).await.map_err(|e| e.to_string())
}

pub async fn import_spells(api: &LcuClient, spells: [i64; 2]) -> Result<(), String> {
    let body = json!({ "spell1Id": spells[0], "spell2Id": spells[1] });
    api.send(Method::PATCH, MY_SELECTION_PATH, &body).await.map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn page(id: i64, name: &str) -> ExistingPage {
        ExistingPage { id, name: name.into(), is_editable: true, is_deletable: true }
    }

    fn preset(id: i64) -> ExistingPage {
        ExistingPage { id, name: "Domination".into(), is_editable: false, is_deletable: false }
    }

    #[test]
    fn reuses_the_vizier_page() {
        let pages = [preset(1), page(2, "My Ahri"), page(3, "Vizier Ahri")];
        assert_eq!(choose_target(&pages, 2, None), Target::Overwrite(3));
    }

    #[test]
    fn creates_a_page_when_a_slot_is_free() {
        let pages = [preset(1), page(2, "My Ahri")];
        assert_eq!(choose_target(&pages, 2, None), Target::Create);
    }

    #[test]
    fn asks_before_touching_the_players_pages() {
        let pages = [preset(1), page(2, "My Ahri"), page(3, "Jungle")];
        assert_eq!(
            choose_target(&pages, 2, None),
            Target::Ask(vec![PageChoice { id: 2, name: "My Ahri".into() }, PageChoice { id: 3, name: "Jungle".into() }])
        );
        assert_eq!(choose_target(&pages, 2, Some(3)), Target::Overwrite(3));
    }

    #[test]
    fn item_sets_keep_other_sets() {
        let document = json!({
            "accountId": 1,
            "timestamp": 5,
            "itemSets": [
                { "title": "Vizier Ahri", "associatedChampions": [103] },
                { "title": "My Ahri", "associatedChampions": [103] },
                { "title": "Vizier Zed", "associatedChampions": [238] },
                { "title": "Other app", "associatedChampions": [] }
            ]
        });
        let blocks = [ItemBlock { title: "Core".into(), items: vec![3157, 3020] }];
        let merged = merge_item_set(document, 103, "Vizier Ahri", &blocks, "vizier-103");
        let titles: Vec<&str> = merged["itemSets"].as_array().unwrap().iter().map(|s| s["title"].as_str().unwrap()).collect();
        assert_eq!(titles, ["My Ahri", "Vizier Zed", "Other app", "Vizier Ahri"]);
        assert_eq!(merged["accountId"], 1);
        assert_eq!(merged["itemSets"][3]["blocks"][0]["items"][1]["id"], "3020");
    }

    #[test]
    fn never_replaces_a_preset_page() {
        let pages = [preset(1), page(2, "Mine")];
        assert_eq!(choose_target(&pages, 1, Some(1)), Target::Ask(vec![PageChoice { id: 2, name: "Mine".into() }]));
    }
}
