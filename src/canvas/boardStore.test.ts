import { beforeEach, describe, expect, it } from "vitest";
import { useBoardStore } from "./boardStore";

const { getState, setState } = useBoardStore;

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
});
