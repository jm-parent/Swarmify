# Feature Specification: Groupes d'agents

**Feature Branch**: `agents/feature-agent-groups-specification`

**Created**: 2026-11-27

**Status**: Draft

**Input**: User description: "Groupes d'agents : une carte de canvas qui contient des agents et suit leurs déplacements, avec un nom et un compteur (total et actifs). Création depuis le menu clic droit ou la barre d'ajout. Le cadre s'adapte aux agents qu'il contient et reste redimensionnable. Les groupes sont stockés par workspace et exposent une API réutilisable par le chat IA (feature 2)."

## Contexte

Sur le canvas, les agents sont placés librement. Quand plusieurs agents travaillent sur le même sujet (par exemple sept testeurs), rien ne les relie visuellement ni ne permet de les déplacer ensemble. Un groupe comble ce manque : c'est une carte du canvas qui contient des agents et les déplace avec elle.

## Clarifications

### Session 2026-11-27

- Q: Dans quel ordre livrer les groupes et les workspaces ? → A: Workspaces d'abord, puis groupes stockés directement par workspace (option A). Le design des workspaces est sur `main`, son implémentation n'existe pas encore.
- Q: Quand le cadre a été agrandi à la main et qu'un membre le quitte, garde-t-il cette taille ? → A: Oui, la taille choisie à la main devient le minimum : le cadre ne se réduit jamais en dessous, mais grandit si un membre sort de cette zone (option A).
- Q: Faut-il pouvoir créer, renommer et changer le rôle d'un groupe uniquement au clavier ? → A: Oui, tout accessible au clavier, conformément à DESIGN.md (option A). Voir FR-018.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Regrouper des agents dans un cadre (Priority: P1)

En tant qu'utilisateur qui fait travailler plusieurs agents sur un même sujet, je veux les regrouper dans un cadre nommé, pour les voir ensemble et les déplacer d'un seul geste.

**Why this priority**: C'est le cœur de la feature. Sans appartenance réelle, un groupe ne serait qu'une étiquette.

**Independent Test**: Sur un board avec trois agents, créer un groupe, y glisser deux agents, puis déplacer le cadre. Les deux agents suivent, le troisième ne bouge pas.

**Acceptance Scenarios**:

1. **Given** un board avec trois agents, **When** l'utilisateur fait un clic droit sur le canvas et choisit « Groupe » dans le menu radial, **Then** un groupe vide apparaît à l'endroit du clic, nommé « Nouveau groupe », de rôle General, avec le compteur « 0 · 0 actif ».
2. **Given** un groupe vide, **When** l'utilisateur glisse un agent dont le centre est déposé à l'intérieur du cadre, **Then** l'agent devient membre du groupe et le cadre s'agrandit pour l'englober.
3. **Given** un groupe avec deux membres et un agent hors groupe, **When** l'utilisateur déplace le cadre, **Then** les deux membres se déplacent avec lui en gardant leur position relative, et l'agent hors groupe reste à sa place.
4. **Given** un groupe avec un membre, **When** l'utilisateur glisse ce membre hors du cadre et le relâche, **Then** l'agent quitte le groupe, reste à sa nouvelle position, et le compteur baisse.
5. **Given** un canvas ouvert, **When** l'utilisateur clique sur le bouton « Groupe » de la barre d'ajout à gauche, **Then** un groupe vide est créé au centre de la vue courante.

---

### User Story 2 - Lire l'état du groupe d'un coup d'œil (Priority: P1)

En tant qu'utilisateur, je veux voir combien d'agents contient un groupe et combien sont en cours d'exécution, sans ouvrir chaque carte.

**Why this priority**: Le compteur est la principale information d'un groupe. Il fait partie de la première version.

**Independent Test**: Un groupe de sept agents dont trois en cours d'exécution affiche « 7 · 3 actifs ». Démarrer un quatrième agent le met à jour en « 7 · 4 actifs ».

**Acceptance Scenarios**:

1. **Given** un groupe de 7 membres dont 3 en cours d'exécution, **When** l'utilisateur regarde le cadre, **Then** le compteur affiche « 7 · 3 actifs ».
2. **Given** un groupe dont un seul membre est en cours d'exécution, **When** l'utilisateur regarde le cadre, **Then** le compteur affiche « 1 · 1 actif ».
3. **Given** un membre en cours d'exécution, **When** il s'arrête, **Then** le compteur baisse d'une unité sans rechargement de la vue.
4. **Given** un membre, **When** sa carte est supprimée, **Then** il quitte le groupe et le compteur baisse en conséquence.

---

### User Story 3 - Nommer le groupe et choisir son rôle (Priority: P2)

En tant qu'utilisateur, je veux donner un nom et un rôle à chaque groupe, pour reconnaître d'un coup d'œil un groupe « Testers » ou « Backend » sur le canvas.

**Why this priority**: Le nom et la couleur de rôle rendent le groupe lisible, mais le cadre fonctionne sans.

**Independent Test**: Renommer un groupe, changer son rôle, puis vérifier que le cadre, la pastille et la bordure reflètent les nouvelles valeurs.

**Acceptance Scenarios**:

1. **Given** un groupe nommé « Nouveau groupe », **When** l'utilisateur le renomme « Équipe test », **Then** le cadre affiche « ÉQUIPE TEST » en capitales.
2. **Given** un groupe nommé « Équipe test », **When** l'utilisateur valide un nom vide ou composé d'espaces, **Then** le renommage est refusé et « Équipe test » est conservé.
3. **Given** un groupe de rôle General, **When** l'utilisateur choisit le rôle Testers, **Then** la pastille et la bordure prennent la couleur du rôle Testers.

---

### User Story 4 - Adapter le cadre aux agents (Priority: P2)

En tant qu'utilisateur, je veux que le cadre suive ses agents automatiquement, tout en pouvant le dimensionner à la main quand j'en ai envie.

**Why this priority**: L'adaptation automatique est demandée, mais un groupe reste utilisable même si elle est imparfaite.

**Independent Test**: Ajouter un agent loin du cadre, vérifier que le cadre l'englobe. Retirer ensuite cet agent, vérifier que le cadre se réduit. Redimensionner à la main, vérifier que la taille tenue est conservée.

**Acceptance Scenarios**:

1. **Given** un groupe avec deux membres, **When** un troisième agent est ajouté au groupe, **Then** le cadre s'agrandit pour englober les trois agents avec une marge.
2. **Given** un groupe dont un membre vient de quitter le cadre, **When** le départ est confirmé, **Then** le cadre se réduit à l'englobant des membres restants, sans descendre sous sa taille minimale.
3. **Given** un groupe, **When** l'utilisateur tire une poignée pour l'agrandir, **Then** le cadre prend la taille choisie, qui devient son minimum : il ne se réduit plus en dessous, même si un membre le quitte.
4. **Given** un groupe, **When** l'utilisateur tente de le réduire sous l'englobant de ses membres, **Then** la taille s'arrête à cette limite.

---

### User Story 5 - Supprimer un groupe sans toucher à ses agents (Priority: P2)

En tant qu'utilisateur, je veux supprimer un cadre sans risquer de perdre ou d'arrêter les agents qu'il contient.

**Why this priority**: Supprimer un groupe ne doit jamais avoir de conséquence sur les agents, c'est une garantie de sécurité pour les sessions en cours.

**Independent Test**: Supprimer un groupe de trois agents dont deux tournent. Le cadre disparaît, les trois agents restent à leur place, les deux sessions continuent. Annuler rétablit le groupe.

**Acceptance Scenarios**:

1. **Given** un groupe de trois membres dont deux en cours d'exécution, **When** l'utilisateur supprime le groupe, **Then** le cadre disparaît, les trois agents restent à leur place et leurs sessions continuent.
2. **Given** un groupe supprimé, **When** l'utilisateur annule (Ctrl+Z), **Then** le groupe revient avec ses mêmes membres et son compteur.

---

### User Story 6 - Piloter les groupes sans interface (Priority: P2)

En tant que développeur de la feature de chat IA (feature 2), je veux créer, modifier et interroger les groupes par programme, pour que le chat puisse dire « ajoute deux testeurs au groupe 2 » sans passer par l'interface.

**Why this priority**: Le chat IA est la feature suivante. Cette API doit exister avant, mais n'a pas de valeur visible pour l'utilisateur seul.

**Independent Test**: Exécuter une suite d'opérations (créer, ajouter, retirer, compter, supprimer) sans interface et vérifier que chaque résultat est celui attendu.

**Acceptance Scenarios**:

1. **Given** trois agents hors groupe, **When** on ajoute deux d'entre eux à un nouveau groupe, **Then** la lecture du compte renvoie 2 membres et 0 actif (si aucun ne tourne).
2. **Given** un agent membre du groupe A, **When** on l'ajoute au groupe B, **Then** il n'appartient plus qu'à B et le compte de A baisse.
3. **Given** une carte note, **When** on tente de l'ajouter à un groupe, **Then** l'opération est refusée avec une erreur explicite et rien ne change.

---

### Edge Cases

- **Deux cadres qui se recouvrent** : un agent déposé dans la zone commune rejoint le groupe dont le cadre est le plus petit.
- **Cadre qui grandit par-dessus un agent hors groupe** : cet agent ne rejoint pas le groupe. Il reste cliquable et déplaçable comme avant.
- **Agent déposé dans un autre groupe** : il quitte son groupe actuel et rejoint le nouveau (un agent, un groupe au plus).
- **Note, Kanban ou image déposé dans un cadre** : la carte ne rejoint pas le groupe.
- **Redimensionnement sous la taille minimale** : la taille est bloquée au minimum.
- **Renommage vers un nom déjà utilisé** : accepté. Les noms ne sont pas uniques, l'identifiant du groupe reste stable.
- **Copier-coller** : un groupe n'est pas copiable en V1. Un agent collé n'appartient à aucun groupe.
- **Board sans groupes** (board existant ou fichier importé d'avant cette feature) : il se charge sans erreur, avec zéro groupe.
- **Agent d'un autre workspace** : un agent ne peut appartenir qu'à un groupe du même workspace (voir Dependencies).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Le système MUST permettre de créer un groupe vide depuis le menu radial (clic droit sur le canvas, entrée « Groupe ») et depuis la barre d'ajout (bouton « Groupe »). Le menu radial place le groupe au point du clic, la barre d'ajout le place au centre de la vue courante.
- **FR-002**: Chaque groupe MUST avoir un nom non vide (« Nouveau groupe » par défaut), un rôle parmi les huit rôles de DESIGN.md (General par défaut), une position et une taille.
- **FR-003**: Le nom et le rôle MUST pouvoir être modifiés après création. Un nom vide ou composé uniquement d'espaces est refusé et l'ancien nom est rétabli.
- **FR-004**: Un agent MUST rejoindre un groupe quand il est déposé avec son centre à l'intérieur du cadre, et le quitter quand il est déposé avec son centre à l'extérieur.
- **FR-005**: Un agent MUST appartenir à au plus un groupe. Les cartes note, Kanban et image ne peuvent pas être membres en V1.
- **FR-006**: Déplacer un groupe MUST déplacer tous ses membres en conservant leurs positions relatives. Déplacer un membre seul ne déplace pas le groupe.
- **FR-007**: Le cadre MUST s'agrandir pour englober ses membres, avec une marge constante, et se réduire à l'englobant de ses membres sans descendre sous sa taille minimale. La taille minimale est la taille choisie à la main, ou à défaut la taille d'un groupe vide.
- **FR-008**: Le cadre MUST pouvoir être redimensionné à la main. Une taille choisie MUST NOT couper un membre : elle est limitée à l'englobant des membres.
- **FR-009**: Le cadre MUST afficher le nom en capitales, une pastille et une bordure de la couleur du rôle, et un compteur au format « N · M actif » ou « N · M actifs », où N est le nombre de membres et M le nombre de membres en cours d'exécution. Le singulier est utilisé pour 0 et 1, le pluriel à partir de 2.
- **FR-010**: La bordure MUST être un trait de 1,5 px à la couleur du rôle, sans effet lumineux ni dégradé, conformément à la section « Cadre de groupe » de DESIGN.md.
- **FR-011**: Le compteur MUST se mettre à jour dès qu'un membre démarre ou s'arrête, rejoint ou quitte le groupe, ou est supprimé.
- **FR-012**: Supprimer un groupe MUST retirer le cadre et libérer ses membres, sans les supprimer et sans arrêter leurs sessions.
- **FR-013**: Les opérations sur un groupe (création, renommage, changement de rôle, déplacement, redimensionnement, ajout ou retrait d'un membre, suppression) MUST être annulables et refaisables, comme les autres modifications du board.
- **FR-014**: Les groupes et leurs membres MUST être stockés avec les données du workspace actif. Ils MUST être restaurés à la réouverture de l'application et inclus dans l'export et l'import du board. Un board sans groupes MUST se charger sans erreur.
- **FR-015**: Le système MUST exposer, indépendamment de l'interface, les opérations suivantes, réutilisables par la feature 2 :
  - a. créer un groupe (nom, rôle et position optionnels) et renvoyer son identifiant ;
  - b. renommer un groupe ;
  - c. changer le rôle d'un groupe ;
  - d. ajouter un agent à un groupe, en le retirant de son groupe précédent s'il en avait un ;
  - e. retirer un agent de son groupe ;
  - f. supprimer un groupe et libérer ses membres ;
  - g. obtenir le nombre de membres et le nombre de membres actifs d'un groupe ;
  - h. lister les groupes du workspace actif, et obtenir le groupe d'un agent donné.
  Ajouter une carte qui n'est pas un agent, ou un identifiant inconnu, MUST être refusé avec une erreur explicite, sans modification.
- **FR-016**: Chaque groupe MUST être identifié par un identifiant stable, qui ne change pas au renommage. Les noms de groupe ne sont pas uniques.
- **FR-017**: Un groupe n'est pas copiable en V1.
- **FR-018**: La création, le renommage et le changement de rôle d'un groupe MUST être accessibles au clavier seul, sans souris, conformément au principe « Tout se commande au clavier » de DESIGN.md.

### Key Entities

- **Groupe** : identifiant stable, nom, rôle, position, taille, taille minimale, et ensemble de membres (agents). Ne contient jamais d'autre groupe.
- **Rôle de groupe** : une des huit valeurs de DESIGN.md : Frontend, Backend, Testers, Reviewers, Design, Docs, Security, General.
- **Agent** (existant) : carte agent. Son état « en cours d'exécution » est celui qui compte comme actif.
- **Workspace** (voir Dependencies) : contient ses groupes. Un groupe ne contient que des agents de son workspace.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un utilisateur crée un groupe et y place trois agents en moins de 30 secondes, sans aide.
- **SC-002**: Déplacer un groupe de sept agents déplace les sept agents, et aucun autre élément ne bouge, dans 100 % des essais.
- **SC-003**: Le compteur reflète le nombre réel d'agents en cours d'exécution, mis à jour moins d'une seconde après chaque changement d'état.
- **SC-004**: Après fermeture et réouverture de l'application, et après un export puis un import, 100 % des groupes conservent leur nom, leur rôle, leur taille, leur position et leurs membres.
- **SC-005**: Aucune opération de groupe (création, suppression, retrait, déplacement, redimensionnement) n'arrête une session d'agent.
- **SC-006**: Chaque opération de FR-015 peut être exécutée et vérifiée sans interface, et produit un résultat observable (compte, appartenance ou erreur).

## Assumptions

- « En cours d'exécution » correspond au statut `running` de la carte agent, posé quand son processus tourne. Les agents en erreur ou au repos ne sont pas comptés comme actifs.
- La taille minimale d'un groupe est la taille choisie à la main, ou à défaut la taille d'un groupe vide. La marge autour des membres et la valeur exacte de la taille d'un groupe vide sont fixées dans le plan.
- Un agent est déposé dans un cadre au sens du centre de la carte. Le retirer se fait en le déposant hors du cadre, sans menu supplémentaire.
- Le rôle peut être changé après création, en plus d'être choisi à la création.
- En V1, pas de groupes imbriqués, pas de groupe repliable, pas de couleur personnalisée, pas de sélection de groupe depuis la barre de commande.
- Le compteur ne compte que les membres, pas les agents posés à côté du cadre.

## Dependencies

- **Workspaces** : le stockage par workspace suppose la feature workspaces ([2026-11-27-workspaces-design.md](../../docs/superpowers/specs/2026-11-27-workspaces-design.md)). Son design est sur `main`, mais son implémentation n'existe pas encore. Ordre de livraison décidé : les workspaces d'abord, puis les groupes, stockés directement par workspace (voir Clarifications). Les groupes ne sont donc pas stockés dans le board unique actuel.
- **Feature 2 (chat IA)** : dépend de FR-015. Résoudre « groupe 2 » en identifiant relève de la feature 2, pas de celle-ci.
- **Interface** : feature visuelle (canvas, menu radial, barre d'ajout). Passe `impeccable` après implémentation, avant la revue de code.
- **Documentation** : `DESIGN.md` et `README.md` sont mis à jour avec la feature.

## Out of Scope

- Groupes imbriqués, groupes repliables, couleur personnalisée.
- Notes, cartes Kanban et images comme membres.
- Copie, collage et duplication de groupe.
- Reprise des sessions d'agent au redémarrage.
