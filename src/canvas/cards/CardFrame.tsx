import type { ReactNode } from "react";
import { NodeResizer } from "@xyflow/react";
import { useBoardStore } from "../boardStore";
import type { CardData } from "../types";

interface CardFrameProps {
  id: string;
  data: CardData;
  selected: boolean;
  // Bouton d'action placé à droite de l'en-tête (ex. fermer une session).
  headerAction?: ReactNode;
  children: ReactNode;
}

// Cadre commun à tous les types de cartes : titre, statut, redimensionnement.
export function CardFrame({ id, data, selected, headerAction, children }: CardFrameProps) {
  const updateCard = useBoardStore((s) => s.updateCard);
  const checkpoint = useBoardStore((s) => s.checkpoint);

  return (
    <div className={`card status-${data.status}${selected ? " selected" : ""}`}>
      <NodeResizer isVisible={selected} minWidth={180} minHeight={120} onResizeStart={checkpoint} />
      <div className="card-header">
        <span className="card-status" aria-label={data.status} />
        <input
          className="nodrag card-title"
          value={data.title}
          onChange={(e) => updateCard(id, { title: e.currentTarget.value })}
        />
        {headerAction}
      </div>
      <div className="card-body">{children}</div>
    </div>
  );
}
