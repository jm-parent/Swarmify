import { useState } from "react";
import type { NodeProps } from "@xyflow/react";
import ReactMarkdown from "react-markdown";
import { useBoardStore } from "../boardStore";
import type { BoardNode } from "../types";
import { CardFrame } from "./CardFrame";

export function NoteCard({ id, data, selected }: NodeProps<BoardNode>) {
  const updateCard = useBoardStore((s) => s.updateCard);
  const [editing, setEditing] = useState(false);

  return (
    <CardFrame id={id} data={data} selected={selected}>
      <div className="note-toolbar">
        <button type="button" className="nodrag" onClick={() => setEditing((v) => !v)}>
          {editing ? "Aperçu" : "Éditer"}
        </button>
      </div>
      {editing ? (
        <textarea
          className="nodrag nowheel note-editor"
          value={data.body ?? ""}
          onChange={(e) => updateCard(id, { body: e.currentTarget.value })}
        />
      ) : (
        <div className="nodrag nowheel note-preview">
          <ReactMarkdown>{data.body ?? ""}</ReactMarkdown>
        </div>
      )}
    </CardFrame>
  );
}
