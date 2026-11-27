# Tasks: Carte Image

**Input**: Design documents from `/specs/001-image-card/`

**Prerequisites**: [plan.md](plan.md) (requis), [spec.md](spec.md) (requis), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: Des tests ciblés sont inclus car le plan les impose (Vitest pour le front, `cargo test` pour `images.rs`). Ils se limitent au comportement introduit par la feature.

**Organization**: Tâches regroupées par user story pour une implémentation et un test indépendants.

## Format: `[ID] [P?] [Story] Description`

- **[P]** : parallélisable (fichiers différents, pas de dépendance non terminée)
- **[Story]** : user story (US1 à US4, selon spec.md)
- Chemins exacts dans chaque description

## Path Conventions

- Front : `src/canvas/` (React 19, TypeScript, zustand, @xyflow/react)
- Back : `src-tauri/src/` (Tauri 2, Rust édition 2024)
- Configuration : `src-tauri/tauri.conf.json`

---

## Phase 1: Setup (Infrastructure partagée)

**Purpose**: dépendances et décision technique qui conditionnent le reste

- [ ] T001 Installer `dompurify` via `npm install dompurify` (met à jour `package.json` et `package-lock.json`), pour l'assainissement SVG (research R4)
- [ ] T002 Spike Ctrl+V : dans le handler `mod+v` de `src/canvas/Board.tsx`, tester `navigator.clipboard.read()` avec une image copiée depuis un navigateur ou une capture d'écran. Consigner le résultat dans la section R3 de `specs/001-image-card/research.md`. Si l'API échoue dans WebView2, ajouter `tauri-plugin-clipboard-manager` : `src-tauri/Cargo.toml`, `package.json`, `src-tauri/src/lib.rs` (init du plugin), `src-tauri/capabilities/default.json` (permission de lecture d'image)

---

## Phase 2: Foundational (Prérequis bloquants)

**Purpose**: types, validation, commandes Rust et configuration communs à toutes les stories

**⚠️ CRITICAL**: aucune story ne peut commencer avant la fin de cette phase

- [ ] T003 [P] Modifier `src/canvas/types.ts` : `CardType` ajoute `"image"`. Ajouter `ImageAsset` avec les contraintes de [data-model.md](data-model.md) : `file` respecte `^[0-9a-f-]{36}\.(png|jpg|gif|webp|svg)$` ; `format` ∈ `"png" | "jpeg" | "gif" | "webp" | "svg"` ; `bytes` ≤ 20 971 520 ; `width` et `height` > 0 ; `originalName` et `addedAt` (ISO 8601). Ajouter `image?: ImageAsset` à `CardData`
- [ ] T004 [P] Créer `src-tauri/src/images.rs` : fonction `images_dir(app)` (chemin `<app_data_dir>/images/`, créé si absent) ; `validate_file_name` (regex de T003, sans séparateur de chemin) ; constante `MAX_IMAGE_BYTES = 20 * 1024 * 1024` ; `detect_format(bytes)` par octets magiques (PNG `89 50 4E 47`, JPEG `FF D8 FF`, GIF `GIF8`, WebP `RIFF????WEBP`, SVG : texte contenant `<svg` après BOM et déclaration XML éventuelle). Déclarer `mod images;` dans `src-tauri/src/lib.rs`
- [ ] T005 Dans `src-tauri/src/images.rs` : commandes `import_image(app, source_path) -> ImageImport` et `save_image_bytes(app, format, data_base64) -> ImageImport` (contrat [contracts/tauri-commands.md](contracts/tauri-commands.md)). Valider l'extension (`png`, `jpg`, `jpeg`, `gif`, `webp`, `svg`), la concordance avec les octets magiques, et la taille ≤ 20 Mo. Messages d'erreur exacts : `Format non supporté : .<ext>` et `Image trop lourde : 20 Mo maximum`, et `Copie impossible : espace disque ou dossier inaccessible` si la copie échoue. Copie vers `<uuid>.<ext>` dans `images_dir`
- [ ] T006 Dans `src-tauri/src/images.rs` : commandes `save_sanitized_svg(app, file, contents)` (réécrit un SVG existant, `file` validé), `copy_image_file(app, file, dest_path)` (crée le dossier parent de `dest_path`), `purge_unused_images(app, referenced: Vec<String>) -> u32` (supprime les fichiers de `images_dir` absents de `referenced` ; ignore et ne supprime jamais les noms invalides)
- [ ] T007 Enregistrer les six commandes (`images_dir`, `import_image`, `save_image_bytes`, `save_sanitized_svg`, `copy_image_file`, `purge_unused_images`) dans l'`invoke_handler` de `src-tauri/src/lib.rs`
- [ ] T008 [P] Activer le protocole d'assets dans `src-tauri/tauri.conf.json` : `app.security.assetProtocol` avec `"enable": true` et `"scope": ["$APPDATA/images/**"]` (research R2)
- [ ] T009 Tests Rust dans le module `tests` de `src-tauri/src/images.rs` : un `.bmp` est rejeté ; un fichier `.png` aux octets JPEG est rejeté ; une image > 20 Mo est rejetée ; `purge_unused_images` ne supprime que les fichiers non référencés ; un nom invalide est ignoré
- [ ] T010 [P] Modifier `src/canvas/boardFile.ts` : `CARD_TYPES` ajoute `"image"` ; pour un nœud image, valider `data.image` (objet ; `file` conforme à la regex ; `format` dans l'énumération ; `width` et `height` numériques > 0). Ajouter dans `src/canvas/boardFile.test.ts` : un nœud image valide est accepté ; un nœud image sans `data.image.file` valide est rejeté
- [ ] T011 [P] Créer `src/canvas/images.ts` (fondation) : `sanitizeSvg(text: string): string` basé sur DOMPurify, profil SVG, avec un hook qui retire tout `href` ou `xlink:href` externe (valeur ne commençant ni par `#` ni par `data:`) ; constantes `MAX_CARD_WIDTH = 480` et `DEFAULT_SVG_SIZE = { width: 480, height: 360 }`

**Checkpoint**: fondation prête. Les user stories peuvent commencer.

---

## Phase 3: User Story 1 - Ajouter une image sur le canvas (Priority: P1) 🎯 MVP

**Goal**: ajouter une image par glisser-déposer, Ctrl+V ou sélecteur, avec une carte à la taille native plafonnée à 480 px

**Independent Test**: sur un board vide, ajouter une image par chacun des trois modes, puis vérifier qu'une carte l'affiche (scénarios 1 à 6 de [quickstart.md](quickstart.md))

### Tests pour User Story 1

- [ ] T012 [P] [US1] Test Vitest dans `src/canvas/images.test.ts` : `fitImageSize({width: 960, height: 640})` renvoie une largeur de 480 et une hauteur de 320 ; un SVG sans dimensions (0 × 0) renvoie `DEFAULT_SVG_SIZE`

### Implémentation pour User Story 1

- [ ] T013 [US1] Dans `src/canvas/images.ts` : `fitImageSize(natural)` (plafond 480 px de large, proportions conservées) ; `measureImage(src)` (lit `naturalWidth`/`naturalHeight` via `new Image()`) ; `importImageAsset(path: string)` qui appelle `import_image`, mesure l'image et renvoie `{ asset, size }` sans créer de carte ; `importImageFiles(paths: string[], positions: XYPosition[])` qui appelle `importImageAsset` pour chaque chemin, crée la carte via `addImageCard` et renvoie les erreurs collectées
- [ ] T014 [US1] Dans `src/canvas/boardStore.ts` : action `addImageCard(asset: ImageAsset, position: XYPosition, size: {width, height})`. Elle appelle `checkpoint()`, puis ajoute un nœud `type: "image"`, `status: "idle"`, `data.title = asset.originalName`, `data.image = asset`
- [ ] T015 [US1] Dans `src/canvas/images.ts` : `imageSrc(file)` (résout `images_dir` une fois et renvoie `convertFileSrc(<dir>/<file>)`)
- [ ] T016 [US1] Créer `src/canvas/cards/ImageCard.tsx` : rendu dans `CardFrame`, `<img>` avec `src` issu de `imageSrc`, `alt` = `originalName`, classe `nodrag`. Pas de traitement canvas, pour que les GIF restent animés
- [ ] T017 [US1] Dans `src/canvas/Board.tsx` : ajouter `image: ImageCard` à `nodeTypes`
- [ ] T018 [US1] Dans `src/canvas/Board.tsx` : abonnement `getCurrentWebview().onDragDropEvent` dans un `useEffect` (types `enter`, `over`, `drop`, `leave`). Sur `drop`, convertir la position physique en flux (`screenToFlowPosition` avec division par `devicePixelRatio`) et décaler chaque fichier de 500 px en horizontal, puis appeler `importImageFiles`
- [ ] T019 [US1] Dans `src/canvas/Board.tsx` : l'entrée « Image » du menu radial (`{ id: "image", ... }`, aujourd'hui sans `onSelect`) ouvre `open({ multiple: true, filters: [{ name: "Images", extensions: ["png","jpg","jpeg","gif","webp","svg"] }] })`, puis appelle `importImageFiles` à la position du menu
- [ ] T020 [US1] Dans `src/canvas/images.ts` et le handler `mod+v` de `src/canvas/Board.tsx` : si le presse-papiers contient une image (méthode retenue par T002), importer via `save_image_bytes` et créer la carte au centre de la vue (`screenToFlowPosition` du centre de la fenêtre). Sinon, garder `store.paste()` inchangé ; les fichiers des cartes image collées sont dupliqués par T035. Priorité : image du presse-papiers système, puis collage interne
- [ ] T021 [US1] Créer `src/canvas/ImportNotice.tsx` : message temporaire (4 secondes, `role="status"`) affichant les erreurs de `importImageFiles` et de l'import par presse-papiers. Monter le composant dans `src/canvas/Board.tsx`

- [ ] T035 [US1] Dans `src/canvas/boardStore.ts`, action `paste` : pour chaque nœud image collé, dupliquer le fichier en appelant `import_image` sur le chemin de l'original dans `images/`, puis réécrire `data.image.file` du nœud collé. Le collage devient asynchrone. Ajouter le test dans `src/canvas/boardStore.test.ts` : le nœud collé référence un fichier différent de l'original

**Checkpoint**: US1 fonctionnelle et testable seule (MVP)

---

## Phase 4: User Story 2 - Retrouver ses images après redémarrage et export (Priority: P1)

**Goal**: les images survivent au redémarrage, sont purgées quand elles sont orphelines, suivent l'export et l'import, et une image manquante reste gérable

**Independent Test**: ajouter une image, redémarrer, supprimer le fichier source, exporter puis réimporter. Supprimer un fichier de `images/` et vérifier l'état « introuvable » (scénarios 7 à 11 de [quickstart.md](quickstart.md))

### Implémentation pour User Story 2

- [ ] T022 [US2] Dans `src/canvas/persistence.ts`, `restoreAndAutosave` : après `load_board`, appeler `purge_unused_images` avec la liste des `data.image.file` des nœuds. Une erreur est journalisée sans bloquer le démarrage ; l'appel précède l'abonnement à l'autosave (research R6)
- [ ] T023 [US2] Dans `src/canvas/boardStore.ts` : action `replaceImage(id, asset)` qui appelle `checkpoint()`, puis met à jour `data.image` et `data.title` du nœud, sans changer sa position ni sa taille
- [ ] T024 [US2] Dans `src/canvas/images.ts` : `imagesFolderFor(path)` renvoie `<dossier>/<nom sans extension>-images`
- [ ] T025 [US2] Dans `src/canvas/persistence.ts`, `exportBoard` : après `write_text_file`, pour chaque nœud image appeler `copy_image_file(file, <imagesFolderFor>/<file>)`
- [ ] T026 [US2] Dans `src/canvas/persistence.ts`, `importBoard` : pour chaque nœud image, appeler `import_image` sur `<imagesFolderFor>/<file>`. En cas de succès, réécrire `data.image` avec le nouveau `file`, `bytes`, `format`. En cas d'échec, garder le nœud avec son nom d'origine : il s'affiche en état « introuvable » (FR-013)
- [ ] T027 [US2] Modifier `src/canvas/cards/ImageCard.tsx` : sur `onError` de l'`<img>`, passer en état « Image introuvable » avec deux actions : « Supprimer » (`removeCard`) et « Remplacer » (sélecteur d'un fichier, `importImageAsset` puis `replaceImage`, sans créer de carte)

**Checkpoint**: US2 fonctionnelle. Export, import, purge et état introuvable sont testables

---

## Phase 5: User Story 3 - Visualiser fidèlement chaque format (Priority: P2)

**Goal**: les GIF s'animent (rendu natif, déjà en place en T016) et les SVG sont assainis avant stockage

**Independent Test**: ajouter un GIF animé et un SVG contenant `<script>` et `onload`, puis vérifier l'animation et l'absence de script (scénarios 12 et 13 de [quickstart.md](quickstart.md))

### Tests pour User Story 3

- [ ] T028 [US3] Test Vitest dans `src/canvas/images.test.ts` : `sanitizeSvg` retire `<script>`, les attributs `onload` et un `href="https://..."` externe, et conserve un `<rect>`

### Implémentation pour User Story 3

- [ ] T029 [US3] Dans `src/canvas/images.ts`, `importImageAsset` : pour le format `svg`, avant la mesure, lire le fichier via `read_text_file(path)` (chemin renvoyé par `import_image`), assainir avec `sanitizeSvg`, réécrire via `save_sanitized_svg`. Un SVG vide après assainissement est refusé avec l'erreur « SVG invalide »

**Checkpoint**: US3 fonctionnelle. Les formats et la sécurité SVG sont couverts

---

## Phase 6: User Story 4 - Gérer une carte Image comme les autres cartes (Priority: P3)

**Goal**: déplacer, redimensionner (proportions conservées), supprimer et annuler une carte Image

**Independent Test**: déplacer, redimensionner, supprimer puis Ctrl+Z (scénarios 15 de [quickstart.md](quickstart.md))

### Tests pour User Story 4

- [ ] T030 [P] [US4] Test Vitest dans `src/canvas/boardStore.test.ts` : après `addImageCard`, `undo()` retire la carte ; après `deleteSelected` sur une carte image, `undo()` la restaure avec son `data.image` intact

### Implémentation pour User Story 4

- [ ] T031 [US4] Modifier `src/canvas/cards/ImageCard.tsx` : verrouiller les proportions au redimensionnement (`NodeResizer` avec `keepAspectRatio`), sauf si `CardFrame` le fait déjà ; le vérifier dans `src/canvas/cards/CardFrame.tsx`

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: validation finale, documentation et passe de design

- [ ] T032 Passe `impeccable` sur `src/canvas/cards/ImageCard.tsx` et `src/canvas/ImportNotice.tsx` après exécution, avant la revue de code (constitution, passe front)
- [ ] T033 [P] Mettre à jour `README.md` : ajouter la carte Image aux fonctionnalités, et la limite de 20 Mo ainsi que le dossier d'images voisin de l'export aux limites connues
- [ ] T034 Validation finale : `npm test`, `npm run build`, `cargo test` dans `src-tauri`, `cargo check --locked`, puis exécution des scénarios 1 à 18 de [quickstart.md](quickstart.md)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)** : immédiat. T002 décide si le plugin presse-papiers est ajouté.
- **Foundational (Phase 2)** : dépend de Setup, bloque toutes les stories. T005 et T006 dépendent de T004 (même fichier) ; T007 dépend de T006 ; T009 dépend de T006.
- **US1 (P1)** : dépend de Foundational. MVP.
- **T020** dépend de T002 (choix du presse-papiers). **T027** dépend de T023 (`replaceImage`) et de T013 (`importImageAsset`). **T035** dépend de T014 et de T005 (`import_image`).
- **US2 (P1)** : dépend de US1 (`ImageCard.tsx`, `importImageFiles`, `addImageCard`).
- **US3 (P2)** : dépend de US1 (`importImageFiles`) et de T011 (`sanitizeSvg`).
- **US4 (P3)** : dépend de US1 (`addImageCard`, `ImageCard.tsx`).
- **Polish (Phase 7)** : après toutes les stories.

### Within Each User Story

- Tests avant implémentation.
- Store (`boardStore.ts`) avant composant (`ImageCard.tsx`).
- Tâches sur le même fichier : séquentielles, pas `[P]`.

### Parallel Opportunities

- Phase 2 : T003, T008, T010, T011 (fichiers différents). T004 peut tourner en parallèle de T003.
- US1 : T012 pendant T013-T014 (fichiers différents).
- US3 et US4 peuvent démarrer en parallèle une fois US1 terminée (`images.ts` et `ImageCard.tsx` restent partagés : coordonner).
- Phase 7 : T033 en parallèle de T032.

---

## Parallel Example: Foundational

```text
# Tâches indépendantes lancées ensemble :
T003 Types ImageAsset dans src/canvas/types.ts
T004 Module Rust src-tauri/src/images.rs (structure, détection de format)
T008 Protocole d'assets dans src-tauri/tauri.conf.json
T010 Validation des nœuds image dans src/canvas/boardFile.ts
T011 sanitizeSvg dans src/canvas/images.ts
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 (Setup), en tranchant T002.
2. Phase 2 (Foundational).
3. Phase 3 (US1).
4. **STOP et VALIDER** : scénarios 1 à 6 de [quickstart.md](quickstart.md).

### Incremental Delivery

1. Setup + Foundational → fondation prête
2. US1 → ajout d'images (MVP)
3. US2 → persistance, export, image introuvable
4. US3 → GIF et SVG sécurisés
5. US4 → gestion comme les autres cartes
6. Polish → impeccable, README, validation complète

---

## Notes

- Fichier hors plan ajouté ici : `src/canvas/ImportNotice.tsx` (T021). Il est ajouté à l'arborescence de `plan.md`.
- Les GIF n'exigent pas de tâche dédiée : le rendu `<img>` (T016) les anime nativement.
- Vérifier que les tests échouent avant implémentation lorsqu'ils sont écrits en premier (T012, T028, T030).
- Une tâche = un commit logique recommandé.
- T035 est ajoutée après T021 pour garder stables les identifiants existants.
