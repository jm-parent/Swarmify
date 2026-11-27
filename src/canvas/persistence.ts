import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { useBoardStore } from "./boardStore";
import { parseBoard, serializeBoard } from "./boardFile";
import { errorMessage, imagesFolderFor, importImageAsset, joinImagePath } from "./images";
import { useImportNotice } from "./ImportNotice";
import type { BoardNode, ImageAsset } from "./types";

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

// Images référencées par un nœud, quel que soit son type : un nœud d'un autre type peut porter une image.
function referencedImages(nodes: BoardNode[]): ImageAsset[] {
  return nodes.flatMap((node) => {
    const image = node.data.image;
    return image && typeof image.file === "string" ? [image] : [];
  });
}

// Ne garde que les images référencées par le board : appelée uniquement pour un board lu et parsé (R13).
function purgeUnusedImages(nodes: BoardNode[]): void {
  const referenced = referencedImages(nodes).map((image) => image.file);
  invoke("purge_unused_images", { referenced }).catch((err) =>
    console.error("Nettoyage des images inutilisées impossible :", err),
  );
}

// Restaure le board sauvegardé, puis sauvegarde chaque modification (débouncée).
export async function restoreAndAutosave(): Promise<void> {
  if (started) return;
  started = true;

  let loaded: BoardNode[] | undefined;
  try {
    const saved = await invoke<string | null>("load_board");
    if (saved) {
      const nodes = parseBoard(saved);
      useBoardStore.setState({ nodes, past: [], future: [] });
      loaded = nodes;
    }
  } catch (err) {
    console.error("Chargement du board impossible, board par défaut affiché :", err);
  }

  useBoardStore.subscribe((state, prev) => {
    if (state.nodes !== prev.nodes) scheduleSave(state.nodes);
  });
  window.addEventListener("beforeunload", flushSave);

  // Sans attente : un appel IPC bloqué ne retarde pas l'autosave.
  if (loaded) purgeUnusedImages(loaded);
}

export async function exportBoard(): Promise<void> {
  const path = await save({
    defaultPath: "board.json",
    filters: [{ name: "Board", extensions: ["json"] }],
  });
  if (!path) return;
  const nodes = useBoardStore.getState().nodes;
  await invoke("write_text_file", { path, contents: serializeBoard(nodes) });

  // Une même image peut être référencée par plusieurs cartes (collage) : on la copie une fois.
  const images = new Map<string, string>();
  for (const image of referencedImages(nodes)) images.set(image.file, image.originalName);
  const folder = imagesFolderFor(path);
  const errors: string[] = [];
  for (const [file, originalName] of images) {
    try {
      await invoke("copy_image_file", { file, destPath: joinImagePath(folder, file) });
    } catch (err) {
      errors.push(`${originalName} : ${errorMessage(err)}`);
    }
  }
  if (errors.length > 0) useImportNotice.getState().show(errors);
}

export async function importBoard(): Promise<void> {
  const path = await open({
    multiple: false,
    filters: [{ name: "Board", extensions: ["json"] }],
  });
  if (typeof path !== "string") return;
  const parsed = parseBoard(await invoke<string>("read_text_file", { path }));

  // Une image absente du dossier voisin garde son nœud : elle s'affiche en état « introuvable ».
  const folder = imagesFolderFor(path);
  const errors: string[] = [];
  const nodes: BoardNode[] = [];
  for (const node of parsed) {
    const image = node.data.image;
    if (node.type !== "image" || !image) {
      nodes.push(node);
      continue;
    }
    try {
      const { asset } = await importImageAsset(joinImagePath(folder, image.file));
      nodes.push({
        ...node,
        data: {
          ...node.data,
          image: { ...asset, originalName: image.originalName, addedAt: image.addedAt },
        },
      });
    } catch (err) {
      errors.push(`${image.originalName} : ${errorMessage(err)}`);
      nodes.push(node);
    }
  }

  useBoardStore.getState().checkpoint();
  useBoardStore.setState({ nodes });
  if (errors.length > 0) useImportNotice.getState().show(errors);
}
