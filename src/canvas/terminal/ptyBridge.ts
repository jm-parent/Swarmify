import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { LaunchSpec } from "./launch";

interface OutputPayload {
  id: string;
  data: string;
}

interface ExitPayload {
  id: string;
  code: number | null;
}

export function ptySpawn(id: string, spec: LaunchSpec, cwd: string, cols: number, rows: number) {
  return invoke<void>("pty_spawn", { id, file: spec.file, args: spec.args, cwd, cols, rows });
}

export function ptyWrite(id: string, data: string) {
  return invoke<void>("pty_write", { id, data });
}

export function ptyResize(id: string, cols: number, rows: number) {
  return invoke<void>("pty_resize", { id, cols, rows });
}

export function ptyKill(id: string) {
  return invoke<void>("pty_kill", { id });
}

// Les sorties arrivent encodées en base64 ; on les décode en octets pour xterm.
export function onPtyOutput(id: string, cb: (bytes: Uint8Array) => void): Promise<UnlistenFn> {
  return listen<OutputPayload>("pty-output", (event) => {
    if (event.payload.id !== id) return;
    const binary = atob(event.payload.data);
    cb(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
  });
}

export function onPtyExit(id: string, cb: (code: number | null) => void): Promise<UnlistenFn> {
  return listen<ExitPayload>("pty-exit", (event) => {
    if (event.payload.id === id) cb(event.payload.code);
  });
}
