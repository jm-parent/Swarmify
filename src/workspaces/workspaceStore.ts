import { create } from "zustand";
import { createBoardStore, type BoardStore } from "../canvas/boardStore";
import { basename, errorMessage } from "../canvas/images";
import { attachAutosave, loadWorkspaceNodes } from "../canvas/persistence";
import {
  createWorkspace,
  deleteWorkspace,
  listWorkspaces,
  markOpened,
  renameWorkspace,
  type Workspace,
} from "./workspaceApi";

export function cleanName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Le nom ne peut pas être vide");
  return trimmed;
}

function recency(ws: Workspace): number {
  return ws.lastOpenedAt ?? ws.createdAt;
}

export function pickStartupWorkspace(list: Workspace[]): Workspace | undefined {
  let best: Workspace | undefined;
  for (const ws of list) {
    if (!best || recency(ws) > recency(best)) best = ws;
  }
  return best;
}

export interface OpenBoard {
  store: BoardStore;
  detach: () => void;
}

export interface WorkspaceState {
  loaded: boolean;
  workspaces: Workspace[];
  activeId: string | null;
  open: Record<string, OpenBoard>;
  error: string | null;
  load(): Promise<void>;
  create(folder: string, name?: string): Promise<void>;
  rename(id: string, name: string): Promise<void>;
  remove(id: string): Promise<void>;
  activate(id: string): Promise<void>;
}

// Les actions ne relancent pas leurs erreurs : elles les publient dans `error`.
export const useWorkspaceStore = create<WorkspaceState>()((set, get) => ({
  loaded: false,
  workspaces: [],
  activeId: null,
  open: {},
  error: null,

  async load() {
    try {
      const list = await listWorkspaces();
      set({ workspaces: list, error: null });
      const startup = pickStartupWorkspace(list);
      if (startup) await get().activate(startup.id);
    } catch (err) {
      set({ error: errorMessage(err) });
    } finally {
      set({ loaded: true });
    }
  },

  async create(folder, name) {
    try {
      const ws = await createWorkspace(crypto.randomUUID(), folder, cleanName(name ?? basename(folder)));
      set((s) => ({ workspaces: [...s.workspaces, ws], error: null }));
      await get().activate(ws.id);
    } catch (err) {
      set({ error: errorMessage(err) });
    }
  },

  async rename(id, name) {
    try {
      const clean = cleanName(name);
      await renameWorkspace(id, clean);
      set((s) => ({
        workspaces: s.workspaces.map((w) => (w.id === id ? { ...w, name: clean } : w)),
        error: null,
      }));
    } catch (err) {
      set({ error: errorMessage(err) });
    }
  },

  async remove(id) {
    const entry = get().open[id];
    // Détacher avant la suppression : une sauvegarde en attente ne doit pas recréer le fichier du board après suppression.
    entry?.detach();
    try {
      await deleteWorkspace(id);
    } catch (err) {
      // La suppression a échoué : le workspace existe toujours, on reprend la sauvegarde.
      if (entry) {
        set((s) => ({ open: { ...s.open, [id]: { store: entry.store, detach: attachAutosave(entry.store) } } }));
      }
      set({ error: errorMessage(err) });
      return;
    }

    const remaining = get().workspaces.filter((w) => w.id !== id);
    set((s) => {
      const open = { ...s.open };
      delete open[id];
      return { open, workspaces: remaining, error: null };
    });

    if (get().activeId === id) {
      const next = pickStartupWorkspace(remaining);
      set({ activeId: null });
      if (next) await get().activate(next.id);
    }
  },

  async activate(id) {
    try {
      if (!get().open[id]) {
        const ws = get().workspaces.find((w) => w.id === id);
        if (!ws) throw new Error("Workspace introuvable");
        const nodes = await loadWorkspaceNodes(id, ws.folder);
        // Un activate concurrent a pu ouvrir le board pendant le chargement.
        if (!get().open[id]) {
          const store = createBoardStore(id, ws.folder, nodes);
          const detach = attachAutosave(store);
          set((s) => ({ open: { ...s.open, [id]: { store, detach } } }));
        }
      }
      set({ activeId: id, error: null });
      await markOpened(id);
    } catch (err) {
      set({ error: errorMessage(err) });
    }
  },
}));
