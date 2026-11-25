import { useState } from "react";
import { Panel, useReactFlow } from "@xyflow/react";
import { useBoardStore } from "./boardStore";
import { PROVIDERS, useCliStatus, type Provider } from "./providers";

// Carte shell PowerShell qui lance la commande d'installation dès son démarrage.
function openInstallCard(p: Provider, position: { x: number; y: number }) {
  const store = useBoardStore.getState();
  const id = store.addCard("agent", position);
  store.updateCard(id, {
    title: `Installer ${p.label}`,
    terminal: { shell: "powershell", preset: "shell", cwd: "", sessionId: crypto.randomUUID() },
    startCommand: p.install,
  });
}

// Barre verticale à droite : un logo par fournisseur, pastille verte si installé.
export function ProviderRail() {
  const status = useCliStatus();
  const { screenToFlowPosition } = useReactFlow();
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <Panel position="center-right" className="provider-rail">
      {PROVIDERS.map((p) => {
        const cli = status?.[p.binary];
        const installed = cli?.installed === true;
        const { Logo } = p;
        return (
          <div
            key={p.id}
            className="provider-item"
            onMouseEnter={() => setHovered(p.id)}
            onMouseLeave={() => setHovered(null)}
          >
            <button
              type="button"
              className={`provider-btn${installed ? "" : " missing"}`}
              aria-label={p.label}
              disabled={!status}
              onClick={() => {
                if (installed || !status) return;
                const center = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
                openInstallCard(p, center);
              }}
            >
              <Logo size={20} />
              <span className={`provider-dot ${installed ? "ok" : "off"}`} />
            </button>
            {hovered === p.id && (
              <div className="provider-tip" role="tooltip">
                <strong>{p.label}</strong>
                {!status ? (
                  <span>Détection…</span>
                ) : installed ? (
                  <span>Version {cli?.version ?? "inconnue"}</span>
                ) : (
                  <>
                    <span>Non installé</span>
                    <code>{p.install}</code>
                    <span>Cliquer pour ouvrir un PowerShell et lancer l'installation</span>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </Panel>
  );
}
