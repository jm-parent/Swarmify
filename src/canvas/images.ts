import DOMPurify from "dompurify";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import type { XYPosition } from "@xyflow/react";
import type { BoardStore } from "./boardStore";
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

export interface ImageImport {
  file: string;
  path: string;
  format: ImageFormat;
  bytes: number;
}

export interface ImportedImage {
  asset: ImageAsset;
  size: { width: number; height: number };
}

// Une résolution de images_dir par workspace ; un échec retire l'entrée, il sera réessayé.
const imagesDirs = new Map<string, Promise<string>>();

function imagesDirPath(workspaceId: string): Promise<string> {
  let dir = imagesDirs.get(workspaceId);
  if (!dir) {
    dir = invoke<string>("images_dir", { workspaceId }).catch((err: unknown) => {
      imagesDirs.delete(workspaceId);
      throw err;
    });
    imagesDirs.set(workspaceId, dir);
  }
  return dir;
}

// Même forme que validate_file_name côté Rust : `<uuid>.<ext>`, JPEG stocké en `.jpg`.
const IMAGE_FILE_NAME = /^[0-9a-f-]{36}\.(png|jpg|gif|webp|svg)$/;

export function isImageFileName(file: string): boolean {
  return IMAGE_FILE_NAME.test(file);
}

// Le séparateur est celui déjà présent dans le dossier (images_dir renvoie un chemin natif).
export function joinImagePath(dir: string, file: string): string {
  const sep = dir.includes("\\") ? "\\" : "/";
  return `${dir}${sep}${file}`;
}

// Dossier des images d'un board exporté : `<dossier>/<nom sans extension>-images`, à côté du fichier.
export function imagesFolderFor(path: string): string {
  const lastSeparator = Math.max(path.lastIndexOf("\\"), path.lastIndexOf("/"));
  const lastDot = path.lastIndexOf(".");
  const stem = lastDot > lastSeparator ? path.slice(0, lastDot) : path;
  return `${stem}-images`;
}

// Filtre du sélecteur d'images (menu « Image » et remplacement d'une image manquante).
export const IMAGE_DIALOG_FILTERS = [{ name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp", "svg"] }];

// Le nom vient du store SQLite (frontière de confiance) : il ne doit jamais sortir de images/.
export async function imageSrc(workspaceId: string, file: string): Promise<string> {
  if (!isImageFileName(file)) throw new Error(`Nom de fichier image invalide : ${file}`);
  return convertFileSrc(joinImagePath(await imagesDirPath(workspaceId), file));
}

// Copie une image déjà stockée dans images/ : import_image prend ce fichier comme source et crée un nouveau nom.
// Renvoie l'asset de la copie (originalName et addedAt y sont ceux de la copie : l'appelant garde ceux de l'original).
export async function duplicateImageAsset(workspaceId: string, file: string): Promise<ImageAsset> {
  if (!isImageFileName(file)) throw new Error(`Nom de fichier image invalide : ${file}`);
  const sourcePath = joinImagePath(await imagesDirPath(workspaceId), file);
  const imported = await invoke<ImageImport>("import_image", { workspaceId, sourcePath });
  const { asset } = await describeImport(workspaceId, imported, file);
  return asset;
}

export function basename(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

export function errorMessage(err: unknown): string {
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
export async function importImageAsset(workspaceId: string, path: string): Promise<ImportedImage> {
  const imported = await invoke<ImageImport>("import_image", { workspaceId, sourcePath: path });
  return describeImport(workspaceId, imported, basename(path));
}

// Mesure une copie déjà stockée dans images/ et construit son asset.
// Un SVG est assaini avant la mesure (R9) : la copie stockée est réécrite avec sa version propre.
export async function describeImport(
  workspaceId: string,
  imported: ImageImport,
  originalName: string,
): Promise<ImportedImage> {
  if (imported.format === "svg") await sanitizeStoredSvg(workspaceId, imported);
  const measured = await measureImage(convertFileSrc(imported.path));
  // Un SVG sans dimensions intrinsèques mesure 0 × 0 : on retient la taille par défaut.
  const natural = measured.width > 0 && measured.height > 0 ? measured : DEFAULT_SVG_SIZE;
  return {
    asset: {
      file: imported.file,
      format: imported.format,
      originalName,
      bytes: imported.bytes,
      width: natural.width,
      height: natural.height,
      addedAt: new Date().toISOString(),
    },
    size: fitImageSize(natural),
  };
}

// Importe les fichiers l'un après l'autre : un fichier en erreur n'empêche pas les autres.
// Contrat de l'appelant : une position par chemin. Vérifié avant tout import, pour ne pas créer de carte sans position.
export async function importImageFiles(
  store: BoardStore,
  paths: string[],
  positions: XYPosition[],
): Promise<string[]> {
  if (positions.length < paths.length) throw new Error("positions manquantes");
  const { workspaceId } = store.getState();
  const errors: string[] = [];
  for (const [index, path] of paths.entries()) {
    try {
      const { asset, size } = await importImageAsset(workspaceId, path);
      store.getState().addImageCard(asset, positions[index], size);
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
  if (!DOMPurify.isSupported) throw new Error("Assainissement SVG indisponible");
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

// Racine <svg> attendue après BOM, espaces, déclaration XML et commentaires (même règle que is_svg côté Rust, sensible à la casse).
// Chaque commentaire ne peut se terminer qu'à son premier `-->` (jetons « tempered ») : aucun découpage ambigu, donc pas de retour arrière exponentiel.
const SVG_ROOT = /^\uFEFF?\s*(<\?xml(?:(?!\?>)[\s\S])*\?>\s*)?(?:<!--(?:(?!-->)[\s\S])*-->\s*)*<svg[\s>/]/;

// Un texte vide ou sans racine <svg> (ex. HTML renvoyé à la place d'un SVG) est refusé.
export function assertSvgRoot(text: string): string {
  if (!SVG_ROOT.test(text)) throw new Error("SVG invalide");
  return text;
}

async function sanitizeStoredSvg(workspaceId: string, imported: ImageImport): Promise<void> {
  let raw: string;
  try {
    raw = await invoke<string>("read_text_file", { path: imported.path });
  } catch (error) {
    throw new Error(`Lecture du SVG impossible : ${error instanceof Error ? error.message : String(error)}`);
  }
  const clean = assertSvgRoot(sanitizeSvg(raw));
  await invoke("save_sanitized_svg", { workspaceId, file: imported.file, contents: clean });
}
