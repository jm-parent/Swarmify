import { useEffect, useState, type ComponentType } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Claude, Codex, Copilot } from "@lobehub/icons";
import type { AgentPreset } from "./terminal/launch";

export interface Provider {
  id: Exclude<AgentPreset, "shell">;
  label: string;
  binary: string;
  install: string;
  Logo: ComponentType<{ size?: number }>;
}

export const PROVIDERS: Provider[] = [
  { id: "claude", label: "Claude Code", binary: "claude", install: "npm install -g @anthropic-ai/claude-code", Logo: Claude.Color },
  { id: "codex", label: "Codex", binary: "codex", install: "npm install -g @openai/codex", Logo: Codex.Color },
  { id: "copilot", label: "Copilot CLI", binary: "copilot", install: "winget install GitHub.Copilot", Logo: Copilot.Color },
];

export interface CliStatus {
  installed: boolean;
  version: string | null;
}

export type CliStatusMap = Record<string, CliStatus>;

// Une seule détection par session : les cartes et la barre partagent le même résultat.
let cache: Promise<CliStatusMap> | undefined;

export function loadCliStatus(): Promise<CliStatusMap> {
  cache ??= invoke<CliStatusMap>("detect_clis", { names: PROVIDERS.map((p) => p.binary) });
  return cache;
}

export function useCliStatus(): CliStatusMap | null {
  const [status, setStatus] = useState<CliStatusMap | null>(null);
  useEffect(() => {
    loadCliStatus().then(setStatus).catch((err) => console.error("Détection des CLIs impossible :", err));
  }, []);
  return status;
}
