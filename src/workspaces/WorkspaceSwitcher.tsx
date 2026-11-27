import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ConfirmDialog } from "../canvas/ConfirmDialog";
import { errorMessage } from "../canvas/images";
import { pickWorkspaceFolder, type Workspace } from "./workspaceApi";
import { useWorkspaceStore } from "./workspaceStore";

function plural(count: number, word: string): string {
  return `${count} ${word}${count > 1 ? "s" : ""}`;
}

export function WorkspaceSwitcher() {
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeId = useWorkspaceStore((s) => s.activeId);
  const open = useWorkspaceStore((s) => s.open);
  const error = useWorkspaceStore((s) => s.error);
  const active = workspaces.find((w) => w.id === activeId);

  const [menuOpen, setMenuOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [menuOpen]);

  const newWorkspace = async () => {
    setMenuOpen(false);
    useWorkspaceStore.setState({ error: null });
    try {
      const folder = await pickWorkspaceFolder();
      if (folder) await useWorkspaceStore.getState().create(folder);
    } catch (err) {
      useWorkspaceStore.setState({ error: errorMessage(err) });
    }
  };

  const activate = (id: string) => {
    setMenuOpen(false);
    useWorkspaceStore.setState({ error: null });
    void useWorkspaceStore.getState().activate(id);
  };

  const startRename = (ws: Workspace) => {
    setRenamingId(ws.id);
    setRenameValue(ws.name);
  };

  const commitRename = () => {
    const id = renamingId;
    setRenamingId(null);
    if (!id) return;
    useWorkspaceStore.setState({ error: null });
    void useWorkspaceStore.getState().rename(id, renameValue);
  };

  const onRenameKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") commitRename();
    else if (e.key === "Escape") setRenamingId(null);
  };

  // Le board du workspace actif peut être absent de `open` le temps de son chargement : aucun agent alors.
  const nodes = activeId ? (open[activeId]?.store.getState().nodes ?? []) : [];
  const agents = nodes.filter((n) => n.type === "agent");
  const running = agents.filter((n) => n.data.status === "running").length;

  return (
    <div className="workspace-switcher" ref={rootRef}>
      <button
        type="button"
        className="workspace-current"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((o) => !o)}
      >
        {active?.name ?? "Workspace"} <span aria-hidden="true">▾</span>
      </button>
      {error && <p className="workspace-error" role="alert">{error}</p>}
      {menuOpen && (
        <div className="workspace-menu" role="menu">
          <ul className="workspace-list">
            {workspaces.map((ws) => (
              <li key={ws.id} className={`workspace-row${ws.id === activeId ? " active" : ""}`}>
                {renamingId === ws.id ? (
                  <input
                    className="workspace-rename"
                    aria-label="Nom du workspace"
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.currentTarget.value)}
                    onKeyDown={onRenameKey}
                    onBlur={() => setRenamingId(null)}
                  />
                ) : (
                  <>
                    <button
                      type="button"
                      role="menuitem"
                      className="workspace-item"
                      onClick={() => activate(ws.id)}
                    >
                      <span className="workspace-name">{ws.name}</span>
                      {!ws.folderExists && <span className="workspace-missing">Dossier introuvable</span>}
                    </button>
                    <button
                      type="button"
                      className="workspace-rename-btn"
                      aria-label="Renommer"
                      title="Renommer"
                      onClick={() => startRename(ws)}
                    >
                      <span aria-hidden="true">✎</span>
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
          <button type="button" role="menuitem" className="workspace-new" onClick={() => void newWorkspace()}>
            Nouveau workspace
          </button>
          {active && (
            <button
              type="button"
              role="menuitem"
              className="workspace-delete"
              onClick={() => {
                setMenuOpen(false);
                setConfirmDelete(true);
              }}
            >
              Supprimer le workspace
            </button>
          )}
        </div>
      )}
      {confirmDelete && active && (
        <ConfirmDialog
          title="Supprimer le workspace ?"
          message={`${plural(agents.length, "agent")} dans « ${active.name} », dont ${running} en cours. Supprimer le workspace arrête les sessions et efface son board et ses images.`}
          confirmLabel="Supprimer le workspace"
          onConfirm={() => {
            setConfirmDelete(false);
            useWorkspaceStore.setState({ error: null });
            void useWorkspaceStore.getState().remove(active.id);
          }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}
