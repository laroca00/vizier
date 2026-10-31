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
    fn never_replaces_a_preset_page() {
        let pages = [preset(1), page(2, "Mine")];
        assert_eq!(choose_target(&pages, 1, Some(1)), Target::Ask(vec![PageChoice { id: 2, name: "Mine".into() }]));
    }
}
