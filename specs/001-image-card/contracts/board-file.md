# Contrat : format du board (JSON exporté)

**Date** : 2026-11-25 | **Plan** : [../plan.md](../plan.md)

## Version

`BOARD_FILE_VERSION` reste à `1` : l'ajout est additif (nouveau type de nœud, champ `data.image`). Un board contenant des images ne peut pas être lu par une version antérieure de l'app, car `parseBoard` y rejette les types inconnus. Ce comportement est accepté pour un usage mono-utilisateur.

## Export

- Fichier choisi par l'utilisateur : `board.json` (inchangé).
- Dossier voisin : `<nom sans extension>-images/` contenant les fichiers des cartes image référencées.
- Exemple : `Mon board.json` + `Mon board-images/<uuid>.png`.

## Import

- Lecture de `board.json` puis validation par `parseBoard`.
- Pour chaque nœud image : copie de `<nom>-images/<file>` vers `images/` via `import_image`, puis réécriture de `data.image.file` avec le nouveau nom.
- Fichier absent du dossier voisin : le nœud est conservé avec l'état « introuvable » (FR-013).

## Exemple de nœud image

```json
{
  "id": "2f1c9e0a-3b7d-4c1e-9a52-8d6f1e0b7a11",
  "type": "image",
  "position": { "x": 120, "y": 80 },
  "width": 480,
  "height": 320,
  "data": {
    "title": "capture.png",
    "status": "idle",
    "image": {
      "file": "7d4e1c2a-9f0b-4a3e-8c11-5b2a6e9f0d33.png",
      "format": "png",
      "originalName": "capture.png",
      "bytes": 183421,
      "width": 960,
      "height": 640,
      "addedAt": "2026-11-25T16:40:00.000Z"
    }
  }
}
```
