import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Background,
  BackgroundVariant,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type NodeTypes,
  type XYPosition,
} from "@xyflow/react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { open } from "@tauri-apps/plugin-dialog";
import { Bot, Image as ImageIcon, Layers, Globe, StickyNote, Users } from "lucide-react";
import "@xyflow/react/dist/style.css";
import { useBoardStore } from "./boardStore";
import { importImageFiles } from "./images";
import { useImportNotice } from "./ImportNotice";
import { MAX_ZOOM, MIN_ZOOM } from "./zoom";
import { ZoomBar } from "./ZoomBar";
import { AddBar } from "./AddBar";
import { ProviderRail } from "./ProviderRail";
import { ImportNotice } from "./ImportNotice";
import { RadialMenu, type RadialItem } from "./RadialMenu";
import { NoteCard } from "./cards/NoteCard";
import { KanbanCard } from "./cards/KanbanCard";
import { AgentCard } from "./cards/AgentCard";
import { ImageCard } from "./cards/ImageCard";

const nodeTypes = { note: NoteCard, kanban: KanbanCard, agent: AgentCard, image: ImageCard } satisfies NodeTypes;

function isEditable(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

// Décalage horizontal entre les images importées ensemble, pour qu'elles ne se superposent pas.
const IMPORT_SPACING = 500;

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function spreadPositions(origin: XYPosition, count: number): XYPosition[] {
  return Array.from({ length: count }, (_, i) => ({ x: origin.x + i * IMPORT_SPACING, y: origin.y }));
}

function showImportErrors(errors: string[]) {
  if (errors.length > 0) useImportNotice.getState().show(errors);
}

function importFiles(paths: string[], origin: XYPosition): Promise<void> {
  return importImageFiles(paths, spreadPositions(origin, paths.length)).then(
    showImportErrors,
    (err: unknown) => showImportErrors([messageOf(err)]),
  );
}

// Annuler le sélecteur renvoie null : rien à faire.
async function pickImageFiles(origin: XYPosition): Promise<void> {
  try {
    const paths = await open({
      multiple: true,
      filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp", "svg"] }],
    });
    if (!paths || paths.length === 0) return;
    await importFiles(paths, origin);
  } catch (err) {
    showImportErrors([messageOf(err)]);
  }
}

export function Board() {
  return (
    <ReactFlowProvider>
      <BoardCanvas />
    </ReactFlowProvider>
  );
}

function BoardCanvas() {
  const nodes = useBoardStore((s) => s.nodes);
  const onNodesChange = useBoardStore((s) => s.onNodesChange);
  const checkpoint = useBoardStore((s) => s.checkpoint);
  const [spacePressed, setSpacePressed] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number; flow: XYPosition } | null>(null);
  const { screenToFlowPosition } = useReactFlow();
  const closeMenu = useCallback(() => setMenu(null), []);

  // Les fichiers déposés depuis l'Explorateur arrivent en pixels physiques, relatifs à la fenêtre.
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let disposed = false;
    getCurrentWebview()
      .onDragDropEvent((event) => {
        const payload = event.payload;
        if (payload.type !== "drop") return;
        const ratio = window.devicePixelRatio;
        const origin = screenToFlowPosition({ x: payload.position.x / ratio, y: payload.position.y / ratio });
        void importFiles(payload.paths, origin);
      })
      .then((stop) => {
        if (disposed) stop();
        else unlisten = stop;
      })
      .catch((err: unknown) => console.error("Écoute du glisser-déposer impossible :", err));
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [screenToFlowPosition]);

  const menuItems = useMemo<RadialItem[]>(() => {
    if (!menu) return [];
    const at = menu.flow;
    return [
      { id: "agent", label: "Agent", icon: Bot, onSelect: () => useBoardStore.getState().addCard("agent", at) },
      { id: "note", label: "Note", icon: StickyNote, onSelect: () => useBoardStore.getState().addCard("note", at) },
      { id: "users", label: "Équipe", icon: Users },
      { id: "image", label: "Image", icon: ImageIcon, onSelect: () => void pickImageFiles(at) },
      { id: "layers", label: "Calques", icon: Layers },
      { id: "globe", label: "Web", icon: Globe },
    ];
  }, [menu]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditable(e.target)) return;
      const store = useBoardStore.getState();
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (e.code === "Space") {
        e.preventDefault();
        setSpacePressed(true);
      } else if (mod && key === "c") {
        store.copySelected();
      } else if (mod && key === "v") {
        store.paste();
      } else if (mod && (key === "y" || (key === "z" && e.shiftKey))) {
        store.redo();
      } else if (mod && key === "z") {
        store.undo();
      } else if (e.key === "Delete") {
        store.deleteSelected();
      } else if (e.key === "Escape") {
        store.clearSelection();
      } else {
        return;
      }
      e.preventDefault();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpacePressed(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  return (
    <ReactFlow
      nodes={nodes}
      edges={[]}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onNodeDragStart={checkpoint}
      deleteKeyCode={null}
      minZoom={MIN_ZOOM}
      maxZoom={MAX_ZOOM}
      fitView
      fitViewOptions={{ padding: 80 }}
      selectionOnDrag={!spacePressed}
      panOnDrag={spacePressed ? true : [1]}
      proOptions={{ hideAttribution: true }}
      onPaneContextMenu={(e) => {
        e.preventDefault();
        setMenu({ x: e.clientX, y: e.clientY, flow: screenToFlowPosition({ x: e.clientX, y: e.clientY }) });
      }}
    >
      <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#2a2a24" />
      <AddBar />
      <ZoomBar />
      <ProviderRail />
      <ImportNotice />
      {menu && <RadialMenu x={menu.x} y={menu.y} items={menuItems} onClose={closeMenu} />}
    </ReactFlow>
  );
}
