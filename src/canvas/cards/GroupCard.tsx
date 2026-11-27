import type { NodeProps } from "@xyflow/react";
import { NodeResizeControl } from "@xyflow/react";
import { useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useBoardStore } from "../boardStore";
import { countMembers, GROUP_ROLES, GroupError, minimumGroupSize, type GroupCount } from "../groups/groupOps";
import type { BoardNode, GroupRole } from "../types";

const NO_MEMBERS: GroupCount = { total: 0, active: 0 };
const NO_SIZE = { width: 0, height: 0 };

const ROLE_LABELS: Record<GroupRole, string> = {
  frontend: "Frontend",
  backend: "Backend",
  testers: "Testers",
  reviewers: "Reviewers",
  design: "Design",
  docs: "Docs",
  security: "Security",
  general: "General",
};

// « 7 · 3 actifs » ; singulier pour 0 et 1 actif (FR-009).
function formatCount({ total, active }: GroupCount): string {
  return `${total} · ${active} ${active <= 1 ? "actif" : "actifs"}`;
}

// Cadre d'un groupe : la bordure porte la couleur du rôle, le nom est affiché sur le trait (DESIGN.md, « Cadre de groupe »).
export function GroupCard({ id, data, selected }: NodeProps<BoardNode>) {
  const checkpoint = useBoardStore((s) => s.checkpoint);
  const renameGroup = useBoardStore((s) => s.renameGroup);
  const setGroupRole = useBoardStore((s) => s.setGroupRole);
  // Le cadre peut disparaître pendant qu'on lit le compteur (suppression en cours) : on ne lève pas d'erreur.
  const count = useBoardStore(
    useShallow((s) => (s.nodes.some((n) => n.id === id) ? countMembers(s.nodes, id) : NO_MEMBERS)),
  );
  // Borne du redimensionnement : la boîte des membres, jamais sous la taille minimale (FR-008).
  const minSize = useBoardStore(
    useShallow((s) => (s.nodes.some((n) => n.id === id) ? minimumGroupSize(s.nodes, id) : NO_SIZE)),
  );
  const resizeGroup = useBoardStore((s) => s.resizeGroup);
  const [draft, setDraft] = useState(data.title);
  const cancelled = useRef(false);

  useEffect(() => setDraft(data.title), [data.title]);

  // Un nom vide est refusé par le store : l'ancien nom est rétabli (FR-003).
  const commit = () => {
    if (cancelled.current) {
      cancelled.current = false;
      setDraft(data.title);
      return;
    }
    try {
      renameGroup(id, draft);
    } catch (err) {
      if (!(err instanceof GroupError)) throw err;
      setDraft(data.title);
    }
  };

  const role = data.group?.role ?? "general";

  return (
    <div className={`group-frame${selected ? " selected" : ""}`} data-role={role}>
      <div className="group-header">
        <span className="group-dot" aria-hidden="true" />
        <input
          className="nodrag group-name"
          aria-label="Nom du groupe"
          value={draft}
          onChange={(e) => setDraft(e.currentTarget.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              cancelled.current = true;
              e.currentTarget.blur();
            }
          }}
        />
        <span className="group-count">{formatCount(count)}</span>
        <select
          className="nodrag group-role"
          aria-label="Rôle du groupe"
          value={role}
          onChange={(e) => setGroupRole(id, e.currentTarget.value as GroupRole)}
        >
          {GROUP_ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
      </div>
      {selected && (
        <NodeResizeControl
          position="bottom-right"
          minWidth={minSize.width}
          minHeight={minSize.height}
          onResizeStart={checkpoint}
          onResizeEnd={(_event, params) => resizeGroup(id, params.width, params.height)}
        />
      )}
    </div>
  );
}
