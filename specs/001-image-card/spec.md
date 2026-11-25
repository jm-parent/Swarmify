# Feature Specification: Carte Image

**Feature Branch**: `jeanmarie-parent-exakisc-carte-image`

**Created**: 2026-11-25

**Status**: Draft

**Input**: User description: "Carte Image : afficher des images sur le canvas, ajoutées par glisser-déposer, Ctrl+V ou sélecteur de fichier, copiées dans le dossier de l'application. Formats PNG, JPEG, GIF (animé), WebP et SVG (assaini). Pas d'annotation en V1."

## Clarifications

### Session 2026-11-25

- Q: Quand les copies d'images devenues inutiles (carte supprimée) sont-elles effacées du disque ? → A: Au démarrage de l'application
- Q: Quelle taille initiale reçoit une carte Image juste après l'ajout ? → A: Taille native plafonnée à 480 px de large, proportions conservées
- Q: Que peut faire l'utilisateur quand la copie d'une carte a disparu ? → A: Supprimer la carte ou choisir un nouveau fichier pour la remplacer
- Q: Quelle taille maximale accepter pour une image ajoutée ? → A: 20 Mo
- Q: (Correction après analyse du code : le board est une base SQLite, pas un fichier) Où vivent les images et que devient l'export ? → A: Dossier images/ de l'application, à côté de la base du board ; l'export JSON crée un dossier d'images voisin, recopié à l'import

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ajouter une image sur le canvas (Priority: P1)

En tant qu'utilisateur, je veux placer une image sur mon board pour la garder sous les yeux à côté de mes agents, de mes notes et de mon Kanban, quel que soit le moyen dont je dispose de cette image (fichier dans l'Explorateur, capture dans le presse-papiers, fichier à retrouver via une boîte de dialogue).

**Why this priority**: C'est le cœur de la feature. Sans ajout d'image, rien d'autre n'a de valeur. Un seul mode d'ajout suffit pour livrer une première valeur, mais les trois sont demandés.

**Independent Test**: Sur un board vide, ajouter une image par chacun des trois modes et vérifier qu'une carte Image affiche l'image.

**Acceptance Scenarios**:

1. **Given** un board ouvert, **When** l'utilisateur glisse un fichier PNG depuis l'Explorateur et le dépose sur le canvas, **Then** une carte Image apparaît à l'endroit du dépôt et affiche l'image entière, sans déformation.
2. **Given** une image copiée dans le presse-papiers, **When** l'utilisateur appuie sur Ctrl+V sur le canvas, **Then** une carte Image contenant cette image est créée au centre de la vue courante.
3. **Given** un board ouvert, **When** l'utilisateur choisit un fichier JPEG via le sélecteur de fichier, **Then** une carte Image contenant ce JPEG est créée au centre de la vue courante.
4. **Given** un board ouvert, **When** l'utilisateur dépose un fichier dont le format n'est pas supporté (par exemple BMP ou un document texte), **Then** aucune carte n'est créée et un message indique le format refusé.
5. **Given** un board ouvert, **When** l'utilisateur dépose plusieurs images d'un coup, **Then** une carte Image est créée pour chacune, disposées sans se superposer.

---

### User Story 2 - Retrouver ses images après redémarrage et déplacement du board (Priority: P1)

En tant qu'utilisateur, je veux que mes images restent affichées après un redémarrage de l'application, et que le board reste complet si je le copie ou le déplace, sans dépendre du fichier d'origine.

**Why this priority**: Le choix de copier l'image dans le dossier de l'application répond à ce besoin. Sans persistance fiable, la carte Image perd sa valeur.

**Independent Test**: Ajouter une image, fermer l'application, la relancer et vérifier que l'image est toujours affichée. Déplacer ou supprimer le fichier d'origine, puis vérifier que la carte n'est pas affectée.

**Acceptance Scenarios**:

1. **Given** un board contenant une carte Image, **When** l'application est fermée puis relancée, **Then** la carte affiche la même image, à la même position et à la même taille.
2. **Given** une image ajoutée depuis un fichier, **When** le fichier d'origine est supprimé ou déplacé, **Then** la carte continue d'afficher l'image.
3. **Given** un board contenant des cartes Image, **When** l'utilisateur exporte le board puis l'importe sur une autre machine, **Then** toutes les images s'affichent, car elles suivent l'export dans son dossier d'images voisin.

---

### User Story 3 - Visualiser fidèlement chaque format (Priority: P2)

En tant qu'utilisateur, je veux qu'un GIF animé s'anime sur le canvas et qu'un SVG s'affiche comme une image, sans que le contenu du fichier puisse exécuter quoi que ce soit.

**Why this priority**: Les formats au-delà de PNG/JPEG complètent la feature, mais le rendu de base suffit pour une première livraison. Le SVG impose toutefois une exigence de sécurité.

**Independent Test**: Ajouter un GIF animé et un SVG contenant un script, puis vérifier l'animation du GIF et l'absence d'exécution du script.

**Acceptance Scenarios**:

1. **Given** un GIF animé, **When** il est affiché sur une carte Image, **Then** l'animation se joue en boucle comme dans un navigateur.
2. **Given** un SVG contenant une balise `script` ou un attribut d'événement, **When** il est ajouté au board, **Then** le script n'est jamais exécuté et les éléments dangereux sont retirés avant l'affichage.
3. **Given** un SVG contenant un lien vers une ressource externe, **When** il est affiché, **Then** aucune ressource externe n'est chargée.

---

### User Story 4 - Gérer une carte Image comme les autres cartes (Priority: P3)

En tant qu'utilisateur, je veux déplacer, redimensionner et supprimer une carte Image comme une carte Note, et retrouver son image après un Ctrl+Z.

**Why this priority**: Ces opérations existent déjà pour les autres cartes ; la carte Image doit s'y conformer sans nouvelle interaction à apprendre.

**Independent Test**: Déplacer, redimensionner, supprimer puis annuler une carte Image et vérifier son état.

**Acceptance Scenarios**:

1. **Given** une carte Image sélectionnée, **When** l'utilisateur la déplace ou la redimensionne, **Then** l'image suit le cadre et conserve ses proportions.
2. **Given** une carte Image supprimée, **When** l'utilisateur appuie sur Ctrl+Z, **Then** la carte réapparaît avec son image.

---

### Edge Cases

- Le fichier copié dans le dossier de l'application est absent au redémarrage (suppression manuelle) : le board se charge, la carte affiche un état « image introuvable » et le reste du board fonctionne.
- La copie échoue (disque plein, dossier inaccessible) : aucune carte n'est créée et l'utilisateur reçoit un message d'erreur explicite.
- Une image dépasse la taille maximale : elle est refusée avec un message qui indique la limite.
- Le même fichier est ajouté deux fois : deux cartes indépendantes sont créées, chacune avec sa propre copie.
- Un SVG est volumineux ou très complexe : il s'affiche sans bloquer l'interface des autres cartes.
- Un GIF contient un très grand nombre d'images : l'animation reste fluide pour les autres cartes du board.
- Le presse-papiers contient du texte et non une image : Ctrl+V conserve son comportement actuel et ne crée aucune carte Image.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Le système DOIT permettre d'ajouter une image par glisser-déposer depuis l'Explorateur Windows sur le canvas.
- **FR-002**: Le système DOIT permettre d'ajouter une image collée depuis le presse-papiers via Ctrl+V lorsque le canvas a le focus.
- **FR-003**: Le système DOIT permettre d'ajouter une image via un sélecteur de fichier.
- **FR-004**: Le système DOIT accepter les formats PNG, JPEG, GIF, WebP et SVG, et refuser les autres avec un message explicite.
- **FR-005**: Le système DOIT créer une carte Image par fichier lorsque plusieurs fichiers sont déposés en une fois.
- **FR-006**: Le système DOIT copier chaque image ajoutée dans le dossier images/ de l'application, à côté de la base du board, et la carte DOIT référencer cette copie et non le fichier d'origine.
- **FR-007**: Le système DOIT restaurer chaque carte Image, avec son image, sa position et sa taille, au lancement suivant.
- **FR-008**: Le système DOIT afficher une carte Image en conservant les proportions de l'image dans le cadre de la carte. À l'ajout, la carte prend la taille native de l'image, plafonnée à 480 px de large.
- **FR-009**: Le système DOIT animer les GIF animés en boucle.
- **FR-010**: Le système DOIT assainir chaque SVG avant affichage : retirer les scripts, les attributs d'événement et les références à des ressources externes.
- **FR-011**: Le système NE DOIT PAS exécuter de script contenu dans une image, ni charger de ressource distante à partir d'une image.
- **FR-012**: Le système DOIT refuser une image dont la taille dépasse 20 Mo avec un message indiquant la limite.
- **FR-013**: Le système DOIT afficher un état « image introuvable » sur une carte dont la copie n'existe plus, sans bloquer le chargement du board. Dans cet état, l'utilisateur DOIT pouvoir supprimer la carte ou choisir un nouveau fichier image pour la remplacer.
- **FR-014**: Le système DOIT permettre de déplacer, redimensionner, supprimer et annuler la suppression d'une carte Image comme pour les autres cartes.
- **FR-015**: Le système NE DOIT PAS inclure d'outils d'annotation (flèches, texte, surlignage) dans cette version.

### Key Entities *(include if feature involves data)*

- **Carte Image**: élément du canvas représentant une image. Attributs : position, taille, référence vers l'image copiée, nom d'origine du fichier affiché en info-bulle.
- **Image copiée**: fichier stocké dans le dossier images/ de l'application, possédé par une seule carte Image. Attributs : format, taille en octets, date d'ajout.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: L'utilisateur peut ajouter une image par chacun des trois modes en moins de 10 secondes, à partir d'un fichier déjà prêt.
- **SC-002**: 100 % des cartes Image présentes avant fermeture sont affichées avec leur image après redémarrage.
- **SC-003**: Aucun script contenu dans un SVG ou une image n'est exécuté, vérifié sur un jeu de fichiers de test contenant des scripts et des liens externes.
- **SC-004**: Les cinq formats listés sont acceptés, et 100 % des fichiers d'un format non listé sont refusés avec un message.
- **SC-005**: Un board contenant 20 cartes Image s'ouvre en moins de 2 secondes.
- **SC-006**: Un fichier d'origine supprimé après ajout n'affecte aucune carte Image existante.

## Assumptions

- Un seul utilisateur, sur une seule machine : pas de synchronisation d'images entre appareils.
- Taille maximale par image : 20 Mo (confirmée à la clarification). Cette valeur est modifiable ultérieurement sans changer le modèle de données.
- Chaque carte possède sa propre copie : aucune déduplication entre cartes.
- Suppression d'une carte : la carte disparaît immédiatement et Ctrl+Z la restaure avec son image. La copie fichier n'est supprimée qu'à la purge des fichiers non référencés, au démarrage suivant de l'application (jamais pendant la session, pour préserver l'annulation).
- L'annulation (Ctrl+Z) fait partie des actions existantes du board et doit couvrir les cartes Image sans nouveau mécanisme.
- Le GIF est joué en boucle comme dans un navigateur, sans contrôle de lecture en V1.
- Le SVG est affiché en lecture seule : pas d'édition du contenu depuis le canvas.
- Les images sont affichées à l'échelle de la carte ; aucune génération de vignette n'est exigée en V1.
- Le dépôt de texte ou de liens sur le canvas reste hors périmètre de cette feature.
