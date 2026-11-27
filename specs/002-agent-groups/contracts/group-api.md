# Contrat : API de groupes d'agents

Interface interne (TypeScript) entre le code de groupe et ses appelants : le store du board, l'interface, les tests, et la feature 2 (chat IA). Pas de réseau, pas de commande Tauri.

Le module pur est `src/canvas/groups/groupOps.ts`. Le store expose les mêmes opérations sous forme d'actions (voir plus bas).

## Module pur : `groupOps.ts`

Toutes les fonctions prennent un tableau `BoardNode[]` et renvoient un **nouveau** tableau. `createGroup` renvoie aussi l'identifiant du groupe créé. Elles ne modifient jamais l'entrée. Elles ne lèvent qu'une `GroupError`.

```ts
export const GROUP_ROLES = [
  "frontend", "backend", "testers", "reviewers", "design", "docs", "security", "general",
] as const;
export type GroupRole = (typeof GROUP_ROLES)[number];

export const DEFAULT_GROUP_NAME = "Nouveau groupe";
export const DEFAULT_GROUP_SIZE = { width: 600, height: 440 };

export type GroupErrorCode =
  | "NOT_FOUND"       // identifiant absent du board
  | "NOT_A_GROUP"     // groupId désigne une carte qui n'est pas un groupe
  | "NOT_AN_AGENT"    // agentId désigne une note, un kanban, une image ou un groupe
  | "EMPTY_NAME"      // nom vide ou composé d'espaces
  | "INVALID_ROLE";   // rôle hors GROUP_ROLES

export class GroupError extends Error {
  readonly code: GroupErrorCode;
}

export interface GroupCount {
  total: number;   // membres (agents dont parentId = groupId)
  active: number;  // parmi eux, ceux dont status === "running"
}

// Crée un groupe vide, placé en tête de tableau (invariant I8).
createGroup(nodes, options?: { name?: string; role?: GroupRole; position?: XYPosition; id?: string })
  => { nodes: BoardNode[]; id: string }

renameGroup(nodes, groupId, name) => BoardNode[]               // name.trim() non vide, sinon EMPTY_NAME
setGroupRole(nodes, groupId, role) => BoardNode[]              // role dans GROUP_ROLES, sinon INVALID_ROLE

// Ajoute un agent au groupe. S'il appartenait à un autre groupe, il le quitte.
// Position convertie en relative. Le cadre est recalculé (fitGroup).
addAgentToGroup(nodes, agentId, groupId) => BoardNode[]

// Retire un agent de son groupe. Position reconvertie en absolue. No-op si l'agent est libre.
removeAgentFromGroup(nodes, agentId) => BoardNode[]

// Supprime le cadre. Ses membres deviennent libres (positions absolues), ils ne sont pas supprimés.
deleteGroup(nodes, groupId) => BoardNode[]

// Recalcule la taille et la position du cadre : englobe les membres avec une marge de 24 px,
// sans descendre sous minSize. Déplace le cadre si un membre déborde en haut ou à gauche.
fitGroup(nodes, groupId) => BoardNode[]

// Redimensionnement manuel : la taille demandée est bornée par minimumGroupSize, puis devient minSize, puis fitGroup.
resizeGroup(nodes, groupId, size: { width: number; height: number }) => BoardNode[]

// Plus petite taille acceptable pour le cadre : boîte des membres + marge, et au moins minSize.
// Sert de borne au redimensionnement à la souris (R6, FR-008).
minimumGroupSize(nodes, groupId) => { width: number; height: number }

// Règle de relâchement (R4) : pour chaque agent donné, rejoint le plus petit cadre contenant son centre,
// ou quitte son cadre si le centre est hors de tout cadre. Puis fitGroup sur les cadres touchés.
settleMembership(nodes, agentIds: string[]) => BoardNode[]

// Lecture seule
countMembers(nodes, groupId) => GroupCount
listGroups(nodes) => BoardNode[]          // dans l'ordre du board (ordre de création)
groupOf(nodes, agentId) => BoardNode | undefined
```

### Erreurs : ordre des vérifications

Pour chaque fonction, la vérification est faite avant toute modification. Une erreur ne laisse donc jamais le board à moitié modifié : on renvoie l'erreur, l'entrée n'est pas touchée.

| Fonction | Erreurs possibles |
|---|---|
| `createGroup` | `EMPTY_NAME` si `name` est fourni et vide, `INVALID_ROLE` si `role` est fourni hors de `GROUP_ROLES`, `NOT_FOUND` si `position` ou `id` ne correspond à rien (sans objet en pratique, listé pour exhaustivité) |
| `renameGroup` | `NOT_FOUND`, `NOT_A_GROUP`, `EMPTY_NAME` |
| `resizeGroup` | `NOT_FOUND`, `NOT_A_GROUP` |
| `setGroupRole` | `NOT_FOUND`, `NOT_A_GROUP`, `INVALID_ROLE` |
| `addAgentToGroup` | `NOT_FOUND` (agent ou groupe), `NOT_A_GROUP`, `NOT_AN_AGENT` |
| `removeAgentFromGroup` | `NOT_FOUND`, `NOT_AN_AGENT` |
| `deleteGroup` | `NOT_FOUND`, `NOT_A_GROUP` |
| `countMembers`, `fitGroup` | `NOT_FOUND`, `NOT_A_GROUP` |

## Actions du store : `boardStore.ts`

Chaque action qui modifie le board appelle `checkpoint()` (annulable, FR-013), puis applique la fonction pure. Si la fonction pure lève une erreur, l'action la relance et n'enregistre aucun point d'annulation.

Exceptions :
- `settleMembership` ne fait pas de checkpoint : le point est pris au début du glissement (`onNodeDragStart`).
- `resizeGroup` ne fait pas de checkpoint : React Flow applique la taille en direct pendant le geste, donc un checkpoint au relâchement capturerait déjà la taille finale et Ctrl+Z ne défirait rien. Le point est pris au début du geste, par `onResizeStart={checkpoint}`, comme dans `CardFrame`.

| Action | Équivalent pur |
|---|---|
| `createGroup(position): string` | `createGroup` (renvoie l'id) |
| `renameGroup(id, name)` | `renameGroup` |
| `setGroupRole(id, role)` | `setGroupRole` |
| `addAgentToGroup(agentId, groupId)` | `addAgentToGroup` |
| `removeAgentFromGroup(agentId)` | `removeAgentFromGroup` |
| `deleteGroup(id)` | `deleteGroup` |
| `resizeGroup(id, width, height)` | `resizeGroup` (au relâchement du redimensionnement, sans checkpoint : voir ci-dessus) |
| `settleMembership(agentIds)` | `settleMembership`, appelée depuis `onNodeDragStop`. Pas de `checkpoint()` : le point d'annulation est pris au début du glissement, par `onNodeDragStart`. |

Les actions `deleteSelected` et `removeCard` appellent `deleteGroup` pour chaque cadre sélectionné ou supprimé.

## Usage par la feature 2 (chat IA)

Le chat ne manipule pas le DOM ni React Flow. Il appelle les actions du store, avec les identifiants.

Exemple : « ajoute deux testeurs au groupe 2 ».

1. Le chat résout « groupe 2 » en identifiant : `listGroups(nodes)[1].id`. La résolution appartient à la feature 2. Les noms ne sont pas uniques (FR-016), donc le chat doit s'appuyer sur la position dans `listGroups` ou demander une précision.
2. Pour chaque testeur à ajouter, on crée l'agent, puis `addAgentToGroup(agentId, groupId)`. Le tableau de nœuds est le même que celui de l'interface.
3. Le compteur est relu par `countMembers`.

## Invariants garantis

Voir [data-model.md](../data-model.md) (I1 à I8). Chaque fonction qui écrit rend un tableau qui respecte tous les invariants.
