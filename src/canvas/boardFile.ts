import type { BoardNode, CardStatus, ImageFormat } from "./types";

export const BOARD_FILE_VERSION = 1;

const CARD_TYPES = ["note", "kanban", "agent", "image"];
const CARD_STATUSES: CardStatus[] = ["idle", "active", "running", "waiting", "error"];
const IMAGE_FILE_PATTERN = /^[0-9a-f-]{36}\.(png|jpg|gif|webp|svg)$/;
const IMAGE_FORMATS: ImageFormat[] = ["png", "jpeg", "gif", "webp", "svg"];

function isValidImage(image: any): boolean {
  return (
    typeof image === "object" &&
    image !== null &&
    typeof image.file === "string" &&
    IMAGE_FILE_PATTERN.test(image.file) &&
    IMAGE_FORMATS.includes(image.format) &&
    typeof image.width === "number" &&
    image.width > 0 &&
    typeof image.height === "number" &&
    image.height > 0
  );
}

export function serializeBoard(nodes: BoardNode[]): string {
  const stored = nodes.map(({ id, type, position, width, height, data }) => ({
    id,
    type,
    position,
    width,
    height,
    data,
  }));
  return JSON.stringify({ version: BOARD_FILE_VERSION, nodes: stored }, null, 2);
}

// Valide le contenu importé avant de le donner à React Flow.
export function parseBoard(text: string): BoardNode[] {
  const file = JSON.parse(text) as { version?: unknown; nodes?: unknown };
  if (file.version !== BOARD_FILE_VERSION) {
    throw new Error(`Format de board non supporté (version ${String(file.version)}).`);
  }
  if (!Array.isArray(file.nodes)) throw new Error("Fichier de board invalide.");

  return file.nodes.map((raw: any) => {
    const valid =
      typeof raw?.id === "string" &&
      CARD_TYPES.includes(raw.type) &&
      typeof raw.position?.x === "number" &&
      typeof raw.position?.y === "number" &&
      typeof raw.data?.title === "string" &&
      CARD_STATUSES.includes(raw.data?.status) &&
      (raw.type !== "agent" || typeof raw.data?.terminal?.sessionId === "string") &&
      (raw.type !== "image" || isValidImage(raw.data?.image));
    if (!valid) throw new Error("Fichier de board invalide.");
    // Aucun processus ne survit à la fermeture de l'app : un statut d'exécution restauré devient « idle ».
    const status = ["running", "active", "waiting"].includes(raw.data.status) ? "idle" : raw.data.status;
    return { ...raw, selected: false, data: { ...raw.data, status } } as BoardNode;
  });
}
