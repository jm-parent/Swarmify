# Implementation Plan: Groupes d'agents

**Branch**: `agents/feature-agent-groups-specification` | **Date**: 2026-11-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/002-agent-groups/spec.md`

## Summary

Un groupe est un cadre du canvas qui contient des agents. Techniquement, le groupe est un nœud React Flow de type `group` dans le même tableau de nœuds que les cartes, et l'appartenance d'un agent est son `parentId`. React Flow fait alors suivre les membres au déplacement du cadre (natif), et le plan ajoute seulement : le calcul d'appartenance au relâchement d'un agent, l'adaptation automatique du cadre, le compteur et une API pure réutilisable par la feature 2 (chat IA).

Les groupes sont stockés dans le JSON du board. Ils suivent donc le store par workspace de la feature workspaces, livrée avant (décision de clarification A). Aucun changement côté Rust.

## Technical Context

**Language/Version**: TypeScript (strict, `tsc` via `npm run build`), React 19 (`react@^19.1.0`). Backend Rust inchangé (Tauri 2).

**Primary Dependencies**: `@xyflow/react` ^13.0.3 (sous-flux via `parentId`, `NodeResizer`), `zustand` ^5.1.0 (store du board), `lucide-react`, `@tauri-apps/api`.

**Storage**: JSON du board, écrit par la commande `save_board` (SQLite côté Rust). Les groupes sont des nœuds de ce JSON. Après la feature workspaces, le JSON est celui du workspace actif (`workspace_board`).

**Testing**: Vitest (`npm test`), comme `boardStore.test.ts` et `boardFile.test.ts`. Vérification manuelle dans `npm run tauri dev`, décrite dans quickstart.md.

**Target Platform**: Windows 10/11 (application de bureau Tauri 2).

**Project Type**: desktop-app (Tauri + React, canvas React Flow).

**Performance Goals**: Le compteur et le cadre se mettent à jour dans la même image que le geste (SC-003 : moins d'une seconde). Le recalcul d'appartenance et d'adaptation est O(n) sur les nœuds du board, sans appel réseau ni disque.

**Constraints**: Format de fichier de board à version 1 conservé (ajout additif, voir research.md R5). Pas de changement Rust. Tokens et règles visuelles de DESIGN.md (cadre de groupe, rôles, typographie). Ne pas toucher à `AgentCard` (le statut `running` est déjà posé).

**Scale/Scope**: Un utilisateur, de l'ordre de 10 à 50 cartes par board, dont une dizaine d'agents par groupe au plus.

## Constitution Check

*GATE : à passer avant la recherche (Phase 0). À revérifier après la conception (Phase 1).*

| Principe | Statut | Justification |
|---|---|---|
| 1. Cadrage avant code | PASS | spec.md (clarifiée), puis plan, puis tâches, puis analyse. Aucun code avant `/speckit-analyze`. |
| 2. Brainstorming en conversation | PASS | Décisions de l'utilisateur reprises telles quelles dans la spec. Pas de skill Superpowers brainstorming ou writing-plans. |
| 3. Exécution confiée à Superpowers | PASS | Exécution prévue via `superpowers:subagent-driven-development` ou `executing-plans` sur `tasks.md`. Pas de `/speckit-implement`. |
| 4. Le plan est tasks.md | PASS | Le découpage sera dans tasks.md, sans re-planification à l'exécution. |
| 5. La spec suit le code | PASS | Points de contact vérifiés dans le code (boardStore.ts, boardFile.ts, Board.tsx, CardFrame.tsx). |
| Passe front (impeccable) | PASS (planifiée) | Interface modifiée (cadre, menu, barre d'ajout). Passe impeccable après exécution, avant revue. |
| Calibrage | PASS | Multi-composants, plus de 2 h : cadre complet. |

Aucune violation : pas de section Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/002-agent-groups/
├── spec.md              # Spécification clarifiée
├── plan.md              # Ce fichier
├── research.md          # Décisions de conception (Phase 0)
├── data-model.md        # Groupe, appartenance, invariants (Phase 1)
├── quickstart.md        # Scénarios de validation (Phase 1)
├── contracts/
│   └── group-api.md     # API de groupe, réutilisable par la feature 2
├── checklists/
│   └── requirements.md
└── tasks.md             # Créé par /speckit-tasks, pas par ce plan
```

### Source Code (repository root)

```text
src/canvas/
├── types.ts                     # + "group" dans CardType ; + GroupMeta optionnel dans CardData
├── boardStore.ts                # + actions de groupe ; deleteSelected, copySelected, paste gèrent parentId
├── boardFile.ts                 # sérialise parentId ; valide les groupes et les parentId
├── boardFile.test.ts            # + cas : aller-retour avec groupe, parentId inconnu refusé
├── boardStore.test.ts           # + cas : suppression de groupe libère ses membres
├── Board.tsx                    # nodeTypes.group ; entrée « Groupe » du menu radial ; onNodeDragStop
├── AddBar.tsx                   # bouton « + Groupe »
├── App.css                      # styles du cadre et du compteur (variables de DESIGN.md)
├── groups/
│   ├── groupOps.ts              # API pure : créer, renommer, rôle, ajouter, retirer, supprimer, compter, adapter, appartenance au relâchement
│   └── groupOps.test.ts         # cas de l'API et des règles d'appartenance
└── cards/
    └── GroupCard.tsx            # cadre : NodeResizer, nom, sélecteur de rôle, compteur
```

Fichiers hors périmètre : `persistence.ts` et `persistence.rs` ne changent pas (le JSON est opaque côté Rust, et `persistence.ts` sérialise via `serializeBoard`). `AgentCard.tsx` ne change pas.

**Structure Decision** : le code pur (règles de groupe) est dans `src/canvas/groups/`, sans dépendance à React ni à zustand. Le store et l'interface l'appellent. Cela permet à la feature 2 et aux tests unitaires d'utiliser les mêmes règles.

### Documentation à mettre à jour (exigence de la spec)

- [DESIGN.md](../../DESIGN.md), section « Cadre de groupe » : préciser le format du compteur (`N · M actif(s)`) et la règle de taille minimale. Clarifier que le libellé de groupe est le nom du groupe, distinct du « Titre de zone » facultatif.
- [README.md](../../README.md), section « Fonctionnalités » : ajouter les groupes d'agents. Section « Données » : les groupes sont dans le JSON du board, et une version antérieure de Swarmify refuse un fichier qui en contient (R5).

## Complexity Tracking

Aucune violation de la Constitution à justifier.
