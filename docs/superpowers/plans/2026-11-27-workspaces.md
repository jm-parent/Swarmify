# Workspaces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter des workspaces (un projet = un dossier de travail, plusieurs agents, notes et images propres), avec un écran d'accueil au titre animé et la liste des workspaces en haut à gauche.

**Architecture:** Une seule base SQLite avec une table `workspaces` (registre) et une table `workspace_board` (contenu par workspace). Les images vivent dans `app_data/workspaces/<id>/images`. Côté front, chaque workspace ouvert a son propre store de board (fabrique `createBoardStore`). Les boards ouverts restent montés et sont cachés quand ils ne sont pas actifs, pour que les agents gardent leur sortie PTY.

**Tech Stack:** Tauri v2, Rust (rusqlite 0.43 bundled), React 19, zustand 5 (store vanilla + `useStore`), @xyflow/react, @xterm/xterm, Vitest, jsdom.

**Spec:** [2026-11-27-workspaces-design.md](../specs/2026-11-27-workspaces-design.md)

## Global Constraints

- Windows : chemins natifs avec `\`. Les commandes se lancent depuis PowerShell.
- Libellés exacts : « Choisir un dossier », « Nouveau workspace », « Dossier introuvable », « Supprimer le workspace ».
- Titre de l'écran d'accueil : style B (reflet violet, `background-clip: text`, boucle). Statique si `prefers-reduced-motion: reduce`.
- Un workspace ouvert reste monté. Un workspace inactif a `style={{ display: "none" }}`.
- `src-tauri/src/pty.rs` ne change pas.
- Les arguments Tauri sont en camelCase côté JS (`workspaceId`) et en snake_case côté Rust (`workspace_id`).
- Commentaires seulement quand ils clarifient quelque chose.

## Review Focus

1. Dossier supprimé ou déplacé après création : le workspace reste listé avec `folderExists: false`, et l'app démarre sans erreur. Test : Task 1, `folder_exists_detects_missing_folder`.
2. Chemin avec espaces, accents ou caractères Unicode : stocké et renvoyé à l'identique. Test : Task 1, `folder_with_spaces_and_accents_round_trips`.
3. Identifiant de workspace hostile (`..\evil`, chemin absolu) : rejeté avant tout accès disque. Test : Task 1, `valid_id_rejects_path_like_values`.
4. Sauvegarde débouncée qui arrive après la suppression : aucune ligne orpheline recréée. Tests : Task 2, `save_board_rejects_deleted_workspace` ; Task 7, `detach annule la sauvegarde en attente`.
5. Nom vide ou composé d'espaces : refusé, l'ancien nom reste. Tests : Task 1, `validate_name_refuses_blank` ; Task 8, `cleanName refuse un nom vide`.

---

### Task 1: Registre des workspaces (Rust)

**Files:**
- Create: `src-tauri/src/workspaces.rs`
- Modify: `src-tauri/src/persistence.rs` (constante `SCHEMA` rendue `pub(crate)`, tables ajoutées)
- Modify: `src-tauri/src/lib.rs` (déclaration `mod workspaces;`)

**Interfaces:**
- Consumes: rien.
- Produces:
  ```rust
  pub fn valid_id(id: &str) -> Result<(), String>        // 36 caractères, [0-9a-f-]
  pub fn validate_name(name: &str) -> Result<String, String> // trim ; vide => Err
  pub fn validate_folder(path: &str) -> Result<(), String>  // doit être un dossier existant
  pub fn folder_exists(path: &str) -> bool
  #[derive(Serialize)] #[serde(rename_all = "camelCase")]
  pub struct Workspace { pub id: String, pub name: String, pub folder: String,
                         pub created_at: i64, pub last_opened_at: Option<i64>, pub folder_exists: bool }
  pub fn insert(conn: &Connection, ws: &Workspace) -> Result<(), String>   // ignore folder_exists
  pub fn list(conn: &Connection) -> Result<Vec<Workspace>, String>        // ORDER BY created_at ; folder_exists calculé
  pub fn exists(conn: &Connection, id: &str) -> Result<bool, String>
  pub fn rename(conn: &Connection, id: &str, name: &str) -> Result<(), String>
  pub fn mark_opened(conn: &Connection, id: &str, now: i64) -> Result<(), String>
  pub fn delete(conn: &Connection, id: &str) -> Result<(), String>        // transaction : workspaces + workspace_board
  ```

**SCHEMA** (dans `persistence.rs`, à ajouter après la table `board` existante) :
```sql
CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    folder TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    last_opened_at INTEGER
);
CREATE TABLE IF NOT EXISTS workspace_board (
    workspace_id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    updated_at INTEGER NOT NULL
);
```

- [ ] **Step 1: Write the failing tests**

Dans `workspaces.rs`, module `#[cfg(test)] mod tests`, avec un helper `memory_db()` (connexion en mémoire + `execute_batch(persistence::SCHEMA)`) et `ws(id, name, folder)` (created_at 0, last_opened_at None).

```rust
#[test]
fn valid_id_rejects_path_like_values() {
    assert!(valid_id("550e8400-e29b-41d4-a716-446655440000").is_ok());
    assert!(valid_id("..\\evil").is_err());
    assert!(valid_id("C:\\Users").is_err());
}

#[test]
fn validate_name_refuses_blank() {
    assert!(validate_name("   ").is_err());
    assert_eq!(validate_name("  Projet  ").unwrap(), "Projet");
}

#[test]
fn folder_exists_detects_missing_folder() {
    assert!(!folder_exists("C:\\dossier\\inexistant"));
    assert!(folder_exists(&std::env::temp_dir().to_string_lossy()));
}

#[test]
fn folder_with_spaces_and_accents_round_trips() {
    let dir = std::env::temp_dir().join("Mes Projets Café");
    std::fs::create_dir_all(&dir).unwrap();
    let conn = memory_db();
    insert(&conn, &ws("550e8400-e29b-41d4-a716-446655440000", "Projet", &dir.to_string_lossy())).unwrap();
    assert_eq!(list(&conn).unwrap()[0].folder, dir.to_string_lossy());
}
```

Ajouter aussi un test `rename_mark_opened_and_delete` : insertion, `rename`, `mark_opened(…, 5)`, puis vérifier `list` (nom, `last_opened_at == Some(5)`), puis `delete` et `list` vide.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cargo test --manifest-path src-tauri/Cargo.toml workspaces`
Expected: FAIL (fonctions absentes, compilation échoue).

- [ ] **Step 3: Implement**

- `valid_id` : longueur 36 et tous les caractères dans `[0-9a-f-]`. Même règle que côté front.
- `validate_name` : `trim()`, vide => `Err("Le nom ne peut pas être vide")`.
- `validate_folder` : `Path::new(path).is_dir()`, sinon `Err("Dossier introuvable")`.
- `folder_exists` : `Path::new(path).is_dir()`.
- `list` : `folder_exists` calculé à chaque appel, `ORDER BY created_at`.
- `delete` : transaction qui supprime d'abord `workspace_board` puis `workspaces`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cargo test --manifest-path src-tauri/Cargo.toml workspaces`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/workspaces.rs src-tauri/src/persistence.rs src-tauri/src/lib.rs
git commit -m "feat(workspaces): ajoute le registre des workspaces"
```

---

### Task 2: Contenu par workspace et migration du board existant (Rust)

**Files:**
- Modify: `src-tauri/src/persistence.rs` (fonctions `load_board` / `save_board` / `load` / `save`, commandes, tests)

**Interfaces:**
- Consumes: `workspaces::{Workspace, exists, insert, valid_id}` (Task 1), `persistence::SCHEMA`.
- Produces:
  ```rust
  pub fn read_board(conn: &Connection, workspace_id: &str) -> Result<Option<String>, String>
  pub fn write_board(conn: &Connection, workspace_id: &str, data: &str, now: i64) -> Result<(), String>
  pub fn load_legacy(conn: &Connection) -> Result<Option<String>, String>        // lit la table `board`
  pub fn create_with_legacy(conn: &Connection, ws: &Workspace) -> Result<bool, String>
  // commandes Tauri, noms exposés au front :
  #[tauri::command] pub fn load_board(db: State<Db>, workspace_id: String) -> Result<Option<String>, String>
  #[tauri::command] pub fn save_board(db: State<Db>, workspace_id: String, data: String) -> Result<(), String>
  ```
  Les fonctions `load` et `save` existantes sont remplacées par `read_board` / `write_board` (fonctions pures, testées en mémoire) et `load_legacy`. Les commandes `load_board` / `save_board` verrouillent la connexion et délèguent aux fonctions pures.

- [ ] **Step 1: Write the failing tests**

```rust
#[test]
fn isole_le_contenu_par_workspace() {
    let conn = memory_db();
    insert(&conn, &ws(A, "A", "C:\\a")).unwrap();
    insert(&conn, &ws(B, "B", "C:\\b")).unwrap();
    write_board(&conn, A, "{\"v\":\"a\"}", 1).unwrap();
    write_board(&conn, B, "{\"v\":\"b\"}", 2).unwrap();
    assert_eq!(read_board(&conn, A).unwrap().as_deref(), Some("{\"v\":\"a\"}"));
    assert_eq!(read_board(&conn, B).unwrap().as_deref(), Some("{\"v\":\"b\"}"));
}

#[test]
fn save_board_rejects_deleted_workspace() {
    let conn = memory_db();
    insert(&conn, &ws(A, "A", "C:\\a")).unwrap();
    delete(&conn, A).unwrap();
    assert!(write_board(&conn, A, "{}", 3).is_err());
    assert_eq!(read_board(&conn, A).unwrap(), None);
}

#[test]
fn create_with_legacy_adopts_board_once() {
    let conn = memory_db();
    conn.execute("INSERT INTO board (id, data, updated_at) VALUES (1, '{\"legacy\":true}', 0)", []).unwrap();
    assert!(create_with_legacy(&conn, &ws(A, "A", "C:\\a")).unwrap());
    assert_eq!(read_board(&conn, A).unwrap().as_deref(), Some("{\"legacy\":true}"));
    assert_eq!(load_legacy(&conn).unwrap(), None);
    assert!(!create_with_legacy(&conn, &ws(B, "B", "C:\\b")).unwrap());
}
```

`A` et `B` sont des UUID de test. Le test `enregistre_puis_recharge_le_board` existant est remplacé par `isole_le_contenu_par_workspace`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cargo test --manifest-path src-tauri/Cargo.toml persistence`
Expected: FAIL (fonctions absentes).

- [ ] **Step 3: Implement**

- `write_board` vérifie `workspaces::exists` et renvoie `Err("Workspace inconnu")` sinon, puis fait l'UPSERT dans `workspace_board`.
- `create_with_legacy` : dans une transaction, `adopt = workspaces::list` vide ET `load_legacy` présent. Insère `ws` ; si `adopt`, copie la donnée legacy dans `workspace_board` et supprime la ligne `board`. Renvoie `adopt`.
- Les commandes `load_board` / `save_board` verrouillent `db.0` et délèguent à `read_board` / `write_board`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cargo test --manifest-path src-tauri/Cargo.toml persistence`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/persistence.rs
git commit -m "feat(workspaces): stocke le board par workspace et adopte le board existant"
```

---

### Task 3: Images par workspace (Rust)

**Files:**
- Modify: `src-tauri/src/images.rs` (`app_images_dir`, commandes d'images, fonctions de copie, tests)

**Interfaces:**
- Consumes: `workspaces::valid_id` (Task 1).
- Produces:
  ```rust
  fn app_images_dir(app: &AppHandle, workspace_id: &str) -> Result<PathBuf, String>   // app_data/workspaces/<id>/images, créé
  pub fn copy_legacy_images(app_data: &Path, dest: &Path) -> Result<Vec<PathBuf>, String> // copie app_data/images/* vers dest
  pub fn remove_files(paths: &[PathBuf])                                              // ignore les erreurs
  ```
  Commandes, avec `workspace_id: String` ajouté en second paramètre après `app` : `images_dir`, `import_image`, `save_image_bytes`, `save_sanitized_svg`, `copy_image_file`, `purge_unused_images`.

- [ ] **Step 1: Write the failing test**

```rust
#[test]
fn copy_legacy_images_copies_every_file() {
    let root = std::env::temp_dir().join(format!("swarmify-legacy-{}", std::process::id()));
    let legacy = root.join("images");
    let dest = root.join("dest");
    std::fs::create_dir_all(&legacy).unwrap();
    std::fs::create_dir_all(&dest).unwrap();
    std::fs::write(legacy.join("a.png"), b"x").unwrap();
    let copied = copy_legacy_images(&root, &dest).unwrap();
    assert_eq!(copied, vec![dest.join("a.png")]);
    assert!(dest.join("a.png").exists());
    std::fs::remove_dir_all(&root).unwrap();
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cargo test --manifest-path src-tauri/Cargo.toml copy_legacy_images`
Expected: FAIL (fonction absente).

- [ ] **Step 3: Implement**

- `app_images_dir(app, workspace_id)` : `valid_id(workspace_id)?` avant tout accès disque, puis `app_data/workspaces/<id>/images`, créé avec `create_dir_all`. Remplace `ensure_dir` et `app_images_dir(app)`.
- `copy_legacy_images` : si `app_data/images` n'existe pas, renvoie `Ok(vec![])`. Sinon copie chaque fichier vers `dest` et renvoie les chemins de destination.
- Ajouter `workspace_id: String` aux six commandes et les faire passer à `app_images_dir`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cargo test --manifest-path src-tauri/Cargo.toml images`
Expected: PASS (les tests existants d'images passent toujours).

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/images.rs
git commit -m "feat(workspaces): range les images par workspace"
```

---

### Task 4: Commandes workspaces et permissions (Rust)

**Files:**
- Modify: `src-tauri/src/workspaces.rs` (commandes Tauri)
- Modify: `src-tauri/src/lib.rs` (`generate_handler!`)
- Modify: `src-tauri/capabilities/default.json`
- Régénéré : `src-tauri/permissions/autogenerated/*.toml`

**Interfaces:**
- Consumes: Tasks 1 à 3.
- Produces (commandes Tauri, noms snake_case) :
  ```rust
  list_workspaces(db) -> Result<Vec<Workspace>, String>
  create_workspace(app, db, id: String, folder: String, name: String) -> Result<Workspace, String>
  rename_workspace(db, id: String, name: String) -> Result<(), String>
  mark_opened(db, id: String) -> Result<(), String>
  delete_workspace(app, db, id: String) -> Result<(), String>
  ```

Logique de `create_workspace` :
1. `valid_id(&id)`, `validate_folder(&folder)`, `validate_name(&name)`.
2. Verrouille la connexion. `adopting = list(conn) vide && load_legacy(conn) présent`.
3. Si `adopting` : `dest = app_images_dir(&app, &id)` ; `copied = copy_legacy_images(app_data, dest)`. En cas d'erreur, supprime `workspaces/<id>` et renvoie l'erreur.
4. `create_with_legacy(conn, &ws)`. En cas d'erreur, supprime `workspaces/<id>` (si `adopting`) et renvoie l'erreur.
5. Si `adopting`, `remove_files(&copied)` pour retirer les copies legacy. Renvoie le `Workspace` (avec `folder_exists`).

`delete_workspace` : `valid_id`, `workspaces::delete`, puis suppression de `app_data/workspaces/<id>` (ignore `NotFound`).

- [ ] **Step 1: Pas de test unitaire nouveau**

La logique testable est déjà couverte par les Tasks 1 à 3. Cette task câble les commandes : la vérification est le build de l'étape 3.

- [ ] **Step 2: Implement**

- Ajouter les cinq commandes à `workspaces.rs`.
- Dans `lib.rs`, déclarer `mod workspaces;` (déjà fait en Task 1) et ajouter à `generate_handler!` : `workspaces::list_workspaces`, `workspaces::create_workspace`, `workspaces::rename_workspace`, `workspaces::mark_opened`, `workspaces::delete_workspace`, `persistence::load_board`, `persistence::save_board`. Les anciennes entrées de la liste restent.
- Dans `capabilities/default.json`, ajouter `allow-list-workspaces`, `allow-create-workspace`, `allow-rename-workspace`, `allow-mark-opened`, `allow-delete-workspace`.

- [ ] **Step 3: Régénérer les permissions et vérifier**

Run: `cargo build --manifest-path src-tauri/Cargo.toml`
Expected: build OK. `src-tauri/permissions/autogenerated/` contient un fichier `.toml` par nouvelle commande.

Run: `cargo test --manifest-path src-tauri/Cargo.toml`
Expected: PASS (tous les tests Rust).

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src src-tauri/capabilities src-tauri/permissions
git commit -m "feat(workspaces): expose les commandes workspaces et leurs permissions"
```

---

### Task 5: Store de board par workspace (front)

**Files:**
- Modify: `src/canvas/boardStore.ts`
- Modify: `src/canvas/boardStore.test.ts`

**Interfaces:**
- Consumes: rien côté Rust.
- Produces:
  ```ts
  export interface BoardState { workspaceId: string; folder: string; /* champs existants inchangés */ }
  export type BoardStore = StoreApi<BoardState>;
  export function createBoardStore(workspaceId: string, folder: string, nodes?: BoardNode[]): BoardStore; // nodes par défaut : seedNodes()
  export const BoardContext: React.Context<BoardStore | null>;
  export function useBoardStore<T>(selector: (s: BoardState) => T): T;   // useStore(useBoardApi(), selector)
  export function useBoardApi(): BoardStore;                             // lève une erreur sans provider
  ```
  Remplace l'export `useBoardStore` singleton. `createCard` et `seedNodes` ne changent pas.

- [ ] **Step 1: Adapter les tests existants**

Dans `boardStore.test.ts`, remplacer l'import singleton par :
```ts
const store = createBoardStore("ws-test", "C:\\projet", []);
const { getState, setState } = store;
```
Les tests existants gardent leurs assertions.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/canvas/boardStore.test.ts`
Expected: FAIL (`createBoardStore` absent).

- [ ] **Step 3: Implement**

- Remplacer `create<BoardState>()((set, get) => ({...}))` par `createStore<BoardState>()((set, get) => ({ workspaceId, folder, nodes: nodes ?? seedNodes(), ... }))` dans une fabrique. Le paramètre `nodes` absent donne `seedNodes()`.
- `useBoardStore` lit le store du contexte avec `useStore`. Importer `createStore` depuis `zustand/vanilla` et `useStore` depuis `zustand`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/canvas/boardStore.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/canvas/boardStore.ts src/canvas/boardStore.test.ts
git commit -m "refactor(board): crée un store de board par workspace"
```

---

### Task 6: Images scopées au workspace (front)

**Files:**
- Modify: `src/canvas/images.ts`
- Modify: `src/canvas/clipboardImage.ts`
- Modify: `src/canvas/cards/ImageCard.tsx`
- Modify: `src/canvas/images.test.ts`

**Interfaces:**
- Consumes: `BoardStore`, `useBoardStore` (Task 5).
- Produces:
  ```ts
  imageSrc(workspaceId: string, file: string): Promise<string>
  duplicateImageAsset(workspaceId: string, file: string): Promise<ImageAsset>
  importImageAsset(workspaceId: string, path: string): Promise<ImportedImage>
  describeImport(workspaceId: string, imported: ImageImport, originalName: string): Promise<ImportedImage>
  importImageFiles(store: BoardStore, paths: string[], positions: XYPosition[]): Promise<string[]>
  importClipboardImage(workspaceId: string): Promise<ImportedImage | null>
  ```
  Le cache de `images_dir` devient une `Map<string, Promise<string>>` indexée par `workspaceId`. En cas d'échec, l'entrée est retirée (comportement actuel conservé).
  Les arguments envoyés à Tauri ajoutent `workspaceId` : `images_dir`, `import_image`, `save_sanitized_svg`, `save_image_bytes`.

- [ ] **Step 1: Adapter les tests et ajouter le cas multi-workspace**

Dans `images.test.ts`, mettre à jour les assertions d'appel (par exemple `expect(invoke).toHaveBeenCalledWith("import_image", { workspaceId: "ws-1", sourcePath: ... })`) et les appels de fonctions. Ajouter :
```ts
it("résout le dossier d'images de chaque workspace séparément", async () => {
  await imageSrc("ws-a", "a.png");
  await imageSrc("ws-b", "a.png");
  expect(invoke).toHaveBeenCalledWith("images_dir", { workspaceId: "ws-a" });
  expect(invoke).toHaveBeenCalledWith("images_dir", { workspaceId: "ws-b" });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/canvas/images.test.ts`
Expected: FAIL (signatures et arguments pas encore changés).

- [ ] **Step 3: Implement**

- Remplacer `imagesDir` par la `Map` indexée par workspace.
- Ajouter `workspaceId` en premier paramètre des fonctions listées, et le passer aux `invoke`.
- `importImageFiles(store, …)` : lit `store.getState().workspaceId` pour `importImageAsset`, et appelle `store.getState().addImageCard`.
- `ImageCard.tsx` : `const workspaceId = useBoardStore((s) => s.workspaceId)` ; passer `workspaceId` à `imageSrc` et `importImageAsset`.
- `clipboardImage.ts` : `importClipboardImage(workspaceId)` envoie `workspaceId` à `save_image_bytes`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/canvas/images.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/canvas/images.ts src/canvas/clipboardImage.ts src/canvas/cards/ImageCard.tsx src/canvas/images.test.ts
git commit -m "feat(workspaces): scope les images au workspace du board"
```

---

### Task 7: Persistance par workspace (front)

**Files:**
- Modify: `src/canvas/persistence.ts`
- Create: `src/canvas/persistence.test.ts`

**Interfaces:**
- Consumes: `BoardStore`, `createBoardStore` (Task 5), `importImageAsset(workspaceId, path)` (Task 6), commandes `load_board` / `save_board` / `purge_unused_images` / `copy_image_file` (Tasks 2 à 4).
- Produces:
  ```ts
  attachAutosave(store: BoardStore): () => void    // abonnement + flush au beforeunload ; le retour annule la sauvegarde en attente sans l'écrire
  loadWorkspaceNodes(workspaceId: string, folder: string): Promise<BoardNode[] | undefined> // undefined si rien n'est sauvegardé ou en cas d'erreur (logguée)
  withFolder(nodes: BoardNode[], folder: string): BoardNode[]  // cwd = folder pour les cartes agent seulement
  exportBoard(store: BoardStore): Promise<void>
  importBoard(store: BoardStore): Promise<void>
  ```
  Les variables de module `started`, `saveTimer`, `pendingNodes` disparaissent : l'état vit dans la closure de `attachAutosave`. `restoreAndAutosave` disparaît (le chargement passe par `loadWorkspaceNodes`, Task 8).

- [ ] **Step 1: Write the failing tests**

`persistence.test.ts` (Vitest, `vi.mock("@tauri-apps/api/core")` comme dans `images.test.ts`) :

```ts
it("withFolder remplace le cwd des agents seulement", () => {
  const nodes = [agentNode("a", "C:\\ancien"), noteNode("n")];
  const out = withFolder(nodes, "C:\\projet");
  expect(out[0].data.terminal.cwd).toBe("C:\\projet");
  expect(out[1]).toEqual(nodes[1]);
});

it("detach annule la sauvegarde en attente", () => {
  vi.useFakeTimers();
  const store = createBoardStore("ws-1", "C:\\projet", []);
  const detach = attachAutosave(store);
  store.getState().addCard("note", { x: 0, y: 0 });
  detach();
  vi.runAllTimers();
  expect(invoke).not.toHaveBeenCalledWith("save_board", expect.anything());
});
```
`agentNode` / `noteNode` : petits helpers qui construisent un `BoardNode` minimal (`createCard` de `boardStore.ts` convient pour la note, et on fixe `terminal.cwd` pour l'agent).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/canvas/persistence.test.ts`
Expected: FAIL (fonctions absentes).

- [ ] **Step 3: Implement**

- `attachAutosave` : `subscribe` sur `store` ; `scheduleSave` avec timer et nœuds en attente dans la closure ; `beforeunload` appelle le flush. Le retour clear le timer, vide les nœuds en attente, désabonne, retire le listener.
- `loadWorkspaceNodes` : `invoke("load_board", { workspaceId })`, `parseBoard`, `withFolder`, puis `purge_unused_images` avec `workspaceId`. Erreurs : `console.error` et `undefined`.
- `exportBoard(store)` et `importBoard(store)` : même logique qu'aujourd'hui, avec `store` et `workspaceId` transmis à `copy_image_file`, `importImageAsset`.
- `save_board` envoie `{ workspaceId, data }`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/canvas/persistence.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/canvas/persistence.ts src/canvas/persistence.test.ts
git commit -m "feat(workspaces): sauvegarde et charge le board de chaque workspace"
```

---

### Task 8: Store des workspaces (front)

**Files:**
- Create: `src/workspaces/workspaceApi.ts`
- Create: `src/workspaces/workspaceStore.ts`
- Create: `src/workspaces/workspaceStore.test.ts`

**Interfaces:**
- Consumes: commandes Tasks 2 à 4, `createBoardStore` (Task 5), `loadWorkspaceNodes`, `attachAutosave` (Task 7), `basename` de `src/canvas/images.ts`.
- Produces:
  ```ts
  // workspaceApi.ts
  export interface Workspace { id: string; name: string; folder: string; createdAt: number; lastOpenedAt: number | null; folderExists: boolean }
  listWorkspaces(): Promise<Workspace[]>
  createWorkspace(id: string, folder: string, name: string): Promise<Workspace>
  renameWorkspace(id: string, name: string): Promise<void>
  markOpened(id: string): Promise<void>
  deleteWorkspace(id: string): Promise<void>

  // workspaceStore.ts
  export function cleanName(name: string): string            // trim ; vide => throw Error("Le nom ne peut pas être vide")
  export function pickStartupWorkspace(list: Workspace[]): Workspace | undefined // max de (lastOpenedAt ?? createdAt)
  export const useWorkspaceStore: UseBoundStore<StoreApi<WorkspaceState>>
  interface WorkspaceState {
    loaded: boolean; workspaces: Workspace[]; activeId: string | null;
    open: Record<string, { store: BoardStore; detach: () => void }>;
    error: string | null;
    load(): Promise<void>;
    create(folder: string, name?: string): Promise<void>;   // name absent => basename(folder)
    rename(id: string, name: string): Promise<void>;
    remove(id: string): Promise<void>;
    activate(id: string): Promise<void>;
  }
  ```

- [ ] **Step 1: Write the failing tests**

`workspaceStore.test.ts`, avec `vi.mock("./workspaceApi")` et `vi.mock("../canvas/persistence")` :

```ts
it("cleanName refuse un nom vide", () => {
  expect(() => cleanName("   ")).toThrow("Le nom ne peut pas être vide");
  expect(cleanName("  Projet  ")).toBe("Projet");
});

it("pickStartupWorkspace prend le dernier ouvert, sinon le plus récent créé", () => {
  const a = ws({ id: "a", createdAt: 1, lastOpenedAt: 50 });
  const b = ws({ id: "b", createdAt: 9, lastOpenedAt: null });
  expect(pickStartupWorkspace([a, b])?.id).toBe("a");
});

it("remove détache l'autosave avant de supprimer côté Rust", async () => {
  // ouvre un workspace via activate, puis remove ; l'ordre des appels est detach puis deleteWorkspace
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/workspaces/workspaceStore.test.ts`
Expected: FAIL (modules absents).

- [ ] **Step 3: Implement**

- `workspaceApi.ts` : `invoke` avec `list_workspaces`, `create_workspace { id, folder, name }`, `rename_workspace { id, name }`, `mark_opened { id }`, `delete_workspace { id }`.
- `activate(id)` : si `open[id]` absent, `nodes = await loadWorkspaceNodes(id, folder)` puis `store = createBoardStore(id, folder, nodes)` (`undefined` déclenche la valeur par défaut), `detach = attachAutosave(store)`. Puis `activeId = id`, `markOpened(id)`.
- `load()` : `listWorkspaces`, `loaded = true`, et si la liste n'est pas vide, `activate(pickStartupWorkspace(list).id)`.
- `create(folder, name?)` : `id = crypto.randomUUID()`, nom = `name ? cleanName(name) : basename(folder)`, `createWorkspace`, ajout à `workspaces`, puis `activate(id)`.
- `remove(id)` : `open[id].detach()` en premier, retrait de `open`, `deleteWorkspace(id)`, retrait de la liste, puis `activate` du plus récent restant ou `activeId = null`.
- `error` : rempli par `create` / `rename` / `remove` en cas d'échec, pour l'UI.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/workspaces/workspaceStore.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/workspaces
git commit -m "feat(workspaces): ajoute le store des workspaces"
```

---

### Task 9: Écran d'accueil, liste des workspaces et branchement (front)

**Files:**
- Create: `src/workspaces/HomeScreen.tsx`
- Create: `src/workspaces/WorkspaceSwitcher.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.css` (titre B, liste, `.workspace-view`, suppression de `.agent-cwd`)
- Modify: `src/canvas/Board.tsx` (toutes les fonctions hors React reçoivent le store)
- Modify: `src/canvas/ProviderRail.tsx` (utilise `useBoardApi()` au lieu de `useBoardStore.getState()`)
- Modify: `src/canvas/cards/AgentCard.tsx` (champ « Dossier » retiré ; `cwd` = `folder` du store)

**Interfaces:**
- Consumes: `useWorkspaceStore`, `cleanName` (Task 8), `BoardContext`, `useBoardApi` (Task 5), `ConfirmDialog` (`src/canvas/ConfirmDialog.tsx`), `open` de `@tauri-apps/plugin-dialog` (`{ directory: true, multiple: false }`).
- Produces : composants `HomeScreen` et `WorkspaceSwitcher` (sans props).

Détails :
- `App.tsx` : `useEffect(() => { void useWorkspaceStore.getState().load(); }, [])`. Rien ne s'affiche tant que `loaded` est faux. Sans workspace : `<HomeScreen />`. Sinon `<div className="app"><WorkspaceSwitcher />` puis, pour chaque entrée de `open`, `<div className="workspace-view" style={{ display: id === activeId ? undefined : "none" }}><BoardContext.Provider value={store}><Board /></BoardContext.Provider></div>`. `restoreAndAutosave` n'est plus appelé.
- `HomeScreen.tsx` : `<h1 className="home-title">Swarmify</h1>` avec la classe de titre B de la maquette (reflet violet). Bouton « Choisir un dossier » : dialogue `open` dossier, puis `create(folder)`. Erreur affichée depuis `error`.
- `WorkspaceSwitcher.tsx` : en haut à gauche. Bouton qui affiche le nom actif avec `▾`, liste des workspaces, « Nouveau workspace » (même dialogue que l'accueil). Un élément sans dossier affiche « Dossier introuvable ». Double-clic sur un nom : champ de renommage ; Entrée appelle `rename`, Échap annule. Menu « Supprimer le workspace » : `ConfirmDialog` avec le nombre d'agents du board (`nodes.filter(n => n.type === "agent").length`) et le nombre en cours (`status === "running"`), puis `remove(id)`.
- `Board.tsx` : `BoardCanvas` prend `const store = useBoardApi()`. `duplicatePastedImages(store, ids)`, `importFiles(store, …)`, `importPickedFiles(store, …)` et `pickImageFiles(store, …)` reçoivent le store en premier paramètre. Les `useBoardStore.getState()` deviennent `store.getState()`. `importClipboardImage(store.getState().workspaceId)`.
- `AgentCard.tsx` : retirer le bloc `<input className="agent-cwd" …>`. `const folder = useBoardStore((s) => s.folder)` ; `openFolder` ouvre `folder` ; `launch` utilise `const cwd = folder` ; retirer l'import `homeDir`.
- `App.css` : `.workspace-view { position: absolute; inset: 0; }`, styles du titre B repris de la maquette (`.home-title` avec `background: linear-gradient(...)`, `background-clip: text`, animation `sweep` ; règle `@media (prefers-reduced-motion: reduce)` qui désactive l'animation), styles de la liste, et suppression de `.agent-toolbar .agent-cwd`.

- [ ] **Step 1: Implémenter**

Pas de test unitaire : l'UI se valide à la Task 10 (manuel). Les règles métier sont couvertes par la Task 8.

- [ ] **Step 2: Vérifier la compilation et les tests existants**

Run: `npm run build`
Expected: `tsc` et `vite build` passent sans erreur.

Run: `npm test`
Expected: PASS (tous les tests front).

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx src/App.css src/workspaces src/canvas/Board.tsx src/canvas/ProviderRail.tsx src/canvas/cards/AgentCard.tsx
git commit -m "feat(workspaces): ajoute l'écran d'accueil et la liste des workspaces"
```

---

### Task 10: Vérification de bout en bout et documentation

**Files:**
- Modify: `README.md` (uniquement si une phrase décrit le champ « Dossier » par agent ou le board unique)

- [ ] **Step 1: Suite complète**

Run: `npm test`
Expected: PASS.

Run: `npm run build`
Expected: PASS.

Run: `cargo test --manifest-path src-tauri/Cargo.toml`
Expected: PASS.

- [ ] **Step 2: Vérification manuelle dans Tauri**

Run: `npm run tauri dev`

Parcours à valider, un par un :
1. Sans workspace : écran d'accueil avec le titre B animé.
2. « Choisir un dossier » : le workspace porte le nom du dossier ; on le renomme (double-clic).
3. Deux agents dans ce workspace : `pwd` (ou `cd`) affiche bien le dossier du workspace.
4. Nouveau workspace via la liste : le premier garde ses agents, sa sortie reste lisible au retour.
5. Supprimer un workspace avec un agent en cours : la confirmation indique le nombre d'agents ; le processus s'arrête.
6. Déplacer un dossier de workspace puis relancer : « Dossier introuvable » apparaît et l'app démarre.
7. Si une base avec un ancien board existe : le premier workspace créé récupère ce board.

- [ ] **Step 3: Documentation**

Run: `rtk git grep -n "Dossier" README.md`
Mettre à jour les phrases qui décrivent le champ « Dossier » par agent, pour dire qu'il vient du workspace. Sans correspondance, rien à changer.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs(readme): décrit les workspaces"
```

Puis la passe Impeccable sur l'écran d'accueil et la liste, hors de ce plan.

---

## Notes d'exécution

- Ordre : Tasks 1 à 4 (Rust) avant les tasks front. Tasks 5 à 8 dans cet ordre (Task 6 et 7 dépendent de 5, Task 8 de 7). Task 9 après 8. Task 10 en dernier.
- Subagents : claude-haiku-5.5, comme demandé.
