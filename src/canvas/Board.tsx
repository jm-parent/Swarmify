import { useEffect, useState } from "react";
import {
  Background,
  BackgroundVariant,
  ReactFlow,
  type Node,
  useNodesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { FIT_PADDING_PX, MAX_ZOOM, MIN_ZOOM } from "./zoom";
import { ZoomBar } from "./ZoomBar";

// Cartes de démonstration pour valider pan, zoom et fit to content (remplacées à l'étape 2).
const initialNodes: Node[] = [
  { id: "a", position: { x: 0, y: 0 }, data: { label: "Carte A" } },
  { id: "b", position: { x: 320, y: 120 }, data: { label: "Carte B" } },
  { id: "c", position: { x: -260, y: 200 }, data: { label: "Carte C" } },
];

export function Board() {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [spacePressed, setSpacePressed] = useState(false);

  useEffect(() => {
    const isEditable = (target: EventTarget | null) =>
      target instanceof HTMLElement &&
      (target.isContentEditable || ["INPUT", "TEXTAREA"].includes(target.tagName));
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" && !isEditable(e.target)) {
        e.preventDefault();
        setSpacePressed(true);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpacePressed(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  return (
    <ReactFlow
      nodes={nodes}
      edges={[]}
      onNodesChange={onNodesChange}
      minZoom={MIN_ZOOM}
      maxZoom={MAX_ZOOM}
      fitView
      fitViewOptions={{ padding: FIT_PADDING_PX }}
      selectionOnDrag={!spacePressed}
      panOnDrag={spacePressed ? true : [1]}
      proOptions={{ hideAttribution: true }}
    >
      <Background variant={BackgroundVariant.Dots} gap={24} size={1} />
      <ZoomBar />
    </ReactFlow>
  );
}
