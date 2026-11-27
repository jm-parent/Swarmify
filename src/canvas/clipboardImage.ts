import { invoke } from "@tauri-apps/api/core";
import { readImage } from "@tauri-apps/plugin-clipboard-manager";
import { describeImport, type ImageImport, type ImportedImage } from "./images";

const BASE64_CHUNK = 0x8000;

// readImage() donne des pixels RGBA bruts, pas un PNG : on les encode via un canvas.
async function encodePng(rgba: Uint8Array, width: number, height: number): Promise<Uint8Array> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas indisponible");
  const pixels = new Uint8ClampedArray(rgba.buffer as ArrayBuffer, rgba.byteOffset, rgba.byteLength);
  context.putImageData(new ImageData(pixels, width, height), 0, 0);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Encodage PNG impossible");
  return new Uint8Array(await blob.arrayBuffer());
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += BASE64_CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + BASE64_CHUNK));
  }
  return btoa(binary);
}

// Renvoie null si le presse-papiers ne contient pas d'image (le plugin rejette alors readImage).
// Une image présente mais impossible à importer lève une erreur.
export async function importClipboardImage(): Promise<ImportedImage | null> {
  const image = await readImage().catch(() => null);
  if (!image) return null;
  try {
    const { width, height } = await image.size();
    const png = await encodePng(await image.rgba(), width, height);
    const imported = await invoke<ImageImport>("save_image_bytes", {
      format: "png",
      dataBase64: toBase64(png),
    });
    return await describeImport(imported, "Presse-papiers.png");
  } finally {
    await image.close().catch(() => {});
  }
}
