import { Panel, useReactFlow } from "@xyflow/react";
import { Bot, Download, Kanban, StickyNote, Upload, Users } from "lucide-react";
import { useBoardApi, useBoardStore } from "./boardStore";
import { DEFAULT_GROUP_SIZE } from "./groups/groupOps";
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

  const addGroup = () => {
    const center = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    store.getState().createGroup({
      position: {
        x: center.x - DEFAULT_GROUP_SIZE.width / 2,
        y: center.y - DEFAULT_GROUP_SIZE.height / 2,
      },
    });
  };

  return (
    <Panel position="center-left" className="add-bar">
      <button type="button" aria-label="Ajouter une note" title="Ajouter une note" onClick={() => add("note")}>
        <StickyNote size={18} />
      </button>
      <button type="button" aria-label="Ajouter un kanban" title="Ajouter un kanban" onClick={() => add("kanban")}>
        <Kanban size={18} />
      </button>
      <button type="button" aria-label="Ajouter un agent" title="Ajouter un agent" onClick={() => add("agent")}>
        <Bot size={18} />
      </button>
      <button type="button" aria-label="Ajouter un groupe" title="Ajouter un groupe" onClick={addGroup}>
        <Users size={18} />
      </button>
      <button type="button" aria-label="Exporter le board" title="Exporter le board" onClick={() => exportBoard(store).catch(reportError)}>
        <Download size={18} />
      </button>
      <button type="button" aria-label="Importer un board" title="Importer un board" onClick={() => importBoard(store).catch(reportError)}>
        <Upload size={18} />
      </button>
    </Panel>
  );
}
