mod images;
mod persistence;
mod pty;
mod workspaces;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .setup(|app| {
            let db = persistence::init(app.handle()).map_err(|e| -> Box<dyn std::error::Error> { e.into() })?;
            app.manage(db);
            app.manage(pty::PtyState::default());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            images::images_dir,
            images::import_image,
            images::save_image_bytes,
            images::save_sanitized_svg,
            images::copy_image_file,
            images::purge_unused_images,
            persistence::load_board,
            persistence::save_board,
            persistence::write_text_file,
            persistence::read_text_file,
            pty::pty_spawn,
            pty::pty_write,
            pty::pty_resize,
            pty::pty_kill,
            pty::detect_clis,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
