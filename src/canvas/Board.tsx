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
import { useBoardApi, useBoardStore, type BoardStore } from "./boardStore";
import { useWorkspaceStore } from "../workspaces/workspaceStore";
import {
  basename,
  errorMessage,
  IMAGE_DIALOG_FILTERS,
  duplicateImageAsset,
  importImageAsset,
  importImageFiles,
  type ImportedImage,
} from "./images";
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

// Tous les boards ouverts restent montés (display: none) : leurs écouteurs globaux ne doivent agir que sur le board actif.
function isActiveBoard(store: BoardStore): boolean {
  return useWorkspaceStore.getState().activeId === store.getState().workspaceId;
}

// Après un collage, chaque image reçoit sa propre copie en arrière-plan. La carte pointe déjà sur le fichier d'origine
// et le patch n'ajoute aucun point d'annulation. Seuls les états encore sur le fichier d'origine sont mis à jour : une carte
// supprimée ou une image remplacée entre-temps n'est pas touchée.
function duplicatePastedImages(store: BoardStore, ids: string[]) {
  for (const id of ids) {
    const original = store.getState().nodes.find((n) => n.id === id)?.data.image;
    if (!original) continue;
    void duplicateImageAsset(store.getState().workspaceId, original.file)
      .then((copy) => {
        store.getState().patchImageAsset(id, original.file, {
          ...original,
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

function importFiles(store: BoardStore, paths: string[], origin: XYPosition): Promise<void> {
  return importImageFiles(store, paths, spreadPositions(origin, paths.length)).then(
    showImportErrors,
    (err: unknown) => showImportErrors([errorMessage(err)]),
  );
}

// Les cartes choisies au sélecteur sont centrées sur le centre de la vue : la taille n'est connue qu'après mesure.
async function importPickedFiles(store: BoardStore, paths: string[], centre: XYPosition): Promise<string[]> {
  const origins = spreadPositions(centre, paths.length);
  const errors: string[] = [];
  for (const [index, path] of paths.entries()) {
    try {
      const { asset, size } = await importImageAsset(store.getState().workspaceId, path);
      const origin = origins[index];
      store
        .getState()
        .addImageCard(asset, { x: origin.x - size.width / 2, y: origin.y - size.height / 2 }, size);
    } catch (err) {
      errors.push(`${basename(path)} : ${errorMessage(err)}`);
    }
  }
  return errors;
}

// Annuler le sélecteur renvoie null : rien à faire.
async function pickImageFiles(store: BoardStore, centre: XYPosition): Promise<void> {
  try {
    const paths = await open({ multiple: true, filters: IMAGE_DIALOG_FILTERS });
    if (!paths || paths.length === 0) return;
    showImportErrors(await importPickedFiles(store, paths, centre));
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
  const store = useBoardApi();
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
      if (store.getState().clipboard.length > 0) {
        duplicatePastedImages(store, store.getState().paste());
        return;
      }
      if (isRepeat || pasteImageBusy.current) return;
      pasteImageBusy.current = true;
      try {
        const imported: ImportedImage | null = await importClipboardImage(store.getState().workspaceId);
        if (!imported) return;
        const center = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
        const { width, height } = imported.size;
        store.getState().addImageCard(
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
    [screenToFlowPosition, store],
  );

  // Les fichiers déposés depuis l'Explorateur arrivent en pixels physiques, relatifs à la fenêtre.
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let disposed = false;
    getCurrentWebview()
      .onDragDropEvent((event) => {
        const payload = event.payload;
        if (payload.type !== "drop" || !isActiveBoard(store)) return;
        const ratio = window.devicePixelRatio;
        const origin = screenToFlowPosition({ x: payload.position.x / ratio, y: payload.position.y / ratio });
        void importFiles(store, payload.paths, origin);
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
  }, [screenToFlowPosition, store]);

  const menuItems = useMemo<RadialItem[]>(() => {
    if (!menu) return [];
    const at = menu.flow;
    return [
      { id: "agent", label: "Agent", icon: Bot, onSelect: () => store.getState().addCard("agent", at) },
      { id: "note", label: "Note", icon: StickyNote, onSelect: () => store.getState().addCard("note", at) },
      { id: "users", label: "Équipe", icon: Users },
      {
        id: "image",
        label: "Image",
        icon: ImageIcon,
        onSelect: () =>
          void pickImageFiles(store, screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 })),
      },
      { id: "layers", label: "Calques", icon: Layers },
      { id: "globe", label: "Web", icon: Globe },
    ];
  }, [menu, screenToFlowPosition, store]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Space sur le bouton Supprimer / Remplacer d'une carte manquante l'active au lieu de déclencher le pan.
      if (e.code === "Space" && e.target instanceof HTMLButtonElement && e.target.closest(".image-missing")) return;
      if (isEditable(e.target) || !isActiveBoard(store)) return;
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (e.code === "Space") {
        e.preventDefault();
        setSpacePressed(true);
      } else if (mod && key === "c") {
        store.getState().copySelected();
      } else if (mod && key === "v") {
        void pasteFromClipboard(e.repeat);
      } else if (mod && (key === "y" || (key === "z" && e.shiftKey))) {
        store.getState().redo();
      } else if (mod && key === "z") {
        store.getState().undo();
      } else if (e.key === "Delete") {
        store.getState().deleteSelected();
      } else if (e.key === "Escape") {
        store.getState().clearSelection();
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
  }, [pasteFromClipboard, store]);

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
