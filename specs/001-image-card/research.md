# Recherche : carte Image

**Date** : 2026-11-25 | **Plan** : [plan.md](plan.md)

Toutes les contraintes « NEEDS CLARIFICATION » du plan sont résolues ci-dessous.

## R1 - Drop depuis l'Explorateur Windows

- **Décision** : utiliser `getCurrentWebview().onDragDropEvent` (API Tauri), pas les événements HTML5 `drop`.
- **Justification** : la WebView intercepte les fichiers déposés depuis l'OS ; l'événement HTML5 ne donne pas les chemins. La fenêtre n'a pas désactivé `dragDropEnabled` (`src-tauri/tauri.conf.json`, valeur par défaut `true`). L'API est présente dans `@tauri-apps/api` 2.12.5 (`node_modules/@tauri-apps/api/webview.d.ts:538`).
- **Point d'attention** : la position du dépôt est en pixels physiques ; la convertir en coordonnées du canvas (division par `devicePixelRatio`, puis `screenToFlowPosition`).
- **Alternatives rejetées** : HTML5 `drop` (pas de chemin, lecture du contenu lourde).

## R2 - Affichage des images

- **Décision** : activer le protocole d'assets Tauri (`app.security.assetProtocol`) avec un scope limité à `$APPDATA/images/**`, et afficher les images via `convertFileSrc`.
- **Justification** : pas de copie en mémoire, pas de base64 par carte ; 20 cartes doivent s'ouvrir en moins de 2 s (SC-005). Un `<img>` ne charge ni n'exécute les scripts d'un SVG.
- **Alternative rejetée** : lecture base64 via la crate `base64` déjà présente. Elle recopie chaque fichier (jusqu'à 20 Mo) en mémoire à chaque montage.
- **Vérifié** : `$APPDATA` désigne déjà `<dataDir>/<identifiant>` (dossier de `app_data_dir()`), donc le scope ne répète pas l'identifiant.

## R3 - Ajout par Ctrl+V

- **Décision** : tenter d'abord `navigator.clipboard.read()` dans le handler Ctrl+V existant (`src/canvas/Board.tsx`) ; si WebView2 refuse l'accès ou ne renvoie pas l'image, ajouter `tauri-plugin-clipboard-manager` (`readImage`).
- **Justification** : éviter une dépendance si l'API web suffit. Le premier geste du plan est un spike qui tranche.
- **Comportement** : si le presse-papiers ne contient pas d'image, Ctrl+V garde le comportement actuel (`store.paste()`).

## R4 - Assainissement SVG

- **Décision** : ajouter `dompurify` (profil SVG), avec un hook qui retire tout `href`/`xlink:href` externe (tout ce qui ne commence pas par `#` ou `data:`).
- **Justification** : la sécurité ne se bricole pas. L'affichage en `<img>` bloque déjà l'exécution, mais FR-010 exige l'assainissement avant stockage.
- **Alternative rejetée** : expressions régulières maison (contournables).
- **Dépendance absente aujourd'hui** (vérifié dans `package.json` et `node_modules`) : c'est un ajout justifié, à noter dans `plan.md` (Complexity Tracking).

## R5 - Validation des fichiers (Rust)

- **Décision** : dans `import_image`, valider l'extension (liste blanche), les octets magiques (PNG `89 50 4E 47`, JPEG `FF D8 FF`, GIF `GIF8`, WebP `RIFF....WEBP`, SVG : texte contenant `<svg` après BOM et déclaration XML éventuelle) et la taille (`metadata().len() <= 20 * 1024 * 1024`) avant toute copie.
- **Justification** : une extension seule ne prouve rien ; le contrôle se fait côté Rust, qui a accès au disque.

## R6 - Purge des images orphelines

- **Décision** : `purge_unused_images(referenced)` appelé dans `restoreAndAutosave` (`src/canvas/persistence.ts`), juste après `load_board` et avant l'abonnement à l'autosave. Il supprime tout fichier de `images/` absent de la liste.
- **Justification** : clarification Q1 (purge au démarrage). L'historique d'annulation de la session reste valable, car les fichiers ne partent qu'au démarrage suivant.

## R7 - Dimensions naturelles

- **Décision** : mesurer `naturalWidth`/`naturalHeight` au chargement de l'image côté front ; pour un SVG sans dimensions intrinsèques (0 × 0), utiliser 480 × 360.
- **Justification** : clarification Q3 (taille native plafonnée à 480 px de large). Les dimensions sont stockées dans la carte, pour ne pas les recalculer à chaque chargement.

## R8 - Export et import

- **Décision** : `exportBoard` écrit `board.json` et copie les images référencées dans `<nom>-images/` à côté du fichier. `importBoard` relit ce dossier, copie chaque fichier dans `images/` sous un nouveau nom (`import_image`) et réécrit `data.image.file` dans les nœuds.
- **Justification** : clarification de correction Q2 (images voisines de l'export). Un fichier manquant à l'import donne l'état « image introuvable » (FR-013).

## R9 - Image introuvable

- **Décision** : `onError` sur la balise `<img>` bascule la carte en état « introuvable » ; l'utilisateur peut supprimer la carte ou choisir un nouveau fichier (clarification Q4), qui est copié puis remplace le fichier référencé.

## R10 - Annulation

- **Décision** : réutiliser `checkpoint()` du store (`src/canvas/boardStore.ts`) avant `addCard`, comme les autres ajouts. Aucun nouveau mécanisme.
