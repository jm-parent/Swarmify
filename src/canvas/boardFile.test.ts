import { describe, expect, it } from "vitest";
import { parseBoard, serializeBoard } from "./boardFile";
import type { BoardNode } from "./types";

const node: BoardNode = {
  id: "k1",
  type: "kanban",
  position: { x: 10, y: 20 },
  width: 280,
  height: 260,
  selected: true,
  data: {
    title: "Tâches",
    status: "idle",
    items: [{ id: "i1", text: "Socle", done: true }],
  },
};

describe("boardFile", () => {
  it("restaure les cartes sans l'état de sélection", () => {
    const [restored] = parseBoard(serializeBoard([node]));
    expect(restored).toEqual({ ...node, selected: false });
  });

  it("refuse un fichier d'une autre version", () => {
    expect(() => parseBoard(JSON.stringify({ version: 2, nodes: [] }))).toThrow("version");
  });

  it("refuse une carte dont le type est inconnu", () => {
    const text = JSON.stringify({ version: 1, nodes: [{ ...node, type: "web" }] });
    expect(() => parseBoard(text)).toThrow("invalide");
  });
});
