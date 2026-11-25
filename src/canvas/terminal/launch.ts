export type ShellKind = "powershell" | "cmd" | "wsl" | "gitbash";
export type AgentPreset = "shell" | "claude" | "codex" | "copilot";

export interface TerminalConfig {
  shell: ShellKind;
  preset: AgentPreset;
  cwd: string;
  sessionId: string;
}

export interface LaunchSpec {
  file: string;
  args: string[];
}

const GIT_BASH = "C:\\Program Files\\Git\\bin\\bash.exe";

// Commande de l'agent. Codex n'expose pas d'identifiant de session à la création :
// la reprise passe par « codex resume --last ».
function agentCommand(config: TerminalConfig, resume: boolean): string | undefined {
  const { preset, sessionId } = config;
  switch (preset) {
    case "shell":
      return undefined;
    case "claude":
      return resume ? `claude --resume ${sessionId}` : `claude --session-id ${sessionId}`;
    case "copilot":
      return resume ? `copilot --resume=${sessionId}` : `copilot --session-id=${sessionId}`;
    case "codex":
      return resume ? "codex resume --last" : "codex";
  }
}

// Enveloppe la commande dans le shell choisi. Sans commande, le shell reste ouvert.
export function buildLaunch(config: TerminalConfig, resume: boolean): LaunchSpec {
  const command = agentCommand(config, resume);
  switch (config.shell) {
    case "powershell":
      return command
        ? { file: "powershell.exe", args: ["-NoLogo", "-NoExit", "-Command", command] }
        : { file: "powershell.exe", args: [] };
    case "cmd":
      return command ? { file: "cmd.exe", args: ["/k", command] } : { file: "cmd.exe", args: [] };
    case "wsl":
      return command
        ? { file: "wsl.exe", args: ["--", "bash", "-lc", `${command}; exec bash`] }
        : { file: "wsl.exe", args: [] };
    case "gitbash":
      return command
        ? { file: GIT_BASH, args: ["-lc", `${command}; exec bash`] }
        : { file: GIT_BASH, args: ["--login", "-i"] };
  }
}
