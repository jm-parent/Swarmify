import { useEffect, useState } from "react";
import type { NodeProps } from "@xyflow/react";
import { imageSrc } from "../images";
import type { BoardNode } from "../types";
import { CardFrame } from "./CardFrame";

// Pas de passage par un canvas : un GIF doit rester animé.
export function ImageCard({ id, data, selected }: NodeProps<BoardNode>) {
  const file = data.image?.file ?? null;
  const name = data.image?.originalName ?? data.title;
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    setSrc(null);
    if (!file) return;
    let cancelled = false;
    imageSrc(file).then(
      (url) => {
        if (!cancelled) setSrc(url);
      },
      () => {
        if (!cancelled) setSrc(null);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [file]);

  return (
    <CardFrame id={id} data={data} selected={selected}>
      {src ? (
        <img
          className="nodrag image-view"
          src={src}
          alt={name}
          draggable={false}
          onError={() => setSrc(null)}
        />
      ) : (
        <div className="image-fallback">{name}</div>
      )}
    </CardFrame>
  );
}
