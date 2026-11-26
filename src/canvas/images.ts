import DOMPurify from "dompurify";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import type { XYPosition } from "@xyflow/react";
import { useBoardStore } from "./boardStore";
import type { ImageAsset, ImageFormat } from "./types";

export const MAX_CARD_WIDTH = 480;
export const DEFAULT_SVG_SIZE = { width: 480, height: 360 };

// Plafonne la largeur à MAX_CARD_WIDTH en gardant les proportions. Un SVG sans dimensions (0 × 0) prend la taille par défaut.
export function fitImageSize(natural: { width: number; height: number }): { width: number; height: number } {
  if (natural.width <= 0 || natural.height <= 0) return { ...DEFAULT_SVG_SIZE };
  if (natural.width <= MAX_CARD_WIDTH) return { width: natural.width, height: natural.height };
  return {
    width: MAX_CARD_WIDTH,
    height: Math.max(1, Math.round((natural.height * MAX_CARD_WIDTH) / natural.width)),
  };
}

interface ImageImport {
  file: string;
  path: string;
  format: ImageFormat;
  bytes: number;
}

export interface ImportedImage {
  asset: ImageAsset;
  size: { width: number; height: number };
}

// Une seule résolution de images_dir par session ; un échec n'est pas gardé, il sera réessayé.
let imagesDir: Promise<string> | undefined;

export function imageSrc(file: string): Promise<string> {
  imagesDir ??= invoke<string>("images_dir").catch((err: unknown) => {
    imagesDir = undefined;
    throw err;
  });
  return imagesDir.then((dir) => convertFileSrc(`${dir}/${file}`));
}

function basename(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function measureImage(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("Image illisible"));
    img.src = src;
  });
}

// Copie l'image dans images/ puis mesure la copie. Ne crée pas de carte.
export async function importImageAsset(path: string): Promise<ImportedImage> {
  const imported = await invoke<ImageImport>("import_image", { sourcePath: path });
  const measured = await measureImage(convertFileSrc(imported.path));
  // Un SVG sans dimensions intrinsèques mesure 0 × 0 : on retient la taille par défaut.
  const natural = measured.width > 0 && measured.height > 0 ? measured : DEFAULT_SVG_SIZE;
  return {
    asset: {
      file: imported.file,
      format: imported.format,
      originalName: basename(path),
      bytes: imported.bytes,
      width: natural.width,
      height: natural.height,
      addedAt: new Date().toISOString(),
    },
    size: fitImageSize(natural),
  };
}

// Importe les fichiers l'un après l'autre : un fichier en erreur n'empêche pas les autres.
export async function importImageFiles(paths: string[], positions: XYPosition[]): Promise<string[]> {
  const errors: string[] = [];
  for (const [index, path] of paths.entries()) {
    try {
      const { asset, size } = await importImageAsset(path);
      useBoardStore.getState().addImageCard(asset, positions[index], size);
    } catch (err) {
      errors.push(`${basename(path)} : ${errorMessage(err)}`);
    }
  }
  return errors;
}

// Une cible hors du board (http:, //, chemin relatif…) ferait charger une ressource externe.
function isLocalTarget(target: string): boolean {
  const value = target.trim().toLowerCase();
  return value.startsWith("#") || value.startsWith("data:");
}

export function sanitizeSvg(text: string): string {
  // Déclarée ici et retirée à la fin de l'appel : les autres usages de DOMPurify ne sont pas affectés.
  function dropExternalReferences(_node: Element, data: { attrName: string; attrValue: string; keepAttr: boolean }) {
    const value = data.attrValue.trim();
    if (data.attrName === "href" || data.attrName === "xlink:href") {
      if (!isLocalTarget(value)) data.keepAttr = false;
      return;
    }
    for (const match of value.matchAll(/url\(\s*(['"]?)([^'")]*)/gi)) {
      if (!isLocalTarget(match[2])) {
        data.keepAttr = false;
        return;
      }
    }
  }

  DOMPurify.addHook("uponSanitizeAttribute", dropExternalReferences);
  try {
    return DOMPurify.sanitize(text, {
      USE_PROFILES: { svg: true, svgFilters: true },
      FORBID_TAGS: ["style"],
    });
  } finally {
    DOMPurify.removeHook("uponSanitizeAttribute", dropExternalReferences);
  }
}
