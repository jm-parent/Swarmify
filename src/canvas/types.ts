import type { Node } from "@xyflow/react";

export type CardType = "note" | "kanban";
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
}

export type BoardNode = Node<CardData, CardType>;
