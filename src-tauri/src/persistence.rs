use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use rusqlite::{params, Connection, OptionalExtension};
use tauri::{AppHandle, Manager, State};

use crate::workspaces::{self, Workspace};

pub struct Db(pub Mutex<Connection>);

pub(crate) const SCHEMA: &str = "CREATE TABLE IF NOT EXISTS board (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    data TEXT NOT NULL,
    updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    folder TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    last_opened_at INTEGER
);
CREATE TABLE IF NOT EXISTS workspace_board (
    workspace_id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    updated_at INTEGER NOT NULL
);";

pub fn open_db(dir: &Path) -> Result<Connection, String> {
    std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    let conn = Connection::open(dir.join("board.sqlite")).map_err(|e| e.to_string())?;
    conn.execute_batch(SCHEMA).map_err(|e| e.to_string())?;
    Ok(conn)
}

pub fn read_board(conn: &Connection, workspace_id: &str) -> Result<Option<String>, String> {
    workspaces::valid_id(workspace_id)?;
    conn.query_row(
        "SELECT data FROM workspace_board WHERE workspace_id = ?1",
        params![workspace_id],
        |row| row.get(0),
    )
    .optional()
    .map_err(|e| e.to_string())
}

pub fn write_board(conn: &Connection, workspace_id: &str, data: &str, now: i64) -> Result<(), String> {
    workspaces::valid_id(workspace_id)?;
    if !workspaces::exists(conn, workspace_id)? {
        return Err("Workspace inconnu".to_string());
    }
    conn.execute(
        "INSERT INTO workspace_board (workspace_id, data, updated_at) VALUES (?1, ?2, ?3)
         ON CONFLICT(workspace_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at",
        params![workspace_id, data, now],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn load_legacy(conn: &Connection) -> Result<Option<String>, String> {
    conn.query_row("SELECT data FROM board WHERE id = 1", [], |row| row.get(0))
        .optional()
        .map_err(|e| e.to_string())
}

pub fn create_with_legacy(conn: &Connection, ws: &Workspace) -> Result<bool, String> {
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
    let legacy = load_legacy(&tx)?;
    let adopt = legacy.is_some() && workspaces::list(&tx)?.is_empty();
    workspaces::insert(&tx, ws)?;
    if let Some(data) = legacy.filter(|_| adopt) {
        tx.execute(
            "INSERT INTO workspace_board (workspace_id, data, updated_at) VALUES (?1, ?2, ?3)",
            params![ws.id, data, ws.created_at],
        )
        .map_err(|e| e.to_string())?;
        tx.execute("DELETE FROM board WHERE id = 1", [])
            .map_err(|e| e.to_string())?;
    }
    tx.commit().map_err(|e| e.to_string())?;
    Ok(adopt)
}

fn now_ms() -> Result<i64, String> {
    Ok(SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis() as i64)
}

#[tauri::command]
pub fn load_board(db: State<Db>, workspace_id: String) -> Result<Option<String>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    read_board(&conn, &workspace_id)
}

#[tauri::command]
pub fn save_board(db: State<Db>, workspace_id: String, data: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    write_board(&conn, &workspace_id, &data, now_ms()?)
}

#[tauri::command]
pub fn write_text_file(path: PathBuf, contents: String) -> Result<(), String> {
    std::fs::write(path, contents).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn read_text_file(path: PathBuf) -> Result<String, String> {
    std::fs::read_to_string(path).map_err(|e| e.to_string())
}

pub fn init(app: &AppHandle) -> Result<Db, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(Db(Mutex::new(open_db(&dir)?)))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::workspaces::test_support::{memory_db, ws};
    use crate::workspaces::{delete, insert};

    const A: &str = "550e8400-e29b-41d4-a716-446655440000";
    const B: &str = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

    #[test]
    fn isole_le_contenu_par_workspace() {
        let conn = memory_db();
        insert(&conn, &ws(A, "A", "C:\\a")).unwrap();
        insert(&conn, &ws(B, "B", "C:\\b")).unwrap();
        write_board(&conn, A, "{\"v\":\"a\"}", 1).unwrap();
        write_board(&conn, B, "{\"v\":\"b\"}", 2).unwrap();
        assert_eq!(read_board(&conn, A).unwrap().as_deref(), Some("{\"v\":\"a\"}"));
        assert_eq!(read_board(&conn, B).unwrap().as_deref(), Some("{\"v\":\"b\"}"));
    }

    #[test]
    fn save_board_rejects_deleted_workspace() {
        let conn = memory_db();
        insert(&conn, &ws(A, "A", "C:\\a")).unwrap();
        delete(&conn, A).unwrap();
        assert!(write_board(&conn, A, "{}", 3).is_err());
        assert_eq!(read_board(&conn, A).unwrap(), None);
    }

    #[test]
    fn create_with_legacy_adopts_board_once() {
        let conn = memory_db();
        conn.execute("INSERT INTO board (id, data, updated_at) VALUES (1, '{\"legacy\":true}', 0)", []).unwrap();
        assert!(create_with_legacy(&conn, &ws(A, "A", "C:\\a")).unwrap());
        assert_eq!(read_board(&conn, A).unwrap().as_deref(), Some("{\"legacy\":true}"));
        assert_eq!(load_legacy(&conn).unwrap(), None);
        assert!(!create_with_legacy(&conn, &ws(B, "B", "C:\\b")).unwrap());
    }
}
