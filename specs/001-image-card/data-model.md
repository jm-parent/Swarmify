# Modèle de données : carte Image

**Date** : 2026-11-25 | **Plan** : [plan.md](plan.md) | **Recherche** : [research.md](research.md)

## Entités

### Carte Image (nœud du board)

Extension du type de nœud existant (`src/canvas/types.ts`) :

- `type` : `"image"` (ajouté à `CardType`, qui vaut aujourd'hui `note | kanban | agent`).
- `width`, `height` : dimensions du cadre (à l'ajout, largeur ≤ 480 px, proportions conservées).
- `data.title` : nom affiché, initialisé au nom d'origine du fichier.
- `data.status` : `"idle"` (les cartes image n'ont pas d'exécution).
- `data.image` : `ImageAsset` (ci-dessous). Présent uniquement sur les cartes image.

### ImageAsset (ajouté à `CardData`)

| Champ | Type | Règle |
|---|---|---|
| `file` | string | Nom du fichier dans `images/` : `<uuid>.<ext>`. Regex : `^[0-9a-f-]{36}\.(png\|jpg\|gif\|webp\|svg)$`. Pas de séparateur de chemin. |
| `format` | `"png" \| "jpeg" \| "gif" \| "webp" \| "svg"` | Dérivé des octets magiques, pas de l'extension seule. |
| `originalName` | string | Nom du fichier d'origine, affiché en info-bulle (spec, Key Entities). |
| `bytes` | number | Taille de la copie, ≤ 20 971 520 (20 Mo). |
| `width` | number | Largeur naturelle, > 0 (480 × 360 pour un SVG sans dimensions). |
| `height` | number | Hauteur naturelle, > 0. |
| `addedAt` | string | Date ISO 8601 de l'import. |

## Relations

- Une carte image possède exactement un `ImageAsset`.
- Un fichier de `images/` est référencé par au plus une carte. Le partage est exclu (Assumptions : pas de déduplication).

## Cycle de vie

```text
  (import réussi)            (carte retirée,            (démarrage suivant,
   fichier créé  ─────────▶  fichier encore présent) ───▶ purge : fichier supprimé
        │                          │
        │ carte supprimée          │ Ctrl+Z
        ▼                          ▼
   carte absente  ◀──────────  carte restaurée
```

- **Import** : `import_image` valide puis copie ; la carte est ajoutée avec `checkpoint()`.
- **Suppression** : la carte disparaît, son fichier reste jusqu'au démarrage suivant (Q1). Ctrl+Z restaure la carte avec son image.
- **Image introuvable** : fichier absent (suppression manuelle). La carte reste dans le board, avec l'état « introuvable » (FR-013).
- **Remplacement** : un nouveau fichier est importé, `data.image` est réécrit, l'ancien fichier est purgé au démarrage suivant.

## Validation (parseBoard)

Règles ajoutées à `src/canvas/boardFile.ts` pour un nœud `type === "image"` :

- `data.image` est un objet ;
- `data.image.file` respecte la regex ci-dessus ;
- `data.image.format` appartient à l'énumération ;
- `data.image.width` et `data.image.height` sont des nombres > 0.

Un nœud image invalide fait échouer le chargement, comme les autres types (même comportement que `parseBoard` aujourd'hui).
