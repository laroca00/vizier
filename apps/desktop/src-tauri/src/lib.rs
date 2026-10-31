mod lcu;

use lcu::{LcuState, LcuStatus};

#[tauri::command]
fn lcu_status(state: tauri::State<'_, LcuState>) -> LcuStatus {
    state.current()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(LcuState::default())
        .invoke_handler(tauri::generate_handler![lcu_status])
        .setup(|app| {
            lcu::spawn(app.handle().clone());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
