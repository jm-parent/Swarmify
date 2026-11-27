import { createContext, useContext } from "react";
import { useStore } from "zustand";
import { createStore, type StoreApi } from "zustand/vanilla";
import type { NodeChangeset, XYPosition } from "@xyflow/react";
import * as groupOps from "./groups/groupOps";
import type { BoardNode, CardType, GroupRole, ImageAsset } from "./types";

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

// Recalcule les cadres dont un membre vient de partir ou de changer de taille.
function refitGroups(nodes: BoardNode[], groupIds: Set<string>): BoardNode[] {
  let next = nodes;
  for (const id of groupIds) {
    if (next.some((n) => n.id === id && n.type === "group")) next = groupOps.fitGroup(next, id);
  }
  return next;
}

export interface BoardState {
  workspaceId: string;
  folder: string;
  nodes: BoardNode[];
  past: BoardNode[][];
  future: BoardNode[][];
  clipboard: BoardNode[];
  onNodesChange: (changes: NodeChangeset<BoardNode>) => void;
  checkpoint: () => void;
  addCard: (type: CardType, position: XYPosition) => string;
  addImageCard: (asset: ImageAsset, position: XYPosition, size: { width: number; height: number }) => string;
  replaceImage: (id: string, asset: ImageAsset) => void;
  patchImageAsset: (id: string, fromFile: string, asset: ImageAsset) => void;
  updateCard: (id: string, patch: Partial<BoardNode["data"]>) => void;
  deleteSelected: () => void;
  removeCard: (id: string) => void;
  clearSelection: () => void;
  copySelected: () => void;
  paste: () => string[];
  undo: () => void;
  redo: () => void;
  // Actions de groupe (contrat : specs/002-agent-groups/contracts/group-api.md).
  createGroup: (options?: { name?: string; role?: GroupRole; position?: XYPosition }) => string;
  renameGroup: (id: string, name: string) => void;
  setGroupRole: (id: string, role: GroupRole) => void;
  addAgentToGroup: (agentId: string, groupId: string) => void;
  removeAgentFromGroup: (agentId: string) => void;
  deleteGroup: (id: string) => void;
  resizeGroup: (id: string, width: number, height: number) => void;
  settleMembership: (agentIds: string[]) => void;
  refitGroupOf: (nodeId: string) => void;
}

export type BoardStore = StoreApi<BoardState>;

export function createBoardStore(workspaceId: string, folder: string, nodes?: BoardNode[]): BoardStore {
  return createStore<BoardState>()((set, get) => ({
    workspaceId,
    folder,
    nodes: nodes ?? seedNodes(),
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
    // Seul un état dont l'image est encore fromFile est mis à jour : un remplacement fait entre-temps n'est pas écrasé.
    patchImageAsset: (id, fromFile, asset) => {
      const withAsset = (nodes: BoardNode[]) =>
        nodes.some((n) => n.id === id && n.data.image?.file === fromFile)
          ? nodes.map((n) => (n.id === id && n.data.image?.file === fromFile ? { ...n, data: { ...n.data, image: asset } } : n))
          : nodes;
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
      const { nodes } = get();
      if (!nodes.some((n) => n.selected)) return;
      get().checkpoint();
      const selectedGroups = new Set(nodes.filter((n) => n.type === "group" && n.selected).map((n) => n.id));
      // Un membre d'un cadre supprimé est libéré, jamais supprimé (FR-012), même s'il est sélectionné.
      const released = new Set(
        nodes.filter((n) => n.selected && n.parentId !== undefined && selectedGroups.has(n.parentId)).map((n) => n.id),
      );
      const doomed = new Set(nodes.filter((n) => n.selected && !released.has(n.id)).map((n) => n.id));
      const parents = new Set(
        nodes.filter((n) => doomed.has(n.id) && n.parentId !== undefined).map((n) => n.parentId as string),
      );
      let next = nodes;
      for (const id of selectedGroups) next = groupOps.deleteGroup(next, id);
      next = next.filter((n) => !doomed.has(n.id)).map((n) => (released.has(n.id) ? { ...n, selected: false } : n));
      set({ nodes: refitGroups(next, parents) });
    },

    removeCard: (id) => {
      const target = get().nodes.find((n) => n.id === id);
      get().checkpoint();
      set((s) => {
        if (target?.type === "group") return { nodes: groupOps.deleteGroup(s.nodes, id) };
        const parents = new Set(target?.parentId !== undefined ? [target.parentId] : []);
        return { nodes: refitGroups(s.nodes.filter((n) => n.id !== id), parents) };
      });
    },

    copySelected: () => {
      set((s) => ({
        // Un cadre n'est pas copiable (FR-017). Un agent copié reçoit sa position absolue et n'appartient à aucun groupe.
        clipboard: structuredClone(
          s.nodes
            .filter((n) => n.selected && n.type !== "group")
            .map((n) => {
              const copy: BoardNode = { ...n, position: groupOps.absolutePosition(s.nodes, n) };
              delete copy.parentId;
              return copy;
            }),
        ),
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

    // Le pur calcule d'abord : une erreur (nom vide, rôle inconnu) ne laisse aucun point d'annulation.
    createGroup: (options = {}) => {
      const { nodes, id } = groupOps.createGroup(get().nodes, options);
      get().checkpoint();
      set({ nodes });
      return id;
    },

    renameGroup: (id, name) => {
      const nodes = groupOps.renameGroup(get().nodes, id, name);
      get().checkpoint();
      set({ nodes });
    },

    setGroupRole: (id, role) => {
      const nodes = groupOps.setGroupRole(get().nodes, id, role);
      get().checkpoint();
      set({ nodes });
    },

    addAgentToGroup: (agentId, groupId) => {
      const nodes = groupOps.addAgentToGroup(get().nodes, agentId, groupId);
      get().checkpoint();
      set({ nodes });
    },

    removeAgentFromGroup: (agentId) => {
      const nodes = groupOps.removeAgentFromGroup(get().nodes, agentId);
      get().checkpoint();
      set({ nodes });
    },

    deleteGroup: (id) => {
      const nodes = groupOps.deleteGroup(get().nodes, id);
      get().checkpoint();
      set({ nodes });
    },

    // Pas de checkpoint : le point d'annulation est pris au début du geste (onResizeStart), voir contracts/group-api.md.
    resizeGroup: (id, width, height) => {
      set({ nodes: groupOps.resizeGroup(get().nodes, id, { width, height }) });
    },

    // Pas de checkpoint : le point est pris au début du glissement (onNodeDragStart).
    settleMembership: (agentIds) => {
      set({ nodes: groupOps.settleMembership(get().nodes, agentIds) });
    },

    // Pas de checkpoint : le point d'annulation est déjà pris au début du geste (CardFrame, onResizeStart).
    refitGroupOf: (nodeId) => {
      const parent = get().nodes.find((n) => n.id === nodeId)?.parentId;
      if (parent === undefined) return;
      set({ nodes: refitGroups(get().nodes, new Set([parent])) });
    },
  }));
}

export const BoardContext = createContext<BoardStore | null>(null);

export function useBoardApi(): BoardStore {
  const store = useContext(BoardContext);
  if (!store) throw new Error("useBoardApi doit être utilisé dans un BoardContext.Provider");
  return store;
}

export function useBoardStore<T>(selector: (s: BoardState) => T): T {
  return useStore(useBoardApi(), selector);
}

