import { useEffect, useState, type ComponentType } from "react";
import { radialOffsets } from "./radialLayout";

export interface RadialItem {
  id: string;
  label: string;
  icon: ComponentType<{ size?: number }>;
  // Absent = bouton sans action pour l'instant.
  onSelect?: () => void;
}

interface RadialMenuProps {
  x: number;
  y: number;
  items: RadialItem[];
  onClose: () => void;
}

const RADIUS = 96;
const BUTTON_HALF = 26;
const EDGE_MARGIN = RADIUS + BUTTON_HALF + 8;

// Menu circulaire ouvert au clic droit : les boutons se déploient depuis le centre.
export function RadialMenu({ x, y, items, onClose }: RadialMenuProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setOpen(true));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const cx = Math.min(Math.max(x, EDGE_MARGIN), window.innerWidth - EDGE_MARGIN);
  const cy = Math.min(Math.max(y, EDGE_MARGIN), window.innerHeight - EDGE_MARGIN);
  const offsets = radialOffsets(items.length, RADIUS);

  return (
    <div
      className="radial-backdrop"
      onMouseDown={onClose}
      onContextMenu={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="radial-hub" style={{ left: cx, top: cy }} onMouseDown={(e) => e.stopPropagation()}>
        <button type="button" className="radial-center" aria-label="More">
          More
        </button>
        {items.map((item, i) => {
          const Icon = item.icon;
          const { x: dx, y: dy } = offsets[i];
          return (
            <button
              key={item.id}
              type="button"
              className={`radial-item${open ? " open" : ""}`}
              title={item.label}
              aria-label={item.label}
              disabled={!item.onSelect}
              style={{
                transform: open
                  ? `translate(${dx}px, ${dy}px) scale(1)`
                  : "translate(0px, 0px) scale(0.4)",
                transitionDelay: `${i * 25}ms`,
              }}
              onClick={() => {
                item.onSelect?.();
                onClose();
              }}
            >
              <Icon size={20} />
              <span className="radial-label">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
