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

  const UUID = "0b1c2d3e-4f50-4617-8899-aabbccddeeff";

  const imageText = (patch: Record<string, unknown>) => {
    const base = {
      id: "img1",
      type: "image",
      position: { x: 0, y: 0 },
      data: {
        title: "logo",
        status: "idle",
        image: {
          file: `${UUID}.png`,
          format: "png",
          originalName: "logo.png",
          bytes: 1024,
          width: 10,
          height: 10,
          addedAt: "2026-11-26T08:00:00.000Z",
          ...patch,
        },
      },
    };
    return JSON.stringify({ version: 1, nodes: [base] });
  };

  it.each([
    ["bytes à 0", { bytes: 0 }],
    ["bytes au-dessus de 20 Mo", { bytes: 20971521 }],
    ["bytes non numérique", { bytes: "1024" }],
    ["originalName non textuel", { originalName: 42 }],
    ["addedAt non textuel", { addedAt: 1700000000 }],
  ])("refuse une carte image avec %s", (_label, patch) => {
    expect(() => parseBoard(imageText(patch))).toThrow("invalide");
  });

  it("accepte une carte image à exactement 20 Mo", () => {
    expect(parseBoard(imageText({ bytes: 20971520 }))).toHaveLength(1);
  });

  it.each([
    ["un chemin relatif", `../${UUID}.png`],
    ["un sous-dossier", `a/${UUID}.png`],
    ["une extension non autorisée", `${UUID}.exe`],
    ["l'extension .jpeg", `${UUID}.jpeg`],
  ])("refuse un fichier image avec %s", (_label, file) => {
    expect(() => parseBoard(imageText({ file }))).toThrow("invalide");
  });

  it("refuse un format hors énumération", () => {
    expect(() => parseBoard(imageText({ format: "bmp" }))).toThrow("invalide");
  });

  it("refuse une largeur nulle", () => {
    expect(() => parseBoard(imageText({ width: 0 }))).toThrow("invalide");
  });

  it("accepte un fichier .jpg au format jpeg", () => {
    const [restored] = parseBoard(imageText({ file: `${UUID}.jpg`, format: "jpeg" }));
    expect(restored.data.image?.file).toBe(`${UUID}.jpg`);
  });
});
