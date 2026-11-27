# Swarmify

Application de bureau Windows qui réunit plusieurs agents IA (Copilot CLI, Claude Code, Codex…) sur un canvas infini, à côté de notes, de tableaux Kanban et de contexte de travail.

Chaque agent tourne dans une carte terminal réelle (PTY). Les CLI sont hébergées, pas réimplémentées : l'app lance vos outils installés, elle ne les remplace pas.

## Fonctionnalités (V1 en cours)

- **Canvas infini** : pan, zoom, sélection au lasso.
- **Cartes** déplaçables et redimensionnables :
  - Agent / Terminal (ConPTY, PowerShell, CMD, WSL2, Git Bash)
  - Note / Markdown
  - Kanban / Checklist
  - Image
- **Supervision** : bandeau qui indique les agents actifs, en arrière-plan ou en attente, avec centrage de la caméra au clic.
- **Sauvegarde automatique** du board, restauré au lancement.
- **Raccourcis Windows** : Ctrl+Z / Ctrl+Y / Ctrl+C / Ctrl+V / Ctrl+F / Suppr / Échap.

La conception est dans [`docs/superpowers/specs/2026-11-24-swarmify-design.md`](docs/superpowers/specs/2026-11-24-swarmify-design.md). Le plan du socle canvas est dans [`docs/superpowers/plans/2026-11-24-canvas-foundation.md`](docs/superpowers/plans/2026-11-24-canvas-foundation.md).

## Prérequis

- Windows 10 (21H2+) ou Windows 11
- [Node.js](https://nodejs.org/) (LTS) et npm
- [Rust](https://www.rust-lang.org/tools/install) (toolchain stable, `x86_64-pc-windows-msvc`)
- [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) (charge de travail « Développement desktop en C++ »)
- [WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/) (présent par défaut sous Windows 11)
- Les CLI d'agents que vous souhaitez utiliser, installées séparément

## Installation

```powershell
git clone https://github.com/jm-parent/Swarmify.git
cd Swarmify
npm install
```

## Lancer en développement

```powershell
npm run tauri dev
```

Lance le serveur Vite et la fenêtre Tauri, avec rechargement à chaud.

## Scripts

| Commande | Rôle |
|---|---|
| `npm run tauri dev` | Application de bureau en mode développement |
| `npm run tauri build` | Construit l'installeur Windows |
| `npm run dev` | Serveur Vite seul (interface sans Tauri) |
| `npm run build` | Vérification TypeScript (`tsc`) puis build Vite |
| `npm test` | Tests unitaires (Vitest) |

## CI

`.github/workflows/ci.yml` : à l'ouverture ou la mise à jour d'une PR, build et tests front (Ubuntu), puis `cargo check --locked` du backend Rust (Windows).

## Structure

```
src/                 Interface React (TypeScript)
  canvas/            Canvas, cartes, barres, store, persistance
    cards/           Cartes Agent, Note, Kanban
    terminal/        Lancement des PTY et pont avec le backend
src-tauri/           Backend Rust (Tauri 2) : PTY, lecture/écriture de fichiers
docs/superpowers/    Spécifications et plans de travail
```

## Données

Le board est sauvegardé localement. L'app est pensée pour un seul utilisateur, sans serveur.

## Limites connues

- Usage personnel pour l'instant : pas d'installeur signé ni d'auto-update en V1.
- Cartes Git prévues en V2.
- Carte Image : taille maximale de 20 Mo par image.
- Carte Image : formats acceptés PNG, JPEG, GIF (animé), WebP et SVG (assaini).
- Carte Image : l'export JSON crée un dossier `<nom>-images/` à côté du fichier exporté.
- Pas de support macOS ni mobile.
