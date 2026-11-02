mod lcu;
mod live;

use lcu::champ_select::ChampSelect;
use lcu::writes::{ItemBlock, RuneImport, RunePage};
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Manager, WindowEvent};
use lcu::{ChampSelectState, LcuApi, LcuState, LcuStatus};
use live::{LiveGame, OverlayState};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

#[tauri::command]
fn lcu_status(state: tauri::State<'_, LcuState>) -> LcuStatus {
    state.current()
}

#[tauri::command]
fn champ_select(state: tauri::State<'_, ChampSelectState>) -> Option<ChampSelect> {
    state.current()
}

#[tauri::command]
fn live_game(state: tauri::State<'_, OverlayState>) -> Option<LiveGame> {
    state.current()
}

#[tauri::command]
fn live_loading(state: tauri::State<'_, OverlayState>) -> bool {
    state.loading.load(std::sync::atomic::Ordering::Relaxed)
}

#[tauri::command]
fn overlay_hidden(state: tauri::State<'_, OverlayState>) -> bool {
    state.hidden.load(std::sync::atomic::Ordering::Relaxed)
}

/// The settings live in the webview, so the main window reports the overlay switch here.
#[tauri::command]
fn set_overlay_enabled(app: tauri::AppHandle, state: tauri::State<'_, OverlayState>, enabled: bool) {
    state.set_enabled(&app, enabled);
}

#[tauri::command]
fn overlay_editing(state: tauri::State<'_, OverlayState>) -> bool {
    state.editing.load(std::sync::atomic::Ordering::Relaxed)
}

/// The overlay's own "Done" button ends editing without the shortcut.
#[tauri::command]
fn set_overlay_editing(app: tauri::AppHandle, editing: bool) {
    live::set_editing(&app, editing);
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

/// Ctrl+Shift+O hides and shows the overlay during a game.
fn overlay_shortcut() -> Shortcut {
    Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::KeyO)
}

/// Ctrl+Shift+L lets the player drag the overlay's boxes into place.
fn edit_shortcut() -> Shortcut {
    Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::KeyL)
}

/// Asks WebView2 to trim the main window's memory while it sits in the tray,
/// and to grow back once it is shown. Its scripts keep running either way,
/// so champ select still brings the window up.
#[cfg(windows)]
fn set_low_memory(window: &tauri::WebviewWindow, low: bool) {
    use webview2_com::Microsoft::Web::WebView2::Win32::{
        COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_LOW, COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_NORMAL, ICoreWebView2_19,
    };
    use windows_core::Interface;
    let _ = window.with_webview(move |webview| {
        // SAFETY: COM calls on the controller Tauri hands out on its own thread.
        unsafe {
            let Ok(core) = webview.controller().CoreWebView2() else { return };
            let Ok(core) = core.cast::<ICoreWebView2_19>() else { return };
            let level = if low { COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_LOW } else { COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_NORMAL };
            let _ = core.SetMemoryUsageTargetLevel(level);
        }
    });
}

#[cfg(not(windows))]
fn set_low_memory(_window: &tauri::WebviewWindow, _low: bool) {}

/// Manual timers on the overlay. They are registered only while a game runs,
/// so the combinations stay free in every other app.
const TIMER_SHORTCUTS: [(Code, &str); 12] = [
    (Code::Digit1, "blue"),
    (Code::Digit2, "red"),
    (Code::Digit3, "gromp"),
    (Code::Digit4, "wolves"),
    (Code::Digit5, "raptors"),
    (Code::Digit6, "krugs"),
    (Code::Digit7, "scuttle"),
    (Code::KeyD, "dragon"),
    (Code::KeyB, "baron"),
    (Code::KeyS, "stopwatch"),
    (Code::KeyT, "custom"),
    (Code::KeyX, "clear"),
];

fn timer_shortcut(code: Code) -> Shortcut {
    Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), code)
}

pub fn set_timer_shortcuts(app: &tauri::AppHandle, on: bool) {
    let shortcuts = app.global_shortcut();
    for (code, _) in TIMER_SHORTCUTS {
        let shortcut = timer_shortcut(code);
        let result = if on { shortcuts.register(shortcut) } else { shortcuts.unregister(shortcut) };
        if let Err(error) = result {
            eprintln!("timer shortcut: {error}");
        }
    }
}

/// Passed by the autostart entry so a login start stays in the tray.
const MINIMIZED_ARG: &str = "--minimized";

fn show_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        set_low_memory(&window, false);
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
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    if event.state != ShortcutState::Pressed {
                        return;
                    }
                    if *shortcut == overlay_shortcut() {
                        live::toggle_hidden(app);
                    } else if *shortcut == edit_shortcut() {
                        live::toggle_editing(app);
                    } else if let Some((_, timer)) = TIMER_SHORTCUTS.iter().find(|(code, _)| *shortcut == timer_shortcut(*code)) {
                        live::timer_pressed(app, timer);
                    }
                })
                .build(),
        )
        .manage(LcuApi::default())
        .manage(OverlayState::default())
        .invoke_handler(tauri::generate_handler![
            lcu_status,
            champ_select,
            import_runes,
            import_spells,
            import_item_set,
            live_game,
            live_loading,
            overlay_hidden,
            set_overlay_enabled,
            overlay_editing,
            set_overlay_editing
        ])
        .setup(|app| {
            setup_tray(app)?;
            if std::env::args().any(|arg| arg == MINIMIZED_ARG) {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                    set_low_memory(&window, true);
                }
            }
            lcu::spawn(app.handle().clone());
            live::spawn(app.handle().clone());
            // Another app may own the combination; the overlay still works without it.
            for shortcut in [overlay_shortcut(), edit_shortcut()] {
                if let Err(error) = app.global_shortcut().register(shortcut) {
                    eprintln!("overlay shortcut: {error}");
                }
            }
            Ok(())
        })
        // Closing keeps Vizier in the tray so it can still react to champ select.
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event
                && window.label() != live::OVERLAY_LABEL
            {
                api.prevent_close();
                let _ = window.hide();
                if let Some(webview) = window.app_handle().get_webview_window(window.label()) {
                    set_low_memory(&webview, true);
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
