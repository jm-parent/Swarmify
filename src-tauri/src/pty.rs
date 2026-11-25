use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};
use std::time::Duration;

use base64::{engine::general_purpose::STANDARD, Engine};
use portable_pty::{native_pty_system, ChildKiller, CommandBuilder, MasterPty, PtySize};
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};

// Regroupe la sortie PTY pour éviter un événement par lecture (~60 Hz max).
const FLUSH_INTERVAL: Duration = Duration::from_millis(16);
static NEXT_TOKEN: AtomicU64 = AtomicU64::new(1);

struct Session {
    token: u64,
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    killer: Box<dyn ChildKiller + Send + Sync>,
}

#[derive(Default)]
pub struct PtyState(Mutex<HashMap<String, Session>>);

#[derive(Clone, Serialize)]
struct OutputEvent {
    id: String,
    data: String,
}

#[derive(Clone, Serialize)]
struct ExitEvent {
    id: String,
    code: Option<u32>,
}

fn err<E: std::fmt::Display>(e: E) -> String {
    e.to_string()
}

fn kill_session(map: &mut HashMap<String, Session>, id: &str) {
    if let Some(mut session) = map.remove(id) {
        let _ = session.killer.kill();
    }
}

#[tauri::command]
pub fn pty_spawn(
    app: AppHandle,
    state: State<PtyState>,
    id: String,
    file: String,
    args: Vec<String>,
    cwd: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    {
        let mut map = state.0.lock().map_err(err)?;
        kill_session(&mut map, &id);
    }

    let pair = native_pty_system()
        .openpty(PtySize { rows, cols, pixel_width: 0, pixel_height: 0 })
        .map_err(err)?;

    let mut cmd = CommandBuilder::new(file);
    cmd.args(args);
    let cwd = if cwd.is_empty() {
        std::env::var("USERPROFILE").unwrap_or_default()
    } else {
        cwd
    };
    if !cwd.is_empty() {
        cmd.cwd(cwd);
    }

    let mut child = pair.slave.spawn_command(cmd).map_err(err)?;
    let killer = child.clone_killer();
    drop(pair.slave);
    let mut reader = pair.master.try_clone_reader().map_err(err)?;
    let writer = pair.master.take_writer().map_err(err)?;

    let token = NEXT_TOKEN.fetch_add(1, Ordering::SeqCst);
    state.0.lock().map_err(err)?.insert(
        id.clone(),
        Session { token, master: pair.master, writer, killer },
    );

    let buffer: Arc<Mutex<Vec<u8>>> = Arc::new(Mutex::new(Vec::new()));
    let done = Arc::new(AtomicBool::new(false));

    let emitter: JoinHandle<()> = {
        let (app, id, buffer, done) = (app.clone(), id.clone(), buffer.clone(), done.clone());
        thread::spawn(move || loop {
            thread::sleep(FLUSH_INTERVAL);
            let chunk = std::mem::take(&mut *buffer.lock().unwrap());
            if !chunk.is_empty() {
                let _ = app.emit("pty-output", OutputEvent { id: id.clone(), data: STANDARD.encode(chunk) });
            }
            if done.load(Ordering::SeqCst) && buffer.lock().unwrap().is_empty() {
                break;
            }
        })
    };

    let reader_thread: JoinHandle<()> = {
        let (buffer, done) = (buffer.clone(), done.clone());
        thread::spawn(move || {
            let mut chunk = [0u8; 8192];
            loop {
                match reader.read(&mut chunk) {
                    Ok(0) | Err(_) => break,
                    Ok(n) => buffer.lock().unwrap().extend_from_slice(&chunk[..n]),
                }
            }
            done.store(true, Ordering::SeqCst);
        })
    };

    // Attend la fin du shell, libère le PTY (EOF côté lecteur), puis signale la sortie.
    thread::spawn(move || {
        let code = child.wait().ok().map(|status| status.exit_code());
        let removed = {
            let state = app.state::<PtyState>();
            let mut map = match state.0.lock() {
                Ok(map) => map,
                Err(_) => return,
            };
            match map.get(&id) {
                Some(s) if s.token == token => map.remove(&id),
                _ => None,
            }
        };
        drop(removed);
        let _ = reader_thread.join();
        let _ = emitter.join();
        let _ = app.emit("pty-exit", ExitEvent { id, code });
    });

    Ok(())
}

#[tauri::command]
pub fn pty_write(state: State<PtyState>, id: String, data: String) -> Result<(), String> {
    let mut map = state.0.lock().map_err(err)?;
    let session = map.get_mut(&id).ok_or("Session terminale introuvable")?;
    session.writer.write_all(data.as_bytes()).map_err(err)?;
    session.writer.flush().map_err(err)
}

#[tauri::command]
pub fn pty_resize(state: State<PtyState>, id: String, cols: u16, rows: u16) -> Result<(), String> {
    let map = state.0.lock().map_err(err)?;
    let session = map.get(&id).ok_or("Session terminale introuvable")?;
    session
        .master
        .resize(PtySize { rows, cols, pixel_width: 0, pixel_height: 0 })
        .map_err(err)
}

#[tauri::command]
pub fn pty_kill(state: State<PtyState>, id: String) -> Result<(), String> {
    let mut map = state.0.lock().map_err(err)?;
    kill_session(&mut map, &id);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::mpsc;
    use std::time::Instant;

    // Vérifie le chemin ConPTY réel : spawn, lecture de la sortie, fin du processus.
    // Chaque attente a un délai maximal pour échouer au lieu de bloquer.
    #[test]
    fn conpty_lit_la_sortie_du_shell() {
        let pair = native_pty_system()
            .openpty(PtySize { rows: 24, cols: 120, pixel_width: 0, pixel_height: 0 })
            .unwrap();
        let mut cmd = CommandBuilder::new("cmd.exe");
        cmd.args(["/c", "echo conpty-ok"]);
        let mut child = pair.slave.spawn_command(cmd).unwrap();
        drop(pair.slave);

        let mut reader = pair.master.try_clone_reader().unwrap();
        let (tx, rx) = mpsc::channel::<Vec<u8>>();
        thread::spawn(move || {
            let mut chunk = [0u8; 1024];
            loop {
                match reader.read(&mut chunk) {
                    Ok(0) | Err(_) => break,
                    Ok(n) => {
                        if tx.send(chunk[..n].to_vec()).is_err() {
                            break;
                        }
                    }
                }
            }
        });

        let mut writer = pair.master.take_writer().unwrap();
        let mut output = Vec::new();
        let mut answered_cursor_query = false;
        let deadline = Instant::now() + Duration::from_secs(15);
        let status = loop {
            while let Ok(bytes) = rx.try_recv() {
                output.extend_from_slice(&bytes);
            }
            // ConPTY attend la réponse à ESC[6n avant de lancer le programme (comme xterm.js).
            if !answered_cursor_query && output.windows(4).any(|w| w == b"\x1b[6n") {
                writer.write_all(b"\x1b[1;1R").unwrap();
                answered_cursor_query = true;
            }
            if let Some(status) = child.try_wait().unwrap() {
                break status;
            }
            assert!(Instant::now() < deadline, "le shell ne s'est pas terminé (sortie: {:?})", String::from_utf8_lossy(&output));
            thread::sleep(Duration::from_millis(20));
        };

        drop(pair.master);
        while let Ok(bytes) = rx.recv_timeout(Duration::from_secs(5)) {
            output.extend_from_slice(&bytes);
        }

        assert!(String::from_utf8_lossy(&output).contains("conpty-ok"));
        assert_eq!(status.exit_code(), 0);
    }
}
