import { beforeEach, describe, expect, it } from "vitest";
import { useBoardStore } from "./boardStore";

const { getState, setState } = useBoardStore;

const imageAsset = {
  file: "a.png",
  format: "png" as const,
  originalName: "photo.png",
  bytes: 10,
  width: 960,
  height: 640,
  addedAt: "2026-01-01T00:00:00.000Z",
};

function seedNodes() {
  setState({
    nodes: [
      { id: "n1", type: "note", position: { x: 0, y: 0 }, data: { title: "A", status: "idle", body: "" }, selected: true },
      { id: "n2", type: "note", position: { x: 300, y: 0 }, data: { title: "B", status: "idle", body: "" }, selected: false },
    ],
    past: [],
    future: [],
    clipboard: [],
  });
}

describe("boardStore", () => {
  beforeEach(seedNodes);

  it("annule et refait un ajout de carte", () => {
    getState().addCard("kanban", { x: 10, y: 10 });
    expect(getState().nodes).toHaveLength(3);

    getState().undo();
    expect(getState().nodes.map((n) => n.id)).toEqual(["n1", "n2"]);

    getState().redo();
    expect(getState().nodes).toHaveLength(3);
  });

  it("colle les cartes sélectionnées avec de nouveaux ids et les sélectionne", () => {
    getState().copySelected();
    getState().paste();

    const { nodes } = getState();
    expect(nodes).toHaveLength(3);
    const pasted = nodes[2];
    expect(pasted.id).not.toBe("n1");
    expect(pasted.position).toEqual({ x: 40, y: 40 });
    expect(pasted.selected).toBe(true);
    expect(nodes[1].selected).toBe(false);
  });

  it("supprime seulement la sélection, de façon annulable", () => {
    getState().deleteSelected();
    expect(getState().nodes.map((n) => n.id)).toEqual(["n2"]);

    getState().undo();
    expect(getState().nodes.map((n) => n.id)).toEqual(["n1", "n2"]);
  });

  it("ajoute une carte image sélectionnée avec son asset", () => {
    const asset = {
      file: "a.png",
      format: "png" as const,
      originalName: "photo.png",
      bytes: 10,
      width: 960,
      height: 640,
      addedAt: "2026-01-01T00:00:00.000Z",
    };
    const id = getState().addImageCard(asset, { x: 5, y: 6 }, { width: 480, height: 320 });

    const card = getState().nodes[2];
    expect(card).toMatchObject({
      id,
      type: "image",
      position: { x: 5, y: 6 },
      width: 480,
      height: 320,
      selected: true,
      data: { title: "photo.png", status: "idle", image: asset },
    });
    expect(getState().nodes[0].selected).toBe(false);
  });

  it("remplace l'image d'une carte sans changer sa position ni sa taille, de façon annulable", () => {
    const asset = {
      file: "a.png",
      format: "png" as const,
      originalName: "photo.png",
      bytes: 10,
      width: 960,
      height: 640,
      addedAt: "2026-01-01T00:00:00.000Z",
    };
    const id = getState().addImageCard(asset, { x: 5, y: 6 }, { width: 480, height: 320 });
    const replacement = { ...asset, file: "b.png", originalName: "autre.png", bytes: 20 };

    getState().replaceImage(id, replacement);
    expect(getState().nodes[2]).toMatchObject({
      position: { x: 5, y: 6 },
      width: 480,
      height: 320,
      data: { title: "autre.png", image: replacement },
    });

    getState().undo();
    expect(getState().nodes[2].data.image).toEqual(asset);
  });

  it("annule l'ajout d'une carte image", () => {
    getState().addImageCard(imageAsset, { x: 5, y: 6 }, { width: 480, height: 320 });
    expect(getState().nodes).toHaveLength(3);

    getState().undo();
    expect(getState().nodes.map((n) => n.id)).toEqual(["n1", "n2"]);
  });

  it("restaure une carte image supprimée avec son image intacte", () => {
    const id = getState().addImageCard(imageAsset, { x: 5, y: 6 }, { width: 480, height: 320 });
    getState().deleteSelected();
    expect(getState().nodes.map((n) => n.id)).toEqual(["n1", "n2"]);

    getState().undo();
    expect(getState().nodes[2]).toMatchObject({ id, data: { image: imageAsset } });
  });

  it("remplace l'asset d'une carte sans ajouter de point d'annulation", () => {
    const id = getState().addImageCard(imageAsset, { x: 5, y: 6 }, { width: 480, height: 320 });
    const pastLength = getState().past.length;
    const copy = { ...imageAsset, file: "copie.png", bytes: 20 };

    getState().patchImageAsset(id, copy);

    expect(getState().past).toHaveLength(pastLength);
    expect(getState().nodes[2]).toMatchObject({ position: { x: 5, y: 6 }, width: 480, height: 320, data: { image: copy } });
  });

  it("ignore le patch d'une carte absente", () => {
    getState().addImageCard(imageAsset, { x: 5, y: 6 }, { width: 480, height: 320 });
    const before = getState().nodes;
    const pastLength = getState().past.length;

    getState().patchImageAsset("absente", { ...imageAsset, file: "copie.png" });

    expect(getState().nodes).toBe(before);
    expect(getState().past).toHaveLength(pastLength);
  });

  it("annule un collage d'image en retirant la copie et garde l'original", () => {
    getState().addImageCard(imageAsset, { x: 5, y: 6 }, { width: 480, height: 320 });
    const before = getState().nodes;
    getState().copySelected();

    const [pastedId] = getState().paste();
    getState().patchImageAsset(pastedId, { ...imageAsset, file: "copie.png" });
    expect(getState().nodes).toHaveLength(4);

    getState().undo();
    expect(getState().nodes).toEqual(before);
    expect(getState().nodes[2].data.image).toEqual(imageAsset);
  });

  it("ne crée pas de point d'annulation quand la carte n'existe plus", () => {
    const asset = {
      file: "b.png",
      format: "png" as const,
      originalName: "autre.png",
      bytes: 20,
      width: 960,
      height: 640,
      addedAt: "2026-01-01T00:00:00.000Z",
    };
    getState().replaceImage("absente", asset);

    expect(getState().past).toEqual([]);
    expect(getState().nodes.map((n) => n.id)).toEqual(["n1", "n2"]);
  });
});
