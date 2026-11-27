import type { XYPosition } from "@xyflow/react";
import type { BoardNode, GroupRole } from "../types";

export const GROUP_ROLES = [
  "frontend",
  "backend",
  "testers",
  "reviewers",
  "design",
  "docs",
  "security",
  "general",
] as const satisfies readonly GroupRole[];

export const DEFAULT_GROUP_NAME = "Nouveau groupe";
export const DEFAULT_GROUP_SIZE = { width: 600, height: 440 };
export const GROUP_MARGIN = 24;

export type GroupErrorCode = "NOT_FOUND" | "NOT_A_GROUP" | "NOT_AN_AGENT" | "EMPTY_NAME" | "INVALID_ROLE";

export class GroupError extends Error {
  readonly code: GroupErrorCode;

  constructor(code: GroupErrorCode, message: string) {
    super(message);
    this.name = "GroupError";
    this.code = code;
  }
}

export interface GroupCount {
  total: number;
  active: number;
}

function findNode(nodes: BoardNode[], id: string): BoardNode {
  const node = nodes.find((n) => n.id === id);
  if (!node) throw new GroupError("NOT_FOUND", `Carte introuvable : ${id}`);
  return node;
}

function findGroup(nodes: BoardNode[], groupId: string): BoardNode {
  const node = findNode(nodes, groupId);
  if (node.type !== "group") throw new GroupError("NOT_A_GROUP", `La carte ${groupId} n'est pas un groupe`);
  return node;
}

function membersOf(nodes: BoardNode[], groupId: string): BoardNode[] {
  return nodes.filter((n) => n.type === "agent" && n.parentId === groupId);
}

export function listGroups(nodes: BoardNode[]): BoardNode[] {
  return nodes.filter((n) => n.type === "group");
}

export function groupOf(nodes: BoardNode[], agentId: string): BoardNode | undefined {
  const agent = findNode(nodes, agentId);
  if (!agent.parentId) return undefined;
  return nodes.find((n) => n.id === agent.parentId);
}

export function countMembers(nodes: BoardNode[], groupId: string): GroupCount {
  findGroup(nodes, groupId);
  const members = membersOf(nodes, groupId);
  return {
    total: members.length,
    active: members.filter((m) => m.data.status === "running").length,
  };
}

// Position absolue d'une carte : un membre a une position relative à son cadre.
export function absolutePosition(nodes: BoardNode[], node: BoardNode): XYPosition {
  if (!node.parentId) return node.position;
  const parent = nodes.find((n) => n.id === node.parentId);
  if (!parent) return node.position;
  return { x: parent.position.x + node.position.x, y: parent.position.y + node.position.y };
}

// Invariant I8 : un groupe précède toujours ses membres dans le tableau.
function groupsFirst(nodes: BoardNode[]): BoardNode[] {
  return [...nodes.filter((n) => n.type === "group"), ...nodes.filter((n) => n.type !== "group")];
}

function release(node: BoardNode, position: XYPosition): BoardNode {
  const freed: BoardNode = { ...node, position };
  delete freed.parentId;
  return freed;
}

export function createGroup(
  nodes: BoardNode[],
  options: { name?: string; role?: GroupRole; position?: XYPosition; id?: string } = {},
): { nodes: BoardNode[]; id: string } {
  const title = (options.name ?? DEFAULT_GROUP_NAME).trim();
  if (!title) throw new GroupError("EMPTY_NAME", "Le nom du groupe ne peut pas être vide");
  const role = options.role ?? "general";
  if (!GROUP_ROLES.includes(role)) throw new GroupError("INVALID_ROLE", `Rôle inconnu : ${role}`);
  const id = options.id ?? crypto.randomUUID();
  const group: BoardNode = {
    id,
    type: "group",
    position: options.position ?? { x: 0, y: 0 },
    width: DEFAULT_GROUP_SIZE.width,
    height: DEFAULT_GROUP_SIZE.height,
    selected: false,
    data: { title, status: "idle", group: { role, minSize: { ...DEFAULT_GROUP_SIZE } } },
  };
  return { nodes: groupsFirst([group, ...nodes]), id };
}

export function renameGroup(nodes: BoardNode[], groupId: string, name: string): BoardNode[] {
  findGroup(nodes, groupId);
  const title = name.trim();
  if (!title) throw new GroupError("EMPTY_NAME", "Le nom du groupe ne peut pas être vide");
  return nodes.map((n) => (n.id === groupId ? { ...n, data: { ...n.data, title } } : n));
}

export function setGroupRole(nodes: BoardNode[], groupId: string, role: GroupRole): BoardNode[] {
  findGroup(nodes, groupId);
  if (!GROUP_ROLES.includes(role)) throw new GroupError("INVALID_ROLE", `Rôle inconnu : ${role}`);
  return nodes.map((n) =>
    n.id === groupId
      ? { ...n, data: { ...n.data, group: { minSize: { ...DEFAULT_GROUP_SIZE }, ...n.data.group, role } } }
      : n,
  );
}

// Un agent déjà membre d'un autre groupe le quitte : un agent, un groupe au plus (FR-005).
export function addAgentToGroup(nodes: BoardNode[], agentId: string, groupId: string): BoardNode[] {
  const agent = findNode(nodes, agentId);
  const group = findGroup(nodes, groupId);
  if (agent.type !== "agent") throw new GroupError("NOT_AN_AGENT", `La carte ${agentId} n'est pas un agent`);
  if (agent.parentId === groupId) return nodes;
  const absolute = absolutePosition(nodes, agent);
  const relative = { x: absolute.x - group.position.x, y: absolute.y - group.position.y };
  return fitGroup(groupsFirst(nodes.map((n) => (n.id === agentId ? { ...n, parentId: groupId, position: relative } : n))), groupId);
}

export function removeAgentFromGroup(nodes: BoardNode[], agentId: string): BoardNode[] {
  const agent = findNode(nodes, agentId);
  if (agent.type !== "agent") throw new GroupError("NOT_AN_AGENT", `La carte ${agentId} n'est pas un agent`);
  if (!agent.parentId) return nodes;
  const position = absolutePosition(nodes, agent);
  return fitGroup(nodes.map((n) => (n.id === agentId ? release(n, position) : n)), agent.parentId);
}

// Les membres ne sont jamais supprimés : ils deviennent libres à leur position absolue (FR-012).
export function deleteGroup(nodes: BoardNode[], groupId: string): BoardNode[] {
  findGroup(nodes, groupId);
  return nodes
    .filter((n) => n.id !== groupId)
    .map((n) => (n.type === "agent" && n.parentId === groupId ? release(n, absolutePosition(nodes, n)) : n));
}

interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function memberBox(nodes: BoardNode[], groupId: string): Box | undefined {
  const members = membersOf(nodes, groupId);
  if (members.length === 0) return undefined;
  const box: Box = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const m of members) {
    const at = absolutePosition(nodes, m);
    box.minX = Math.min(box.minX, at.x);
    box.minY = Math.min(box.minY, at.y);
    box.maxX = Math.max(box.maxX, at.x + (m.width ?? 0));
    box.maxY = Math.max(box.maxY, at.y + (m.height ?? 0));
  }
  return box;
}

// Cadre = boîte des membres + marge, sans descendre sous la taille minimale.
function frameFor(box: Box, minSize: { width: number; height: number }) {
  return {
    x: box.minX - GROUP_MARGIN,
    y: box.minY - GROUP_MARGIN,
    width: Math.max(box.maxX - box.minX + 2 * GROUP_MARGIN, minSize.width),
    height: Math.max(box.maxY - box.minY + 2 * GROUP_MARGIN, minSize.height),
  };
}

export function fitGroup(nodes: BoardNode[], groupId: string): BoardNode[] {
  const group = findGroup(nodes, groupId);
  const minSize = group.data.group?.minSize ?? DEFAULT_GROUP_SIZE;
  const box = memberBox(nodes, groupId);
  if (!box) {
    return nodes.map((n) => (n.id === groupId ? { ...n, width: minSize.width, height: minSize.height } : n));
  }
  const frame = frameFor(box, minSize);
  return nodes.map((n) => {
    if (n.id === groupId) {
      return { ...n, position: { x: frame.x, y: frame.y }, width: frame.width, height: frame.height };
    }
    if (n.type === "agent" && n.parentId === groupId) {
      const at = absolutePosition(nodes, n);
      return { ...n, position: { x: at.x - frame.x, y: at.y - frame.y } };
    }
    return n;
  });
}

export function minimumGroupSize(nodes: BoardNode[], groupId: string): { width: number; height: number } {
  const group = findGroup(nodes, groupId);
  const minSize = group.data.group?.minSize ?? DEFAULT_GROUP_SIZE;
  const box = memberBox(nodes, groupId);
  if (!box) return { ...minSize };
  const frame = frameFor(box, minSize);
  return { width: frame.width, height: frame.height };
}

// Le redimensionnement à la main ne descend pas sous la boîte des membres. La taille obtenue devient la taille minimale.
export function resizeGroup(nodes: BoardNode[], groupId: string, size: { width: number; height: number }): BoardNode[] {
  const min = minimumGroupSize(nodes, groupId);
  const minSize = { width: Math.max(size.width, min.width), height: Math.max(size.height, min.height) };
  const withSize = nodes.map((n) =>
    n.id === groupId ? { ...n, data: { ...n.data, group: { role: n.data.group?.role ?? "general", minSize } } } : n,
  );
  return fitGroup(withSize, groupId);
}

// Carte la plus petite qui contient le centre de la carte (research.md R4).
function containingGroup(nodes: BoardNode[], agent: BoardNode): BoardNode | undefined {
  const at = absolutePosition(nodes, agent);
  const cx = at.x + (agent.width ?? 0) / 2;
  const cy = at.y + (agent.height ?? 0) / 2;
  let best: BoardNode | undefined;
  let bestArea = Infinity;
  for (const g of listGroups(nodes)) {
    const w = g.width ?? 0;
    const h = g.height ?? 0;
    const inside = cx >= g.position.x && cx <= g.position.x + w && cy >= g.position.y && cy <= g.position.y + h;
    if (inside && w * h < bestArea) {
      best = g;
      bestArea = w * h;
    }
  }
  return best;
}

// Règle de relâchement : rejoint le plus petit cadre contenant le centre, sinon quitte son cadre.
export function settleMembership(nodes: BoardNode[], agentIds: string[]): BoardNode[] {
  let result = nodes;
  const touched = new Set<string>();
  for (const id of agentIds) {
    const agent = result.find((n) => n.id === id);
    if (!agent || agent.type !== "agent") continue;
    const before = agent.parentId;
    const target = containingGroup(result, agent);
    if (before) touched.add(before);
    if (target) {
      touched.add(target.id);
      result = addAgentToGroup(result, id, target.id);
    } else if (before) {
      result = removeAgentFromGroup(result, id);
    }
  }
  for (const groupId of touched) {
    if (result.some((n) => n.id === groupId)) result = fitGroup(result, groupId);
  }
  return result;
}
