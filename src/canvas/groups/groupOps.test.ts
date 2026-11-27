import { describe, expect, it } from "vitest";
import type { BoardNode } from "../types";
import {
  addAgentToGroup,
  countMembers,
  createGroup,
  deleteGroup,
  GroupError,
  groupOf,
  removeAgentFromGroup,
  renameGroup,
  settleMembership,
  listGroups,
  resizeGroup,
} from "./groupOps";

const terminal = { shell: "powershell", preset: "copilot", cwd: "", sessionId: "s" } as const;

function agent(
  id: string,
  position = { x: 0, y: 0 },
  status: BoardNode["data"]["status"] = "idle",
  parentId?: string,
): BoardNode {
  return {
    id,
    type: "agent",
    position,
    width: 560,
    height: 380,
    ...(parentId ? { parentId } : {}),
    data: { title: id, status, terminal: { ...terminal } },
  } as BoardNode;
}

function group(id: string, position: { x: number; y: number }, width = 600, height = 440): BoardNode {
  return {
    id,
    type: "group",
    position,
    width,
    height,
    data: { title: id, status: "idle", group: { role: "general", minSize: { width: 600, height: 440 } } },
  } as BoardNode;
}

function note(id: string): BoardNode {
  return {
    id,
    type: "note",
    position: { x: 0, y: 0 },
    width: 280,
    height: 200,
    data: { title: "Note", status: "idle", body: "" },
  } as BoardNode;
}

function codeOf(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (err) {
    return err instanceof GroupError ? err.code : undefined;
  }
  return undefined;
}

describe("groupOps", () => {
  it("place le groupe créé en tête du tableau, avec les valeurs par défaut", () => {
    const { nodes, id } = createGroup([agent("a1")]);
    expect(nodes[0].id).toBe(id);
    expect(nodes[0].data.title).toBe("Nouveau groupe");
    expect(nodes[0].data.group).toEqual({ role: "general", minSize: { width: 600, height: 440 } });
  });

  it("refuse un renommage vide sans modifier le tableau", () => {
    const nodes = [group("g1", { x: 0, y: 0 })];
    expect(codeOf(() => renameGroup(nodes, "g1", "   "))).toBe("EMPTY_NAME");
    expect(nodes[0].data.title).toBe("g1");
  });

  it("refuse d'ajouter une note à un groupe", () => {
    const nodes = [group("g1", { x: 0, y: 0 }), note("n1")];
    expect(codeOf(() => addAgentToGroup(nodes, "n1", "g1"))).toBe("NOT_AN_AGENT");
    expect(nodes[1].parentId).toBeUndefined();
  });

  it("fait passer un agent d'un groupe à un autre", () => {
    const nodes = [
      group("gA", { x: 0, y: 0 }),
      group("gB", { x: 1000, y: 0 }),
      agent("a1", { x: 100, y: 100 }, "idle", "gA"),
    ];
    const moved = addAgentToGroup(nodes, "a1", "gB");
    expect(groupOf(moved, "a1")?.id).toBe("gB");
    expect(countMembers(moved, "gA").total).toBe(0);
    expect(countMembers(moved, "gB").total).toBe(1);
  });

  it("libère les membres d'un groupe supprimé à leur position absolue", () => {
    const nodes = [group("gA", { x: 500, y: 300 }), agent("a1", { x: 100, y: 100 }, "idle", "gA")];
    const after = deleteGroup(nodes, "gA");
    const freed = after.find((n) => n.id === "a1");
    expect(after.some((n) => n.id === "gA")).toBe(false);
    expect(freed?.parentId).toBeUndefined();
    expect(freed?.position).toEqual({ x: 600, y: 400 });
  });

  it("compte les membres et les membres actifs", () => {
    const members = Array.from({ length: 7 }, (_, i) =>
      agent(`a${i}`, { x: 10 * i, y: 0 }, i < 3 ? "running" : "idle", "gA"),
    );
    const nodes = [group("gA", { x: 0, y: 0 }), ...members];
    expect(countMembers(nodes, "gA")).toEqual({ total: 7, active: 3 });
  });

  it("choisit le plus petit cadre quand deux cadres se recouvrent", () => {
    const nodes = [
      group("gBig", { x: 0, y: 0 }, 1000, 800),
      group("gSmall", { x: 200, y: 200 }, 400, 300),
      agent("a1", { x: 300, y: 300 }),
    ];
    const settled = settleMembership(nodes, ["a1"]);
    expect(groupOf(settled, "a1")?.id).toBe("gSmall");
  });

  it("retire un agent dont le centre est hors de tout cadre", () => {
    const nodes = [group("gA", { x: 0, y: 0 }), agent("a1", { x: 2000, y: 2000 }, "idle", "gA")];
    const settled = settleMembership(nodes, ["a1"]);
    expect(settled.find((n) => n.id === "a1")?.parentId).toBeUndefined();
    expect(countMembers(settled, "gA").total).toBe(0);
  });

  it("ne fait pas entrer une note déposée dans un cadre", () => {
    const nodes = [group("gA", { x: 0, y: 0 }), note("n1")];
    const settled = settleMembership(nodes, ["n1"]);
    expect(settled.find((n) => n.id === "n1")?.parentId).toBeUndefined();
    expect(listGroups(settled)).toHaveLength(1);
  });

  it("ne rattache pas un agent hors groupe recouvert par un cadre qui grandit", () => {
    const nodes = [
      group("gA", { x: 0, y: 0 }),
      agent("a1", { x: 100, y: 100 }, "idle", "gA"),
      agent("a2", { x: 100, y: 300 }),
      agent("f1", { x: 650, y: 100 }),
    ];
    const grown = addAgentToGroup(nodes, "a2", "gA");
    expect(grown.find((n) => n.id === "f1")?.parentId).toBeUndefined();
  });

  it("agrandit le cadre pour englober un membre ajouté, avec la marge", () => {
    const nodes = [
      group("gA", { x: 0, y: 0 }),
      agent("a1", { x: 100, y: 100 }, "idle", "gA"),
      agent("a2", { x: 900, y: 100 }),
    ];
    const grown = addAgentToGroup(nodes, "a2", "gA").find((n) => n.id === "gA");
    expect(grown?.width).toBe(1408);
    expect(grown?.position.x).toBe(76);
  });

  it("réduit le cadre au retrait d'un membre sans descendre sous la taille minimale", () => {
    const nodes = [
      group("gA", { x: 0, y: 0 }),
      agent("a1", { x: 100, y: 100 }, "idle", "gA"),
      agent("a2", { x: 900, y: 100 }, "idle", "gA"),
    ];
    const shrunk = removeAgentFromGroup(nodes, "a2").find((n) => n.id === "gA");
    expect(shrunk?.width).toBe(608);
    expect(shrunk?.height).toBe(440);
  });

  it("garde une taille choisie à la main comme minimum après le départ d'un membre", () => {
    const nodes = [
      group("gA", { x: 0, y: 0 }),
      agent("a1", { x: 100, y: 100 }, "idle", "gA"),
      agent("a2", { x: 900, y: 100 }),
    ];
    const resized = resizeGroup(nodes, "gA", { width: 900, height: 700 });
    const withSecond = addAgentToGroup(resized, "a2", "gA");
    const shrunk = removeAgentFromGroup(withSecond, "a2").find((n) => n.id === "gA");
    expect(shrunk?.data.group?.minSize).toEqual({ width: 900, height: 700 });
    expect(shrunk?.width).toBe(900);
    expect(shrunk?.height).toBe(700);
  });

  it("borne le redimensionnement à la boîte des membres", () => {
    const nodes = [group("gA", { x: 0, y: 0 }), agent("a1", { x: 100, y: 100 }, "idle", "gA")];
    const bounded = resizeGroup(nodes, "gA", { width: 100, height: 100 }).find((n) => n.id === "gA");
    expect(bounded?.width).toBe(608);
    expect(bounded?.height).toBe(440);
  });

  it("déplace le cadre quand un membre déborde en haut et à gauche, sans bouger le membre", () => {
    const nodes = [
      group("gA", { x: 500, y: 500 }),
      agent("a1", { x: -100, y: -100 }, "idle", "gA"),
      agent("a2", { x: 2000, y: 2000 }),
    ];
    const fitted = addAgentToGroup(nodes, "a2", "gA");
    const frame = fitted.find((n) => n.id === "gA");
    const member = fitted.find((n) => n.id === "a1");
    expect(frame?.position).toEqual({ x: 376, y: 376 });
    expect(frame!.position.x + member!.position.x).toBe(400);
    expect(frame!.position.y + member!.position.y).toBe(400);
  });

  it("retire un agent avec removeAgentFromGroup et garde sa position absolue", () => {
    const nodes = [group("gA", { x: 500, y: 300 }), agent("a1", { x: 100, y: 100 }, "idle", "gA")];
    const freed = removeAgentFromGroup(nodes, "a1").find((n) => n.id === "a1");
    expect(freed?.parentId).toBeUndefined();
    expect(freed?.position).toEqual({ x: 600, y: 400 });
  });
});
