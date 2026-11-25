import { useEffect, useRef, useState } from "react";
import type { NodeProps } from "@xyflow/react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { homeDir } from "@tauri-apps/api/path";
import { openPath } from "@tauri-apps/plugin-opener";
import { useBoardStore } from "../boardStore";
import type { BoardNode } from "../types";
import { buildLaunch, type AgentPreset, type ShellKind, type TerminalConfig } from "../terminal/launch";
import { onPtyExit, onPtyOutput, ptyKill, ptyResize, ptySpawn, ptyWrite } from "../terminal/ptyBridge";
import { PROVIDERS, useCliStatus } from "../providers";
import { CardFrame } from "./CardFrame";

const SHELLS: { value: ShellKind; label: string }[] = [
  { value: "powershell", label: "PowerShell" },
  { value: "cmd", label: "CMD" },
  { value: "wsl", label: "WSL" },
  { value: "gitbash", label: "Git Bash" },
];

export function AgentCard({ id, data, selected }: NodeProps<BoardNode>) {
  const updateCard = useBoardStore((s) => s.updateCard);
  const config = data.terminal as TerminalConfig;
  const cliStatus = useCliStatus();

  // Seuls les fournisseurs installés sont proposés ; « Shell seul » est toujours disponible.
  const presetOptions: { value: AgentPreset; label: string }[] = [
    { value: "shell", label: "Shell seul" },
    ...PROVIDERS.filter((p) => cliStatus?.[p.binary]?.installed).map((p) => ({ value: p.id, label: p.label })),
  ];

  // Une carte dont le fournisseur n'est plus installé repasse sur le shell.
  useEffect(() => {
    if (cliStatus && !presetOptions.some((o) => o.value === config.preset)) {
      updateCard(id, { terminal: { ...config, preset: "shell" } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cliStatus]);

  const hostRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  // Identifiant PTY de la session en cours : change à chaque lancement pour ignorer les événements de l'ancienne.
  const sessionRef = useRef<string | null>(null);
  const launchCount = useRef(0);
  const unlistenRef = useRef<Array<() => void>>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setConfig = (patch: Partial<TerminalConfig>) =>
    updateCard(id, { terminal: { ...config, ...patch } });

  const releaseListeners = () => {
    unlistenRef.current.forEach((unlisten) => unlisten());
    unlistenRef.current = [];
  };

  const stop = () => {
    const current = sessionRef.current;
    sessionRef.current = null;
    releaseListeners();
    setRunning(false);
    updateCard(id, { status: "idle" });
    if (current) void ptyKill(current).catch(() => {});
  };

  const launch = async (resume: boolean, cfg: TerminalConfig = config) => {
    const term = termRef.current;
    const fit = fitRef.current;
    if (!term || !fit) return;

    stop();
    setError(null);
    term.reset();
    fit.fit();

    const session = `${id}#${++launchCount.current}`;
    sessionRef.current = session;
    try {
      unlistenRef.current = [
        await onPtyOutput(session, (bytes) => term.write(bytes)),
        await onPtyExit(session, (code) => {
          if (sessionRef.current !== session) return;
          sessionRef.current = null;
          releaseListeners();
          setRunning(false);
          const failed = code !== null && code !== 0;
          updateCard(id, { status: failed ? "error" : "idle" });
          if (failed) setError(`Processus terminé (code ${code})`);
        }),
      ];
      const cwd = cfg.cwd || (await homeDir());
      const spec = buildLaunch(cfg, resume);
      await ptySpawn(session, spec, cwd, term.cols, term.rows);
      setRunning(true);
      updateCard(id, { status: "running" });
    } catch (err) {
      stop();
      setError(String(err));
      updateCard(id, { status: "error" });
    }
  };

  useEffect(() => {
    const term = new Terminal({
      fontFamily: "Cascadia Mono, Consolas, monospace",
      fontSize: 13,
      cursorBlink: true,
      scrollback: 5000,
      theme: { background: "#0c0c08" },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(hostRef.current as HTMLDivElement);
    termRef.current = term;
    fitRef.current = fit;

    // Ctrl+C reste l'interruption du programme ; copier/coller passent par Ctrl+Maj+C / Ctrl+Maj+V.
    term.attachCustomKeyEventHandler((e) => {
      if (e.type !== "keydown" || !e.ctrlKey || !e.shiftKey) return true;
      const key = e.key.toLowerCase();
      if (key === "c" && term.hasSelection()) {
        void navigator.clipboard.writeText(term.getSelection());
        return false;
      }
      if (key === "v") {
        void navigator.clipboard.readText().then((text) => term.paste(text));
        return false;
      }
      return true;
    });

    const input = term.onData((data) => {
      const session = sessionRef.current;
      if (session) void ptyWrite(session, data).catch(() => {});
    });

    const observer = new ResizeObserver(() => {
      fit.fit();
      const session = sessionRef.current;
      if (session) void ptyResize(session, term.cols, term.rows).catch(() => {});
    });
    observer.observe(hostRef.current as HTMLDivElement);

    return () => {
      observer.disconnect();
      input.dispose();
      const session = sessionRef.current;
      sessionRef.current = null;
      releaseListeners();
      if (session) void ptyKill(session).catch(() => {});
      term.dispose();
    };
    // Le terminal vit avec la carte ; launch/stop lisent la config via leurs arguments.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Carte créée pour une action (ex. installer une CLI) : lance le shell puis envoie la commande une fois.
  useEffect(() => {
    const command = data.startCommand;
    if (!command) return;
    updateCard(id, { startCommand: undefined });
    void launch(false).then(() => {
      const session = sessionRef.current;
      if (session) void ptyWrite(session, `${command}\r`).catch(() => {});
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openFolder = async () => {
    const folder = config.cwd || (await homeDir());
    await openPath(folder).catch((err) => setError(String(err)));
  };

  return (
    <CardFrame id={id} data={data} selected={selected}>
      <div className="agent-toolbar nodrag">
        <select
          value={config.shell}
          disabled={running}
          onChange={(e) => setConfig({ shell: e.currentTarget.value as ShellKind })}
        >
          {SHELLS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <select
          value={config.preset}
          disabled={running}
          onChange={(e) => setConfig({ preset: e.currentTarget.value as AgentPreset })}
        >
          {presetOptions.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        <input
          className="agent-cwd"
          placeholder="Dossier (vide = dossier utilisateur)"
          value={config.cwd}
          disabled={running}
          onChange={(e) => setConfig({ cwd: e.currentTarget.value })}
        />
      </div>
      <div className="agent-toolbar nodrag">
        <button type="button" onClick={() => launch(true)}>
          {running ? "Relancer" : "Reprendre"}
        </button>
        <button
          type="button"
          onClick={() => {
            const fresh = { ...config, sessionId: crypto.randomUUID() };
            setConfig({ sessionId: fresh.sessionId });
            void launch(false, fresh);
          }}
        >
          Nouvelle session
        </button>
        <button type="button" disabled={!running} onClick={stop}>Arrêter</button>
        <button type="button" onClick={() => void openFolder()}>Dossier</button>
        {error && <span className="agent-error">{error}</span>}
      </div>
      <div ref={hostRef} className="nodrag nowheel terminal-host" />
    </CardFrame>
  );
}
