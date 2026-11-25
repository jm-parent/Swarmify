# Canvas foundation Implementation Plan

> **For agentic workers:** Implement task by task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Une app Tauri 2 + React/TS qui affiche un canvas infini avec pan, zoom, reset 100 % et fit to content (étape 1 du design).

**Architecture:** Shell Tauri 2 (WebView2) ; le frontend rend le canvas avec React Flow (`@xyflow/react`). La logique de format du zoom est une fonction pure testée avec Vitest. Pas de backend métier à ce stade.

**Tech Stack:** Tauri 2, React 19, TypeScript, Vite, `@xyflow/react`, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-24-spatial-agent-board-design.md` (section 6, étape 1).

## Global Constraints

- Windows 10 / 11 uniquement.
- Pas de dépendance hors React Flow et Vitest pour cette étape.

## Review Focus

- Zoom à une valeur non entière (ex. 0.505) : l'affichage doit arrondir sans afficher de décimales.
- Zoom hors limites : React Flow doit borner le zoom entre `MIN_ZOOM` et `MAX_ZOOM`.

---

### Task 1: Pure zoom formatter

**Files:**
- Create: `src/canvas/zoom.ts`
- Test: `src/canvas/zoom.test.ts`

**Interfaces:**
- Produces: `formatZoom(zoom: number): string`, `MIN_ZOOM`, `MAX_ZOOM`, `RESET_ZOOM` (exports de `src/canvas/zoom.ts`).

- [ ] **Step 1:** Test : `formatZoom(1) === "100 %"`, `formatZoom(0.505) === "51 %"`, `formatZoom(0.1234) === "12 %"`.
- [ ] **Step 2:** `npx vitest run src/canvas/zoom.test.ts` → FAIL (module absent).
- [ ] **Step 3:** Implémenter `formatZoom` : `Math.round(zoom * 100) + " %"`.
- [ ] **Step 4:** Même commande → PASS.

### Task 2: Canvas and zoom controls

**Files:**
- Create: `src/canvas/Board.tsx`, `src/canvas/ZoomBar.tsx`
- Modify: `src/App.tsx`, `src/App.css`

**Interfaces:**
- Consumes: `formatZoom`, `MIN_ZOOM`, `MAX_ZOOM`, `RESET_ZOOM` (Task 1).
- Produces: `Board` (composant par défaut, sans props), rendu par `App`.

- [ ] **Step 1:** `Board` rend `ReactFlow` avec `Background` en points, `minZoom={MIN_ZOOM}`, `maxZoom={MAX_ZOOM}`, `fitView`, `selectionOnDrag`, `panOnDrag={[1]}` (bouton milieu). Tant que la barre espace est enfoncée, `panOnDrag` passe à `true`.
- [ ] **Step 2:** `ZoomBar` (Panel `bottom-center`) affiche `formatZoom(zoom)` via `useViewport`, un bouton « 100 % » (`zoomTo(RESET_ZOOM)`) et un bouton « Ajuster » (`fitView({ padding: 0.2 })`).
- [ ] **Step 3:** `App` rend `<Board />` plein écran ; retirer le contenu template (greet, logos).

### Task 3: Tauri shell cleanup

**Files:**
- Modify: `src-tauri/src/lib.rs` (retirer la commande `greet` et son handler)

- [ ] **Step 1:** Ne garder que le plugin opener et `generate_context!`.
- [ ] **Step 2:** `cargo check --manifest-path src-tauri/Cargo.toml` → succès.

### Task 4: Verification

- [ ] **Step 1:** `npm test` → PASS.
- [ ] **Step 2:** `npm run build` → succès (tsc + vite).
- [ ] **Step 3:** `npm run dev`, puis ouvrir `http://localhost:1420` : le canvas s'affiche, zoom à la molette, pourcentage mis à jour, reset et ajustement fonctionnels.
