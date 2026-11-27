import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { parseBoard, serializeBoard } from "./boardFile";
import type { BoardStore } from "./boardStore";
import { errorMessage, imagesFolderFor, importImageAsset, joinImagePath } from "./images";
import { useImportNotice } from "./ImportNotice";
import type { BoardNode, ImageAsset } from "./types";

const SAVE_DEBOUNCE_MS = 500;

// Images référencées par un nœud, quel que soit son type : un nœud d'un autre type peut porter une image.
function referencedImages(nodes: BoardNode[]): ImageAsset[] {
  return nodes.flatMap((node) => {
    const image = node.data.image;
    return image && typeof image.file === "string" ? [image] : [];
  });
}

// Ne garde que les images référencées par le board : appelée uniquement pour un board lu et parsé (R13).
function purgeUnusedImages(workspaceId: string, nodes: BoardNode[]): void {
  const referenced = referencedImages(nodes).map((image) => image.file);
  invoke("purge_unused_images", { workspaceId, referenced }).catch((err) =>
    console.error("Nettoyage des images inutilisées impossible :", err),
  );
}

// Le dossier courant du projet remplace le cwd des cartes agent ; les autres cartes sont renvoyées telles quelles.
export function withFolder(nodes: BoardNode[], folder: string): BoardNode[] {
  return nodes.map((node) =>
    node.type === "agent" && node.data.terminal
      ? { ...node, data: { ...node.data, terminal: { ...node.data.terminal, cwd: folder } } }
      : node,
  );
}

// Sauvegarde chaque modification du board (débouncée). Le retour annule la sauvegarde en attente sans l'écrire.
export function attachAutosave(store: BoardStore): () => void {
  const { workspaceId } = store.getState();
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  let pendingNodes: BoardNode[] | undefined;

  function flush() {
    if (saveTimer !== undefined) clearTimeout(saveTimer);
    saveTimer = undefined;
    if (!pendingNodes) return;
    const nodes = pendingNodes;
    pendingNodes = undefined;
    invoke("save_board", { workspaceId, data: serializeBoard(nodes) }).catch((err) =>
      console.error("Sauvegarde du board impossible :", err),
    );
  }

  function scheduleSave(nodes: BoardNode[]) {
    pendingNodes = nodes;
    if (saveTimer !== undefined) clearTimeout(saveTimer);
    saveTimer = setTimeout(flush, SAVE_DEBOUNCE_MS);
  }

  const unsubscribe = store.subscribe((state, prev) => {
    if (state.nodes !== prev.nodes) scheduleSave(state.nodes);
  });
  window.addEventListener("beforeunload", flush);

  return () => {
    unsubscribe();
    window.removeEventListener("beforeunload", flush);
    if (saveTimer !== undefined) clearTimeout(saveTimer);
    saveTimer = undefined;
    pendingNodes = undefined;
  };
}

// Board sauvegardé d'un workspace, prêt à être donné au store. undefined si rien n'est sauvegardé ; lève une erreur si le board existe mais ne se lit pas.
export async function loadWorkspaceNodes(workspaceId: string, folder: string): Promise<BoardNode[] | undefined> {
  let nodes: BoardNode[];
  try {
    const saved = await invoke<string | null>("load_board", { workspaceId });
    if (!saved) return undefined;
    nodes = withFolder(parseBoard(saved), folder);
  } catch (err) {
    throw new Error(`Chargement du board impossible : ${errorMessage(err)}`);
  }
  // Sans attente : un appel IPC bloqué ne retarde pas le chargement.
  purgeUnusedImages(workspaceId, nodes);
  return nodes;
}

export async function exportBoard(store: BoardStore): Promise<void> {
  const path = await save({
    defaultPath: "board.json",
    filters: [{ name: "Board", extensions: ["json"] }],
  });
  if (!path) return;
  const { workspaceId, nodes } = store.getState();
  await invoke("write_text_file", { path, contents: serializeBoard(nodes) });

  // Une même image peut être référencée par plusieurs cartes (collage) : on la copie une fois.
  const images = new Map<string, string>();
  for (const image of referencedImages(nodes)) images.set(image.file, image.originalName);
  const folder = imagesFolderFor(path);
  const errors: string[] = [];
  for (const [file, originalName] of images) {
    try {
      await invoke("copy_image_file", { workspaceId, file, destPath: joinImagePath(folder, file) });
    } catch (err) {
      errors.push(`${originalName} : ${errorMessage(err)}`);
    }
  }
  if (errors.length > 0) useImportNotice.getState().show(errors);
}

export async function importBoard(store: BoardStore): Promise<void> {
  const path = await open({
    multiple: false,
    filters: [{ name: "Board", extensions: ["json"] }],
  });
  if (typeof path !== "string") return;
  const parsed = parseBoard(await invoke<string>("read_text_file", { path }));
  const { workspaceId } = store.getState();

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
      const { asset } = await importImageAsset(workspaceId, joinImagePath(folder, image.file));
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

  store.getState().checkpoint();
  store.setState({ nodes });
  if (errors.length > 0) useImportNotice.getState().show(errors);
}
