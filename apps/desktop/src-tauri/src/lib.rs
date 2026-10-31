mod lcu;

use lcu::champ_select::ChampSelect;
use lcu::writes::{RuneImport, RunePage};
use lcu::{ChampSelectState, LcuApi, LcuState, LcuStatus};

#[tauri::command]
fn lcu_status(state: tauri::State<'_, LcuState>) -> LcuStatus {
    state.current()
}

#[tauri::command]
fn champ_select(state: tauri::State<'_, ChampSelectState>) -> Option<ChampSelect> {
    state.current()
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(LcuState::default())
        .manage(ChampSelectState::default())
        .manage(LcuApi::default())
        .invoke_handler(tauri::generate_handler![lcu_status, champ_select, import_runes, import_spells])
        .setup(|app| {
            lcu::spawn(app.handle().clone());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
