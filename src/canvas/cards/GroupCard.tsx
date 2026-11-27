import type { NodeProps } from "@xyflow/react";
import { NodeResizeControl } from "@xyflow/react";
import { useBoardStore } from "../boardStore";
import type { BoardNode } from "../types";

// Cadre d'un groupe : la bordure porte la couleur du rôle, le nom est affiché sur le trait (DESIGN.md, « Cadre de groupe »).
export function GroupCard({ data, selected }: NodeProps<BoardNode>) {
  const checkpoint = useBoardStore((s) => s.checkpoint);

  return (
    <div className={`group-frame${selected ? " selected" : ""}`} data-role={data.group?.role ?? "general"}>
      <div className="group-header">
        <span className="group-name">{data.title}</span>
      </div>
      {selected && <NodeResizeControl position="bottom-right" onResizeStart={checkpoint} />}
    </div>
  );
}
