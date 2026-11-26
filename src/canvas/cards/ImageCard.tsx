import { useEffect, useState } from "react";
import type { NodeProps } from "@xyflow/react";
import { open } from "@tauri-apps/plugin-dialog";
import { useBoardStore } from "../boardStore";
import { errorMessage, IMAGE_DIALOG_FILTERS, imageSrc, importImageAsset } from "../images";
import { useImportNotice } from "../ImportNotice";
import type { BoardNode } from "../types";
import { CardFrame } from "./CardFrame";

// Pas de passage par un canvas : un GIF doit rester animé.
export function ImageCard({ id, data, selected }: NodeProps<BoardNode>) {
  const file = data.image?.file ?? null;
  const name = data.image?.originalName ?? data.title;
  const [src, setSrc] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const removeCard = useBoardStore((s) => s.removeCard);
  const replaceImage = useBoardStore((s) => s.replaceImage);

  useEffect(() => {
    setSrc(null);
    setMissing(false);
    if (!file) return;
    let cancelled = false;
    imageSrc(file).then(
      (url) => {
        if (!cancelled) setSrc(url);
      },
      () => {
        if (!cancelled) setMissing(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [file]);

  // Annuler le sélecteur ne fait rien ; un échec d'import passe par la notification.
  async function replaceFile() {
    try {
      const path = await open({ multiple: false, filters: IMAGE_DIALOG_FILTERS });
      if (typeof path !== "string") return;
      const { asset } = await importImageAsset(path);
      replaceImage(id, asset);
    } catch (err) {
      useImportNotice.getState().show([errorMessage(err)]);
    }
  }

  return (
    <CardFrame id={id} data={data} selected={selected} keepAspectRatio>
      {missing ? (
        <div className="image-missing">
          <p>Image introuvable</p>
          <div className="image-missing-actions">
            <button type="button" className="nodrag" onClick={() => removeCard(id)}>
              Supprimer
            </button>
            <button type="button" className="nodrag" onClick={() => void replaceFile()}>
              Remplacer
            </button>
          </div>
        </div>
      ) : src ? (
        <img
          className="nodrag image-view"
          src={src}
          alt={name}
          draggable={false}
          onError={() => setMissing(true)}
        />
      ) : (
        <div className="image-fallback">{name}</div>
      )}
    </CardFrame>
  );
}
