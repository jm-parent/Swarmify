mod persistence;
mod pty;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let db = persistence::init(app.handle()).map_err(|e| -> Box<dyn std::error::Error> { e.into() })?;
            app.manage(db);
            app.manage(pty::PtyState::default());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            persistence::load_board,
            persistence::save_board,
            persistence::write_text_file,
            persistence::read_text_file,
            pty::pty_spawn,
            pty::pty_write,
            pty::pty_resize,
            pty::pty_kill,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
