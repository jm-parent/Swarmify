# Implementation Plan: Carte Image

**Branch**: `jeanmarie-parent-exakisc-carte-image` | **Date**: 2026-11-25 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-image-card/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Ajouter une carte Image au canvas Swarmify. Une image arrive par glisser-déposer depuis l'Explorateur (événement natif Tauri), par Ctrl+V ou par le sélecteur du menu radial. Elle est copiée dans `images/` (données de l'app), validée côté Rust (extension, octets magiques, 20 Mo), assainie si SVG, puis affichée via le protocole d'assets Tauri. Les copies orphelines sont purgées au démarrage. L'export JSON embarque un dossier d'images voisin. Détails : [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/).

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: TypeScript 5 / React 19 (front) ; Rust édition 2024 (back, Tauri 2)

**Primary Dependencies**: @xyflow/react, zustand, @tauri-apps/api 2.12.5, tauri-plugin-dialog ; nouveaux : `dompurify` (R4), `tauri-plugin-clipboard-manager` seulement si le spike R3 échoue

**Storage**: SQLite pour le board (`board.sqlite`, dossier de données de l'app) ; fichiers images dans `<app_data_dir>/images/` ; export JSON + dossier `<nom>-images/`

**Testing**: Vitest (`npm test`) pour le front ; `cargo test` pour `src-tauri/src/images.rs` ; scénarios manuels dans [quickstart.md](quickstart.md)

**Target Platform**: Windows 10 (21H2+) / Windows 11, WebView2

**Project Type**: desktop-app (Tauri 2 + React)

**Performance Goals**: un board de 20 cartes image s'ouvre en moins de 2 s (SC-005) ; aucune copie d'image en mémoire côté front pour l'affichage

**Constraints**: image ≤ 20 Mo ; aucun script exécuté depuis une image ; chemins de fichiers validés côté Rust ; pas de réseau

**Scale/Scope**: mono-utilisateur ; quelques dizaines de cartes image par board

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Cadrage avant code** : PASS. Spec, clarifications et plan sont faits avant tout code.
- **Brainstorming en conversation** : PASS. Les skills Superpowers brainstorming et writing-plans ne sont pas utilisés.
- **Exécution par Superpowers** : à respecter à l'étape suivante (`tasks.md`, puis exécution sans re-planifier).
- **La spec suit le code** : PASS. Après lecture de `persistence.rs`, FR-006 et US2.3 ont été corrigés (board en SQLite, pas en fichier).
- **Passe impeccable** : prévue après exécution, avant la revue, car la feature modifie l'interface (`src/canvas/cards/`).
- **Calibrage** : multi-composants (front, Rust, config Tauri) : cadre complet, conforme.

Aucune violation : pas de justification à porter dans Complexity Tracking pour le cadre.

## Project Structure

### Documentation (this feature)

```text
specs/001-image-card/
├── plan.md              # Ce fichier (/speckit-plan)
├── research.md          # Phase 0 (R1 à R10)
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1, guide de validation
├── contracts/
│   ├── tauri-commands.md
│   └── board-file.md
└── tasks.md             # Phase 2 (/speckit-tasks, pas encore créé)
```

### Source Code (repository root)

```text
src/canvas/
├── types.ts                 # + CardType "image", ImageAsset (modifié)
├── boardStore.ts            # + addImageCard : checkpoint puis addCard (modifié)
├── boardFile.ts             # + validation des nœuds image (modifié)
├── boardFile.test.ts        # + cas image valides et invalides (modifié)
├── persistence.ts           # + purge au démarrage, export/import des images (modifié)
├── images.ts                # pipeline front : import, dimensions, SVG via DOMPurify (nouveau)
├── images.test.ts           # dimensions par défaut, nom de fichier accepté (nouveau)
├── Board.tsx                # drop natif, Ctrl+V image, nodeTypes.image (modifié)
├── ImportNotice.tsx         # message temporaire d'erreur d'import (nouveau)
└── cards/
    └── ImageCard.tsx        # rendu image, état « introuvable », remplacement (nouveau)

src-tauri/src/
├── images.rs                # import, save_image_bytes, save_sanitized_svg, purge, copy_image_file + tests (nouveau)
├── lib.rs                   # mod images, enregistrement des commandes (modifié)
└── tauri.conf.json          # app.security.assetProtocol, scope images/** (modifié)
```

**Structure Decision** : extension des modules existants de `src/canvas/` (un fichier par responsabilité, comme `cards/NoteCard.tsx`) et d'un module Rust dédié `images.rs`, à côté de `persistence.rs`. Aucun nouveau dossier de premier niveau.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Dépendance `dompurify` (R4) | Assainir les SVG importés (FR-010) avec un profil SVG maintenu | Regex maison : contournable. Affichage seul en `<img>` ne suffit pas, FR-010 exige l'assainissement avant stockage |
| Plugin `tauri-plugin-clipboard-manager` (R3, conditionnel) | Lire une image du presse-papiers si `navigator.clipboard.read()` échoue dans WebView2 | Pas d'API web fiable : le spike R3 décide. Sans cela, Ctrl+V ne fonctionne pas pour les images |
| Module Rust `images.rs` | Validation octets magiques et taille, accès disque hors de la WebView | Validation front seule : une extension ne prouve pas le format, et la WebView ne doit pas écrire librement dans `images/` |

