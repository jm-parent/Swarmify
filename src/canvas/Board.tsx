import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { errorMessage, IMAGE_DIALOG_FILTERS, duplicateImageAsset, importImageFiles, type ImportedImage } from "./images";
import { importClipboardImage } from "./clipboardImage";
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

function spreadPositions(origin: XYPosition, count: number): XYPosition[] {
  return Array.from({ length: count }, (_, i) => ({ x: origin.x + i * IMPORT_SPACING, y: origin.y }));
}

function showImportErrors(errors: string[]) {
  if (errors.length > 0) useImportNotice.getState().show(errors);
}

// Après un collage, chaque image reçoit sa propre copie en arrière-plan. La carte pointe déjà sur le fichier d'origine
// et le patch n'ajoute aucun point d'annulation. Une carte supprimée ou une image remplacée entre-temps n'est pas touchée.
function duplicatePastedImages(ids: string[]) {
  for (const id of ids) {
    const original = useBoardStore.getState().nodes.find((n) => n.id === id)?.data.image;
    if (!original) continue;
    void duplicateImageAsset(original.file)
      .then((copy) => {
        const store = useBoardStore.getState();
        const current = store.nodes.find((n) => n.id === id)?.data.image;
        if (!current || current.file !== original.file) return;
        store.patchImageAsset(id, {
          ...current,
          file: copy.file,
          format: copy.format,
          bytes: copy.bytes,
          width: copy.width,
          height: copy.height,
        });
      })
      .catch((err: unknown) => showImportErrors([`Copie du collage impossible : ${errorMessage(err)}`]));
  }
}

function importFiles(paths: string[], origin: XYPosition): Promise<void> {
  return importImageFiles(paths, spreadPositions(origin, paths.length)).then(
    showImportErrors,
    (err: unknown) => showImportErrors([errorMessage(err)]),
  );
}

// Annuler le sélecteur renvoie null : rien à faire.
async function pickImageFiles(origin: XYPosition): Promise<void> {
  try {
    const paths = await open({ multiple: true, filters: IMAGE_DIALOG_FILTERS });
    if (!paths || paths.length === 0) return;
    await importFiles(paths, origin);
  } catch (err) {
    showImportErrors([errorMessage(err)]);
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
  const pasteImageBusy = useRef(false);

  // Priorité R12 : des cartes copiées passent avant l'image système, collage synchrone (le presse-papiers OS n'est pas lu).
  // Sans carte copiée, une image du presse-papiers système est importée au centre de la vue. Un Ctrl+V maintenu
  // ou un import déjà en cours ne relance pas l'encodage.
  const pasteFromClipboard = useCallback(
    async (isRepeat: boolean) => {
      const store = useBoardStore.getState();
      if (store.clipboard.length > 0) {
        duplicatePastedImages(store.paste());
        return;
      }
      if (isRepeat || pasteImageBusy.current) return;
      pasteImageBusy.current = true;
      try {
        const imported: ImportedImage | null = await importClipboardImage();
        if (!imported) return;
        const center = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
        const { width, height } = imported.size;
        useBoardStore.getState().addImageCard(
          imported.asset,
          { x: center.x - width / 2, y: center.y - height / 2 },
          imported.size,
        );
      } catch (err) {
        showImportErrors([errorMessage(err)]);
      } finally {
        pasteImageBusy.current = false;
      }
    },
    [screenToFlowPosition],
  );

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
        void pasteFromClipboard(e.repeat);
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
  }, [pasteFromClipboard]);

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
