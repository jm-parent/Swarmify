# Contrat : commandes Tauri de la carte Image

**Date** : 2026-11-25 | **Plan** : [../plan.md](../plan.md)

Commandes exposées par le backend Rust (`src-tauri/src/images.rs`, enregistrées dans `src-tauri/src/lib.rs`). Les noms de fichiers reçus du front sont toujours validés contre la regex de [data-model.md](../data-model.md) : aucun chemin arbitraire n'est accepté pour l'écriture.

## `images_dir() -> string`

Renvoie le chemin absolu de `<app_data_dir>/images/`, en le créant si besoin.

## `import_image(source_path: string) -> ImageImport`

Copie un fichier dans `images/` après validation (R5).

- **Erreurs** (`Err(string)`, message affiché à l'utilisateur) :
  - format non supporté (« Format non supporté : .bmp ») ;
  - octets magiques incohérents avec l'extension ;
  - taille > 20 Mo (« Image trop lourde : 20 Mo maximum ») ;
  - lecture ou copie impossible.
- **Succès** : `ImageImport`.

## `save_image_bytes(format: string, data_base64: string) -> ImageImport`

Même traitement qu'`import_image`, pour une image collée (Ctrl+V). `format` ∈ `png | jpeg | gif | webp | svg`. Décodage base64 vérifié, puis mêmes contrôles de taille et d'octets magiques.

## `save_sanitized_svg(file: string, contents: string) -> void`

Réécrit un SVG déjà copié avec le contenu assaini par le front (DOMPurify, R4). `file` doit respecter la regex et désigner un `.svg` existant dans `images/`.

## `purge_unused_images(referenced: string[]) -> number`

Supprime de `images/` tout fichier absent de `referenced` ; renvoie le nombre de fichiers supprimés. Appelé au démarrage (R6). Les entrées ne respectant pas la regex sont ignorées, jamais supprimées.

## `copy_image_file(file: string, dest_path: string) -> void`

Utilisée à l'export : copie `images/<file>` vers `dest_path` (dossier `<nom>-images/`). `file` doit respecter la regex.

## Types

```ts
type ImageImport = {
  file: string;      // "<uuid>.<ext>"
  path: string;      // chemin absolu dans images/
  format: "png" | "jpeg" | "gif" | "webp" | "svg";
  bytes: number;
};
```
