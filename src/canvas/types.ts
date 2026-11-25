import type { Node } from "@xyflow/react";
import type { TerminalConfig } from "./terminal/launch";

export type CardType = "note" | "kanban" | "agent";
export type CardStatus = "idle" | "active" | "running" | "waiting" | "error";

export interface KanbanItem {
  id: string;
  text: string;
  done: boolean;
}

export interface CardData extends Record<string, unknown> {
  title: string;
  status: CardStatus;
  collapsed: boolean;
  body?: string;
  items?: KanbanItem[];
  terminal?: TerminalConfig;
  // Commande envoyée au shell dès son lancement, une seule fois.
  startCommand?: string;
}

export type BoardNode = Node<CardData, CardType>;
