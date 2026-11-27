# Modèle de données : Groupes d'agents

Les groupes ne sont pas une table à part : ce sont des nœuds du board, sérialisés dans le même JSON (voir [research.md](./research.md) R1 et R5). Les types TypeScript sont dans `src/canvas/types.ts` et `src/canvas/groups/groupOps.ts`.

## Entités

### Groupe (nœud `type: "group"`)

| Champ | Type | Règle |
|---|---|---|
| `id` | string (UUID) | Stable. Ne change jamais, même au renommage (FR-016). |
| `type` | `"group"` | Nouvelle valeur de `CardType`. |
| `position` | `{x, y}` | Absolue. Un groupe n'a jamais de `parentId`. |
| `width`, `height` | number | Taille du cadre. Au moins la taille minimale, et englobe les membres avec la marge. |
| `data.title` | string | Nom affiché en capitales. Non vide après `trim()`. Défaut : « Nouveau groupe ». Non unique (FR-016). |
| `data.status` | `"idle"` | Requis par `CardData`, sans sémantique pour un groupe. |
| `data.group.role` | `GroupRole` | Un des huit rôles. Défaut : `general`. |
| `data.group.minSize` | `{width, height}` | Taille choisie à la main, ou `DEFAULT_GROUP_SIZE` (600 × 440). |

### Membre (nœud `type: "agent"` avec `parentId`)

| Champ | Type | Règle |
|---|---|---|
| `parentId` | string, optionnel | Id d'un nœud `group`. Absent = agent libre. |
| `position` | `{x, y}` | Relative au cadre si `parentId` est défini, absolue sinon. |
| `data.status` | `CardStatus` | Inchangé. Un agent est « actif » si `running` (FR-009, hypothèse de la spec). |

Seul un agent peut avoir un `parentId`. Les cartes note, kanban et image n'en ont jamais (FR-005).

### Rôle de groupe

`GroupRole` = `"frontend" | "backend" | "testers" | "reviewers" | "design" | "docs" | "security" | "general"`. Libellés : Frontend, Backend, Testers, Reviewers, Design, Docs, Security, General.

### Compteur (dérivé, jamais stocké)

- `total` = nombre de nœuds `agent` dont `parentId` vaut l'id du groupe.
- `active` = parmi eux, ceux dont `data.status === "running"`.

Affichage : `N · M actif` si M vaut 0 ou 1, `N · M actifs` sinon (FR-009).

## Invariants

| Id | Invariant | Vérifié par |
|---|---|---|
| I1 | Un groupe n'a pas de `parentId`. | `addAgentToGroup` refuse un groupe comme membre ; `parseBoard` le refuse. |
| I2 | Un `parentId` pointe vers un nœud `group` existant. | `parseBoard` ; `deleteGroup` libère les membres avant de supprimer. |
| I3 | Seul un agent a un `parentId`. | `addAgentToGroup` ; `parseBoard`. |
| I4 | Un agent a au plus un `parentId`. | Structurel (un seul champ). |
| I5 | Le nom d'un groupe n'est jamais vide après `trim()`. | `renameGroup` refuse, l'ancien nom reste. |
| I6 | Le cadre englobe tous ses membres, avec la marge. | `fitGroup`, appelé après chaque changement. |
| I7 | La taille du cadre est au moins `minSize`. | `fitGroup`. |
| I8 | Un groupe précède ses membres dans `nodes`. | Toute écriture du code de groupe (R3). |

## Transitions

```
            createGroup
  (rien) ───────────────▶ Groupe vide
                             │  addAgentToGroup / drop dans le cadre
                             ▼
                      Groupe avec membres ◀──┐
                             │  removeAgentFromGroup / drop hors cadre
                             │  addAgentToGroup vers un autre groupe
                             ▼
                      Agent libre (ou dans un autre groupe)

  deleteGroup (ou Suppr d'un cadre) : membres ➜ agents libres (position absolue), cadre supprimé.
```

Statut d'un agent (`running`, `idle`, `error`) : change hors groupe, par `AgentCard`. Le compteur le suit.

## Sérialisation

`serializeBoard` ajoute `parentId` (si défini) à chaque nœud. `parseBoard` accepte le type `group`, valide `data.group` (rôle dans la liste, `minSize` positif), et valide `parentId`. Un board sans groupe ni `parentId` produit le même JSON qu'aujourd'hui (R5).
