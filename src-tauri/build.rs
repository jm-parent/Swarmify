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
            "images_dir",
            "import_image",
            "save_image_bytes",
            "save_sanitized_svg",
            "copy_image_file",
            "purge_unused_images",
            "list_workspaces",
            "create_workspace",
            "rename_workspace",
            "mark_opened",
            "delete_workspace",
        ])),
    )
    .expect("échec de la génération des permissions Tauri");
}
