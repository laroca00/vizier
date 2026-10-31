mod lcu;

use lcu::champ_select::ChampSelect;
use lcu::{ChampSelectState, LcuState, LcuStatus};

#[tauri::command]
fn lcu_status(state: tauri::State<'_, LcuState>) -> LcuStatus {
    state.current()
}

#[tauri::command]
fn champ_select(state: tauri::State<'_, ChampSelectState>) -> Option<ChampSelect> {
    state.current()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(LcuState::default())
        .manage(ChampSelectState::default())
        .invoke_handler(tauri::generate_handler![lcu_status, champ_select])
        .setup(|app| {
            lcu::spawn(app.handle().clone());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
