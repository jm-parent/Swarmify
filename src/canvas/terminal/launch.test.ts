import { describe, expect, it } from "vitest";
import { buildLaunch } from "./launch";

const base = { cwd: "C:\\projet", sessionId: "abc" };

describe("buildLaunch", () => {
  it("lance Claude Code avec un identifiant de session à la première exécution", () => {
    const spec = buildLaunch({ ...base, shell: "powershell", preset: "claude" }, false);
    expect(spec).toEqual({
      file: "powershell.exe",
      args: ["-NoLogo", "-NoExit", "-Command", "claude --session-id abc"],
    });
  });

  it("reprend la session Claude Code existante", () => {
    const spec = buildLaunch({ ...base, shell: "cmd", preset: "claude" }, true);
    expect(spec.args).toEqual(["/k", "claude --resume abc"]);
  });

  it("utilise l'option de reprise de Copilot CLI", () => {
    const spec = buildLaunch({ ...base, shell: "powershell", preset: "copilot" }, true);
    expect(spec.args[spec.args.length - 1]).toBe("copilot --resume=abc");
  });

  it("ouvre WSL sans commande quand le preset est shell", () => {
    const spec = buildLaunch({ ...base, shell: "wsl", preset: "shell" }, false);
    expect(spec).toEqual({ file: "wsl.exe", args: [] });
  });
});
