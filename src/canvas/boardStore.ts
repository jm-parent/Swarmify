import { create } from "zustand";
import type { NodeChangeset, XYPosition } from "@xyflow/react";
import type { BoardNode, CardType, ImageAsset } from "./types";

const HISTORY_LIMIT = 100;
const PASTE_OFFSET = 40;

export function createCard(type: CardType, position: XYPosition): BoardNode {
  const base = { id: crypto.randomUUID(), type, position, selected: false };
  if (type === "note") {
    return {
      ...base,
      width: 280,
      height: 200,
      data: { title: "Note", status: "idle", body: "" },
    };
  }
  if (type === "agent") {
    return {
      ...base,
      width: 560,
      height: 380,
      data: {
        title: "Agent",
        status: "idle",
        terminal: { shell: "powershell", preset: "copilot", cwd: "", sessionId: crypto.randomUUID() },
      },
    };
  }
  return {
    ...base,
    width: 280,
    height: 260,
    data: { title: "Kanban", status: "idle", items: [] },
  };
}

function seedNodes(): BoardNode[] {
  const note = createCard("note", { x: 0, y: 0 });
  note.data = { ...note.data, title: "Bienvenue", body: "# Swarmify\n\nGlisse, zoome, ajoute des cartes." };
  const kanban = createCard("kanban", { x: 340, y: 0 });
  kanban.data = {
    ...kanban.data,
    title: "Tâches",
    items: [{ id: crypto.randomUUID(), text: "Socle canvas", done: true }],
  };
  return [note, kanban];
}

export interface BoardState {
  nodes: BoardNode[];
  past: BoardNode[][];
  future: BoardNode[][];
  clipboard: BoardNode[];
  onNodesChange: (changes: NodeChangeset<BoardNode>) => void;
  checkpoint: () => void;
  addCard: (type: CardType, position: XYPosition) => string;
  addImageCard: (asset: ImageAsset, position: XYPosition, size: { width: number; height: number }) => string;
  replaceImage: (id: string, asset: ImageAsset) => void;
  patchImageAsset: (id: string, asset: ImageAsset) => void;
  updateCard: (id: string, patch: Partial<BoardNode["data"]>) => void;
  deleteSelected: () => void;
  removeCard: (id: string) => void;
  clearSelection: () => void;
  copySelected: () => void;
  paste: () => string[];
  undo: () => void;
  redo: () => void;
}

export const useBoardStore = create<BoardState>()((set, get) => ({
  nodes: seedNodes(),
  past: [],
  future: [],
  clipboard: [],

  onNodesChange: (changes) => set({ nodes: changes.applyTo(get().nodes) }),

  // Appelé avant une modification structurelle (ajout, suppression, déplacement, redimensionnement).
  // L'édition de texte dans une carte ne passe pas par l'historique.
  checkpoint: () =>
    set((s) => ({ past: [...s.past, s.nodes].slice(-HISTORY_LIMIT), future: [] })),

  addCard: (type, position) => {
    get().checkpoint();
    const card = createCard(type, position);
    set((s) => ({
      nodes: [...s.nodes.map((n) => ({ ...n, selected: false })), { ...card, selected: true }],
    }));
    return card.id;
  },

  addImageCard: (asset, position, size) => {
    get().checkpoint();
    const id = crypto.randomUUID();
    const card: BoardNode = {
      id,
      type: "image",
      position,
      width: size.width,
      height: size.height,
      selected: true,
      data: { title: asset.originalName, status: "idle", image: asset },
    };
    set((s) => ({
      nodes: [...s.nodes.map((n) => ({ ...n, selected: false })), card],
    }));
    return id;
  },

  // Remplace l'image d'une carte existante (position et taille inchangées). Annulable.
  replaceImage: (id, asset) => {
    if (!get().nodes.some((n) => n.id === id)) return;
    get().checkpoint();
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, title: asset.originalName, image: asset } } : n,
      ),
    }));
  },

  // Change seulement l'asset d'une carte (copie en arrière-plan). Pas de point d'annulation : le collage reste annulable tel quel.
  // Les instantanés de l'historique sont mis à jour aussi, sinon annuler ramènerait le fichier d'origine.
  patchImageAsset: (id, asset) => {
    if (!get().nodes.some((n) => n.id === id)) return;
    const withAsset = (nodes: BoardNode[]) =>
      nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, image: asset } } : n));
    set((s) => ({
      nodes: withAsset(s.nodes),
      past: s.past.map(withAsset),
      future: s.future.map(withAsset),
    }));
  },

  updateCard: (id, patch) =>
    set((s) => ({
      nodes: s.nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)),
    })),

  clearSelection: () => set((s) => ({ nodes: s.nodes.map((n) => (n.selected ? { ...n, selected: false } : n)) })),

  deleteSelected: () => {
    if (!get().nodes.some((n) => n.selected)) return;
    get().checkpoint();
    set((s) => ({ nodes: s.nodes.filter((n) => !n.selected) }));
  },

  removeCard: (id) => {
    get().checkpoint();
    set((s) => ({ nodes: s.nodes.filter((n) => n.id !== id) }));
  },

  copySelected: () => {
    set((s) => ({
      clipboard: structuredClone(s.nodes.filter((n) => n.selected)),
    }));
  },

  paste: () => {
    const { clipboard } = get();
    if (clipboard.length === 0) return [];
    get().checkpoint();
    const pasted = clipboard.map((n) => ({
      ...structuredClone(n),
      id: crypto.randomUUID(),
      position: { x: n.position.x + PASTE_OFFSET, y: n.position.y + PASTE_OFFSET },
      selected: true,
    }));
    set((s) => ({
      nodes: [...s.nodes.map((n) => ({ ...n, selected: false })), ...pasted],
    }));
    return pasted.map((n) => n.id);
  },

  undo: () => {
    const { past, nodes, future } = get();
    if (past.length === 0) return;
    set({
      nodes: past[past.length - 1],
      past: past.slice(0, -1),
      future: [nodes, ...future],
    });
  },

  redo: () => {
    const { past, nodes, future } = get();
    if (future.length === 0) return;
    set({
      nodes: future[0],
      past: [...past, nodes],
      future: future.slice(1),
    });
  },
}));
