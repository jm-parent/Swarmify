import { useState } from "react";
import type { NodeProps } from "@xyflow/react";
import { useBoardStore } from "../boardStore";
import type { BoardNode, KanbanItem } from "../types";
import { CardFrame } from "./CardFrame";

export function KanbanCard({ id, data, selected }: NodeProps<BoardNode>) {
  const updateCard = useBoardStore((s) => s.updateCard);
  const [draft, setDraft] = useState("");
  const items = data.items ?? [];

  const setItems = (next: KanbanItem[]) => updateCard(id, { items: next });

  return (
    <CardFrame id={id} data={data} selected={selected}>
      <ul className="kanban-list">
        {items.map((item) => (
          <li key={item.id} className="kanban-item">
            <input
              type="checkbox"
              className="nodrag"
              checked={item.done}
              onChange={(e) =>
                setItems(items.map((i) => (i.id === item.id ? { ...i, done: e.currentTarget.checked } : i)))
              }
            />
            <span className={item.done ? "done" : undefined}>{item.text}</span>
            <button
              type="button"
              className="nodrag kanban-remove"
              aria-label="Supprimer"
              onClick={() => setItems(items.filter((i) => i.id !== item.id))}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <form
        className="kanban-add"
        onSubmit={(e) => {
          e.preventDefault();
          const text = draft.trim();
          if (!text) return;
          setItems([...items, { id: crypto.randomUUID(), text, done: false }]);
          setDraft("");
        }}
      >
        <input
          className="nodrag"
          placeholder="Ajouter une tâche…"
          value={draft}
          onChange={(e) => setDraft(e.currentTarget.value)}
        />
      </form>
    </CardFrame>
  );
}
