mod lcu;

use lcu::champ_select::ChampSelect;
use lcu::writes::{ItemBlock, RuneImport, RunePage};
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Manager, WindowEvent};
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

#[tauri::command]
async fn import_item_set(
    api: tauri::State<'_, LcuApi>,
    champion_id: i64,
    title: String,
    blocks: Vec<ItemBlock>,
) -> Result<(), String> {
    let client = api.get().ok_or(NOT_CONNECTED)?;
    lcu::writes::import_item_set(&client, champion_id, &title, &blocks).await
}

/// Passed by the autostart entry so a login start stays in the tray.
const MINIMIZED_ARG: &str = "--minimized";

fn show_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn setup_tray(app: &tauri::App) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "Vizier\u{2019}i aç", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Çıkış", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &quit])?;
    TrayIconBuilder::new()
        .icon(app.default_window_icon().cloned().expect("bundle has an icon"))
        .tooltip("Vizier")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => show_main_window(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                show_main_window(tray.app_handle());
            }
        })
        .build(app)?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![MINIMIZED_ARG]),
        ))
        .manage(LcuState::default())
        .manage(ChampSelectState::default())
        .manage(LcuApi::default())
        .invoke_handler(tauri::generate_handler![lcu_status, champ_select, import_runes, import_spells, import_item_set])
        .setup(|app| {
            setup_tray(app)?;
            if std::env::args().any(|arg| arg == MINIMIZED_ARG) {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                }
            }
            lcu::spawn(app.handle().clone());
            Ok(())
        })
        // Closing keeps Vizier in the tray so it can still react to champ select.
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
