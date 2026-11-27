import type { Node } from "@xyflow/react";
import type { TerminalConfig } from "./terminal/launch";

export type CardType = "note" | "kanban" | "agent" | "image";
export type CardStatus = "idle" | "active" | "running" | "waiting" | "error";
export type ImageFormat = "png" | "jpeg" | "gif" | "webp" | "svg";

export interface KanbanItem {
  id: string;
  text: string;
  done: boolean;
}

// Image importée : `file` est le nom dans images/ (<uuid>.<ext>), jamais un chemin.
export interface ImageAsset {
  file: string;
  format: ImageFormat;
  originalName: string;
  bytes: number;
  width: number;
  height: number;
  addedAt: string;
}

export interface CardData extends Record<string, unknown> {
  title: string;
  status: CardStatus;
  body?: string;
  items?: KanbanItem[];
  terminal?: TerminalConfig;
  // Commande envoyée au shell dès son lancement, une seule fois.
  startCommand?: string;
  image?: ImageAsset;
}

export type BoardNode = Node<CardData, CardType>;
