use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use rusqlite::{params, Connection, OptionalExtension};
use tauri::{AppHandle, Manager, State};

pub struct Db(pub Mutex<Connection>);

const SCHEMA: &str = "CREATE TABLE IF NOT EXISTS board (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    data TEXT NOT NULL,
    updated_at INTEGER NOT NULL
);";

pub fn open_db(dir: &Path) -> Result<Connection, String> {
    std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    let conn = Connection::open(dir.join("board.sqlite")).map_err(|e| e.to_string())?;
    conn.execute_batch(SCHEMA).map_err(|e| e.to_string())?;
    Ok(conn)
}

pub fn load(conn: &Connection) -> Result<Option<String>, String> {
    conn.query_row("SELECT data FROM board WHERE id = 1", [], |row| row.get(0))
        .optional()
        .map_err(|e| e.to_string())
}

pub fn save(conn: &Connection, data: &str) -> Result<(), String> {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis() as i64;
    conn.execute(
        "INSERT INTO board (id, data, updated_at) VALUES (1, ?1, ?2)
         ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at",
        params![data, now],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn load_board(db: State<Db>) -> Result<Option<String>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    load(&conn)
}

#[tauri::command]
pub fn save_board(db: State<Db>, data: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    save(&conn, &data)
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

    #[test]
    fn enregistre_puis_recharge_le_board() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(SCHEMA).unwrap();
        assert_eq!(load(&conn).unwrap(), None);

        save(&conn, r#"{"version":1,"nodes":[]}"#).unwrap();
        save(&conn, r#"{"version":1,"nodes":[{"id":"a"}]}"#).unwrap();

        assert_eq!(load(&conn).unwrap().as_deref(), Some(r#"{"version":1,"nodes":[{"id":"a"}]}"#));
    }
}
