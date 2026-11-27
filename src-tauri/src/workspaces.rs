use std::path::Path;

use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;

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

pub fn mark_opened(conn: &Connection, id: &str, now: i64) -> Result<(), String> {
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
        mark_opened(&conn, id, 5).unwrap();
        let listed = list(&conn).unwrap();
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].name, "Nouveau");
        assert_eq!(listed[0].last_opened_at, Some(5));
        assert!(exists(&conn, id).unwrap());

        delete(&conn, id).unwrap();
        assert!(list(&conn).unwrap().is_empty());
        assert!(!exists(&conn, id).unwrap());
    }
}
