import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { serializeBoard } from "./boardFile";
import { createBoardStore, createCard } from "./boardStore";
import { attachAutosave, loadWorkspaceNodes, withFolder } from "./persistence";
import type { BoardNode } from "./types";

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: (path: string) => path,
  invoke: vi.fn(async () => null),
}));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn(), save: vi.fn() }));

const IMAGE_FILE = "11111111-2222-3333-4444-555555555555.png";

function agentNode(id: string, cwd: string): BoardNode {
  return {
    id,
    type: "agent",
    position: { x: 0, y: 0 },
    width: 560,
    height: 380,
    selected: false,
    data: {
      title: "Agent",
      status: "idle",
      terminal: { shell: "powershell", preset: "copilot", cwd, sessionId: `session-${id}` },
    },
  };
}

function imageNode(): BoardNode {
  return {
    id: "img",
    type: "image",
    position: { x: 10, y: 10 },
    width: 280,
    height: 200,
    selected: false,
    data: {
      title: "photo.png",
      status: "idle",
      image: {
        file: IMAGE_FILE,
        format: "png",
        originalName: "photo.png",
        bytes: 10,
        width: 280,
        height: 200,
        addedAt: "2026-01-01T00:00:00.000Z",
      },
    },
  };
}

describe("persistence", () => {
  beforeEach(() => {
    vi.stubGlobal("window", new EventTarget());
    vi.mocked(invoke).mockReset();
    vi.mocked(invoke).mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("withFolder remplace le cwd des agents seulement", () => {
    const nodes = [agentNode("a", "C:\\ancien"), createCard("note", { x: 0, y: 0 })];
    const out = withFolder(nodes, "C:\\projet");
    expect(out[0].data.terminal?.cwd).toBe("C:\\projet");
    expect(out[1]).toEqual(nodes[1]);
  });

  it("detach annule la sauvegarde en attente", () => {
    vi.useFakeTimers();
    const store = createBoardStore("ws-1", "C:\\projet", []);
    const detach = attachAutosave(store);
    store.getState().addCard("note", { x: 0, y: 0 });
    detach();
    vi.runAllTimers();
    expect(invoke).not.toHaveBeenCalledWith("save_board", expect.anything());
  });

  it("sauvegarde le board du workspace après le délai de debounce", () => {
    vi.useFakeTimers();
    const store = createBoardStore("ws-1", "C:\\projet", []);
    const detach = attachAutosave(store);
    store.getState().addCard("note", { x: 0, y: 0 });

    vi.advanceTimersByTime(499);
    expect(invoke).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(invoke).toHaveBeenCalledWith("save_board", { workspaceId: "ws-1", data: expect.any(String) });
    detach();
  });

  it("écrit la sauvegarde en attente au beforeunload", () => {
    vi.useFakeTimers();
    const store = createBoardStore("ws-1", "C:\\projet", []);
    const detach = attachAutosave(store);
    store.getState().addCard("note", { x: 0, y: 0 });

    window.dispatchEvent(new Event("beforeunload"));
    expect(invoke).toHaveBeenCalledWith("save_board", { workspaceId: "ws-1", data: expect.any(String) });
    detach();
  });

  it("charge les nœuds sauvegardés avec le dossier courant et purge les images inutilisées", async () => {
    vi.mocked(invoke).mockImplementation(async (command: string) =>
      command === "load_board" ? serializeBoard([agentNode("a", "C:\\ancien"), imageNode()]) : null,
    );

    const nodes = await loadWorkspaceNodes("ws-1", "C:\\projet");

    expect(invoke).toHaveBeenCalledWith("load_board", { workspaceId: "ws-1" });
    expect(nodes?.[0].data.terminal?.cwd).toBe("C:\\projet");
    expect(nodes?.[1].data.image?.file).toBe(IMAGE_FILE);
    expect(invoke).toHaveBeenCalledWith("purge_unused_images", { workspaceId: "ws-1", referenced: [IMAGE_FILE] });
  });

  it("renvoie undefined quand rien n'est sauvegardé ou que le chargement échoue", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await loadWorkspaceNodes("ws-1", "C:\\projet")).toBeUndefined();

    vi.mocked(invoke).mockRejectedValueOnce(new Error("base indisponible"));
    expect(await loadWorkspaceNodes("ws-1", "C:\\projet")).toBeUndefined();
    expect(consoleError).toHaveBeenCalled();
  });
});
