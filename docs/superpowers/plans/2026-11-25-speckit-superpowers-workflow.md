# SpecKit + Superpowers Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Installer SpecKit dans Swarmify pour le cadrage et les specs, rédiger la constitution avec les règles de passage à Superpowers, et faire router l'agent vers cette boucle.

**Architecture:** Le scaffolding SpecKit (`.specify/`, prompts Copilot) est généré par `specify init`. Les règles projet vivent dans `.specify/memory/constitution.md`. Les règles de routage de l'agent vivent dans `AGENTS.md`. La boucle complète, lisible par un humain, vit dans `docs/dev-workflow.md`.

**Tech Stack:** specify-cli 1.0.8 (Python, installé via uv), intégration GitHub Copilot CLI, Markdown.

**Spec:** `docs/superpowers/specs/2026-11-25-speckit-superpowers-workflow-design.md`

## Global Constraints

- Aucune modification du code produit (`src/`, `src-tauri/`), ni de `package.json`.
- Intégration : `copilot`. Type de script : `ps` (Windows).
- Les dossiers existants `docs/superpowers/specs/` et `docs/superpowers/plans/` ne sont pas touchés.
- Emplacement de la doc de workflow, laissé ouvert par le design : `docs/dev-workflow.md` (choix de ce plan).
- Chaque commit se termine par le trailer `Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>`.

## Review Focus

- `specify init --here` sur un repo non vide écrase les fichiers de même nom. Tâche 1 : `git status` ne doit montrer que des chemins SpecKit ; tout autre chemin est restauré.
- Relancer `specify init` plus tard écraserait la constitution. Tâche 1 : ne pas relancer l'init une fois la constitution écrite (tâche 2).
- Le type de script par défaut peut être `sh`, inutilisable sous Windows sans bash propre. Tâche 1 : `--script ps`, et vérifier que les scripts générés sont en `.ps1`.

---

### Task 1: Initialiser SpecKit pour Copilot

**Files:**
- Create (généré par init) : `.specify/**`, dossier des prompts de l'intégration Copilot (attendu : `.github/prompts/`, à confirmer dans la sortie d'init)

**Interfaces:**
- Consumes : rien.
- Produces : les commandes `/speckit.*` disponibles pour Copilot, dont `/speckit.constitution`, `/speckit.specify`, `/speckit.clarify`, `/speckit.plan`, `/speckit.tasks`, `/speckit.analyze`. Tâche 2 écrit dans `.specify/memory/constitution.md` produit par cette tâche.

- [ ] **Step 1: Vérifier que l'arbre de travail est propre**

Run: `git status --short`
Expected: aucune sortie.

- [ ] **Step 2: Lancer l'init**

Run: `specify init --here --force --non-interactive --integration copilot --script ps`
Expected: code de sortie 0, sans invite.

- [ ] **Step 3: Restaurer tout chemin hors SpecKit**

Run: `git status --short`
Expected: seuls `.specify/` et le dossier des prompts Copilot apparaissent (plus, au besoin, un fichier d'instructions Copilot généré). Pour tout fichier suivi modifié hors de ces chemins : `git checkout -- <chemin>`. Pour tout fichier non suivi hors de ces chemins : le supprimer.

- [ ] **Step 4: Vérifier la présence de la commande analyze et des scripts PowerShell**

Run: `Get-ChildItem -Recurse -Path .github,.specify -Filter 'speckit.analyze*'` puis `Get-ChildItem -Recurse -Path .specify -Filter '*.sh'`
Expected: au moins un fichier `speckit.analyze*` trouvé ; aucun `.sh` côté scripts. Si analyze est absent, arrêter et signaler : la boucle du design en dépend.

- [ ] **Step 5: Vérifier l'installation**

Run: `specify check`
Expected: Copilot listé comme intégration configurée, sans erreur bloquante.

- [ ] **Step 6: Commit**

```bash
git add .specify .github
git commit -m "chore: initialize SpecKit for Copilot" -m "Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 2: Rédiger la constitution

**Files:**
- Modify: `.specify/memory/constitution.md` (placeholder généré par la tâche 1)

**Interfaces:**
- Consumes : la structure de `.specify/` produite par la tâche 1.
- Produces : les règles que les tâches 3 et 4 citent par leur nom (boucle, frontière SpecKit/Superpowers, ne pas re-planifier).

- [ ] **Step 1: Remplacer le placeholder par les principes suivants**

Un principe par puce, rédigés en français comme les documents existants du repo :
- Toute feature passe par `/speckit.specify`, `/speckit.clarify`, `/speckit.plan`, `/speckit.tasks`, puis `/speckit.analyze`, avant tout code.
- Le brainstorming se fait en conversation, son résultat alimente `/speckit.specify`. Les skills Superpowers `brainstorming` et `writing-plans` ne s'appliquent pas à ce repo.
- L'exécution est confiée à Superpowers uniquement : worktree, TDD, subagents, revue, finition de branche. Ne jamais lancer `/speckit.implement`.
- Le plan est `tasks.md`. Ne pas re-planifier au moment de l'exécution.
- Si le code diverge de la spec, relancer `/speckit.specify` sur la zone concernée avant de continuer.
- Calibrage : moins de 30 min et moins de 3 fichiers, pas de cadre ; 30 min à 2 h sur une préoccupation, Superpowers seul ; plus de 2 h ou multi-composants, cadre complet.

- [ ] **Step 2: Vérifier que chaque règle clé est présente**

Run: `Select-String -Path .specify/memory/constitution.md -Pattern 'speckit.analyze','speckit.implement','tasks.md','writing-plans','Superpowers'`
Expected: au moins une correspondance par motif ; `speckit.implement` apparaît dans la règle qui l'interdit.

- [ ] **Step 3: Commit**

```bash
git add .specify/memory/constitution.md
git commit -m "docs: write SpecKit constitution for the SpecKit/Superpowers split" -m "Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 3: Documenter la boucle par feature

**Files:**
- Create: `docs/dev-workflow.md`

**Interfaces:**
- Consumes : les noms de commandes de la tâche 1 et les règles de la tâche 2.
- Produces : la boucle complète (point de référence unique). `AGENTS.md` (tâche 4) pointe vers ce fichier au lieu de la recopier.

- [ ] **Step 1: Écrire le fichier**

Contenu :
- Titre et une phrase : SpecKit cadre le quoi, Superpowers exécute le comment.
- Tableau des neuf étapes, identique à la section « Boucle par feature » du design (`docs/superpowers/specs/2026-11-25-speckit-superpowers-workflow-design.md`, section 5).
- Les quatre règles de la constitution, en liste.
- Le calibrage, en trois lignes.
- Un lien vers `.specify/memory/constitution.md`.

- [ ] **Step 2: Vérifier les liens et les commandes**

Run: `Select-String -Path docs/dev-workflow.md -Pattern '/speckit\.(specify|clarify|plan|tasks|analyze)','constitution.md','design'`
Expected: chaque commande et chaque lien apparaît au moins une fois.

- [ ] **Step 3: Commit**

```bash
git add docs/dev-workflow.md
git commit -m "docs: describe the SpecKit + Superpowers feature loop" -m "Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 4: Router l'agent vers la boucle

**Files:**
- Create: `AGENTS.md` (lu par Copilot CLI à la racine du repo)

**Interfaces:**
- Consumes : `docs/dev-workflow.md` (tâche 3) et la constitution (tâche 2).
- Produces : rien d'autre. C'est le point d'entrée de l'agent.

Les skills Superpowers sont installés globalement : ce fichier est le seul mécanisme par repo pour désactiver brainstorming et writing-plans ici. Choix de ce plan, à signaler au relecteur.

- [ ] **Step 1: Écrire AGENTS.md**

Contenu, en français :
- Pour toute feature, suivre `docs/dev-workflow.md` et la constitution. Commencer par les commandes `/speckit.*`.
- Ne pas invoquer les skills `superpowers:brainstorming` ni `superpowers:writing-plans` dans ce repo.
- Pour exécuter, utiliser `superpowers:subagent-driven-development` ou `superpowers:executing-plans` sur `specs/<id>/tasks.md`, sans re-planifier.
- Ne jamais lancer `/speckit.implement`.

- [ ] **Step 2: Vérifier**

Run: `Select-String -Path AGENTS.md -Pattern 'dev-workflow','brainstorming','writing-plans','speckit.implement','tasks.md'`
Expected: chaque motif trouvé au moins une fois.

- [ ] **Step 3: Commit**

```bash
git add AGENTS.md
git commit -m "docs: route agent feature work through SpecKit and Superpowers" -m "Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 5: Vérification finale

**Files:** aucun.

Pas de validation de build : aucun code produit n'est modifié, et les changements sont documentaires.

- [ ] **Step 1: Arbre propre**

Run: `git status --short`
Expected: aucune sortie.

- [ ] **Step 2: Vérifier que le code produit n'a pas changé**

Run: `git diff --stat main -- src src-tauri package.json`
Expected: aucune sortie.

- [ ] **Step 3: Vérifier l'installation SpecKit**

Run: `specify check`
Expected: pas d'erreur bloquante.

---

## Self-Review

- Couverture : intention, installation (T1), constitution (T2), boucle (T3), routage (T4), frontière et calibrage (T2 et T3). Les neuf étapes du design sont couvertes par les commandes et les règles citées.
- Cohérence des noms : `constitution.md`, `docs/dev-workflow.md`, `AGENTS.md`, `tasks.md` identiques partout.
- Review Focus : chaque ligne a sa vérification dans la tâche propriétaire (T1 pour init et script, T2 pour la constitution).
- Proportion : plan court, pas de code applicatif.
