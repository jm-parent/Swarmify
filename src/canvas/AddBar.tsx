import { Panel, useReactFlow } from "@xyflow/react";
import { useBoardStore } from "./boardStore";
import type { CardType } from "./types";

// Moitié de la taille par défaut d'une carte : la carte est centrée sur la vue.
const HALF_CARD = { x: 140, y: 100 };

export function AddBar() {
  const { screenToFlowPosition } = useReactFlow();
  const addCard = useBoardStore((s) => s.addCard);

  const add = (type: CardType) => {
    const center = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    addCard(type, { x: center.x - HALF_CARD.x, y: center.y - HALF_CARD.y });
  };

  return (
    <Panel position="top-left" className="add-bar">
      <button type="button" onClick={() => add("note")}>+ Note</button>
      <button type="button" onClick={() => add("kanban")}>+ Kanban</button>
    </Panel>
  );
}
