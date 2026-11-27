# Tasks: Groupes d'agents

**Input**: Design documents from `specs/002-agent-groups/`

**Prerequisites**: plan.md (requis), spec.md (requis pour les user stories), research.md, data-model.md, contracts/group-api.md, quickstart.md

**Tests**: inclus pour les règles pures et le format de fichier uniquement. Raison : plan.md (« Testing : Vitest ») et quickstart.md les demandent, et les fichiers `groupOps.test.ts`, `boardFile.test.ts` et `boardStore.test.ts` sont prévus. Pas de test de rendu.

**Organisation** : par user story, pour une implémentation et un test indépendants. Les US2, US3 et US4 modifient le composant `GroupCard.tsx` créé en US1 : elles démarrent après le point de contrôle de US1.

## Format : `[ID] [P?] [Story] Description`

- **[P]** : peut tourner en parallèle (fichiers différents, pas de dépendance sur une tâche incomplète)
- **[Story]** : user story concernée (US1 à US6), absent en Setup, Foundational et Polish
- Chemins exacts dans chaque description

## Chemins

- Code : `src/canvas/` (Vite + React, TypeScript), `src/App.css`
- Docs : `DESIGN.md`, `README.md`
- Pas de changement Rust (`src-tauri/`) : voir research.md R12

---

## Phase 1 : Setup (infrastructure partagée)

**But** : relever la base avant toute modification, pour distinguer les échecs préexistants des régressions.

- [ ] T001 Lancer `npm test` et `npm run build` sur la branche avant modification (scripts de `package.json`) et noter les échecs déjà présents

---

## Phase 2 : Foundational (prérequis bloquants)

**Prérequis bloquant (décision I2, option A)** : la feature workspaces est mergée et le store du board est une fabrique `createBoardStore(workspaceId)`. Les références à `boardStore.ts` ci-dessous (T009, T023, T024, T025, T026) visent alors l'instance du workspace actif. Ne pas démarrer cette phase avant.

**But** : le modèle, le format de fichier, le module pur et les actions du store. Toutes les user stories s'appuient dessus.

**⚠️ CRITIQUE** : aucune user story ne commence avant la fin de cette phase.

- [ ] T002 Étendre `src/canvas/types.ts` : ajouter `"group"` à `CardType`, exporter `GroupRole` (huit valeurs, voir T003), ajouter `group?: GroupMeta` à `CardData`, avec `GroupMeta = { role: GroupRole; minSize: { width: number; height: number } }`. Contrainte à respecter (data-model.md) : `role` est une valeur de `GROUP_ROLES` ; `minSize` a une largeur et une hauteur positives.
- [ ] T003 Créer `src/canvas/groups/groupOps.ts` : constantes `GROUP_ROLES` (dans l'ordre de DESIGN.md : frontend, backend, testers, reviewers, design, docs, security, general), `DEFAULT_GROUP_NAME = "Nouveau groupe"`, `DEFAULT_GROUP_SIZE = { width: 600, height: 440 }`, marge `24` px ; classe `GroupError` avec les codes `NOT_FOUND`, `NOT_A_GROUP`, `NOT_AN_AGENT`, `EMPTY_NAME`, `INVALID_ROLE` ; lectures `listGroups`, `groupOf`, `countMembers` (total = agents dont `parentId` vaut l'id du groupe ; actif = `data.status === "running"`).
- [ ] T004 Dans `src/canvas/groups/groupOps.ts` : mutations `createGroup` (nœud placé en tête de tableau, invariant I8 ; `data.title` = nom ou `DEFAULT_GROUP_NAME`, `data.status` = `"idle"`, `data.group` = `{ role: "general", minSize: DEFAULT_GROUP_SIZE }`), `renameGroup` (contrainte : nom non vide après `trim()`, sinon `EMPTY_NAME`), `setGroupRole` (contrainte : rôle dans `GROUP_ROLES`, sinon `INVALID_ROLE`), `addAgentToGroup` (position convertie en relative, quitte l'ancien groupe), `removeAgentFromGroup` (position reconvertie en absolue), `deleteGroup` (membres libérés en absolu, jamais supprimés). Chaque fonction vérifie ses erreurs avant de modifier le tableau.
- [ ] T005 Dans `src/canvas/groups/groupOps.ts` : géométrie. `fitGroup` (boîte des membres + marge, taille au moins `minSize`, déplacement du cadre si un membre déborde en haut ou à gauche avec réécriture des positions relatives), `minimumGroupSize`, `resizeGroup` (borne par `minimumGroupSize`, puis `minSize` = taille obtenue, puis `fitGroup`), `settleMembership` (centre de la carte en absolu ; rejoint le plus petit cadre qui contient le centre ; hors de tout cadre, retrait).
- [ ] T006 Mettre à jour `src/canvas/boardFile.ts` : `serializeBoard` écrit `parentId` quand il est défini. `parseBoard` accepte le type `"group"`, place les groupes en tête du tableau (invariant I8, research.md R3), valide `data.group` (contrainte : rôle dans `GROUP_ROLES`, `minSize.width` et `minSize.height` strictement positifs), valide `parentId` (contrainte : défini seulement sur un nœud `agent`, et pointe vers un nœud `group` existant). `BOARD_FILE_VERSION` reste `1`. Un board sans groupe produit le même JSON qu'aujourd'hui.
- [ ] T007 Créer `src/canvas/groups/groupOps.test.ts` : règles pures. Un groupe créé est en tête de tableau ; un renommage vide est refusé ; ajouter une note échoue avec `NOT_AN_AGENT` sans changer le tableau ; un agent passe d'un groupe à un autre ; supprimer un groupe remet ses membres en position absolue ; `countMembers` renvoie total et actifs ; `settleMembership` choisit le plus petit cadre ; un centre hors de tout cadre retire l'agent ; une note déposée dans un cadre n'y entre pas (`settleMembership` ne traite que les agents) ; un cadre qui grandit par-dessus un agent hors groupe ne l'ajoute pas ; un agent dans la zone commune de deux cadres rejoint le plus petit. Dépend de T003 à T005.
- [ ] T008 [P] Mettre à jour `src/canvas/boardFile.test.ts` : aller-retour d'un board avec groupe et `parentId` ; un `parentId` inconnu est refusé ; un board sans groupe est inchangé ; un groupe placé après ses membres dans le fichier est remis en tête. Démarre après T006, en parallèle de T007.
- [ ] T009 Mettre à jour `src/canvas/boardStore.ts` : actions `createGroup(position): string`, `renameGroup`, `setGroupRole`, `addAgentToGroup`, `removeAgentFromGroup`, `deleteGroup`, `resizeGroup`, `settleMembership(agentIds)`. Chaque action appelle `checkpoint()` puis la fonction pure, sauf deux exceptions : `settleMembership` (le point est pris au début du glissement, par `onNodeDragStart`) et `resizeGroup` (le point est pris au début du geste, par `onResizeStart`, voir T021). Si la fonction pure lève une erreur, l'action la relance sans enregistrer de point d'annulation. Dépend de T004 et T005.

**Point de contrôle** : `npm test` passe sur les fichiers de la phase. Le modèle et le format sont prêts, les user stories peuvent commencer.

---

## Phase 3 : User Story 1 - Regrouper des agents dans un cadre (Priorité : P1) 🎯 MVP

**But** : créer un groupe depuis le menu radial ou la barre d'ajout, y placer des agents, déplacer le cadre avec ses membres, sortir un agent.

**Test indépendant** : scénario S1 de [quickstart.md](./quickstart.md) (créer, glisser dedans, déplacer le cadre, sortir un membre).

- [ ] T010 [US1] Créer `src/canvas/cards/GroupCard.tsx` : composant du type `"group"`, avec un `NodeResizer` visible quand le cadre est sélectionné, et le nom affiché en capitales (lecture seule pour l'instant). Ne pas réutiliser `CardFrame` : son champ titre appelle `updateCard` et accepterait un nom vide.
- [ ] T011 [P] [US1] Ajouter dans `src/App.css` les styles du cadre : rayon 8 px, trait de 1,5 px dans la couleur du rôle (variable par défaut `General` = `#9A9A94`), fond transparent, sans effet lumineux ni dégradé (FR-010), en s'appuyant sur les règles « Cadre de groupe » de DESIGN.md.
- [ ] T012 [US1] Mettre à jour `src/canvas/Board.tsx` : importer `GroupCard` et ajouter `group: GroupCard` à `nodeTypes`. Dépend de T010.
- [ ] T013 [US1] Mettre à jour `src/canvas/Board.tsx` : dans `menuItems`, remplacer l'entrée désactivée « Équipe » (`id: "users"`, sans `onSelect`) par « Groupe » (icône `Users`), dont `onSelect` appelle `createGroup` au point du clic (`at`). Décision validée par l'utilisateur (research.md R10). Dépend de T012.
- [ ] T014 [P] [US1] Mettre à jour `src/canvas/AddBar.tsx` : bouton « + Groupe » qui appelle `createGroup` au centre de la vue, décalé de la moitié de `DEFAULT_GROUP_SIZE` comme `add()` le fait pour les cartes.
- [ ] T015 [US1] Mettre à jour `src/canvas/Board.tsx` : ajouter `onNodeDragStop` qui appelle `settleMembership` avec les identifiants des nœuds `agent` déplacés. Le suivi des membres quand on déplace le cadre est natif (`parentId`), il n'y a rien à coder. Dépend de T013.

**Point de contrôle** : S1 passe. Un groupe se crée, accueille des agents, suit son déplacement et libère ses membres.

---

## Phase 4 : User Story 2 - Lire l'état du groupe d'un coup d'œil (Priorité : P1)

**But** : afficher `N · M actif` ou `N · M actifs` et le tenir à jour.

**Test indépendant** : scénario S2 de quickstart.md.

- [ ] T016 [US2] Mettre à jour `src/canvas/cards/GroupCard.tsx` : afficher le compteur, lu par `useShallow(countMembers(...))` (zustand v5, pour éviter un re-rendu à chaque changement). Singulier pour 0 et 1, pluriel à partir de 2 (FR-009). Dépend de T010, T015.
- [ ] T017 [US2] Ajouter dans `src/App.css` le style du compteur : Cascadia Mono 13 px, gris, chiffres tabulaires (DESIGN.md, « Méta de statut »).

**Point de contrôle** : S2 passe. Le compteur suit les démarrages et arrêts d'agents sans recharger.

---

## Phase 5 : User Story 3 - Nommer le groupe et choisir son rôle (Priorité : P2)

**But** : renommer un groupe (refus d'un nom vide), changer son rôle.

**Test indépendant** : scénario S3 de quickstart.md.

- [ ] T018 [US3] Mettre à jour `src/canvas/cards/GroupCard.tsx` : nom éditable via `renameGroup` (et non `updateCard`). Un nom vide ou composé d'espaces lève `EMPTY_NAME` et l'ancien nom est rétabli. Entrée valide, Échap annule. Dépend de T016.
- [ ] T019 [US3] Mettre à jour `src/canvas/cards/GroupCard.tsx` : sélecteur de rôle natif (`<select>`) avec les huit rôles, appelle `setGroupRole`, et pose `data-role` sur le cadre pour la couleur. Dépend de T018.
- [ ] T020 [US3] Mettre à jour `src/App.css` : variables `--role-frontend` à `--role-general` selon DESIGN.md (Frontend `#E0A060`, Backend `#B48CE0`, Testers `#7FBF6A`, Reviewers `#7FA8E8`, Design `#E07A9A`, Docs `#6DBEBE`, Security `#E0705A`, General `#9A9A94`). La bordure et la pastille de 6 px prennent la variable selon `data-role`.

**Point de contrôle** : S3 passe.

---

## Phase 6 : User Story 4 - Adapter le cadre aux agents (Priorité : P2)

**But** : le cadre suit ses membres, et se redimensionne à la main sans couper un membre.

**Test indépendant** : scénario S4 de quickstart.md.

- [ ] T021 [US4] Mettre à jour `src/canvas/cards/GroupCard.tsx` : `onResizeStart={checkpoint}` (point d'annulation au début du geste, comme `CardFrame.tsx`) ; `NodeResizer` borne la taille pendant le geste avec `minimumGroupSize` (`onResize`) ; `onResizeEnd` appelle `resizeGroup(id, width, height)`, sans checkpoint supplémentaire. Ne proposer que les poignées bas-droite : les membres ont des positions relatives, donc une poignée haute ou gauche ferait glisser les membres visuellement (M3). Dépend de T016.
- [ ] T022 [US4] Compléter `src/canvas/groups/groupOps.test.ts` : l'ajout agrandit le cadre avec la marge ; le retrait le réduit sans descendre sous `minSize` ; une taille choisie à la main devient le minimum ; un membre qui déborde en haut ou à gauche déplace le cadre sans changer les positions absolues des membres. Dépend de T007.

**Point de contrôle** : S4 passe.

---

## Phase 7 : User Story 5 - Supprimer un groupe sans toucher à ses agents (Priorité : P2)

**But** : supprimer un cadre libère ses agents, sans les supprimer ni arrêter leurs sessions. Annuler restaure le groupe.

**Test indépendant** : scénario S5 de quickstart.md.

- [ ] T023 [US5] Mettre à jour `src/canvas/boardStore.ts` : `deleteSelected` et `removeCard` appellent `deleteGroup` pour chaque cadre concerné, avant de retirer les autres nœuds sélectionnés. Un membre sélectionné en même temps que son cadre est supprimé par la sélection, comme aujourd'hui. Dépend de T009.
- [ ] T024 [US5] Compléter `src/canvas/boardStore.test.ts` : supprimer un cadre garde ses membres à leur position absolue ; `undo` restaure le cadre et ses membres. Dépend de T023.

**Point de contrôle** : S5 passe. Aucun agent n'est supprimé ni arrêté par une suppression de cadre.

---

## Phase 8 : User Story 6 - Piloter les groupes sans interface (Priorité : P2)

**But** : les actions de groupe du store sont utilisables sans l'interface, avec les garanties d'annulation et d'erreur du contrat.

**Test indépendant** : une séquence scriptée (créer, ajouter, retirer, compter, supprimer) via le store, sans UI.

- [ ] T025 [US6] Compléter `src/canvas/boardStore.test.ts` : une action de groupe est annulable en une étape (`createGroup` puis `undo` retire le groupe) ; un `renameGroup` vide lève `EMPTY_NAME` et ne modifie pas `past`. Dépend de T024.

**Point de contrôle** : la séquence scriptée passe, et le chat IA peut s'appuyer sur `contracts/group-api.md`.

---

## Phase 9 : Polish & préoccupations transverses

**But** : garanties transverses et documentation.

- [ ] T026 Mettre à jour `src/canvas/boardStore.ts` : `copySelected` stocke les cartes en coordonnées absolues sans `parentId` ; `paste` recrée les cartes sans `parentId` (FR-017) ; les cadres sont exclus du presse-papiers. Dépend de T023.
- [ ] T027 [P] Mettre à jour `DESIGN.md`, section « Cadre de groupe » : format du compteur (`N · M actif(s)`), règle de taille minimale. Clarifier que le libellé est le nom du groupe, distinct du « Titre de zone » facultatif.
- [ ] T028 [P] Mettre à jour `README.md` : section « Fonctionnalités » (groupes d'agents) ; section « Données » : les groupes sont dans le JSON du board, et une version antérieure de Swarmify refuse un fichier qui en contient.
- [ ] T029 Lancer `npm test` puis `npm run build` (scripts de `package.json`) ; corriger les régressions par rapport à T001.
- [ ] T030 Passe `impeccable` (constitution, « Passe front ») sur le cadre, le compteur, la barre d'ajout et l'entrée du menu radial. Confirmer `DEFAULT_GROUP_SIZE` et la marge de 24 px dans `src/canvas/groups/groupOps.ts`. Après toutes les tâches d'interface, avant la revue.
- [ ] T031 Exécuter les scénarios S1 à S8 de `specs/002-agent-groups/quickstart.md` dans `npm run tauri dev`. Vérifier que le `board.json` exporté liste les groupes avant leurs membres (research.md R3). Vérifier aussi que la sortie d'un agent membre continue après création de cadre, déplacement dans le cadre et suppression du cadre (M4), et qu'un membre déplacé avec son cadre garde ses positions relatives (FR-006).

---

## Dépendances et ordre d'exécution

### Dépendances entre phases

- **Setup (Phase 1)** : aucune dépendance.
- **Foundational (Phase 2)** : dépend de Setup, bloque toutes les user stories.
- **User Stories (Phase 3+)** : dépendent de Foundational.
  - US1 est le MVP. US2, US3 et US4 étendent `GroupCard.tsx` : elles suivent US1.
  - US5 et US6 touchent `boardStore.ts` et `boardStore.test.ts` : elles suivent T009.
- **Polish (Phase 9)** : après les user stories concernées.

### Dépendances entre tâches clés

- T003 → T004 → T005 → T007 (même fichier `groupOps.ts`, séquentiel).
- T006 → T008 ; T004 et T005 → T009.
- T010 → T012 → T013 → T015 (`Board.tsx` séquentiel).
- T016 → T018 → T019 → T021 (`GroupCard.tsx` séquentiel).
- T009 → T023 → T024 → T025 → T026 (`boardStore.ts` séquentiel).

### Parallélisme

- Foundational : T008 en parallèle de T007 une fois T006 terminé (fichiers différents).
- US1 : T011 (`App.css`) et T014 (`AddBar.tsx`) en parallèle de T010.
- Polish : T027 et T028 (docs) en parallèle.

---

## Exemple parallèle : User Story 1

```text
# Une fois T003 à T005 terminées :
Task: "T010 Créer src/canvas/cards/GroupCard.tsx"
Task: "T011 Ajouter les styles du cadre dans src/App.css"
Task: "T014 Ajouter le bouton « + Groupe » dans src/canvas/AddBar.tsx"
```

---

## Stratégie d'implémentation

### MVP d'abord (User Story 1)

1. Phase 1 : Setup (T001)
2. Phase 2 : Foundational (T002 à T009), point de contrôle
3. Phase 3 : US1 (T010 à T015)
4. **STOP et VALIDER** : scénario S1
5. Démo si prête

### Livraison incrémentale

1. Setup + Foundational → socle prêt
2. US1 → S1 (MVP)
3. US2 → compteur
4. US3 → nom et rôle
5. US4 → adaptation et redimensionnement
6. US5 → suppression sûre
7. US6 → API vérifiée par les tests du store
8. Polish → copier-coller, docs, validation, passe impeccable

---

## Notes

- Une tâche = un fichier, sauf les tâches séquentielles sur un même fichier (listées dans « Dépendances entre tâches clés »).
- Les user stories n'ont pas de tests de rendu : les scénarios S1 à S8 les couvrent manuellement (quickstart.md).
- Ne jamais lancer `/speckit-implement`. L'exécution se fait avec Superpowers sur ce fichier (constitution, principe 3).
- Commit après chaque point de contrôle.
- Subagents (y compris Superpowers) : `claude-haiku-5.5`, selon AGENTS.md (B7).
