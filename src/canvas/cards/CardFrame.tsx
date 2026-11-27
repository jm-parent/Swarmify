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
  // Garde les proportions au redimensionnement (cartes image).
  keepAspectRatio?: boolean;
  children: ReactNode;
}

// Cadre commun à tous les types de cartes : titre, statut, redimensionnement.
export function CardFrame({ id, data, selected, headerAction, keepAspectRatio, children }: CardFrameProps) {
  const updateCard = useBoardStore((s) => s.updateCard);
  const checkpoint = useBoardStore((s) => s.checkpoint);
  const refitGroupOf = useBoardStore((s) => s.refitGroupOf);

  return (
    <div className={`card status-${data.status}${selected ? " selected" : ""}`}>
      <NodeResizer
        isVisible={selected}
        minWidth={180}
        minHeight={120}
        keepAspectRatio={keepAspectRatio}
        onResizeStart={checkpoint}
        onResizeEnd={() => refitGroupOf(id)}
      />
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
