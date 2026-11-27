use std::fs;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;
use tauri::{AppHandle, Manager, State};

use crate::images::{app_images_dir, copy_legacy_images, remove_files};
use crate::persistence::{self, Db};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Workspace {
    pub id: String,
    pub name: String,
    pub folder: String,
    pub created_at: i64,
    pub last_opened_at: Option<i64>,
    pub folder_exists: bool,
}

pub fn valid_id(id: &str) -> Result<(), String> {
    if id.len() == 36 && id.chars().all(|c| matches!(c, '0'..='9' | 'a'..='f' | '-')) {
        Ok(())
    } else {
        Err("Identifiant de workspace invalide".to_string())
    }
}

pub fn validate_name(name: &str) -> Result<String, String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        Err("Le nom ne peut pas être vide".to_string())
    } else {
        Ok(trimmed.to_string())
    }
}

pub fn validate_folder(path: &str) -> Result<(), String> {
    if folder_exists(path) {
        Ok(())
    } else {
        Err("Dossier introuvable".to_string())
    }
}

pub fn folder_exists(path: &str) -> bool {
    Path::new(path).is_dir()
}

pub fn insert(conn: &Connection, ws: &Workspace) -> Result<(), String> {
    conn.execute(
        "INSERT INTO workspaces (id, name, folder, created_at, last_opened_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![ws.id, ws.name, ws.folder, ws.created_at, ws.last_opened_at],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn list(conn: &Connection) -> Result<Vec<Workspace>, String> {
    let mut stmt = conn
        .prepare("SELECT id, name, folder, created_at, last_opened_at FROM workspaces ORDER BY created_at")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(Workspace {
                id: row.get(0)?,
                name: row.get(1)?,
                folder: row.get(2)?,
                created_at: row.get(3)?,
                last_opened_at: row.get(4)?,
                folder_exists: false,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.map(|row| {
        row.map(|mut ws| {
            ws.folder_exists = folder_exists(&ws.folder);
            ws
        })
        .map_err(|e| e.to_string())
    })
    .collect()
}

pub fn exists(conn: &Connection, id: &str) -> Result<bool, String> {
    conn.query_row("SELECT 1 FROM workspaces WHERE id = ?1", params![id], |_| Ok(()))
        .optional()
        .map(|found| found.is_some())
        .map_err(|e| e.to_string())
}

pub fn rename(conn: &Connection, id: &str, name: &str) -> Result<(), String> {
    conn.execute("UPDATE workspaces SET name = ?2 WHERE id = ?1", params![id, name])
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn set_last_opened(conn: &Connection, id: &str, now: i64) -> Result<(), String> {
    conn.execute(
        "UPDATE workspaces SET last_opened_at = ?2 WHERE id = ?1",
        params![id, now],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn delete(conn: &Connection, id: &str) -> Result<(), String> {
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM workspace_board WHERE workspace_id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM workspaces WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())
}

fn now_ms() -> Result<i64, String> {
    Ok(SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis() as i64)
}

fn workspace_dir(app: &AppHandle, id: &str) -> Result<PathBuf, String> {
    let root = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(root.join("workspaces").join(id))
}

fn remove_workspace_dir(app: &AppHandle, id: &str) {
    if let Ok(dir) = workspace_dir(app, id) {
        let _ = fs::remove_dir_all(dir);
    }
}

#[tauri::command]
pub fn list_workspaces(db: State<Db>) -> Result<Vec<Workspace>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    list(&conn)
}

#[tauri::command]
pub fn create_workspace(
    app: AppHandle,
    db: State<Db>,
    id: String,
    folder: String,
    name: String,
) -> Result<Workspace, String> {
    valid_id(&id)?;
    validate_folder(&folder)?;
    let name = validate_name(&name)?;
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let adopting = list(&conn)?.is_empty() && persistence::load_legacy(&conn)?.is_some();
    let ws = Workspace {
        id: id.clone(),
        name,
        folder,
        created_at: now_ms()?,
        last_opened_at: None,
        folder_exists: true,
    };

    let copied = if adopting {
        let copy = app_images_dir(&app, &id).and_then(|dest| copy_legacy_images(&app_data, &dest));
        match copy {
            Ok(copied) => copied,
            Err(e) => {
                remove_workspace_dir(&app, &id);
                return Err(e);
            }
        }
    } else {
        Vec::new()
    };

    if let Err(e) = persistence::create_with_legacy(&conn, &ws) {
        if adopting {
            remove_workspace_dir(&app, &id);
        }
        return Err(e);
    }

    if adopting {
        let legacy: Vec<PathBuf> = copied
            .iter()
            .filter_map(|path| path.file_name())
            .map(|file| app_data.join("images").join(file))
            .collect();
        remove_files(&legacy);
    }
    Ok(ws)
}

#[tauri::command]
pub fn rename_workspace(db: State<Db>, id: String, name: String) -> Result<(), String> {
    valid_id(&id)?;
    let name = validate_name(&name)?;
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    rename(&conn, &id, &name)
}

#[tauri::command]
pub fn mark_opened(db: State<Db>, id: String) -> Result<(), String> {
    valid_id(&id)?;
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    set_last_opened(&conn, &id, now_ms()?)
}

#[tauri::command]
pub fn delete_workspace(app: AppHandle, db: State<Db>, id: String) -> Result<(), String> {
    valid_id(&id)?;
    {
        let conn = db.0.lock().map_err(|e| e.to_string())?;
        delete(&conn, &id)?;
    }
    match fs::remove_dir_all(workspace_dir(&app, &id)?) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == ErrorKind::NotFound => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

#[cfg(test)]
pub(crate) mod test_support {
    use rusqlite::Connection;

    use super::Workspace;
    use crate::persistence;

    pub(crate) fn memory_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(persistence::SCHEMA).unwrap();
        conn
    }

    pub(crate) fn ws(id: &str, name: &str, folder: &str) -> Workspace {
        Workspace {
            id: id.to_string(),
            name: name.to_string(),
            folder: folder.to_string(),
            created_at: 0,
            last_opened_at: None,
            folder_exists: false,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::test_support::{memory_db, ws};
    use super::*;

    #[test]
    fn valid_id_rejects_path_like_values() {
        assert!(valid_id("550e8400-e29b-41d4-a716-446655440000").is_ok());
        assert!(valid_id("..\\evil").is_err());
        assert!(valid_id("C:\\Users").is_err());
    }

    #[test]
    fn validate_name_refuses_blank() {
        assert!(validate_name("   ").is_err());
        assert_eq!(validate_name("  Projet  ").unwrap(), "Projet");
    }

    #[test]
    fn folder_exists_detects_missing_folder() {
        assert!(!folder_exists("C:\\dossier\\inexistant"));
        assert!(folder_exists(&std::env::temp_dir().to_string_lossy()));
    }

    #[test]
    fn folder_with_spaces_and_accents_round_trips() {
        let dir = std::env::temp_dir().join("Mes Projets Café");
        std::fs::create_dir_all(&dir).unwrap();
        let conn = memory_db();
        insert(&conn, &ws("550e8400-e29b-41d4-a716-446655440000", "Projet", &dir.to_string_lossy())).unwrap();
        assert_eq!(list(&conn).unwrap()[0].folder, dir.to_string_lossy());
    }

    #[test]
    fn rename_mark_opened_and_delete() {
        let id = "550e8400-e29b-41d4-a716-446655440000";
        let conn = memory_db();
        insert(&conn, &ws(id, "Projet", &std::env::temp_dir().to_string_lossy())).unwrap();

        rename(&conn, id, "Nouveau").unwrap();
        set_last_opened(&conn, id, 5).unwrap();
        let listed = list(&conn).unwrap();
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].name, "Nouveau");
        assert_eq!(listed[0].last_opened_at, Some(5));
        assert!(exists(&conn, id).unwrap());

        delete(&conn, id).unwrap();
        assert!(list(&conn).unwrap().is_empty());
        assert!(!exists(&conn, id).unwrap());
    }

    #[test]
    fn delete_removes_board_rows() {
        let id = "550e8400-e29b-41d4-a716-446655440000";
        let conn = memory_db();
        insert(&conn, &ws(id, "Projet", &std::env::temp_dir().to_string_lossy())).unwrap();
        conn.execute(
            "INSERT INTO workspace_board (workspace_id, data, updated_at) VALUES (?1, '{}', 0)",
            params![id],
        )
        .unwrap();

        delete(&conn, id).unwrap();

        let board_rows: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM workspace_board WHERE workspace_id = ?1",
                params![id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(board_rows, 0);
        assert!(!exists(&conn, id).unwrap());
    }
}
