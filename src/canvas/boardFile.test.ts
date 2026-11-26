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

  it("accepte une carte image valide", () => {
    const image: BoardNode = {
      id: "img1",
      type: "image",
      position: { x: 0, y: 0 },
      width: 480,
      height: 360,
      data: {
        title: "logo.svg",
        status: "idle",
        image: {
          file: "0b1c2d3e-4f50-4617-8899-aabbccddeeff.svg",
          format: "svg",
          originalName: "logo.svg",
          bytes: 1024,
          width: 480,
          height: 360,
          addedAt: "2026-11-26T08:00:00.000Z",
        },
      },
    };
    const [restored] = parseBoard(serializeBoard([image]));
    expect(restored.data.image).toEqual(image.data.image);
  });

  it("refuse une carte image sans fichier image valide", () => {
    const image = {
      id: "img1",
      type: "image",
      position: { x: 0, y: 0 },
      data: { title: "logo", status: "idle", image: { format: "png", width: 10, height: 10 } },
    };
    const text = JSON.stringify({ version: 1, nodes: [image] });
    expect(() => parseBoard(text)).toThrow("invalide");
  });
});
