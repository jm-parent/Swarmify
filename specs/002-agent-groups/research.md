# Recherche et décisions : Groupes d'agents

Pas de NEEDS CLARIFICATION restant : les choix techniques sont tous posés ci-dessous. Chaque décision a son alternative rejetée.

## R1. Modèle : nœud `group` + `parentId` sur l'agent

**Décision** : un groupe est un nœud React Flow de type `group`, dans le même tableau `nodes` que les cartes. L'appartenance d'un agent est son `parentId`.

**Rationale** : React Flow gère nativement le suivi (un enfant suit son parent quand on le déplace) et l'ordre d'affichage. Un agent a un seul `parentId`, ce qui garantit « un agent, un groupe » (FR-005). L'appartenance est réelle, pas une étiquette (demande utilisateur).

**Alternatives rejetées** :
- Tableau `groups` séparé avec `groupId` sur les agents. Il faudrait recoder le déplacement, le z-order et la sélection du cadre, et tenir deux sources de vérité.
- Cadre purement visuel, sans `parentId`. Rejeté : contredit la demande (appartenance réelle).

## R2. Coordonnées : position relative au cadre

**Décision** : un agent membre a une position relative au cadre (convention React Flow : `{x:0,y:0}` = coin haut gauche du parent). Un agent libre a une position absolue.

**Rationale** : c'est la convention native, et elle rend le suivi gratuit. Source : documentation React Flow « Sub Flows » (« the child node is positioned relative to its parent »).

**Conséquences** :
- Sortir un agent d'un cadre (`removeAgentFromGroup`, ou suppression du cadre) reconvertit la position en absolue.
- `copySelected` place les cartes copiées en absolu et retire `parentId` (FR-017 : un agent collé n'appartient à aucun groupe).

## R3. Ordre du tableau : groupes avant leurs membres

**Décision** : toute écriture de `nodes` par le code de groupe place les nœuds `group` avant leurs membres.

**Rationale** : les exemples React Flow placent le parent avant l'enfant. Le respect de cet ordre évite un rendu incorrect, et met le cadre sous ses membres dans le z-order.

**À vérifier** : la doc v13 ne l'impose peut-être plus. On garde l'ordre dans tous les cas (coût nul). Point de contrôle dans quickstart.md.

## R4. Appartenance calculée au relâchement

**Décision** : à la fin d'un glissement d'agent (`onNodeDragStop`), on teste le centre de la carte, en coordonnées absolues, contre les cadres :
- centre dans un cadre : l'agent le rejoint (si plusieurs cadres, le plus petit) ;
- centre hors de tout cadre : l'agent quitte son cadre.

**Rationale** : un seul changement d'appartenance par geste, donc un seul point d'annulation (FR-013). Le centre est plus stable que le coin quand la carte est grande (560 px).

**Alternatives rejetées** :
- Calcul pendant le glissement (`onNodeDrag`). Rejeté : l'appartenance change pendant un geste annulable, et le cadre clignote à chaque pixel.
- Appartenance par recouvrement partiel. Rejeté : ambigu avec un cadre qui grandit par-dessus un agent hors groupe (cas limite de la spec).

## R5. Format du fichier de board : version 1 conservée, ajout additif

**Décision** : `BOARD_FILE_VERSION` reste à `1`. On ajoute `parentId` (optionnel) sur les nœuds, le type `group` et `data.group` (rôle, taille minimale). `serializeBoard` écrit `parentId`. `parseBoard` valide les groupes et refuse un `parentId` qui ne pointe pas vers un groupe existant.

**Rationale** : un board sans groupes reste identique au format actuel, et un board antérieur se charge sans migration.

**Trade-off accepté** : une version antérieure de Swarmify rejette un fichier qui contient un groupe (type inconnu). Un passage en version 2 aurait le même effet pour une version 1, sans bénéfice. À noter dans le README (section Données).

## R6. Adaptation automatique et taille minimale

**Décision** :
- `fitGroup(nodes, groupId)` : boîte englobante des membres (coordonnées absolues, tailles incluses) + marge de 24 px. Taille du cadre = max(boîte + marge, taille minimale). Si la boîte déborde en haut ou à gauche, le cadre se déplace et les positions relatives des membres sont réécrites.
- Taille minimale = taille choisie à la main (`data.group.minSize`), ou à défaut `DEFAULT_GROUP_SIZE` (600 × 440 px, à ajuster en passe Impeccable).
- Redimensionnement à la main : `NodeResizer` empêche de passer sous la boîte des membres pendant le geste, et met `minSize` à la taille finale au relâchement. Le point d'annulation est pris au début du geste (`onResizeStart`), pas au relâchement : sinon Ctrl+Z ne défait rien (voir `contracts/group-api.md`, « Exceptions »).
- `fitGroup` est appelé après chaque changement de membres, après un déplacement d'agent, et après un redimensionnement.

**Rationale** : répond à la clarification 2 (taille choisie = minimum) et à FR-007 et FR-008. La fonction est pure, donc testable.

**Alternative rejetée** : un cadre qui ne fait qu'agrandir (jamais de retour). Rejeté : contredit « se réduit à l'englobant » (FR-007).

## R7. API pure, store mince

**Décision** : les règles de groupe sont dans `src/canvas/groups/groupOps.ts`, en fonctions pures `BoardNode[] → BoardNode[]` avec erreurs typées (`GroupError`, codes listés dans contracts/group-api.md). `boardStore.ts` expose des actions fines qui font `checkpoint()` puis appliquent la fonction pure.

**Rationale** : testable sans zustand ni React. Le chat IA appelle les actions du store, qui réutilisent les mêmes règles.

**Alternative rejetée** : règles dans le store. Rejeté : impossible à réutiliser hors store, tests plus lourds.

## R8. Suppression et copier-coller

**Décision** :
- `deleteSelected` et `removeCard` sur un cadre : les membres sont libérés (position absolue, `parentId` retiré), sans être supprimés. Leurs sessions continuent (FR-012, SC-005).
- `copySelected` : les cartes copiées sont en absolu, sans `parentId`. Un cadre n'est pas copiable en V1 (FR-017), il est exclu du presse-papiers.

**Rationale** : supprimer un cadre ne doit jamais tuer ni supprimer un agent. Cette garantie est explicitement demandée.

## R9. Compteur et sélecteurs zustand

**Décision** : `countMembers` renvoie `{ total, active }`. Le composant le lit avec `useShallow` (zustand v5) pour éviter un re-rendu à chaque changement de store. Le format « N · M actif / actifs » vit dans `GroupCard` (présentation).

**Rationale** : un objet recréé à chaque lecture provoquerait des re-rendus inutiles.

## R10. Points d'entrée : barre d'ajout et menu radial

**Décision** :
- `AddBar` : bouton « + Groupe », même logique que les autres boutons (centre de la vue).
- `RadialMenu` : l'entrée « Équipe » (désactivée, sans action, dans `Board.tsx`) devient « Groupe » et crée un cadre au point du clic.

**Rationale** : « Équipe » est déjà un placeholder pour cette idée. Le remplacer évite un doublon. **Validé** par l'utilisateur (option A : « Équipe » devient « Groupe »).

## R11. Clavier (FR-018)

**Décision** : création via le bouton de la barre d'ajout (focus, Entrée). Nom : `<input>` natif. Rôle : `<select>` natif. Tout est atteignable au Tab. Le menu radial reste souris, comme aujourd'hui.

**Rationale** : clarification 3, principe « Tout se commande au clavier » de DESIGN.md. Le menu radial n'est pas accessible au clavier aujourd'hui, c'est hors périmètre.

## R12. Stockage par workspace

**Décision** : aucun code spécifique. Les groupes sont des nœuds, donc ils suivent le store du workspace actif. Dépendance : la fabrique `createBoardStore(workspaceId)` de la feature workspaces, livrée avant (clarification 1, option A).

**Rationale** : c'est le bénéfice principal de R1. Les groupes ne demandent aucune table ni commande Rust.

## R13. Rôles et couleurs

**Décision** : les huit rôles (`frontend`, `backend`, `testers`, `reviewers`, `design`, `docs`, `security`, `general`) sont dans `groupOps.ts`. Les couleurs viennent de DESIGN.md, en propriétés CSS (`--role-*`) dans `App.css`. Le cadre reçoit `data-role`, et le CSS choisit la couleur.

**Rationale** : pas de couleur en dur dans le TSX, tokens centralisés. Libellés affichés comme dans DESIGN.md (Frontend, Backend, Testers…).

## Alternatives non retenues (globalement)

- Groupes dans une table SQLite séparée : pas nécessaire, le JSON du board suffit, et les groupes suivent le workspace.
- Groupes imbriqués : hors périmètre V1 (spec, Out of Scope).
