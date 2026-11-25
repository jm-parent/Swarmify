# Swarmify (Windows) — Design

Brouillon de design, à valider avant tout code. Référence fonctionnelle : `Symvibe_inventaire_fonctionnalites.md` (app Mac, à la racine du repo).

## 1. Intention et pourquoi

Remplacer l'empilement d'onglets et de fenêtres de terminal par un canvas infini où l'utilisateur :
- lance plusieurs agents IA en parallèle (CLI installées : Claude Code, Codex, Copilot CLI…) dans des terminaux PTY,
- voit d'un coup d'œil lequel travaille, lequel a fini, lequel attend une décision,
- organise son travail (notes, tâches, contexte Git, visuels) à côté de ces agents.

Succès : superviser 4 à 6 agents sur un board sans lag, et retrouver le board tel quel à la réouverture.

Usage initial : personnel (un seul utilisateur). Distribution à des collègues envisagée plus tard : ne pas la bloquer, mais installeur, signature et auto-update sont hors V1.

## 2. Objectifs / non-objectifs / anti-objectifs

**Objectifs (V1)**
- Canvas infini : pan (molette/clic milieu/espace+glisser), zoom (molette, affichage du %, reset 100 %, fit to content), sélection multiple au lasso.
- Cartes déplaçables et redimensionnables, avec barre de titre et états (actif, en cours, en attente, erreur, replié).
- Types de cartes : **Agent/Terminal**, **Note/Markdown**, **Kanban/Checklist**.
- Barre flottante d'ajout de cartes et d'outils (centrer, aligner, filtrer).
- Barre de commande (raccourci clavier) qui cible une carte agent et lui envoie une instruction, ou crée/organise des cartes.
- Bandeau de supervision (coin haut droit) : agents actifs, en arrière-plan, en attente ; clic = centrer la caméra sur la carte.
- Sauvegarde locale automatique du board et restauration au lancement.
- Raccourcis Windows : Ctrl+Z / Ctrl+Y / Ctrl+C / Ctrl+V / Ctrl+F / Suppr / Échap.

**Non-objectifs (V1)** : liens visuels entre cartes, templates de boards, recherche globale, commandes vocales, cartes Git et Image (prévues en V2, la structure doit les accueillir), macOS, mobile, collaboration temps réel.

**Anti-objectifs** : que l'app devienne un nouveau client d'agent IA qui réimplémente la logique des CLI. Elle héberge les CLI, elle ne les remplace pas. Et pas de re-render global du canvas à chaque octet de sortie terminal.

## 3. Contraintes

- Windows 10 (21H2+) et Windows 11 uniquement.
- Pseudo-terminaux via ConPTY (API Windows).
- Support natif de PowerShell, CMD, WSL2 et Git Bash comme shells de carte ; chemins Windows (`C:\…`) et chemins WSL (`\\wsl$\…`) gérés.
- Les CLI d'agents sont installées par l'utilisateur, l'app ne les embarque pas.
- Un seul utilisateur, pas de backend serveur.

## 4. Approches considérées

| Approche | Pour | Contre |
|---|---|---|
| **A. Tauri 2 + React/TypeScript** (retenue) | Binaire léger, WebView2 présent sur Win 10/11, xterm.js (rendu WebGL) pour les terminaux, cœur PTY/IO en Rust | Courbe d'apprentissage Rust |
| B. Electron + React/TypeScript | Tout en TypeScript, écosystème node-pty / xterm.js éprouvé (stack de VS Code) | Binaire lourd (~150 Mo), mémoire plus élevée avec beaucoup de terminaux |
| C. .NET 8 + WinUI 3 | Le plus natif Windows | Écosystème canvas et terminal peu mûr, xterm.js reste nécessaire dans une WebView2 |

**Choix : A.** Décision de l'utilisateur après recommandation.

## 5. Architecture retenue (choix de l'agent, à corriger si besoin)

```
┌─────────────────────────── Frontend (WebView2, React + TS) ───────────────────────────┐
│  Canvas (React Flow)   Cartes (Agent/Note/Kanban)   Barre commande   Supervision      │
│  State: Zustand (board, sélection, caméra)                                            │
│  Terminal: xterm.js (WebGL) par carte Agent                                           │
└───────────────▲──────────────────────────────────────────────▲────────────────────────┘
                │ commandes Tauri (invoke)                      │ canaux (sortie PTY, batch ~16 ms)
┌───────────────┴──────────────────────────────────────────────┴────────────────────────┐
│  Backend Rust (Tauri 2)                                                               │
│  - SessionManager : portable-pty (ConPTY), spawn/stop/restart, cwd, env               │
│  - Persistance : SQLite (rusqlite) — boards, cartes, positions, états                 │
│  - Export/import : JSON du board                                                      │
└───────────────────────────────────────────────────────────────────────────────────────┘
```

Décisions de l'agent (à valider) :
- **Canvas** : React Flow (lib mûre pour nœuds déplaçables/redimensionnables, zoom, pan, sélection). Le lasso et l'aimantation (snap) sont à vérifier dans React Flow ; sinon couche custom.
- **State** : Zustand, avec sélecteurs fins pour éviter les re-renders globaux.
- **Sorties terminal** : le backend regroupe les octets par session (batch ~16 ms) et les envoie sur un canal ; xterm.js écrit directement, sans passer par le state React. Seul le statut (actif/attente/erreur) remonte dans le store.
- **Détection « attend une décision »** : heuristique sur la sortie (inactivité + motif de prompt) et état explicite quand la CLI le fournit. Sans garantie à 100 %, à signaler sur la carte.
- **Persistance** : SQLite pour l'état, sauvegarde débouncée (~500 ms) après chaque modification. Export/import en JSON.
- **Commande** : la barre envoie du texte à la session PTY ciblée ; les commandes d'organisation (« crée une note », « aligne la sélection ») passent par un petit parseur de commandes, pas par un LLM en V1.
- **Tests** : Vitest + Testing Library côté front, `cargo test` côté Rust, un test E2E Playwright sur le parcours clé (créer agent, envoyer commande, sauvegarder, relancer).

## 6. Étapes incrémentales (chacune testable)

1. **Socle** : app Tauri + React vide, canvas React Flow avec pan/zoom/fit, reset 100 %, grille.
2. **Cartes** : carte générique (titre, états, déplacement, redimensionnement), carte Note (Markdown), carte Kanban/Checklist, barre flottante d'ajout, multi-sélection et Suppr/Ctrl+C/Ctrl+V/Ctrl+Z.
3. **Persistance** : SQLite, sauvegarde débouncée, restauration au lancement, export/import JSON.
4. **Agent/Terminal** : SessionManager ConPTY, carte avec xterm.js, streaming batché, relancer / stopper / ouvrir le dossier, shell au choix (PowerShell, CMD, WSL, Git Bash).
5. **Supervision** : statuts par carte, bandeau haut droit, clic = centrer la caméra.
6. **Barre de commande** : envoi à une session ciblée, parseur de commandes d'organisation, historique récent.
7. **Perf et finition** : tests de charge avec 10 terminaux à sortie continue, raccourcis complets, Ctrl+F.

## 6bis. Décisions prises pendant le brainstorm

- **Périmètre V1 = le pitch uniquement.** Pas de cartes web, calendrier, dessin, Mission Map, mode Yolo, multi-comptes, ni catalogue de 34 CLIs. Symvibe sert de référence pour la V2+.
- **Statut « attend une décision » = hooks** dans la config de chaque CLI (`~/.claude/settings.json`, `~/.codex/hooks.json`) qui écrivent sur un canal local. Scripts portés en PowerShell/Node (pas de `.sh`). Le config d'origine est sauvegardée avant modification et la désactivation est possible depuis l'app.
- **Réouverture = reprise.** Chaque carte Agent stocke l'identifiant de conversation de sa CLI et la relance à la réouverture (`claude --resume <id>`, équivalent Codex et Copilot CLI). Les processus ne survivent pas à la fermeture de l'app.
- **CLIs V1** : Claude Code, Codex, Copilot CLI, shell (PowerShell, CMD, WSL, Git Bash).

## 7. Points laissés au constructeur (mes décisions, à corriger)

- **Ctrl+C / Ctrl+V dans une carte terminal** : quand le terminal a le focus, les touches vont au programme (Ctrl+C = interruption). Copier/coller utilise Ctrl+Shift+C / Ctrl+Shift+V. Ctrl+Z, Ctrl+F et Suppr restent pour l'app quand aucun terminal n'a le focus.
- **Rattachement au dossier** : un board n'est lié à aucun repo. Chaque carte Agent a son propre cwd. Les chemins WSL (`\\wsl$\…`) et Windows sont convertis par l'app.

- Format exact du JSON d'export et schéma SQLite (versionné avec migrations).
- Palette, typographie et thème sombre par défaut.
- Choix précis de la lib Markdown (ex. `marked` ou `react-markdown`).
- Gestion des erreurs PTY (session qui meurt, shell introuvable) : la carte passe en « erreur » avec le message et un bouton relancer.