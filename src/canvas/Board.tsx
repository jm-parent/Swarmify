import { useEffect, useState } from "react";
import {
  Background,
  BackgroundVariant,
  ReactFlow,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useBoardStore } from "./boardStore";
import { MAX_ZOOM, MIN_ZOOM } from "./zoom";
import { ZoomBar } from "./ZoomBar";
import { AddBar } from "./AddBar";
import { NoteCard } from "./cards/NoteCard";
import { KanbanCard } from "./cards/KanbanCard";
import { AgentCard } from "./cards/AgentCard";

const nodeTypes = { note: NoteCard, kanban: KanbanCard, agent: AgentCard } satisfies NodeTypes;

function isEditable(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

export function Board() {
  const nodes = useBoardStore((s) => s.nodes);
  const onNodesChange = useBoardStore((s) => s.onNodesChange);
  const checkpoint = useBoardStore((s) => s.checkpoint);
  const [spacePressed, setSpacePressed] = useState(false);

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
    >
      <Background variant={BackgroundVariant.Dots} gap={24} size={1} />
      <AddBar />
      <ZoomBar />
    </ReactFlow>
  );
}
