import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { useBoardStore } from "./boardStore";
import { parseBoard, serializeBoard } from "./boardFile";
import type { BoardNode } from "./types";

const SAVE_DEBOUNCE_MS = 500;

let started = false;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let pendingNodes: BoardNode[] | undefined;

function flushSave() {
  if (saveTimer !== undefined) clearTimeout(saveTimer);
  saveTimer = undefined;
  if (!pendingNodes) return;
  const nodes = pendingNodes;
  pendingNodes = undefined;
  invoke("save_board", { data: serializeBoard(nodes) }).catch((err) =>
    console.error("Sauvegarde du board impossible :", err),
  );
}

function scheduleSave(nodes: BoardNode[]) {
  pendingNodes = nodes;
  if (saveTimer !== undefined) clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSave, SAVE_DEBOUNCE_MS);
}

// Restaure le board sauvegardé, puis sauvegarde chaque modification (débouncée).
export async function restoreAndAutosave(): Promise<void> {
  if (started) return;
  started = true;

  try {
    const saved = await invoke<string | null>("load_board");
    if (saved) useBoardStore.setState({ nodes: parseBoard(saved), past: [], future: [] });
  } catch (err) {
    console.error("Chargement du board impossible, board par défaut affiché :", err);
  }

  useBoardStore.subscribe((state, prev) => {
    if (state.nodes !== prev.nodes) scheduleSave(state.nodes);
  });
  window.addEventListener("beforeunload", flushSave);
}

export async function exportBoard(): Promise<void> {
  const path = await save({
    defaultPath: "board.json",
    filters: [{ name: "Board", extensions: ["json"] }],
  });
  if (!path) return;
  await invoke("write_text_file", { path, contents: serializeBoard(useBoardStore.getState().nodes) });
}

export async function importBoard(): Promise<void> {
  const path = await open({
    multiple: false,
    filters: [{ name: "Board", extensions: ["json"] }],
  });
  if (typeof path !== "string") return;
  const nodes = parseBoard(await invoke<string>("read_text_file", { path }));
  useBoardStore.getState().checkpoint();
  useBoardStore.setState({ nodes });
}
