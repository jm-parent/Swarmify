import { beforeEach, describe, expect, it, vi } from "vitest";
import { attachAutosave, loadWorkspaceNodes } from "../canvas/persistence";
import {
  createWorkspace,
  deleteWorkspace,
  listWorkspaces,
  markOpened,
  renameWorkspace,
  type Workspace,
} from "./workspaceApi";
import { cleanName, pickStartupWorkspace, useWorkspaceStore } from "./workspaceStore";

vi.mock("./workspaceApi");
vi.mock("../canvas/persistence");

function ws(overrides: Partial<Workspace> & { id: string }): Workspace {
  return {
    name: overrides.id,
    folder: `C:\\${overrides.id}`,
    createdAt: 0,
    lastOpenedAt: null,
    folderExists: true,
    ...overrides,
  };
}

const { getState, setState } = useWorkspaceStore;

beforeEach(() => {
  vi.resetAllMocks();
  setState({ loaded: false, workspaces: [], activeId: null, open: {}, error: null });
  vi.mocked(loadWorkspaceNodes).mockResolvedValue(undefined);
  vi.mocked(attachAutosave).mockImplementation(() => vi.fn());
  vi.mocked(markOpened).mockResolvedValue();
});

describe("cleanName", () => {
  it("refuse un nom vide et retire les espaces autour", () => {
    expect(() => cleanName("   ")).toThrow("Le nom ne peut pas être vide");
    expect(cleanName("  Projet  ")).toBe("Projet");
  });
});

describe("pickStartupWorkspace", () => {
  it("prend le dernier ouvert, sinon le plus récent créé", () => {
    const a = ws({ id: "a", createdAt: 1, lastOpenedAt: 50 });
    const b = ws({ id: "b", createdAt: 9, lastOpenedAt: null });
    expect(pickStartupWorkspace([a, b])?.id).toBe("a");
    expect(pickStartupWorkspace([ws({ id: "c", createdAt: 3 }), b])?.id).toBe("b");
    expect(pickStartupWorkspace([])).toBeUndefined();
  });
});

describe("workspaceStore", () => {
  it("load active le workspace de démarrage et marque le store chargé", async () => {
    vi.mocked(listWorkspaces).mockResolvedValue([
      ws({ id: "a", createdAt: 1, lastOpenedAt: 50 }),
      ws({ id: "b", createdAt: 9 }),
    ]);

    await getState().load();

    expect(getState().loaded).toBe(true);
    expect(getState().activeId).toBe("a");
    expect(loadWorkspaceNodes).toHaveBeenCalledWith("a", "C:\\a");
    expect(markOpened).toHaveBeenCalledWith("a");
  });

  it("load sans workspace marque le store chargé sans rien activer", async () => {
    vi.mocked(listWorkspaces).mockResolvedValue([]);

    await getState().load();

    expect(getState().loaded).toBe(true);
    expect(getState().activeId).toBeNull();
    expect(loadWorkspaceNodes).not.toHaveBeenCalled();
  });

  it("create sans nom prend le nom du dossier et active le workspace créé", async () => {
    vi.mocked(createWorkspace).mockImplementation(async (id, folder, name) =>
      ws({ id, folder, name, createdAt: 5 }),
    );

    await getState().create("C:\\Devs\\Projet");

    const id = vi.mocked(createWorkspace).mock.calls[0][0];
    expect(createWorkspace).toHaveBeenCalledWith(id, "C:\\Devs\\Projet", "Projet");
    expect(getState().workspaces.map((w) => w.name)).toEqual(["Projet"]);
    expect(getState().activeId).toBe(id);
  });

  it("create refuse un nom vide sans créer le workspace", async () => {
    await getState().create("C:\\projet", "   ");

    expect(createWorkspace).not.toHaveBeenCalled();
    expect(getState().error).toBe("Le nom ne peut pas être vide");
  });

  it("rename en échec enregistre l'erreur sans la relancer", async () => {
    setState({ workspaces: [ws({ id: "a" })] });
    vi.mocked(renameWorkspace).mockRejectedValue(new Error("nom refusé"));

    await expect(getState().rename("a", "Neuf")).resolves.toBeUndefined();

    expect(getState().error).toBe("nom refusé");
    expect(getState().workspaces[0].name).toBe("a");
  });

  it("remove détache l'autosave avant de supprimer côté Rust", async () => {
    const detach = vi.fn();
    vi.mocked(attachAutosave).mockReturnValue(detach);
    vi.mocked(deleteWorkspace).mockResolvedValue();
    setState({ workspaces: [ws({ id: "a" })] });
    await getState().activate("a");

    await getState().remove("a");

    expect(detach).toHaveBeenCalledOnce();
    expect(detach.mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(deleteWorkspace).mock.invocationCallOrder[0],
    );
    expect(getState().open).toEqual({});
  });

  it("remove rattache l'autosave si la suppression Rust échoue", async () => {
    const first = vi.fn();
    const second = vi.fn();
    vi.mocked(attachAutosave).mockReturnValueOnce(first).mockReturnValueOnce(second);
    vi.mocked(deleteWorkspace).mockRejectedValue(new Error("disque bloqué"));
    setState({ workspaces: [ws({ id: "a" })] });
    await getState().activate("a");

    await getState().remove("a");

    expect(first).toHaveBeenCalledOnce();
    expect(attachAutosave).toHaveBeenCalledTimes(2);
    expect(getState().error).toBe("disque bloqué");
    expect(getState().workspaces.map((w) => w.id)).toEqual(["a"]);
    expect(getState().open.a).toBeDefined();
  });
});
