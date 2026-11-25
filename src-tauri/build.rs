fn main() {
    tauri_build::try_build(
        tauri_build::Attributes::new().app_manifest(tauri_build::AppManifest::new().commands(&[
            "load_board",
            "save_board",
            "write_text_file",
            "read_text_file",
            "pty_spawn",
            "pty_write",
            "pty_resize",
            "pty_kill",
            "detect_clis",
        ])),
    )
    .expect("échec de la génération des permissions Tauri");
}
