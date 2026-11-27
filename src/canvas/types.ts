import type { Node } from "@xyflow/react";
import type { TerminalConfig } from "./terminal/launch";

export type CardType = "note" | "kanban" | "agent" | "image" | "group";
export type CardStatus = "idle" | "active" | "running" | "waiting" | "error";
export type ImageFormat = "png" | "jpeg" | "gif" | "webp" | "svg";
export type GroupRole =
  | "frontend"
  | "backend"
  | "testers"
  | "reviewers"
  | "design"
  | "docs"
  | "security"
  | "general";

export interface GroupMeta {
  role: GroupRole;
  // Taille choisie à la main, ou la taille par défaut d'un groupe vide.
  minSize: { width: number; height: number };
}

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
  // Présent uniquement sur les nœuds de type "group".
  group?: GroupMeta;
}

export type BoardNode = Node<CardData, CardType>;
