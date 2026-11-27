import { Panel, useReactFlow } from "@xyflow/react";
import { useBoardApi, useBoardStore } from "./boardStore";
import { exportBoard, importBoard } from "./persistence";
import type { CardType } from "./types";

// Moitié de la taille par défaut d'une carte : la carte est centrée sur la vue.
const HALF_CARD = { x: 140, y: 100 };

function reportError(err: unknown) {
  console.error(err);
  window.alert(err instanceof Error ? err.message : String(err));
}

export function AddBar() {
  const store = useBoardApi();
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
      <button type="button" onClick={() => add("agent")}>+ Agent</button>
      <button type="button" onClick={() => exportBoard(store).catch(reportError)}>Exporter</button>
      <button type="button" onClick={() => importBoard(store).catch(reportError)}>Importer</button>
    </Panel>
  );
}
