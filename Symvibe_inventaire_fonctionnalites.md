# Symvibe — Inventaire exhaustif des fonctionnalités

> **Source** : crawl complet de https://www.symvibe.com/ réalisé le 2026-11-24 avec [Scrapling](https://github.com/D4Vinci/Scrapling) 0.5.1 (`Fetcher` HTTP + sélecteurs CSS), 73 pages (dont 41 pages de documentation produit, 7 guides, 6 comparatifs, changelog, pricing, légal).
> **Données brutes** : `symvibe-scrape/symvibe_raw.json` et `symvibe-scrape/pages/*.md` (texte structuré par page).
> **Finalité** : base de sélection de fonctionnalités pour le DAT d'une nouvelle application.

## Résumé en une page

**Symvibe** (ex-Hypervibe) est une application native **macOS Apple Silicon** qui transforme un dossier/repo en **board visuel infini** (24 000 × 24 000 pt, zoom 20–300 %) sur lequel on place de **vrais terminaux PTY** exécutant des CLIs d'agents de code (Claude Code, Codex, Gemini CLI… **34 CLIs** catalogués + agents personnalisés). L'app n'embarque aucun modèle ni clé API : elle pilote les CLIs que l'utilisateur possède déjà, en **tapant dans leurs terminaux**.

Autour de ce cœur, 7 familles de fonctionnalités :

| # | Famille | Contenu | Détail |
|---|---------|---------|--------|
| 1 | **Board & canvas** | Nodes (consoles, notes, kanban, calendrier, formes, encre, images, fichiers, web tiles), workspaces par repo, presets (18), undo 80 niveaux, persistance JSON versionnée avec snapshots | Partie 1 |
| 2 | **Consoles & agents** | PTY réel, catalogue 34 CLIs, flags Yolo, resume natif, live status par hooks, visualiseur de sortie, profils multi-comptes | Partie 1 & 3 |
| 3 | **Orchestration** | Barre de commande (@mentions), parseur local + planner LLM hébergé (Groq), cartes orchestrateur, groupes/rôles, Mission Map, handoffs, forwards, loops, mémoire projet, agent teams | Partie 2 |
| 4 | **Voix** | STT on-device (Parakeet v3, 25 langues), push-to-talk, dictée, TTS hébergé (Inworld) avec cache local | Partie 2 |
| 5 | **Studios** | Documents (PDF généré par le CLI), Diagrams (formes sur le board, export PNG/Excalidraw), Code (explorateur/éditeur), Markdown (vault + graphe), Skills (manager SKILL.md) | Partie 3 |
| 6 | **Git & web** | Panneau Git/GitHub (commit/push/pull/publish via gh, worktrees, PR), carte branches, web tiles WebKit avec inspecteur, aperçus localhost automatiques | Partie 1 |
| 7 | **Compte, licence, données** | Firebase Auth, Paddle, entitlement check 4 min / grâce 15 min, 10 000 crédits/mois, local-first sans télémétrie, settings, raccourcis | Partie 3 & 4 |

**Architecture résumée** : app locale (Swift/WebKit, données dans `~/Library/Application Support/Hypervibe`) + 3 services hébergés uniquement (auth Firebase, planner → Groq `gpt-oss-120b`, TTS → Inworld) + paiement Paddle. Tout le reste (terminaux, STT, parsing d'ordres, git, studios via sessions CLI cachées, usage/tokens via logs locaux) tourne sur le Mac.

---

## Sommaire

- **Partie 1 — Board, consoles, agents, Git, web tiles** (concepts, board, workspaces, presets, notes/kanban/calendrier, dessin, fichiers, web tiles, Git, consoles, terminal, catalogue 34 agents, agents custom, resume, live status)
- **Partie 2 — Orchestration et voix** (barre de commande, routage des ordres, cartes orchestrateur, voix, dictée, commandes, groupes, Mission Map, handoffs/forwards, loops, mémoire)
- **Partie 3 — Studios, compte, réglages** (Documents, Diagrams, Code, Markdown, Skills, abonnement, crédits, profils, usage/tokens, raccourcis, settings, privacy, install, premier lancement)
- **Partie 4 — Positionnement, marketing, changelog, contraintes** (modèle économique, fonctionnalités mises en avant, historique des versions, prérequis, troubleshooting)
- **Partie 5 — Grille de sélection pour le DAT** (matrice fonctionnalité → mécanisme technique → dépendances → complexité → transposabilité)

---

# PARTIE 1 — Board, consoles, agents, Git, web tiles

## Concepts de base (vocabulaire Symvibe)

- **Repo** — dossier suivi depuis l'écran d'accueil, généralement un dépôt git ; le suivi ne déplace ni ne modifie rien ; chaque repo possède ses propres boards, son propre thread (conversation de la barre de commande) et sa propre mémoire.
- **Workspace** — onglet du board d'un repo, nommé « Workspace 1 », « Workspace 2 »… jusqu'au renommage ; les consoles des workspaces en arrière-plan continuent de tourner.
- **Board** — canevas d'un workspace : 24 000 points de côté, zoom de 20 à 300 % ; tout ce qui y est placé est sauvegardé sur disque quelques instants après chaque modification.
- **Écran d'accueil (Home screen)** — liste des repos et point de dispatch des presets ; Symvibe rouvre le dernier repo ouvert.
- **Node** — tout élément du board : console, note, kanban, web tile, forme, image, carte.
- **Console (alias « lane »)** — node exécutant un vrai terminal : CLI d'agent ou shell simple, démarré dans le dossier du repo, avec un nom court adressable (ex. « Otto »).
- **Agent** — CLI du catalogue de 34 (Claude Code, Codex, Gemini CLI, Grok, OpenCode…) ou exécutable ajouté par l'utilisateur.
- **Agent par défaut** — agent utilisé quand le choix est laissé à Symvibe (lanes de preset non modifiées, etc.) ; un ordre « spawn » sans agent nommé utilise l'agent du rôle ou ouvre un shell.
- **Groupe** — deux consoles ou plus réunies sous un nom, un rôle et une teinte ; ⌘G groupe les consoles sélectionnées.
- **Carte (Card)** — node qui affiche au lieu d'exécuter : document, fichier code, fichier Markdown, mémoire projet, branches Git.
- **Barre de commande (Command bar)** — barre en bas de chaque board ; ordres tapés ou parlés, commande tout le board.
- **Thread** — conversation de la barre de commande, conservée par repo : ordres, réponses, rapport de chaque agent.
- **Carte orchestrateur** — carte câblée à certaines consoles ; les ordres donnés dessus n'atteignent que ces consoles.
- **Planner (planificateur)** — transforme une phrase en étapes ; les ordres simples (« spawn 4 codex ») sont compris localement sur le Mac ; les autres phrases vont au service planner de Symvibe (consomme des crédits).
- **Live agent status** — réglage opt-in permettant à Claude Code et Codex de signaler via leurs propres hooks s'ils travaillent, ont besoin de vous ou sont prêts.
- **Mission Map** — carte de la barre de commande, des cartes orchestrateur, des groupes et de chaque console, filtrable par statut.
- **Handoff** — passage d'une tâche d'un agent à une console neuve (souvent d'un autre CLI) avec un résumé de l'état d'avancement.
- **Loop (boucle)** — instruction envoyée aux consoles selon un planning, quand elles deviennent idle, ou quand leur sortie contient un certain texte ; tourne jusqu'à désactivation ou jusqu'à atteinte d'un objectif, d'un nombre d'exécutions ou d'une limite de temps optionnels.
- **Memory (mémoire)** — faits sur un repo ou sur tous les repos, poussés aux agents comme contexte de fond.
- **Studios** — Documents, Diagrams, Code et Markdown : vues qui transforment le repo en PDF et diagrammes, et permettent de parcourir code et notes.
- **Skills** — fichiers de skills Claude Code sur disque, avec un checkup et un éditeur.
- **Preset** — layout prêt à l'emploi de consoles et groupes ; dispatché depuis l'accueil ou déployé sur un board.
- **Profile (profil de compte)** — connexion supplémentaire de Claude Code ou Codex, conservée dans son propre dossier de configuration ; plusieurs possibles.
- **Crédits** — allocation mensuelle partagée par le planner et les réponses parlées ; les agents n'utilisent jamais de crédits (ils utilisent leurs propres plans).
- **Yolo** — réglage qui lance les agents avec leur flag de contournement des permissions ; désactivé par défaut.
- **Recherche docs** — touche « / » pour chercher dans toutes les pages de la documentation.

## Board (bases : navigation, sélection, rails, menu contextuel)

- **Pan** — trackpad : défilement à deux doigts ; souris : molette (Shift pour horizontal) ou glisser au bouton du milieu.
- **Zoom** — pinch ou ⌘ + scroll (trackpad) ; ⌘ ou Ctrl + molette (souris) ; ⌘= / ⌘- au clavier ; plage 20 à 300 % ; le pinch zoome le board même au-dessus d'une page web ; contrôles de zoom aussi en bas à droite.
- **Taille réelle** — ⌘0.
- **Tout voir** — Shift 1 (cadre l'ensemble du board).
- **Cadrer un node** — double-clic sur un node le cadre à l'écran ; sur une sticky note ou une zone de texte, le double-clic édite le texte ; une web tile se cadre depuis sa barre d'en-tête.
- **Sélection** — clic sur un node ; glisser sur le canevas vide pour une sélection multiple ; ⌘A pour tout sélectionner.
- **Sélection des consoles / web tiles** — ces nodes capturent les clics pour leur contenu ; on les sélectionne par leur barre d'en-tête.
- **Déplacement** — glisser ; flèches = nudge d'un point, dix points avec Shift.
- **Copier / couper / coller / dupliquer** — ⌘C, ⌘X, ⌘V, ⌘D ; une console copiée démarre une nouvelle session du même agent, la conversation n'est pas copiée.
- **Supprimer** — touche Delete ; les consoles en cours d'exécution demandent confirmation.
- **Annuler / rétablir** — ⌘Z / ⌘⇧Z, jusqu'à 80 étapes ; annuler la suppression d'une console la ramène avec une session neuve (scrollback perdu).
- **Guides d'alignement et d'espacement** — affichés pendant le glisser ; guides uniquement, pas de magnétisme (snap).
- **Grouper / dégrouper** — ⌘G groupe les consoles sélectionnées, ⌘⇧G dégroupe.
- **Rail gauche – Select** — sélectionne, déplace, trace une boîte de sélection.
- **Rail gauche – Spawn agent** — dépose une console de l'agent armé dans son flyout ; sans agent armé, ouvre le flyout de choix.
- **Rail gauche – Shapes** — dépose la forme choisie ou une sticky note.
- **Rail gauche – Diagrams** — ouvre un panneau avec le générateur de diagrammes et quatre starters ; un clic sur le canevas dépose le starter « Flow ».
- **Rail gauche – Text** — dépose une zone de texte prête à la saisie.
- **Rail gauche – Pen** — trace des traits d'encre.
- **Rail gauche – Eraser** — efface traits et nodes survolés ; les consoles et cartes orchestrateur ne sont jamais effacées.
- **Rail gauche – Web tile** — dépose une tuile navigateur.
- **Rail gauche – Insert image** — ouvre un sélecteur de fichier.
- **Rail gauche – Fit to content** — cadre tout le board.
- **Retour automatique à Select** — un outil de placement revient à Select après un placement.
- **Inspecteur de style** — s'ouvre à côté du rail quand une forme ou un texte est sélectionné.
- **Rail droit – Presets** — layouts prêts de consoles et groupes, et layouts sauvegardés.
- **Rail droit – Insert to-do** — checklist, kanban ou calendrier.
- **Rail droit – Insert orchestrator** — carte orchestrateur.
- **Rail droit – Browse project code / Browse markdown docs** — ouvre les studios Code et Markdown.
- **Rail droit – Generate PDF** — ouvre le studio Documents.
- **Rail droit – Loops** — avec un badge comptant les boucles actives.
- **Menu contextuel en anneau (canevas vide)** — Spawn agent, Insert image, Insert web, Paste, Shapes, Spawn group ; « More » : insérer checklist, kanban, calendrier, formes flow, carte mémoire, carte branches Git ; ouvrir la Mission Map ; tout sélectionner ; fit to content ; zoom 100 %.
- **Menu contextuel (sur un node)** — Duplicate, Bring to front, Delete (non proposé pour une console en cours) + actions spécifiques : Text size sur une console, Open file et Reveal in Finder sur une carte fichier, options d'export sur un diagramme généré ; une page web affiche son propre menu navigateur.
- **Coin haut-gauche** — Back to home (tout continue de tourner), sélecteur de repo, onglets de workspace, « + » nouveau workspace.
- **Coin haut-droit** — chip « live » (compte les consoles en cours et liste toutes les consoles du board), chip « needs you », pilule d'usage, menu Tools (Presets, GitHub, Code, Markdown, Mission Map, Memory, Skills, Loops, Settings), engrenage, avatar.
- **Bas** — barre de commande au centre ; pilule GitHub à gauche (branche + nombre de fichiers modifiés) ; « Found a bug? » et contrôles de zoom à droite.
- **Outils à touche unique** — quand aucune console/champ n'a le clavier : V Select, T Spawn agent, P Pen, E Eraser, G panneau Git, M Memory, S Skills, L Loops, D Markdown, X Mission Map, N saute à la console qui a besoin de vous ; Espace maintenu = parler à la barre de commande.
- **Routage clavier vers console** — avec exactement une console en cours sélectionnée, les lettres vont dans la console ; clic sur canevas vide pour rendre le clavier au board.
- **Raccourcis personnalisables** — tous sauf X modifiables dans Settings › Shortcuts.

## Repos, workspaces et écran d'accueil

- **Liste des repos** — chaque dossier suivi avec sa branche git ; badge « active » sur le repo ouvert/ajouté le plus récemment.
- **Ouvrir un repo** — clic sur la ligne, ou flèches + Return.
- **Barre de composition (compose bar)** — pilule repo, pilule preset, bouton Dispatch ; Dispatch ouvre le repo et, si un preset est armé, le dépose sur le workspace ouvert ; devient « Resume » si le repo est déjà ouvert sans preset armé.
- **Thèmes** — bouton soleil/lune pour basculer entre thèmes « OG » et « Light ».
- **Ajouter un repo** — carte « Add a repo », drag-and-drop d'un ou plusieurs dossiers, ou ⌘O ; ajouter un dossier déjà suivi le sélectionne simplement.
- **Renommer un repo** — double-clic sur le nom, 24 caractères max, Return valide, Esc annule ; seul le nom affiché change, pas le dossier.
- **Retirer un repo** — menu de la ligne au survol, ou sélection + Delete ; confirmation systématique ; les fichiers restent sur disque, les consoles du repo s'arrêtent.
- **Cloner / créer un dépôt** — proposé au premier lancement ; ensuite cloner via git dans une console puis ajouter le dossier.
- **Ajouter un workspace** — « + » à côté des onglets.
- **Renommer un workspace** — double-clic sur l'onglet, 24 caractères max.
- **Fermer un workspace** — bouton de fermeture de l'onglet, avec confirmation ; ses consoles s'arrêtent ; le board est conservé dans l'archive.
- **Exécution en arrière-plan** — changer d'onglet ou de repo laisse toutes les consoles en cours.
- **Workspaces par la barre de commande** — « go to workspace 2 », « new workspace called QA », « rename this workspace to Backend », « close workspace 2 » ; fermeture avec agents actifs attend confirmation.
- **Retour accueil** — bouton Back to home ou ⌘⇧L ; le repo reste ouvert, consoles actives.
- **Sélecteur de repo (chip)** — repos ouverts, récents, ou « Open repo ».
- **Fermer un repo** — « Close » demande toujours ; ⌘⇧W ne demande que si des agents tournent ou qu'un studio a des modifications non sauvegardées ; boards sauvegardés, agents stoppés ; à la réouverture, nouvelle session avec offre de reprise si le CLI le supporte.
- **Réouverture du dernier repo au lancement** — activée par défaut ; désactivable via Settings › General › Reopen last repo on launch.
- **Persistance des boards** — un fichier par workspace dans `~/Library/Application Support/Hypervibe/Boards` ; écriture ~2 s après arrêt des modifications, jamais plus de ~7 s de retard ; workspaces en arrière-plan sauvegardés chaque minute ; tout écrit à la fermeture de l'app.
- **Contenu sauvegardé** — nodes, positions, tailles, contenus ; NON sauvegardés : processus de la console et son scrollback.
- **Versioning / snapshots** — jamais d'écrasement sans copie : version précédente conservée ; un snapshot par heure où le board a changé (les 24 plus récents conservés) ; boards vidés, fermés ou illisibles vont dans `Boards/Archive`, jamais purgés.
- **Compatibilité descendante** — un board sauvegardé par une version plus récente s'ouvre et s'édite, mais la version courante ne le sauvegarde jamais (modifications perdues) ; recommandation de mettre à jour.
- **Restauration** — tout l'archivé est dans `Boards/Archive` ; assistance via hello@symvibe.com.
- **Détection iCloud Drive** — bannière proposant de déplacer un repo situé dans iCloud Drive vers le dossier projets (`~/symvibe` par défaut, ou autre choisi au setup, ou `~/hypervibe` si existant) car macOS peut évincer les fichiers vers le cloud et bloquer git/agents.
- **Déplacement depuis iCloud** — télécharge ce qui est encore dans iCloud, copie tout, vérifie le nombre de fichiers et le HEAD git ; l'original n'est jamais supprimé ; demande d'arrêter les agents en cours d'abord.
- **Keep here** — n'affiche plus la bannière pour ce repo ; le bouton fermer la réaffichera la prochaine fois.

## Presets (layouts prêts d'agents)

- **Bibliothèque de presets** — 18 presets intégrés ; accessible via rail droit Presets › Open the full library, Tools › Presets, « Start from a preset » sur un board vide, ou « New preset » sur l'accueil.
- **Dev HQ** — 4 agents frontend + 4 backend de part et d'autre d'un kanban, un aperçu localhost:3000 et 4 reviewers, tous câblés à une carte orchestrateur.
- **Sprint Room** — 2 builders de chaque côté d'un kanban, briefés par un orchestrateur.
- **Web Studio** — 2 designers + 3 agents frontend avec un aperçu localhost:3000 entre eux, et un orchestrateur.
- **Ship It** — builders et testeurs d'un côté, backend et reviewers de l'autre, kanban au centre, orchestrateur.
- **Bug Hunt** — 3 testeurs + 2 reviewers autour d'un kanban de triage.
- **Pair / Trio / Squad of Four** — un groupe de 2, 3 ou 4 agents.
- **Two Squads / Three Squads / Four Squads** — 2, 3 ou 4 groupes de 4 (Four Squads = 16 consoles).
- **Squad and Board / Squad and Preview** — 4 agents à côté d'un kanban vide, ou d'un aperçu localhost:3000.
- **Briefed Squad** — 4 agents sous une carte orchestrateur qui les briefe et collecte leurs réponses.
- **Feature Squad** — 2 frontend + 2 backend construisant les deux moitiés d'une feature.
- **Review Panel** — 3 reviewers sur le même changement.
- **Security Sweep** — 2 agents sécurité + 2 reviewers.
- **Docs Sprint** — 3 rédacteurs de documentation.
- **Choix des agents par lane** — l'inspecteur de la bibliothèque montre chaque lane ; clic = cycle d'agent ; clic droit = catalogue complet ; « Fill every lane with » pour tout définir d'un coup ; lanes non modifiées = agent par défaut.
- **Fallbacks de lane** — agent inconnu de la version courante → Claude Code ; agent personnalisé supprimé → shell simple.
- **Déployer sur un board** — « Deploy » dépose le preset sur le workspace courant.
- **Dispatch depuis l'accueil** — « Save preset » arme le preset dans la compose bar (pilule avec son nom ; menu listant nombre d'agents et d'équipes) ; rien ne se passe avant Dispatch ; désarmé après un dispatch ; survol pour retirer un preset sauvegardé.
- **Sauvegarder son propre layout** — Presets › Save current layout ; nommé Set 1, Set 2… ; clic ultérieur le tamponne au centre de la vue ; « Delete preset » sans confirmation.
- **Contenu d'un layout sauvegardé** — type, position, taille, titre, texte, couleur de chaque node, et agent de chaque console (consoles recréées à la taille par défaut avec un nouveau nom) ; NON conservés : groupes, câbles (wires), adresses web, images, contenus de cartes, styles de formes, encre.
- **Portée des layouts sauvegardés** — appartiennent à l'app, pas à un repo (malgré l'étiquette « Saved on this board »).

## Notes, checklists, kanban et calendrier

- **Sticky note** — via l'outil Shapes ; s'ouvre prête à la saisie ; police rétrécit automatiquement de 20 pt max (≈18 sur une nouvelle note) à 11 pt ; changement de couleur de papier par clic sur le coin plié ; double-clic pour rééditer.
- **Zone de texte** — outil Text ; une zone laissée vide disparaît au clic ailleurs.
- **Inspecteur texte** — 8 polices (Sketch, Clean, Serif, Rounded, Mono, Typewriter, Marker, Script), 4 tailles, alignement.
- **Note par la barre de commande** — « add a note that says ship the beta on Friday ».
- **Checklist** — Insert to-do › Checklist ou menu anneau › More ; « Add an objective » ajoute un item ; anneau de progression se remplit au cochage ; « Clear done » supprime les items cochés sans confirmation (⌘Z restaure) ; double-clic sur le titre pour renommer.
- **Kanban** — Insert to-do › Board (kanban) ou ordre « add a kanban » ; 4 colonnes initiales : Backlog, To do, In progress, Done.
- **Colonnes kanban** — menu : Rename, Add card, couleur (Amber, Sage, Sky, Violet, Rose, Teal), Sort by priority (≥2 cartes), déplacer gauche/droite/début/fin, Clear done cards, Delete column (confirmation si la colonne contient des cartes).
- **Cartes kanban** — titre, notes, date d'échéance (Today, Tomorrow, Next week ou date libre), priorité (None, Low, Med, High) ; drag entre colonnes ; menu : Mark as done, Edit, Duplicate, Move to, Delete card.
- **Calendrier** — Insert to-do › Calendar ou « add a calendar » ; vue mois avec Today et navigation mois précédent/suivant.
- **Événements** — « New » : titre, jour, journée entière ou heure, notes, couleur ; drag vers un autre jour ; clic droit : éditer, dupliquer, recolorer, supprimer.
- **Isolation du calendrier** — ne lit ni n'écrit le Calendrier macOS ni aucun calendrier en ligne ; les événements vivent dans le board.
- **Stockage** — contenus des notes/kanban/calendrier dans le fichier board sur le Mac.
- **Non lus par les agents** — ces nodes sont pour l'utilisateur ; pour transmettre un plan à un agent, le taper/coller dans sa console ou l'envoyer via la barre de commande.

## Formes, encre et images (dessin)

- **Formes** — outil Shapes : Rectangle, Ellipse, Diamond, Line, Arrow, Sticky ; clic pour déposer, ou glisser pour dessiner à la taille voulue.
- **Lignes et flèches** — poignée à chaque extrémité ; Shift pendant le glisser = angle aligné par pas de 15° ; poignée centrale pour courber ; double-clic dessus pour redresser.
- **Starters de diagrammes** — outil Diagrams : Flow, Steps, Decision branch, Mind map, sans IA ; ou demande à un agent de dessiner un diagramme du repo (studio Diagrams).
- **Inspecteur – Lignes** — couleur du trait, épaisseur (Thin, Bold, Extra bold), style (Solid, Dashed, Dotted), « sloppiness » (Architect, Artist, Cartoonist) pour un rendu propre ou dessiné à la main.
- **Inspecteur – Remplissage** — couleur de fond, transparent par défaut ; une fois une couleur choisie : style Hachure, Cross-hatch ou Solid.
- **Inspecteur – Forme** — coins vifs ou arrondis, opacité de 10 à 100 %.
- **Inspecteur – Texte** — police, taille S/M/L/XL, alignement.
- **Inspecteur – Ordre** — Bring to front, Send to back, Duplicate, Delete.
- **Stylo (P)** — 8 couleurs, 5 épaisseurs ; chaque trait devient un node d'encre sélectionnable, déplaçable, supprimable ; dessine par-dessus les autres nodes.
- **Gomme (E)** — supprime les traits survolés et le node le plus haut sous le pointeur, sauf consoles et cartes orchestrateur ; une web tile ou un kanban est supprimé sans confirmation (⌘Z restaure).
- **Insertion d'image** — outil Insert image (clic sur l'emplacement puis sélecteur de fichier), anneau contextuel (sélecteur immédiat), ⌘V depuis le presse-papiers, drag depuis le Finder.
- **Dimensions des images** — proportions conservées, plus grand côté à 460 points initialement.
- **Référencement des images** — une image issue d'un fichier pointe vers ce fichier (y compris un fichier image copié dans le Finder) ; une capture/image collée sans fichier est sauvegardée dans `~/Library/Application Support/Hypervibe/Screenshots`.
- **Markup d'image – ouverture** — sélectionner l'image, cliquer la pilule « Markup ».
- **Markup d'image – outils** — Arrow, Rectangle, Ellipse, Line, Pen, Highlight, Text ; 8 couleurs, 4 épaisseurs ; « Clear all » pour recommencer.
- **Markup d'image – sauvegarde** — « Save markup » crée une nouvelle image affichée sur le board (l'original n'est jamais modifié) ; « Cancel » abandonne.

## Fichiers et dossiers sur le board

- **Drop depuis le Finder (fichiers du repo)** — déposés directement sur le board.
- **Drop depuis le Finder (fichiers hors repo)** — choix : « Copy into repo » (copie dans le dossier racine du repo, jamais d'écrasement, suffixe -2, -3… si nom pris) ou « Keep original location » (référence en place) ; fermer le dialogue ne dépose rien.
- **Dossier avec fichiers lisibles → carte explorateur de code** — liste les fichiers du dossier, max 40, sans sous-dossiers.
- **Image → node image** — prête pour markup.
- **Fichier Markdown du repo → carte Markdown** — rendu depuis le disque.
- **Autre fichier texte → carte code** — coloration syntaxique.
- **Tout autre fichier → carte fichier** — vignette Quick Look, ou icône Finder pour dossiers/fichiers non prévisualisables.
- **Carte code** — copie en lecture seule, colorée, de l'état du fichier au moment du drop (ne suit pas les éditions ultérieures) ; fichiers texte jusqu'à 800 Ko ; aperçu tronqué au-delà de 5 000 lignes ; bouton Copy.
- **Carte Markdown** — rendue depuis le disque, mise à jour quand le fichier change (y compris éditions par les agents) ; « Open in Studio » ouvre le studio Markdown ; « PDF » exporte ; signale un fichier supprimé.
- **Carte fichier** — pointe vers le fichier/dossier par chemin ; clic droit : Open file, Reveal in Finder ; signale un fichier déplacé/manquant.
- **Origine alternative** — cartes code depuis le studio Code, cartes Markdown depuis le studio Markdown.

## Web tiles et Web Inspector

- **Moteur** — navigateur sur le board basé sur WebKit (Safari).
- **Ouvrir une tuile** — outil Web tile + clic, anneau › Insert web, ou ordre « open localhost 3000 ».
- **Cadran localhost** — tuile vide affiche les ports 3000, 3001, 4200, 5173, 8000, 8080 ; point vert si un service répond sur le port.
- **Liens rapides** — Google, GitHub, YouTube, MDN, npm, Hacker News ; barre d'adresse pour toute autre URL ; http et https uniquement.
- **Barre d'outils** — Back, Forward, Reload/Stop, barre d'adresse, « {} » inspecteur, menu More : zoom de page 50 à 250 % par pas de 10 %, Inspect on board, Hard reload (sans cache), Copy URL, Open in Browser ; indicateur de zoom cliquable pour réinitialiser.
- **Onglets** — « + » ouvre un onglet ; pop-ups s'ouvrent en onglets, max 12 ; fermer le dernier laisse un onglet de démarrage.
- **Tailles d'appareil** — Fit tile, moniteur 24/27/32 pouces, iPhone SE, iPhone 14 Pro, iPhone 14 Pro Max, Pixel 7, Galaxy S8+ ; les tailles téléphone présentent la page comme iPhone Safari (user-agent).
- **Attente du dev server** — si rien n'écoute sur localhost : 10 tentatives à 1 s d'intervalle, message « Waiting for the dev server » avec « Retry now ».
- **Autres erreurs** — « Couldn't load this page » avec Retry et Open in Browser.
- **Certificats auto-signés** — acceptés sur localhost uniquement.
- **Aperçus automatiques** — quand une console imprime une adresse locale http(s):// (localhost, 127.0.0.1, 0.0.0.0, [::1]) et que quelque chose y répond, une web tile s'ouvre à côté de la console avec un câble cyan ; une fois par console et par adresse ; un aperçu automatique resté sur ce serveur n'est pas restauré à la réouverture du board ; s'il a navigué ailleurs, il revient comme toute tuile.
- **Web Inspector docké** — « {} » docke l'inspecteur Safari comme carte câblée à sa tuile (une par tuile) ; nouvel appui = retour à la carte existante ; inspecte l'onglet ouvert au moment du dock, « Re-attach » si cet onglet se ferme ; si impossible à docker : « Open in window » ; supprimer la tuile supprime l'inspecteur.
- **Permissions caméra/micro** — toujours demandées à l'utilisateur.
- **Téléchargements** — vers le dossier Downloads ; un téléchargement initié par clic dans la page (pas dans un iframe) est direct ; autres téléchargements de l'onglet visible demandent confirmation ; ceux des onglets en arrière-plan sont annulés.
- **Pop-ups** — lien cliqué dans la page ouvrant une fenêtre → onglet ; autres pop-ups (iframes, scripts post-clic) bloqués derrière une bannière « Pop-up blocked » avec Open / Dismiss.
- **Audio** — pas de lecture sonore avant un clic dans la page.

## Git sur le board

- **Ouvrir le panneau Git** — pilule GitHub en bas à gauche, touche G, ou Tools › GitHub ; Esc ferme.
- **En-tête du panneau** — repo, branche, état de synchro (en sync ou nombre de commits ahead/behind), historique des 100 derniers commits, Open on GitHub, Refresh.
- **Pas de fetch automatique** — seuls Pull et Push parlent au remote.
- **Liste des changements** — case à cocher par fichier, All / None, jusqu'à 400 fichiers ; survol = compteurs de lignes.
- **Message de commit suggéré** — sujet généré localement sur le Mac à partir des changements ; bouton « sparkle » pour l'utiliser.
- **Commit & Push** — commit les fichiers cochés et pousse ; devient « Commit » si HEAD détaché ; « Commit only » (sur branche avec remote) commit sans pousser.
- **Publish to GitHub** — remplace la liste des changements tant que le repo n'a pas de remote.
- **Refus de commit** — pendant un merge avec conflits non résolus.
- **Discard** — toujours avec confirmation ; fichiers suivis : retour au dernier commit avec copie de la version dans la Corbeille ; fichiers non suivis : déplacés dans la Corbeille.
- **Pull** — apparaît si la branche est en retard (selon dernier fetch) ; pull fast-forward ; « pull » dans la barre de commande pull même sans bouton ; si divergence, le panneau le signale (merge dans une console).
- **Push / Publish branch** — push des commits ; Publish branch pousse une branche sans upstream.
- **Create repository** — pour un dossier non-git : `git init` sur branche main immédiatement.
- **Publication via gh CLI – installation** — si `gh` manque, le panneau propose de copier `brew install gh`.
- **Publication via gh CLI – connexion** — « Connect account » ouvre une console exécutant `gh auth login` ; le panneau détecte la fin ; même connexion visible dans Settings › Connections.
- **Publication via gh CLI – création** — nom (dossier par défaut), Private (défaut) ou Public, « Create repo & push everything » : commit tout ce qui est en attente, crée le dépôt GitHub et pousse.
- **Fichiers > 100 Mo – avant commit** — « Keep off GitHub » arrête le suivi et les ajoute au `.gitignore`.
- **Fichiers > 100 Mo – push rejeté** — « Remove from commits & push » réécrit les commits non poussés ; demande un second clic ; ancien historique conservé sur une branche de sauvegarde `hv-oversize-backup`.
- **Git par la barre de commande / voix** — « commit and push », « push », « pull », « commit with the message fix login » ; actionnent les boutons du panneau ; push/commit exécutés sans reconfirmation ; un push commit d'abord tous les changements cochés.
- **Carte branches** — insérée via anneau › More ; affiche branche courante, ahead/behind, nombre de fichiers modifiés, jusqu'à 200 branches locales.
- **Changer de branche** — clic, sans confirmation (git refuse lui-même si cela écraserait du travail non commité).
- **Nouvelle branche** — crée et bascule ; icône corbeille = `git branch -d` (refuse les branches non fusionnées).
- **Bouton Panel** — ouvre le panneau Git depuis la carte.
- **Limites** — pas de merge, rebase ni stash dans le panneau (utiliser une console).
- **Authentification** — git ne demande jamais de mot de passe dans l'app ; SSH en mode batch : clé avec passphrase déjà dans ssh-agent ou Keychain, serveur déjà dans known_hosts.
- **Timeouts** — chaque commande git a une limite de temps ; un push s'arrête après 5 minutes sans sortie.

## Consoles d'agents

- **Vrai pseudo-terminal (PTY)** — exécute le CLI non modifié depuis le PATH ; Ctrl-C, job control, interfaces plein écran fonctionnent comme dans Terminal.
- **Contexte de démarrage** — démarre dans le dossier du repo, sous la propre connexion de l'utilisateur au CLI ; aucune clé API ajoutée, aucun wrapper ; le démarrage ne tape jamais rien dans l'agent.
- **Nommage** — noms courts : Otto, Dax, Maya, Rafa, Nova, Iris, Kai, Zoe, Leo, Mila, Ren, Juno, Ada, Bex, Cy, Pip ; numérotés en cas de doublon ; adressage par `@Otto`.
- **Placement automatique** — nouvelle console placée dans un espace libre à côté de l'existant, jamais par-dessus.
- **Démarrage – outil Spawn agent** — T puis clic ; lance l'agent armé dans le flyout du rail gauche (agent armé, jusqu'à 3 agents personnalisés, built-ins installés — 5 lignes max — puis Shell et All agents) ; sans agent armé, le clic ouvre le flyout.
- **Démarrage – barre de commande** — « New console » : Claude, Codex, Gemini, Grok, OpenCode ou shell vide ; « Spawn 4 » et « Group » ouvrent le composer.
- **Démarrage – anneau contextuel** — Spawn agent : 5 built-ins + Shell, plus « Other » si agents personnalisés.
- **Démarrage – board vide** — « This board is empty » propose agents récents, Spawn an agent, Spawn 2/4/8, Start from a preset.
- **Démarrage – ordres** — « spawn 3 codex », « spawn two reviewers », voix ou texte ; jusqu'à 12 à la fois.
- **Démarrage – presets** — layout complet.
- **CLI absent du PATH** — la console ouvre le login shell et affiche « not found on PATH. Opening a shell in this lane » ; installer l'agent ou définir son chemin dans Settings › Agents puis Restart.
- **En-tête – badge agent** — logo ; clic pour basculer vers un autre agent, ou (Claude Code/Codex) vers un autre compte ; relance la console, avec confirmation si en cours.
- **En-tête – nom** — double-clic pour renommer, 23 caractères max, unicité sur le board.
- **En-tête – badge YOLO** — affiché quand la console tourne avec le flag skip-permission.
- **En-tête – See output** — apparaît quand une réponse terminée atteint ~80 caractères ou 3 paragraphes ; masqué pendant le travail ; ouvre le visualiseur de sortie.
- **En-tête – pilule de statut** — statut courant ; survol pour lire ce que l'agent dit faire (commande exécutée, permission demandée).
- **En-tête – Restart / Duplicate / Close** — Restart relance le CLI sur place ; Close termine et supprime ; les deux demandent confirmation si l'agent tourne ; Duplicate démarre une nouvelle console même agent/compte/taille de texte, sans la conversation.
- **Statut STARTING** — CLI en cours de lancement.
- **Statut WORKING** — avec live status : agent dans un tour ; sans : sortie reçue récemment (y compris un prompt en attente avec spinner).
- **Statut RUNNING** — processus vivant mais silencieux.
- **Statut NEEDS YOU** — permission ou question demandée (nécessite live status).
- **Statut READY** — agent à son prompt, tour terminé ou juste démarré (nécessite live status).
- **Statut PAUSED** — mis en pause depuis la barre de commande (Pause all ou ordre), la Mission Map ou une carte orchestrateur ; rien ne tourne jusqu'à reprise.
- **Statut DONE** — processus terminé : shell sorti ou session tuée depuis la Mission Map / carte orchestrateur ; Restart relance.
- **Statut ERROR** — console n'a pas pu démarrer, ou (live status) tour Claude Code terminé sur erreur (ex. rate limit).
- **Statut IDLE** — rien n'a encore tourné.
- **Sortie de l'agent** — quand l'agent quitte (ex. `/exit`), la console retombe sur le shell en place ; Restart relance l'agent.
- **Sortie du shell** — affiche le code de sortie et attend Restart.
- **Après veille > 90 s** — chaque console active du workspace ouvert affiche une note discrète (sauf programme plein écran) : les sessions réseau ont pu tomber.
- **Arrêt d'une console** — signal de quit, puis arrêt forcé si encore en cours après un instant.
- **Visualiseur de sortie** — affiche la réponse complète comme un document ; pour Claude Code et Codex lue depuis leurs fichiers de transcript, pour les autres depuis l'écran.
- **Visualiseur – Copy** — copie la réponse.
- **Visualiseur – Save .md** — écrit dans `outputs/` du repo avec une ligne datée en tête.
- **Visualiseur – Reply to <nom>** — la réponse est tapée dans la console et soumise.

## Intérieur du terminal

- **Focus clavier** — clic dans la console pour taper ; double-clic cadre aussi la console ; avec une seule console en cours sélectionnée, la frappe y va directement ; clic sur canevas vide pour rendre le clavier au board.
- **⌘C** — copie la sélection.
- **⌘V** — colle.
- **⌘A** — sélectionne toute la sortie.
- **⌘K** — efface le scrollback et l'écran (sauf programme plein écran) ; sur le board, les mêmes touches focalisent la barre de commande.
- **⌘← / ⌘→** — début/fin de ligne.
- **⌘Delete** — supprime jusqu'au début de ligne.
- **Option← / Option→** — déplacement par mot.
- **Option Delete** — supprime le mot précédent.
- **Shift Tab** — back-tab (utilisé par certains agents pour changer de mode).
- **Transparence des autres touches** — tout le reste (Ctrl-C, Esc inclus) va au programme comme dans Terminal.
- **Sélection souris** — glisser ; double-clic = mot ; triple-clic = ligne.
- **Souris pour programmes** — les programmes demandant la souris reçoivent clics et scrolls.
- **Scrollback** — molette jusqu'à 10 000 lignes ; en plein écran, la molette envoie les flèches ; scrollback non sauvegardé avec le board (console redémarrée vide).
- **Contrôle de collage multi-ligne** — coller plusieurs lignes dans un programme non prêt pour un paste exécuterait chaque ligne ; Symvibe demande « Paste N lines as commands? » avec Cancel / Paste as One Line / Paste Lines ; les agents acceptant les pastes (bracketed paste) ne voient jamais la question ; caractères de contrôle supprimés sauf tabulations et sauts de ligne.
- **Taille de texte** — SF Mono 12,5 pt par défaut ; Settings › Appearance › Text size : 85, 100, 115, 130, 150, 175 ou 200 % pour toutes les consoles ; par console : clic droit › Text size (Global suit le réglage, ou un palier spécifique).
- **Option comme Meta** — par défaut Option tape les caractères de la disposition (accents) ; Settings › Agents › Use Option as Meta key : Option envoie Esc + touche.
- **Environnement vu par les programmes** — `TERM=xterm-256color`, `COLORTERM=truecolor`, `TERM_PROGRAM=Hypervibe` (ancien nom, testable par scripts) ; les variables `CLAUDE_CODE_*` héritées sont supprimées pour un comportement identique quel que soit le mode de lancement de l'app.
- **Limites** — liens non cliquables dans la sortie ; pas de recherche dans le scrollback ; les programmes ne peuvent pas définir le titre de fenêtre, écrire dans le presse-papiers ni afficher d'images inline.

## Agents supportés (catalogue de 34)

- **Principe** — CLIs exécutés tels quels ; 34 connus par nom et commande ; tout programme terminal ajoutable comme agent personnalisé.
- **Built-ins (5 + Shell)** — Claude Code, Codex, Gemini, Grok, OpenCode, plus Shell (login shell) : apparaissent dans « New console », chemin configurable dans Settings › Agents, fonctionnalités les plus complètes.
- **Claude (Claude Code)** — commande `claude` ; reprise : sa propre conversation ; comptes multiples : oui ; live status : oui ; flag Yolo `--dangerously-skip-permissions`.
- **Codex** — commande `codex` ; reprise : sa propre conversation ; comptes : oui ; live status : oui ; flag Yolo `--dangerously-bypass-approvals-and-sandbox`.
- **Gemini** — commande `gemini` ; reprise : dernière conversation ; comptes : non ; flag Yolo `--yolo`.
- **Grok** — commande `grok` ; reprise : non ; flag Yolo `--permission-mode bypassPermissions`.
- **OpenCode** — commande `opencode` ; reprise : dernière conversation ; comptes : non ; pas de flag Yolo.
- **Reste du catalogue (29)** — sélection via « All agents », ajouté automatiquement à « Your agents » :
  - Antigravity — `agy` — `--dangerously-skip-permissions`
  - Aider — `aider` — `--yes-always`
  - Amp — `amp` — `--dangerously-allow-all`
  - Ante — `ante` — `--yolo`
  - Auggie — `auggie` — aucun
  - Autohand — `autohand` — `--unrestricted`
  - Cline — `cline` — `--auto-approve true`
  - Codebuff — `codebuff` — aucun
  - Command Code — `command-code --trust` — `--yolo` (toujours lancé avec `--trust` quel que soit le réglage Yolo)
  - Continue — `cn` — `--allow *`
  - Crush — `crush` — `--yolo`
  - Cursor — `cursor-agent` — `--yolo`
  - Devin — `devin` — `--permission-mode bypass`
  - Droid — `droid` — aucun
  - GitHub Copilot — `copilot` — `--yolo`
  - Goose — `goose` — variable d'environnement `GOOSE_MODE=auto`
  - Hermes — `hermes --tui` — `--yolo`
  - Kilocode — `kilo` — aucun
  - Kimi — `kimi` — `--yolo`
  - Kiro — `kiro-cli chat --tui` — `--trust-all-tools`
  - MiMo Code — `mimo` — aucun
  - Mistral Vibe — `vibe` — `--agent auto-approve`
  - OpenClaude — `openclaude` — `--dangerously-skip-permissions`
  - OpenClaw — `openclaw` — aucun
  - Pi — `pi` — aucun
  - Prime Agent — `prime-agent` — aucun
  - Qwen Code — `qwen` — `--approval-mode yolo`
  - Rovo Dev — `rovo` — `--yolo`
  - Trae — `traecli` — `--yolo`
- **Découverte des agents** — recherche sur le PATH du login shell et dans les dossiers d'installation usuels : Homebrew, `~/.local/bin`, npm, pnpm, bun, cargo, Volta, asdf, mise.
- **Pickers triés** — « detected on your system », puis « your agents », puis « not installed yet » ; agent non installé → ouvre le shell avec message.
- **Agent par défaut – usages** — lanes de preset non modifiées, slots des composers Spawn 4 et Group, consoles ajoutées à un groupe existant, premier choix des studios Documents et Diagrams ; le choisir (premier lancement ou Settings) l'arme aussi pour l'outil Spawn agent ; ensuite l'outil garde le dernier agent armé, même après redémarrage.
- **Agents par rôle (spawn sans agent nommé)** — Claude Code pour reviewers, frontend, design, docs ; Codex pour backend et security ; Gemini pour testers ; spawn simple → shell.
- **Scans mémoire** — uniquement les 5 built-ins ; démarrent sur l'agent par défaut s'il en fait partie, puis mémorisent le dernier choix.
- **Réglage de l'agent par défaut** — Settings › Agents › Default agent › Change ; sinon premier agent installé dans l'ordre du catalogue (built-ins d'abord, puis alphabétique) ; Claude si aucun installé.
- **Yolo** — Settings › Agents › Yolo: skip permission prompts (aussi au premier lancement) ; off par défaut ; badge YOLO sur les consoles concernées ; couvre 25 des 34 agents ; jamais appliqué aux commandes personnalisées ; appliqué au démarrage de la console (Restart pour changer) ; jamais ajouté aux sessions cachées des studios.
- **Avertissement Yolo** — l'agent exécute des commandes shell, édite/supprime des fichiers et utilise le réseau sans demander ; recommandé pour repos restaurables, git worktree ou environnement jetable ; guide « skip-permissions » décrivant les modes plus doux de Claude Code et Codex.

## Agents personnalisés (Your agents)

- **Ajout** — Settings › Agents › Your agents › Add an agent : nom + exécutable avec arguments (ex. `aider …`).
- **Parsing des arguments** — découpés sur les espaces, guillemets non interprétés ; envelopper le complexe dans un script.
- **Emplacements d'apparition** — picker All agents du board, switcher d'agent de l'en-tête de console, composer de groupe, board vide, parmi les 3 premiers du flyout console, sous « Other » dans l'anneau contextuel ; « New console » de la barre de commande ne propose que built-ins + Shell.
- **Ajout automatique** — choisir un agent du catalogue non built-in l'ajoute aussi à cette liste.
- **Stockage** — liste conservée dans `custom-agents.json` dans le dossier de données de l'app.
- **Matrice de fonctionnalités** —
  - Consoles, groupes, presets : built-ins oui ; catalogue oui ; commandes personnalisées oui.
  - Ordres de la barre de commande, loops : oui pour les trois.
  - Resume on reopen : Claude, Codex, Gemini, OpenCode ; non pour le reste.
  - Live agent status : Claude, Codex uniquement.
  - Flag Yolo : 4 des 5 built-ins ; 21 des 29 du catalogue ; jamais pour les commandes personnalisées.
  - Documents, Diagrams : built-ins oui ; catalogue oui si l'agent suit le format ; commandes personnalisées non.
  - Scans mémoire : built-ins seulement.
  - Profils de compte : Claude, Codex seulement.
- **Sécurité d'injection** — ordres et instructions de loop ne sont tapés que dans des consoles exécutant un agent, jamais dans un shell simple (le texte n'est jamais exécuté comme commande shell).
- **Suppression** — depuis Your agents ; les consoles déjà en cours continuent jusqu'à fermeture.

## Reprise (resume) et fermeture

- **Quitter avec consoles actives** — dialogue « Quit Symvibe? » avec le nombre de sessions à terminer ; fermer la fenêtre quitte aussi l'app avec la même question.
- **Arrêt propre** — chaque console reçoit un signal de quit, un délai, puis arrêt forcé ; aucun agent ne survit à l'app.
- **Watchdog** — en cas de crash ou force-quit, un petit watchdog arrête les consoles lancées ; un programme détaché volontairement par un agent (ex. serveur en arrière-plan) est laissé en vie.
- **Même mécanisme** — fermeture d'une console, d'un workspace ou d'un repo.
- **Réouverture** — chaque console relance son CLI au même emplacement avec une note « restored » ; scrollback perdu.
- **Resume agent chats** — Settings › General › Resume agent chats (on par défaut) : si le CLI le supporte, la console propose « Resume last conversation? » ; cliquer reprend, taper démarre à neuf.
- **Resume all** — si plusieurs consoles ont quelque chose à reprendre, bannière « Resume all conversations? » Yes/No.
- **Claude Code** — propre conversation de la console si le transcript est encore sur disque ; `claude --resume <session id>`.
- **Codex** — propre session de la console ; `codex resume <session id>`.
- **Gemini** — conversation la plus récente du dossier, proposée sur la console ayant discuté en dernier ; `gemini --resume latest`.
- **OpenCode** — conversation la plus récente du dossier, sur la console ayant discuté en dernier ; `opencode --continue`.
- **Grok, Shell, autres** — rien ; démarrage à neuf.
- **Reprise échouée** — si un resume Claude Code/Codex se termine en moins de 8 secondes, l'offre revient ; Gemini/OpenCode sans rien à reprendre démarrent à neuf.
- **Veille du Mac** — processus conservés ; après > 90 s de veille, note discrète dans chaque console active du workspace ouvert (sauf plein écran) ; la vérification d'abonnement attend le réveil complet.

## Live agent status (hooks Claude Code et Codex)

- **Activation** — Settings › Agents › Live agent status › « Report status from the agent itself » ; off par défaut car cela ajoute une entrée aux réglages de chaque CLI.
- **Confiance Codex** — Codex demande une fois de valider les nouveaux hooks : « Trust all and continue ».
- **Redémarrage** — consoles déjà actives nécessitent Restart ; les nouvelles le prennent en compte directement.
- **Fichiers modifiés** — entrée Symvibe dans `~/.claude/settings.json` et `~/.codex/hooks.json`, ou dans les dossiers pointés par `CLAUDE_CONFIG_DIR` et `CODEX_HOME`, et dans chaque profil de compte sauvegardé.
- **Script de hook** — `~/.hypervibe/agent-hooks/hypervibe-hook.sh` transmet chaque événement à Symvibe via un socket local ; les événements restent sur le Mac.
- **Sauvegardes** — backup unique avant la première modification : `settings.json.hypervibe-backup` (Claude Code) et `hooks.json.hypervibe-backup` (Codex), dans les dossiers propres et chaque profil ; la status line n'est jamais touchée ; un fichier illisible est laissé intact.
- **Désactivation** — retire les entrées.
- **Mapping événements → statut** — début de tour ou d'outil → WORKING ; demande de permission → NEEDS YOU ; question posée → NEEDS YOU ; démarrage ou fin de tour → READY ; échec de tour → ERROR.
- **Limites Codex** — les lignes « question » et « tour échoué » viennent de Claude Code ; les hooks Codex ne rapportent ni l'un ni l'autre.
- **Détail au survol** — commande exécutée, permission demandée, question en attente.
- **Chip « needs you » / touche N** — compte et saute vers les consoles qui ont besoin de vous, erreurs incluses.
- **Intégrations** — filtres de la Mission Map basés sur ces états ; déclencheur de loop « When an agent goes idle » s'y appuie.
- **Rapports dans le thread** — la réponse finale de l'agent, jusqu'à 4 000 caractères.
- **Sans live status** — WORKING = sortie récente seulement (un prompt de permission avec spinner reste WORKING) ; NEEDS YOU et READY n'apparaissent jamais ; les ordres attendent quand même pendant une permission/question car Symvibe reconnaît ces prompts à l'écran.
- **Périmètre** — consoles built-in Claude Code et Codex uniquement ; Gemini, Grok, OpenCode, catalogue et commandes personnalisées gardent le statut basé sur la sortie.

## Détails techniques repérés

- **Terminal** — vrai PTY (pseudo-terminal) exécutant le CLI non modifié du PATH ; `TERM=xterm-256color`, `COLORTERM=truecolor`, `TERM_PROGRAM=Hypervibe` ; variables `CLAUDE_CODE_*` héritées purgées ; scrollback 10 000 lignes ; SF Mono 12,5 pt ; support souris pour les programmes ; détection du bracketed-paste pour le contrôle de collage ; suppression des caractères de contrôle collés (sauf tab/LF) ; Option→Esc+touche optionnel ; pas d'OSC titre/clipboard/images inline ; pas d'hyperliens.
- **Gestion des processus** — signal de quit puis kill après délai ; watchdog indépendant tuant les consoles en cas de crash/force-quit, épargnant les processus détachés ; processus conservés à travers la veille ; note après > 90 s de veille.
- **Persistance des boards** — un fichier par workspace dans `~/Library/Application Support/Hypervibe/Boards` ; debounce ~2 s, max ~7 s ; arrière-plan toutes les 60 s ; flush au quit ; version précédente conservée ; snapshots horaires (24 derniers) ; `Boards/Archive` jamais purgé ; refus d'écrire un board créé par une version plus récente (forward-compat en lecture seule).
- **Captures/images collées** — `~/Library/Application Support/Hypervibe/Screenshots` ; images de fichiers référencées par chemin (pas copiées) ; 460 pt côté max initial.
- **Agents personnalisés** — `custom-agents.json` dans le dossier de données de l'app ; args splittés sur espaces sans parsing de guillemets.
- **Découverte de binaires** — PATH du login shell + Homebrew, `~/.local/bin`, npm, pnpm, bun, cargo, Volta, asdf, mise.
- **Hooks de statut** — entrées dans `~/.claude/settings.json` et `~/.codex/hooks.json` (ou `$CLAUDE_CONFIG_DIR`, `$CODEX_HOME`, et chaque profil de compte) ; script `~/.hypervibe/agent-hooks/hypervibe-hook.sh` → socket local Unix ; backups `settings.json.hypervibe-backup` / `hooks.json.hypervibe-backup` ; Codex exige un « Trust all » des hooks ; événements : start turn/tool, permission request, question (Claude only), startup/end turn, turn failure (Claude only).
- **Détection de prompts sans hooks** — reconnaissance à l'écran (screen-scraping) des prompts de permission/question pour retarder les ordres ; statut WORKING basé sur l'activité de sortie récente.
- **Visualiseur de sortie** — lecture des fichiers de transcript natifs de Claude Code et Codex ; sinon capture de l'écran ; seuil ~80 caractères ou 3 paragraphes ; export `outputs/<fichier>.md` avec en-tête daté ; « Reply to » injecte et soumet dans la console ; rapports de thread limités à 4 000 caractères.
- **Reprise de session** — `claude --resume <id>`, `codex resume <id>`, `gemini --resume latest`, `opencode --continue` ; fenêtre de 8 s pour détecter un resume échoué ; Settings › General › Resume agent chats.
- **Flags Yolo** — injectés au lancement (voir tableau) ; `GOOSE_MODE=auto` en variable d'environnement pour Goose ; `--trust` permanent pour Command Code ; jamais pour commandes personnalisées ni sessions de studio.
- **Profils de compte** — Claude Code et Codex uniquement, dossier de configuration dédié par profil (CLAUDE_CONFIG_DIR / CODEX_HOME).
- **Web tiles** — WKWebView (WebKit/Safari) ; http/https seulement ; retry 10×1 s sur localhost ; certificats auto-signés acceptés sur localhost ; 12 onglets max ; user-agent iPhone Safari pour les tailles téléphone ; Web Inspector Safari dockable en carte ; détection d'URL locale dans la sortie console (localhost, 127.0.0.1, 0.0.0.0, [::1]) avec vérification de réponse avant ouverture auto ; ports du cadran 3000/3001/4200/5173/8000/8080 ; sandbox : pas d'audio avant clic, permissions caméra/micro demandées, downloads en arrière-plan annulés, pop-ups filtrés (user-gesture).
- **Git** — git local du Mac ; pas de fetch automatique ; 400 fichiers max dans la liste, 100 commits d'historique, 200 branches locales ; message de commit généré localement ; `git init` sur main ; `git branch -d` ; fast-forward pull seulement ; branche de backup `hv-oversize-backup` lors de la réécriture pour fichiers > 100 Mo ; `.gitignore` auto pour « Keep off GitHub » ; discard via Corbeille ; SSH batch mode (ssh-agent/Keychain, known_hosts) ; timeout par commande, push coupé après 5 min sans sortie ; publication via `gh auth login` / `gh` CLI (`brew install gh`), état de connexion dans Settings › Connections.
- **Fichiers sur le board** — copie dans le repo sans écrasement (suffixes -2, -3…) ; explorateur de dossier 40 fichiers max sans récursion ; carte code 800 Ko / 5 000 lignes ; carte Markdown avec file-watching (mise à jour live) ; carte fichier avec Quick Look et chemin surveillé (manquant/déplacé).
- **Board/canvas** — 24 000 × 24 000 points ; zoom 20–300 % ; undo 80 étapes ; placement automatique des consoles sans chevauchement ; guides d'alignement sans snap ; nudge 1/10 pt.
- **Limites diverses** — 12 consoles par ordre spawn ; noms de console 23 caractères, repos/workspaces 24 ; 16 noms courts prédéfinis numérotés ; 18 presets ; layouts sauvegardés globaux à l'app ; preset Four Squads = 16 consoles.
- **Planner** — ordres simples parsés localement (regex/intention locale), phrases complexes envoyées au service planner distant (crédits) ; crédits partagés avec le TTS des réponses parlées ; agents n'utilisant jamais les crédits.
- **Dossier projets** — `~/symvibe` (ou choix au setup, ou `~/hypervibe` hérité) ; migration iCloud avec vérification du nombre de fichiers et du HEAD git.
- **Nom historique** — Hypervibe (chemins, TERM_PROGRAM, préfixes de backup `hv-`/`hypervibe`).

---

# PARTIE 2 — Orchestration et voix

## Barre de commande et son fil (docs/command-bar)

- **Barre de commande globale** — barre en bas de chaque board ; dirige l'ensemble du board en tapant ou en parlant un ordre, ciblé par une mention `@` ; les réponses et rapports d'agents s'affichent dans son fil (thread).
- **Raccourci ⌘ K (focus bar)** — quand aucune console ni champ texte n'a le clavier, ⌘ K place le curseur dans la barre ; à l'intérieur d'une console, ⌘ K efface (clear) cette console au lieu de focaliser la barre.
- **Return envoie / Esc rend le clavier au board** — Return soumet l'ordre, Esc rend le focus au board.
- **Historique des commandes (↑/↓)** — les flèches Haut/Bas rappellent les 50 dernières commandes.
- **Push-to-talk Espace** — maintenir Espace sur le board pour parler, relâcher pour envoyer.
- **Bouton micro** — maintenir le bouton micro, ou taper une fois pour démarrer et une fois pour arrêter.
- **Placeholder contextuel** — rappelle « Hold space to speak · @ to direct » ; sur un board vide, suggère de demander « what can you do? ».
- **Menu « Direct to » via @** — taper `@` ouvre un menu : everyone, puis chaque console, puis chaque groupe ; navigation ↑/↓, validation Tab ou Return, fermeture Esc.
- **Mention d'une console unique** — `@Otto run the tests` ne va qu'à Otto ; la mention est retirée du texte reçu par l'agent ; avec un `@` sur une seule console, les mots sont tapés exactement (sans planner).
- **Mentions globales** — `@everyone`, `@all`, `@everybody` adressent toutes les consoles ; `@everyone` se comporte comme une absence de mention (passe par le planner).
- **Mention d'un groupe ou de plusieurs consoles** — passe par le planner qui répartit le travail.
- **Mention vide → nudge** — une mention sans texte derrière déclenche un rappel du type « Say what Otto should do ».
- **Adressage sans @ par nom** — formes `tell Otto to run the tests`, `Otto, run the tests`, `the backend group, run the migrations` ; lorsqu'il est disponible, le planner traite ces formes et rédige l'instruction.
- **Désambiguïsation des noms proches** — si un nom prononcé ressemble seulement (ex. « Claudia » pour la console Claude nommée Otto), l'ordre est retenu et l'app demande « Did you mean Otto? » ; si plusieurs consoles correspondent, elle demande s'il faut envoyer à toutes ; on confirme en disant « confirm » ou en cliquant Send.
- **Chip « New console »** — démarre une console : Claude, Codex, Gemini, Grok, OpenCode ou shell vide.
- **Chip « Spawn 4 »** — ouvre le composeur de groupe (nom, rôle, un agent par slot) avec quatre slots.
- **Chip « Group »** — même composeur avec six slots.
- **Chip « Presets »** — ouvre la bibliothèque de presets.
- **Chips « Pause all » / « Resume all »** — met en pause toutes les consoles ou les laisse reprendre ; une console en pause conserve son état.
- **Chip « Memory »** — ouvre le panneau de mémoire projet.
- **Chips « Loops », « Docs », « Code », « Skills », « Mission Map »** — visibles uniquement quand le fil est ouvert ; ouvrent les panneaux correspondants.
- **Chip « Kill all »** — visible quand le fil est ouvert ; deux clics puis une confirmation macOS, puis toutes les consoles se ferment.
- **Ouverture du fil (chevron)** — le chevron de la barre ouvre le fil : vos ordres, les réponses, et une ligne par rapport d'agent.
- **Note « Plan »** — après chaque plan, une note Plan affiche ce qui a été envoyé à chaque console.
- **Rapport d'agent dans le fil** — quand un agent chargé de travail termine, sa ligne indique qu'il a fini et la durée, ou qu'il a échoué et pourquoi, avec les premières lignes de sa réponse et un bouton « See output ».
- **Timeout de rapport 30 min** — les agents qui ne répondent pas sous 30 minutes sont abandonnés avec une note dans le fil.
- **Requêtes d'état** — `who finished` / `what happened` donnent l'état du dernier ordre : qui a fini, qui a échoué, qui travaille encore, qui a besoin de vous ; `status` compte ce que fait chaque console et nomme qui a besoin de vous.
- **Persistance du fil par repo** — fil conservé par repo, jusqu'aux 500 derniers messages, dans `~/Library/Application Support/Hypervibe/Threads` ; bouton Clear pour vider.
- **Sélecteur de langue vocale (globe)** — le globe dans l'en-tête du fil définit la langue de parole.
- **Parseur local vs planner** — ordres courts et simples (`spawn 4 codex`, `pause Otto`, `open loops`) compris localement sur le Mac sans planner ni crédits ; une confirmation parlée non encore en cache consomme toutefois des crédits ; si la langue vocale n'est pas l'une des six (anglais, espagnol, portugais, français, allemand, italien), tout ordre va au planner ; phrases complètes, questions et travail pour plusieurs agents passent au planner (consomme des crédits).
- **Filtrage du small talk** — des énoncés comme « thanks » n'atteignent jamais une console.

## Routage des ordres vers les agents (docs/orders)

- **Saisie automatique dans les consoles** — Symvibe tape l'ordre dans les consoles des agents et presse Return à votre place.
- **Compréhension locale (parseur intégré)** — ordres simples (`spawn 4 codex`, `pause Otto`, `kill the codex consoles`, `open the mission map`, `go to workspace 2`) lus par un parseur intégré, sans crédits ; une confirmation parlée non cachée consomme des crédits ; langue vocale hors des six langues → tout passe au planner.
- **Compréhension par le planner** — phrases entières, questions, travail multi-agents : le service planner rédige les étapes et le texte destiné à chaque agent ; chaque ordre consomme des crédits ; un seul tour de planner à la fois par fil ; le fil affiche « Still thinking » au-delà de quelques secondes.
- **Collage en une ligne + Return différé** — le texte est collé comme une seule ligne, puis soumis par Return un instant plus tard, comme une frappe manuelle.
- **Seules les consoles agent reçoivent** — un shell nu ou une console agent retombée dans son shell ne reçoit jamais d'ordre ; un ordre n'est donc jamais exécuté comme commande shell.
- **Délai de démarrage 10 s** — une console en cours de démarrage dispose de jusqu'à 10 secondes ; une console n'ayant rien affiché ne reçoit rien.
- **Mise en attente sur prompt/question (15 min)** — si l'agent affiche un prompt de permission ou une question, l'ordre attend votre réponse jusqu'à 15 minutes, puis est abandonné avec une note dans le fil.
- **Annulation** — `cancel that` / `never mind` abandonne les parties non encore tapées ; le texte déjà collé mais non soumis reste dans la zone de saisie de l'agent.
- **Tour natif de l'agent** — ce que Symvibe tape est un tour normal de l'agent, sous l'abonnement propre de celui-ci.
- **Découpage d'une review multi-agents** — une review demandée à plusieurs agents est scindée en parties ; chaque agent reçoit son angle avec consigne de lire sans modifier les fichiers.
- **Répartition par le planner** — le planner attribue à chaque agent sa part ; si un même texte irait encore à plusieurs agents (non scindé ou traité par le parseur local), un seul agent le reçoit (un agent libre si possible) et le fil indique combien sont restés libres.
- **Même texte pour tous** — uniquement pour de courtes directives globales (`commit`, `stop using mocks`, `reply in English`) ou sur demande explicite (« the same prompt », « identical prompts », « independent reviews »).
- **Confirmation kill/restart** — toujours : Symvibe annonce ce qu'il va fermer/redémarrer et attend jusqu'à 60 s un « yes », « confirm », « do it », « go ahead » ou un clic Confirm dans le fil ; tout autre chose annule.
- **Confirmation Kill all** — deux clics puis dialogue macOS.
- **Confirmation fermeture de workspace avec agents actifs** — confirmation parlée ou cliquée.
- **Confirmation nom ambigu** — « Did you mean… » ou envoi à tous les correspondants, avant envoi.
- **Confirmation création de loop par ordre** — dialogue macOS « Create a recurring instruction? ».
- **Confirmation d'étapes non demandées / texte risqué** — actions Git, ouverture de liens, et ordres contenant `rm -rf`, `sudo`, `curl`, `.env` ou `--yolo` attendent « confirm » ou un clic Confirm (Send pour un ordre à agents) ; une étape Git ou un site que vous avez interdit est abandonné ; un ordre à agents demandant une chose interdite attend de la même façon.
- **Push/commit/pull demandés : sans confirmation** — un push commite d'abord toutes les modifications cochées.
- **Pause/resume : sans confirmation** — une pause est toujours réversible.
- **Handoffs et forwards : sans confirmation**.
- **Mode dégradé sans planner** — si le planner est injoignable, occupé ou en rate-limit (et pendant une minute après deux échecs consécutifs), si les crédits mensuels sont épuisés (jusqu'au renouvellement), ou si l'ordre dépasse 600 caractères, le parseur intégré traite tout.
- **Comportement dégradé** — les ordres simples continuent ; les questions reçoivent une courte réponse locale ; un ordre commençant par son destinataire ou avec `@` part tel quel ; s'il nomme plusieurs agents, un agent libre parmi eux le reçoit, et une review est scindée en angles ; un ordre demandant à l'orchestrateur de rédiger l'instruction ou nommant une console/un groupe non routable (ex. groupe nommé en fin de phrase) n'est pas envoyé ; un ordre sans destinataire alors que plusieurs agents pourraient le prendre n'est pas envoyé (sinon il va à un agent libre).
- **Messages d'erreur du fil** — « The planner didn't answer, so I sent nothing to the agents », « Without the planner I can't write or split that order, so I sent nothing », « I couldn't read that without the planner » ; à l'épuisement des crédits, la première réponse nécessitant le planner le signale, une fois par session.

## Cartes orchestrateur (docs/orchestrator-cards)

- **Carte orchestrateur à portée restreinte** — dirige uniquement les consoles qui lui sont câblées, permettant à plusieurs équipes de travailler côte à côte sans croisement d'ordres.
- **Ajout depuis le rail droit** — « Insert orchestrator » ; toute carte ajoutée ainsi s'appelle « Orchestrator ».
- **Ajout par commande** — `add an orchestrator`, `add an orchestrator for group 1` ; nommage automatique Orchestrator, Orchestrator 2… sauf nom fourni.
- **Presets avec carte pré-câblée** — Dev HQ, Sprint Room, Web Studio, Ship It, Briefed Squad.
- **Câblage manuel** — bouton Connect, clic sur les consoles du board ou câblage depuis la carte, puis Done ; un groupe entier se câble en une seule connexion.
- **Carte vide** — affiche « No agents wired » et propose « Spawn agent », qui démarre une console déjà câblée.
- **Câblage par commande** — `connect group 1 to the orchestrator`.
- **Portée des ordres** — les ordres tapés sur la carte n'atteignent que ses consoles ; le placeholder indique leur nombre ; mentionner une console non câblée renvoie « That mention is not connected to this orchestrator ».
- **Limitation** — undo, redo et commandes de workspace ne fonctionnent que depuis la barre principale.
- **En-tête de carte** — affiche le nombre d'agents dirigés et le nom du groupe quand elle dirige un seul groupe.
- **Intégration Mission Map** — la Mission Map dessine chaque carte avec ses groupes et consoles.
- **Actions de ligne (hover)** — Focus ; Pause / Resume / Restart selon l'état ; Kill session pendant l'exécution ou la pause (deux clics + confirmation macOS ; la console reste sur le board, marquée done).
- **Actions de ligne (clic droit)** — Restart session et Disconnect.

## Ordres vocaux (docs/voice)

- **Push-to-talk Espace** — board au premier plan, sans console ni champ texte tenant le clavier ; alternative : maintenir le bouton micro, ou tap pour démarrer / tap pour arrêter.
- **Transcription en direct** — la barre signale l'écoute et écrit les mots au fur et à mesure.
- **Envoi au relâchement / Esc annule**.
- **Espace → barre principale uniquement** — jamais vers une carte orchestrateur.
- **Limite d'enregistrement 60 s** — un enregistrement coupé par la limite n'est pas envoyé.
- **Désactivation** — Settings › Voice › Hold Space to talk.
- **STT on-device Parakeet v3** — modèle exécuté sur le Mac, téléchargé une fois depuis Hugging Face ; la barre indique « preparing » tant qu'il n'est pas prêt.
- **Audio jamais envoyé** — le micro ne quitte pas le Mac.
- **Filtrage des hallucinations sur silence** — phrases inventées par le modèle sur le silence filtrées ; mots ressemblant à un nom de console rapprochés de ce nom.
- **Langue vocale** — Settings › Voice › Speech language : Automatic par défaut, ou l'une des 25 langues européennes ; épingler une langue aide quand les résultats reviennent dans le mauvais alphabet.
- **Permission micro macOS** — demandée à l'apparition du premier board ; sinon System Settings › Privacy & Security › Microphone.
- **Périphérique d'entrée** — Settings › Voice › Input device ; « Test your microphone » affiche un vumètre en direct.
- **Réponses parlées** — Settings › Voice › Confirm commands out loud (activé par défaut) : l'orchestrateur répond par de courtes lignes (confirmations, questions, qui a fini) ; ne lit jamais la réponse d'un agent, seulement son nom.
- **Choix de la voix + Test** — dans le même panneau.
- **Langues des réponses** — anglais, espagnol, portugais, français, allemand, italien ; le planner répond en anglais pour les autres langues ; les lignes courtes de l'app utilisent la plus proche des six.
- **TTS Inworld via serveurs Symvibe** — le texte part, l'audio revient ; cache local jusqu'à 100 Mo par compte ; une ligne inutilisée 30 jours est supprimée ; une ligne en cache joue sans réseau ni crédits ; bouton Clear pour le cache audio.
- **Coût** — les lignes parlées consomment des crédits ; à l'épuisement, les lignes en cache jouent encore et le texte reste dans le fil.
- **Flux réseau** — audio micro : nulle part ; ordre transcrit + lignes récentes du fil + snapshot du board : service planner Symvibe → Groq (quand le planner est requis) ; texte d'une ligne parlée : serveurs Symvibe → Inworld ; modèle STT : Hugging Face (une fois).

## Dictée (docs/dictation)

- **Dictée = frappe seule** — convertit la parole en texte à l'emplacement du curseur ; rien n'est envoyé tant que vous ne pressez pas Return.
- **Procédure** — cliquer la cible (console, champ texte ou barre de commande) ; maintenir Fn un instant puis parler ; toute autre touche ou Esc annule ; relâcher tape le texte au curseur.
- **Ordre de résolution de la cible** — console ou champ focalisé ; sinon l'unique console en cours d'exécution sélectionnée ; sinon la barre de commande.
- **Pill d'indication de cible** — petite pastille montrant où va le texte.
- **Repli vers la barre** — si la console cible affiche un prompt de permission/une question, a été relancée ou a quitté, le texte va dans la barre.
- **Touche de dictée configurable** — Settings › Voice › Hold to dictate : Fn/Globe (défaut), Right ⌘ ou Right Option.
- **Conflit touche Globe** — régler System Settings › Keyboard › Press Globe key to → Do Nothing.
- **Ponctuation parlée** — « comma », « period », « question mark ».
- **Limite 5 min** — à la limite, ce qui a été dit est tapé.
- **Portée** — fonctionne dans la fenêtre Symvibe uniquement, pas dans d'autres apps.
- **Coût et confidentialité** — 100 % on-device, même modèle que les ordres vocaux ; aucun crédit, rien n'est envoyé ; nécessite un abonnement actif.

## Commandes vocales et tapées (docs/voice-commands)

- **Principe** — à dire avec Espace maintenu ou à taper dans la barre ; les ordres simples tournent localement ; les phrases entières vont au planner, qui comprend bien plus que cette liste.
- **Reconnaissance** — 25 langues européennes ; réponses et lignes parlées en EN/ES/PT/FR/DE/IT, anglais sinon.
- **Via le planner** — tout ce qui n'est pas un ordre simple : phrase pour plusieurs agents, question sur le board, `group the testers`, `clean up the board`, renommage, checklists, presets ; chaque tour consomme des crédits.

| Catégorie | Action | Commandes (exemples) | Notes |
|---|---|---|---|
| Agents et groupes | Démarrer des consoles | `spawn two reviewers`, `spin up 3 codex` | Jusqu'à 12 d'un coup ; nommer un CLI intégré ou un agent ajouté sous Settings › Agents › Your agents ; sans CLI ni rôle → shells nus |
| Agents et groupes | Créer un groupe | `make a group of three Claude Code agents` | Sans nombre, un groupe en compte trois |
| Agents et groupes | Ajouter à un groupe | `add two testers to group 2` | |
| Agents et groupes | Pause | `pause`, `pause Otto`, `wait` | Arrête le processus jusqu'à reprise ; sans confirmation |
| Agents et groupes | Reprendre | `resume`, `continue`, `keep going` | |
| Agents et groupes | Redémarrer | `restart group 1`, `reset the codex` | Relance sur place ; demande confirmation |
| Agents et groupes | Fermer | `kill Otto`, `kill the claude consoles`, `delete the backend group` | Ferme et retire ; demande toujours confirmation |
| Donner du travail | Un agent | `@Otto run the tests`, `tell Otto to run the tests`, `Otto, run the tests` | Seule cette console reçoit ; avec `@` mots tapés tels quels, les deux autres formes passent par le planner |
| Donner du travail | Tout le board | `run the tests and report` | Le planner décide qui reçoit quoi |
| Donner du travail | Même prompt pour tous | `give everyone the same prompt: review the auth flow` | Sinon le travail est scindé ou va à un agent libre |
| Donner du travail | Handoff | `pass this task to codex`, `hand off to gemini` | Voir Handoffs |
| Donner du travail | Forward des résultats | `when they finish, pass it to Codex` | |
| Donner du travail | Annuler | `cancel that`, `never mind`, `scratch that` | Abandonne ce qui n'est pas encore tapé |
| Demander | État | `status`, `how's it going` | |
| Demander | Résultats | `who finished`, `what happened`, `give me a summary` | |
| Demander | Aide | `what can you do?`, `help` | |
| Board | Caméra | `show me everything`, `zoom in`, `reset zoom`, `go to Otto`, `focus on group 2`, `show me the codex lanes` | |
| Board | Panneaux | `open loops`, `open memory`, `open mission map`, `open settings`, `open github`, `open usage`, `close that` | |
| Board | Studios | `open documents`, `open code`, `open markdown`, `open skills` | |
| Board | Ajouter | `add a note that says ship Friday`, `add a kanban`, `add a calendar`, `open localhost 3000`, `add an orchestrator` | |
| Board | Dessiner | `I want to draw`, `eraser` | |
| Board | Thème | `light mode`, `dark mode`, `match macOS` | |
| Board | Undo/Redo | `undo`, `redo` | Seuls, dans la barre de commande |
| Workspaces | Workspaces | `go to workspace 2`, `new workspace called QA`, `rename this workspace to Backend`, `close workspace 2` | Barre principale uniquement ; fermeture avec agents actifs demande confirmation |
| Loops | Créer une loop | `every 10 minutes run the tests` | La durée doit ouvrir la phrase ; 1 min à 24 h ; dialogue macOS de confirmation |
| Git | Git | `commit and push`, `push`, `pull`, `commit with the message fix login` | Exécution immédiate, sans confirmation |

## Groupes et équipes (docs/teams)

- **Groupe = ensemble de consoles adressées ensemble** — nom + rôle, un seul ordre pour tous ; rend lisible un board de douze agents.
- **Créer par raccourci** — sélectionner ≥ 2 consoles + ⌘ G ; nommage Group 1, Group 2… ; ⌘ Shift G dissout.
- **Glisser-déposer dans le halo** — glisser une console dans le halo du groupe pour l'ajouter, hors du halo pour la retirer.
- **Créer par commande** — `make a group of three Claude Code agents`, `add two testers to group 2`, `group the testers`.
- **Composeur d'équipe** — ouvert par les chips Spawn 4 / Group ou « Spawn group » dans l'anneau de clic droit.
- **Nom et rôle du groupe** — rôles : General, Frontend, Backend, Testers, Reviewers, Design, Docs, Security ; le rôle nomme et teinte le groupe, sans changer les capacités des agents.
- **Slots** — un slot par console, jusqu'à 12 ; clic pour faire défiler l'agent, clic droit pour le catalogue complet, logo dans la ligne « fill-all » pour fixer tous les slots.
- **Spawn** — lance toutes les consoles ensemble.
- **Rôle → CLI par défaut** — reviewers, frontend, design, docs → Claude Code ; backend, security → Codex ; testers → Gemini ; requête générale sans CLI ni rôle (`spawn two agents`) → shells nus ; CLI nommé explicitement (`spawn two codex reviewers`) ; ajout à un groupe existant sans CLI → agent par défaut de l'utilisateur.
- **Donner du travail à un groupe** — `@Reviewers` ou `tell group 2 to write tests for the cart` ; travail scindé entre membres ou donné au premier libre.
- **Contrôle d'un groupe par nom** — pause, resume, restart, kill (restart et kill demandent confirmation).
- **Rapports d'équipe** — chaque réponse de membre arrive dans le fil d'origine (barre ou carte orchestrateur) à la fin ou à l'échec ; détection de fin via le live agent status quand activé, sinon via l'arrêt de la sortie ; `who finished` / `give me a summary` ; forward des résultats vers l'agent suivant.

## Mission Map (docs/mission-map)

- **Vue chaîne de commandement** — barre de commande et cartes orchestrateur, groupes dirigés, chaque console avec son état en direct.
- **Ouverture** — touche X, chip Mission Map dans le fil ouvert, Tools › Mission Map, liste More de l'anneau clic droit, ou `open mission map` ; Esc ferme.
- **Trois colonnes** — barre/cartes → groupes → consoles ; des fils montrent qui dirige qui ; une ligne pointillée « Command bar only » marque les groupes et consoles isolées sans carte orchestrateur.
- **Filtres** — All, Working, Needs you (erreurs incluses), Idle (pauses incluses), Done.
- **Recherche** — « Find a console or team » sur les noms, et pour les consoles aussi sur l'agent et le rôle.
- **Clic / double-clic** — clic pour inspecter, double-clic pour sauter à l'élément sur le board.
- **Inspecteur de console** — statut, activité courante (outil exécuté, question posée ou cause d'échec), durée, sous-agents, libellé de tâche ; actions Pause/Resume, Relaunch (après fin de session), Kill (second clic + confirmation pendant l'exécution).
- **Inspecteur de groupe** — tâche courante ou dernière tâche.
- **Inspecteur de carte orchestrateur** — dernière instruction reçue.
- **Source des états** — « Needs you » (prompt de permission ou question) provient du live agent status rapporté par les consoles Claude Code et Codex ; avec lui, une console ayant fini son tour compte comme Idle ; Done = session terminée ; sans live status, une console vivante compte Working jusqu'à pause ou fin de session, et une nouvelle sortie n'allume qu'un anneau autour de son point.

## Handoffs et forwards (docs/handoffs)

- **Handoff** — déplace une tâche vers une console fraîche du CLI nommé (généralement différent) ; `pass this task to codex`, `hand off to gemini`.
- **Étape 1 : demande de résumé** — Symvibe tape dans la console source une requête de résumé de la tâche et de son état ; si plusieurs sources possibles, le fil demande une mention `@`.
- **Étape 2 : attente ≤ 4 min** — sans résumé, la nouvelle console s'ouvre quand même, vide.
- **Étape 3 : démarrage destination** — console fraîche du CLI nommé.
- **Étape 4 : livraison du brief** — une fois la console prête, le résumé est tapé et soumis avec instruction de continuer depuis exactement cet état.
- **Source conservée** — la console source continue ; à fermer manuellement.
- **Contraintes** — un seul handoff à la fois ; destination = l'un des CLIs intégrés.
- **Prompt de confiance du dossier** — non répondu automatiquement ; à approuver sous ~2 min pour recevoir le brief ; passé ce délai, le brief n'est pas envoyé et le fil l'affiche pour collage manuel.
- **Coût** — la requête de résumé et le brief sont des tours de chaque agent, sur son propre plan ; un agent à court de quota ne peut pas faire de handoff (il doit rédiger le résumé).
- **Forward** — envoie les résultats terminés à l'agent suivant ; `when they finish, pass it to Codex`, `when group 1 finishes pass everything to group 2`.
- **Digest** — quand toutes les sources ont rapporté, leurs réponses complètes sont tapées dans la destination en un seul digest et soumises.
- **Plusieurs destinations** — chacune reçoit une part différente si divisible ; un agent sans part reste libre ; l'indivisible va entier au premier ; `to everyone` envoie le digest complet à chacun.
- **Limites de taille** — 24 000 caractères par réponse, ~72 000 par digest ; au-delà, coupé.
- **Fenêtres temporelles** — résultats forwardables 30 min après leur fin ; un forward énoncé avant que les sources aient un ordre attend jusqu'à 4 h ; une fois en travail, attente max 30 min depuis l'ordre, puis envoi des réponses reçues.
- **Cas d'usage** — handoff : changer de CLI en cours de tâche (agent bloqué) ; forward : pipelines (builders → reviewers ; trois investigations → un agent qui corrige).

## Loops (docs/loops)

- **Loop** — tape une instruction dans les consoles choisies de manière répétée, sur un déclencheur, jusqu'à une condition d'arrêt (garder les agents actifs, surveiller un build, point horaire).
- **Ouverture** — touche L, Tools › Loops, bouton Loops du rail droit (badge = loops en cours), chip Loops du fil ouvert ; création vocale `every 10 minutes run the tests` avec dialogue macOS.
- **Déclencheur « On a schedule »** — toutes les 1 min à 24 h ; presets 5, 10, 15, 30 min, 1 h, 2 h ; 15 min par défaut.
- **Déclencheur « When an agent goes idle »** — quand une console termine son tour.
- **Déclencheur « When output contains »** — quand la nouvelle sortie contient le texte donné (≥ 2 caractères ; sensible à la casse seulement si une majuscule est tapée).
- **Instruction** — texte tapé dans les consoles à chaque run.
- **Cibles** — All consoles, les consoles d'une carte orchestrateur, ou Pick consoles.
- **Conditions d'arrêt** — après N runs (1 à 200) ; après une durée (15 min à 24 h) ; quand un objectif est atteint.
- **Estimation de charge** — pour une loop planifiée, le composeur estime le nombre de prompts/heure et de consoles avant sauvegarde.
- **Objectif « A command passes »** — exécute une commande dans le repo via zsh ; exit code 0 = atteint ; check arrêté après 5 min.
- **Objectif « An agent judges »** — interroge votre CLI dans une session cachée sur l'atteinte de l'objectif et lit son verdict ; n'exécute pas de commandes ; chaque check est un tour sur votre plan.
- **Cadence des checks** — avant un run planifié et quand une console ciblée finit un tour (via live agent status), jamais deux fois en 90 s ; max 2 checks simultanés ; un check sans verdict (ex. CLI déconnecté) laisse le run se faire.
- **Templates** — Progress check, Keep them moving, Build rescue, Test watchdog, Commit checkpoint, Review sweep, Hourly standup.
- **Livraison** — instruction tapée et soumise comme un ordre ; chaque run = un tour sur le plan de l'agent.
- **Consoles éligibles** — seulement celles exécutant un agent ; une console sur prompt/question est sautée : un run planifié n'ayant atteint aucune console réessaie une minute plus tard, sinon la console sautée attend le run suivant ; un déclencheur output livre quand la console est libre ; un déclencheur idle laisse passer ce tour.
- **Rate limit** — déclencheurs idle et output : au plus une fois toutes les 2 min par console.
- **Dépendance au live status** — « When an agent goes idle » exige le live agent status.
- **Conditions d'exécution** — seulement app ouverte et Mac éveillé ; option « Keep running behind other tabs » pour atteindre un workspace en arrière-plan.
- **Historique** — 20 dernières entrées de la session (runs et skips), effacé à la fermeture.
- **Notifications** — en arrière-plan, notification silencieuse quand une loop planifiée trouve une console en attente de vous et retient son instruction, et quand une loop se termine (objectif atteint, durée ou nombre de runs) ; permission macOS demandée à la première création/activation ; seules notifications de l'app.

## Mémoire projet (docs/memory)

- **Mémoire = courte liste de faits sur le repo** — comment le lancer, où sont les choses, quoi éviter ; poussée dans les agents à la demande.
- **Ouverture** — touche M, chip Memory, Tools › Memory.
- **Deux portées** — ce repo (nommé d'après son dossier) et All repos.
- **Types de faits** — Architecture, Structure, Commands, Conventions, Gotchas, Context.
- **Stockage** — `~/Library/Application Support/Hypervibe/Memory`, par chemin de repo.
- **Scan** — demande à l'un de vos CLIs, dans une session cachée dans le repo, un briefing sans rien modifier ; selon l'effort (Quick, Balanced, Thorough) propose ~6 à 14 faits ; rien n'est sauvegardé sans « Add to memory ».
- **Refresh** — revérifie un seul fait contre le repo.
- **Choix du CLI** — parmi les cinq intégrés ; agent par défaut présélectionné (sinon premier installé) ; choix mémorisé pour Scan et Refresh ; chaque scan/refresh = un tour sur le plan de ce CLI.
- **Place card on board** — pose une carte mémoire sur le board.
- **Wire** — câble la carte (fils violets) aux consoles ou groupes concernés.
- **Push** — tape la mémoire dans chaque agent câblé en cours d'exécution et la soumet, présentée comme contexte d'arrière-plan (pas une tâche), en demandant une réponse « OK » ; plafond 3 400 caractères, entrées excédentaires omises avec décompte dans le message.
- **Rapport de push** — envoyé à combien, combien occupés, ou rien envoyé.
- **Push manuel uniquement** — à refaire après ajout d'agents ; la mémoire n'atteint un agent que lors d'un push.

## Détails techniques repérés (orchestration & voix)

- **Architecture d'injection** — toute orchestration repose sur la saisie de texte dans des terminaux PTY (collage en une ligne + Return différé) ; aucune API agent : chaque ordre est un tour de l'agent sous son propre abonnement.
- **Parseur local** — grammaire de commandes courtes exécutée sur le Mac (spawn/pause/kill/open/workspace/git/caméra…), sans crédits ; limité aux six langues EN/ES/PT/FR/DE/IT ; sert de fallback complet quand le planner est injoignable, occupé, rate-limité (backoff 1 min après 2 échecs), hors crédits, ou pour un ordre > 600 caractères.
- **Planner LLM hébergé** — service Symvibe qui relaie vers **Groq** (`gpt-oss-120b`) ; entrée : ordre transcrit + lignes récentes du fil + snapshot du board ; sortie : étapes + texte par agent (note Plan) ; un tour à la fois par fil ; consomme des crédits ; répond dans les six langues, anglais sinon.
- **STT on-device** — **Parakeet v3** téléchargé une fois depuis Hugging Face ; 25 langues européennes ; filtrage des hallucinations de silence ; matching phonétique des noms de consoles ; limite 60 s (ordres) / 5 min (dictée) ; audio jamais transmis.
- **TTS** — **Inworld** via les serveurs Symvibe ; cache local 100 Mo/compte, éviction après 30 jours d'inutilisation ; lecture hors ligne et sans crédits depuis le cache.
- **Stockage local** — fil : `~/Library/Application Support/Hypervibe/Threads` (par repo, 500 messages max) ; mémoire : `~/Library/Application Support/Hypervibe/Memory` (par chemin de repo).
- **Live agent status** — remonté par les consoles Claude Code et Codex ; alimente Needs you/Idle/Done, les rapports d'équipe, le déclencheur idle des loops et les checks d'objectif ; fallback : détection par silence de sortie.
- **Timeouts et limites** — démarrage console 10 s ; attente sur prompt 15 min ; rapport d'agent 30 min ; confirmation kill/restart 60 s ; handoff : résumé 4 min, trust prompt ~2 min, un seul à la fois ; forward : 24 000 car./réponse, ~72 000/digest, fenêtre 30 min, attente 4 h avant ordre ; push mémoire 3 400 car. ; spawn max 12 ; loops 1 min–24 h, 1–200 runs, 15 min–24 h, idle/output ≤ 1/2 min/console, checks ≤ 2 simultanés et ≥ 90 s d'écart, commande zsh ≤ 5 min.
- **Sécurité** — détection de texte risqué (`rm -rf`, `sudo`, `curl`, `.env`, `--yolo`) avec confirmation ; confirmations à deux niveaux (clics + dialogue macOS) pour kill ; jamais d'exécution dans un shell nu ; l'app ne répond jamais aux prompts de confiance du CLI.
- **Sessions cachées** — Scan/Refresh mémoire et objectif « An agent judges » lancent le CLI dans une session invisible dans le repo.
- **Mapping rôle → CLI** — reviewers/frontend/design/docs → Claude Code ; backend/security → Codex ; testers → Gemini ; CLIs intégrés : Claude, Codex, Gemini, Grok, OpenCode (+ agents personnalisés via Settings › Agents › Your agents).
- **Notifications macOS** — uniquement pour les loops (console en attente, fin de loop), permission demandée à la première loop.


---

# PARTIE 3 — Studios, compte, réglages, données

## Studio Documents (docs/documents)

- **Objet du studio** — demande à l'un des CLIs d'agent installés (Claude, Codex, Gemini, Grok, OpenCode ou agent du catalogue) d'écrire un document sur le dépôt, l'affiche en streaming pendant la rédaction, conserve chaque version et exporte un PDF paginé.
- **Points d'entrée** — rail droit « Generate PDF » (Project overview, Onboarding guide, Architecture, Ask for anything), chip « Docs » dans le fil ouvert, ou ordre vocal/typé `open documents`. Choisir un item ne fait que le sélectionner : rien n'est généré avant d'appuyer sur Generate.
- **Choix du CLI** — l'agent par défaut en premier, puis Claude, Codex, Gemini, Grok, OpenCode, puis tout agent du catalogue ajouté via « + ». Les agents non installés sont grisés.
- **Niveau d'effort (3 valeurs)** — Quick (~400–700 mots), Balanced (défaut ; ~700–1 100 mots), Thorough (~900–1 500 mots).
- **Estimation de durée par effort** — chaque option affiche la médiane des 5 derniers runs terminés avec le CLI sélectionné sur ce Mac, ou « not timed ».
- **Types de documents prédéfinis (9)** — Project overview, Onboarding guide, Architecture, README, API reference, Data model, Security overview, Testing guide, Release notes.
- **Document libre (« Ask for anything »)** — description libre du document attendu.
- **Suivi de génération** — ligne de statut (launching, thinking, writing, finishing) avec nom de l'agent et temps écoulé ; streaming ; « Stop » conserve ce qui est arrivé.
- **Mécanisme d'exécution** — Symvibe lance le CLI dans un terminal invisible, dans le dossier du repo, sous le compte (profil) utilisé pour les nouvelles consoles ; tape un seul prompt, lit la réponse à l'écran, puis ferme la session. Jamais de mode « print », jamais d'API, jamais de flags Yolo.
- **Contrainte du prompt** — l'agent reçoit l'instruction de ne pas exécuter d'outils ni ouvrir de fichiers ; il rédige à partir de ce qu'il voit au démarrage (dossier, notes projet comme CLAUDE.md).
- **Facturation** — chaque run = un vrai tour sur le plan de l'utilisateur chez son fournisseur. N'utilise pas de crédits Symvibe.
- **Blocage sur question du CLI** — si le CLI s'arrête sur une question (confiance du dossier, écran de connexion), le run se termine avec consigne d'ouvrir une console et répondre. Un prompt de mise à jour Codex est ignoré.
- **Langue** — documents rédigés en anglais.
- **Timeouts** — 6 / 12 / 25 minutes selon l'effort, ou 200 s sans aucune sortie.
- **Bibliothèque / versions** — chaque run terminé ou stoppé est sauvegardé comme nouvelle version, par repo, avec date et agent. Un run inachevé est marqué « Incomplete » (Regenerate, Export draft PDF).
- **Stockage des versions** — `~/Library/Application Support/Hypervibe/Documents`, un dossier par repo (nom du dossier + code court dérivé du chemin complet).
- **Suppression** — « Remove from library » définitif.
- **Prévisualisation** — aperçu fluide ou page par page identique au PDF.
- **Export PDF** — US Letter ou A4 ; couverture (titre, agent, repo, date), sommaire si ≥ 3 titres, en-têtes courants, numéros de page, signets ; thème clair.
- **Export Markdown / Copy Markdown**.
- **Images** — placeholders étiquetés.
- **Add to board** — carte avec son propre bouton Export PDF.

## Studio Diagrams (docs/diagrams)

- **Objet** — un CLI décrit un diagramme du repo, Symvibe le dessine sur le board en formes et flèches ordinaires, déplaçables et restylables.
- **Point d'entrée** — outil « Diagrams » du rail gauche.
- **Choix du modèle** — même sélection que Documents.
- **Niveau d'effort** — Quick (~6–10 composants), Balanced (~8–14), Thorough (~10–16).
- **Style** — Ink (défaut, contours dans l'encre du board) ou Colorful (une couleur par couche/groupe) ; revient à Ink à chaque démarrage.
- **Diagrammes prédéfinis (6)** — Architecture, User flow, Data flow, Components, Request lifecycle, State flow ; ou description libre.
- **Carte de progression** — aperçu « dessiné à la main » qui se remplit ; fermeture = stop en conservant les formes reçues.
- **Éléments produits** — boîtes, ellipses, losanges avec étiquettes et notes, flèches étiquetées (verbe court ; réponses sur les branches de décision), zones pointillées pour les groupes (si ≥ 2 sans chevauchement), titre, disposition haut → bas.
- **Nature des formes** — formes libres ; pas d'éditeur de diagramme ; pas de régénération une fois posé.
- **Échec** — carte « Try again » ; conseil de changer de modèle.
- **Formes de départ (sans IA)** — Flow, Steps, Decision branch, Mind map.
- **Export PNG** — clic droit → « Export diagram as PNG », 2×, fond sombre.
- **Export Excalidraw** — « Export as Excalidraw ».
- **Limites d'export** — diagramme tel que généré (modifications ultérieures exclues) ; formes de départ/manuelles non exportables.
- **Mécanisme d'exécution** — identique à Documents (terminal invisible, un prompt, lecture écran, pas de print mode/API/Yolo).

## Studio Code (docs/code)

- **Objet** — explorateur de fichiers + éditeur simple du repo.
- **Points d'entrée** — rail droit « Browse project code », Tools › Code, chip « Code », ordre `open code`.
- **Arborescence : tri** — dossiers d'abord.
- **Arborescence : masquage** — `.git`, `node_modules`, `build`, `dist`, `.next`, `venv`, `target`, `vendor`, `coverage`, `DerivedData`, `Pods` ; la plupart des dotfiles (sauf `.gitignore`, `.env.example`, `.editorconfig`), bundles d'apps, binaires.
- **Menu contextuel dossier** — New file here, New folder here.
- **Menu contextuel fichier/dossier** — Reveal in Finder, Move to Trash (confirmation).
- **Menu « + »** — ajout à la racine ou dans le dossier courant.
- **Fichier ouvert par défaut** — README, sinon le premier fichier.
- **Éditeur** — numéros de ligne, Find, undo ; pas de word-wrap.
- **Coloration syntaxique (25 langages)** — Swift, JavaScript, TypeScript, JSX, TSX, Python, Ruby, Go, Rust, Java, Kotlin, C, C++, Objective-C, C#, PHP, HTML, CSS, SCSS, JSON, YAML, TOML, XML, Markdown, Shell, SQL. Désactivée au-delà de 120 000 caractères.
- **Limites d'affichage** — fichiers > 800 Ko et binaires non affichés.
- **Barre d'information** — chemin, langage, lignes, taille, encodage non-UTF-8 (Windows-1252, BOM), CRLF.
- **Sauvegarde explicite** — bouton Save ; brouillons non sauvegardés récupérés après crash.
- **Fermeture avec modifications** — « Save your code changes? ».
- **Détection de conflit disque** — si le fichier a changé sur disque (ex. agent) : bannière Reload / Keep mine, pas d'écrasement.
- **Préservation encodage/BOM/fins de ligne** — conservés ; « Convert to UTF-8 » si texte non représentable.
- **Sauvegarde hors repo** — (symlink) Allow Saving There / Keep Read-Only, valable jusqu'au quit.
- **Insert (fichier → board)** — carte lecture seule, éditions non sauvegardées incluses.
- **Add folder (dossier → board)** — max 40 fichiers, sans sous-dossiers.
- **Nature des cartes** — instantanés, non mis à jour.

## Studio Markdown (docs/markdown)

- **Objet** — tous les fichiers Markdown du repo en « vault » : lecteur, éditeur autosave, graphe des liens.
- **Points d'entrée** — touche `D`, rail droit « Browse markdown docs », Tools › Markdown, « Open in Studio » sur une carte Markdown.
- **Contenu du vault** — `.md`, `.markdown`, `.mdx` ; mêmes exclusions que Code + dossiers cachés ; max 2 000 fichiers.
- **Agent memory** — en premier : dossier mémoire Claude Code du projet, pour le compte des nouvelles consoles.
- **Recherche de fichiers** — noms et chemins.
- **Menu d'un fichier** — Open, Add to Board, Rename, Duplicate, Reveal in Finder, Move to Trash.
- **Création (« + »)** — à la racine, dans `docs`, ou dans Agent memory.
- **Vue Reading** — rendu ; liens relatifs `.md` ouverts dans le studio.
- **Vue Source** — autosave 1,5 s après arrêt de frappe ; statuts saving / could not save / recovered unsaved edits / found a change on disk.
- **Vue Graph** — toutes les notes et leurs liens.
- **Relecture disque** — toutes les quelques secondes ; reload/keep si édition en cours ; récupération après crash.
- **Sources des liens du graphe** — `[[wiki links]]` (avec `|alias`, `#heading`) et `[texte](fichier.md)` ; notes orphelines affichées.
- **Navigation du graphe** — drag/scroll pan, pinch/molette zoom, `0` fit ; curseur d'espacement.
- **Interaction du graphe** — clic = ouvrir ; wiki-links non cliquables en Reading.
- **Export PDF** — mise en page Documents, images du repo incluses.
- **Add to Board** — carte live, mise à jour à chaque changement.

## Gestionnaire Skills (docs/skills)

- **Objet** — lit les `SKILL.md` chargés par Claude Code (personnels, projet, plugins), les vérifie, édite, crée, exécute.
- **Points d'entrée** — touche `S`, Tools › Skills, chip « Skills ». Onglets Installed / Starters ; filtres Personal, Project, Plugins, Commands.
- **Portée Personal** — `~/.claude/skills/<name>/SKILL.md`, un niveau de sous-dossiers.
- **Portée Project** — `.claude/skills/` du repo.
- **Portée Plugins** — skills et commandes des plugins Claude Code, lecture seule, `/plugin:name`.
- **Portée Commands** — `~/.claude/commands/*.md` et `.claude/commands/`.
- **Limites de lecture** — uniquement la disposition Claude Code ; profils non lus ; max 400 skills.
- **Fiche d'un skill** — portée, invocation (Copy), auto-invocable ou manuel, sous-agent, modèle, estimation tokens, outils autorisés, fichiers adjacents, texte.
- **Détection de masquage** — personal > project, skill > command.
- **Checkup (local, sans IA)** — nom (minuscules/chiffres/tirets, ≤ 64), description manquante ou description+usage > 1 536 car., corps vide ou > 500 lignes, nom ≠ dossier, champs inconnus, champs Claude-Code-only rejetés par claude.ai/API, chevrons dans les valeurs.
- **Edit** — fichier entier ; refus si changé sur disque ; plugins lecture seule.
- **New skill** — nom, description, indice d'argument, portée, corps → `.claude/skills/<name>/SKILL.md`.
- **Import** — dossier contenant `SKILL.md` → personal ou project.
- **Duplicate / Delete** — copie ; Delete → Corbeille.
- **Starters (12)** — `/commit`, `/pr-description`, `/changelog`, `/test-first`, `/bug-hunt`, `/refactor-plan`, `/api-docs`, `/standup`, `/explain`, `/perf-pass`, `/deps-audit`, `/readme-refresh`.
- **Run a skill** — arguments + « Run on » un agent ; tape `/name args` dans la console et soumet.

## Compte et abonnement (docs/subscription)

- **Plan unique Symvibe Pro** — 19 USD/mois ou 190 USD/an.
- **Crédits inclus** — 10 000/mois (planner + voix).
- **Abonnements agents séparés** — Symvibe ne revend pas d'accès modèles.
- **Paiement Paddle** — remboursement 14 jours sur premier achat et renouvellements annuels.
- **Conditions d'accès Pro** — compte avec email vérifié + binaire non altéré (signature) + abonnement actif.
- **Fréquence de vérification** — symvibe.com ~toutes les 4 min + au retour au premier plan ; réponse valable ≤ 15 min ; re-check après réveil/retour réseau.
- **Données envoyées** — jeton + identifiant aléatoire du Mac.
- **Échec temporaire** — rien ne change si une réponse valide est encore valable.
- **Rejet** — accès coupé immédiatement.
- **Expiration (≤ 15 min)** — écran d'accès ; consoles non arrêtées, boards sauvegardés ; voix, dictée, loops, handoffs, confirmations en attente s'arrêtent.
- **Veille** — rien ne change jusqu'au réveil.
- **Version trop ancienne** — mise à jour obligatoire.
- **Écran d'accès** — « Check my access again », « Open my account on the web ».
- **Settings › Account › Subscription** — statut, Manage subscription (portail Paddle), Refresh.
- **Échec de renouvellement** — Pro termine en fin de période ; régularisation via Paddle.
- **Dashboard web** — mêmes fonctions + installeur.
- **Profil : Name** — 1–80 car., côté web.
- **Profil : Email et méthodes de connexion** — gérés sur le web.
- **Profil : Avatar** — initiales (8 couleurs), photo, logo (Dog, Cat, Robot, Alien, Asteroid) ; local, non synchronisé.
- **Sign out** — conserve boards/threads/mémoire/consoles/logins CLI/avatar ; supprime le cache audio ; ne déconnecte jamais les CLIs.

## Crédits (docs/credits)

- **Rôle** — payent le planner et la voix de réponse, seuls services serveur.
- **Quantité** — 10 000/mois d'abonnement.
- **Consomme** — phrases/questions/multi-agents envoyés au planner ; réponses parlées non en cache.
- **Cache partagé serveur** — lignes fixes sans noms ni nombres, sans coût.
- **Désactivation des réponses parlées** — Settings › Voice.
- **Ne consomme jamais** — parseur local ; STT, dictée, lignes en cache ; tout ce que font les agents ; Documents, Diagrams, scans mémoire, objectifs de loops ; usage/tokens.
- **Solde** — Settings › Voice › Intelligence : restants, renouvellement, commandes du jour et part locale.
- **Épuisement : planner** — s'arrête jusqu'au renouvellement ; explication une fois par session.
- **Épuisement : ordres simples** — continuent via parseur local (règles de routage dégradé).
- **Épuisement : voix** — seules lignes en cache.
- **Aucune facturation supplémentaire**.
- **Clés API personnelles** — non acceptées (ni Groq ni Cerebras).

## Profils de compte (docs/profiles)

- **Définition** — connexion supplémentaire Claude Code ou Codex dans son propre dossier de config ; compte pro et perso simultanés.
- **Accès** — pastille d'usage → icône personne / « Manage accounts ».
- **Mécanisme** — Claude Code via `CLAUDE_CONFIG_DIR`, Codex via `CODEX_HOME`.
- **Stockage** — `~/Library/Application Support/Hypervibe/Profiles`, lisible par l'utilisateur seul.
- **Save your current sign-in** — copie `.credentials.json`, `settings.json`, `CLAUDE.md`, `~/.claude.json` (Claude) ; `auth.json`, `config.toml` (Codex). Sessions/historique non copiés.
- **Connect a new account** — profil vide + console de login.
- **Use** — compte des nouvelles consoles, Documents, Diagrams, scans mémoire.
- **Changer le compte d'une console** — badge → ACCOUNT ; relance ; initiales du profil.
- **Conversations par profil** — resume restaure la bonne conversation.
- **Usage par compte** — chip par compte.
- **Limite Keychain** — Claude Code peut garder son login dans le Trousseau ; vérifier `/status`.
- **Remove** — confirmation ; fichiers de connexion supprimés ; reste → Corbeille.
- **Conditions fournisseurs** — pas de pooling/rotation.

## Usage et tokens (docs/usage)

- **Deux vues** — pastille d'usage (chiffres du CLI) ; « Tokens » (logs locaux par jour et par agent).
- **Pastille d'usage** — jauge, logo CLI, heure de reset ; clic = détails.
- **CLIs supportés** — Claude Code, Codex, Gemini, Kimi, Amp, Copilot, OpenCode. Grok non.
- **Barres** — % utilisé et reset ; ambre ≥ 75 %, rouge ≥ 90 %.
- **Statistiques enrichies** — heatmap et faits (Claude Code : modèle favori, total tokens, sessions, streaks ; Codex : tokens cumulés, pic, streak, tâche la plus longue).
- **Vue terminal** — parsée ↔ écran brut.
- **Mécanisme du check** — terminal invisible éphémère dans un dossier vide dédié, commande d'usage, lecture écran, fermeture ; aucun prompt au modèle.
- **Commandes tapées** — Claude `/usage` ; Codex `/status` puis `/usage` ; Gemini `/stats` ; Kimi, Copilot `/usage` ; Amp `amp usage` ; OpenCode `opencode stats`.
- **Déclenchement** — ouverture du board si > 3 min ; popover si > 30 s ; « Ask again ».
- **Gestion des prompts du CLI** — check de fond ne répond jamais ; check utilisateur peut sauter l'update ou accorder la confiance au dossier vide.
- **Profils** — chips ; « Use for new lanes ».
- **Carillon de reset** — Settings › General ; Only after 100 % / Always ; Glass, Ping, Tink, Pop, Purr, Submarine ; joue même en arrière-plan.
- **Tokens : sources** — `~/.claude/projects`, `~/.codex/sessions`, base locale OpenCode ; Gemini/Grok/profils non couverts.
- **Tokens : affichage** — 30 derniers jours, jour le plus chargé, agent principal ; graphique par jour/agent (all / input+output / output) ; liste par agent.
- **Avertissement** — pas une facture.

## Raccourcis clavier (docs/shortcuts)

| Contexte | Touches | Action |
|---|---|---|
| Partout | ⌘ O | Open Folder (ajouter un repo) |
| Partout | ⌘ , | Settings |
| Partout | ⌘ Shift L | Retour à l'accueil |
| Partout | ⌘ Shift W | Fermer le repo courant |
| Partout | ⌘ Q | Quitter |
| Accueil | ↑ ↓ / Return / Delete / Esc | Naviguer / Ouvrir / Retirer / Fermer la bibliothèque |
| Board | Space (maintenu) | Parler à la barre de commande |
| Board | ⌘ K | Curseur dans la barre de commande |
| Board | ⌘ Z / ⌘ Shift Z | Annuler / Rétablir |
| Board | ⌘ C / ⌘ X / ⌘ V / ⌘ D / ⌘ A | Copier / Couper / Coller / Dupliquer / Tout sélectionner |
| Board | ⌘ G / ⌘ Shift G | Grouper / Dégrouper |
| Board | ⌘ = / ⌘ - / ⌘ 0 / Shift 1 | Zoom + / − / 100 % / Tout voir |
| Board | Flèches (+Shift) | Déplacer 1 pt (10 pt) |
| Board | Delete | Supprimer |
| Board | Esc | Annuler voix → fermer panneau → vider sélection → Select |
| Outils 1 touche | V T P E G M S L D X N | Select, Spawn agent, Pen, Eraser, Git, Memory, Skills, Loops, Markdown, Mission Map (fixe), console « needs you » |
| Pointeur | Scroll / Shift+molette / pinch / ⌘+scroll / middle-drag | Pan / pan latéral / zoom / zoom / pan |
| Pointeur | Double-clic nœud | Cadrer (+ clavier sur console ; édition sur texte) |
| Pointeur | Shift + drag extrémité ligne | Angle par pas de 15° |
| Console | ⌘ C / ⌘ V / ⌘ A / ⌘ K | Copier / Coller / Tout / Effacer |
| Console | ⌘ ← → / ⌘ Delete / Option ← → / Option Delete / Shift Tab | Ligne / mot / back-tab |
| Barre de commande | Return / Esc / ↑ ↓ / @ / Tab | Envoyer / quitter / historique 50 / Direct to / accepter mention |
| Voix | Space / Esc / Fn (ou Right ⌘, Right Option) | Ordre / annuler / dictée |
| Graphe Markdown | Flèches / + − / 0 | Pan / zoom / fit |

- **Personnalisation** — toutes les touches 1 lettre sauf X modifiables dans Settings › Shortcuts (Esc garde, Delete restaure).
- **Priorité console** — une seule console sélectionnée → les touches vont à la console.

## Réglages (docs/settings)

Ouverture : ⌘ , ou engrenage / avatar / Tools. Huit volets.

| Volet | Réglage | Description | Défaut |
|---|---|---|---|
| Account | Name | 1–80 car., compte web | Nom web |
| Account | Email | Affiché | — |
| Account | Sign-in methods | Manage on the web | — |
| Account | Avatar | Initiales / photo / logo ; local | Initiales |
| Account | Subscription | Statut, Manage, Refresh | — |
| Account | Sign out | Conserve le local | — |
| General | Reopen last repo on launch | | On |
| General | Resume agent chats | Claude, Codex, Gemini, OpenCode | On |
| General | Chime when usage resets | | On |
| General | Play | Only after 100 % / Always | Only after 100 % |
| General | Sound | Glass, Ping, Tink, Pop, Purr, Submarine | Glass |
| Appearance | Theme | OG (sombre), Light, Match macOS | OG |
| Appearance | Text size | 85–200 % ; override par console | 100 % |
| Shortcuts | Touches 1 lettre | | V T P E G M S L D X N |
| Agents | Default agent | | Premier installé |
| Agents | Yolo: skip permission prompts | | Off |
| Agents | Report status from the agent itself | Hooks Claude/Codex | Off |
| Agents | Default shell | | Shell de login |
| Agents | Use Option as Meta key | | Off |
| Agents | Agent executables | Chemins claude/codex/gemini/grok/opencode | PATH |
| Agents | Your agents | Add an agent | — |
| Agents & CLI | Teach my agents to use Symvibe | Installe le skill symvibe (agent teams) | Off |
| Connections | GitHub | via `gh` ; Connect = console `gh auth login` ; Disconnect global | Non connecté |
| Voice | Input device | | Automatic |
| Voice | Test your microphone | Vumètre | — |
| Voice | Speech language | Auto ou 25 langues | Automatic |
| Voice | Recognition | État du modèle, Retry | — |
| Voice | Hold Space to talk | | On |
| Voice | Hold to dictate | Fn/Globe, Right ⌘, Right Option | Fn |
| Voice | Confirm commands out loud | + voix + Test | On |
| Voice | Cached audio | 100 Mo / 30 j ; Clear | — |
| Voice | Intelligence | Crédits restants, renouvellement | — |
| About | Version / Check for updates | Release notes ; « Restart to update » | — |

## Données et confidentialité (docs/privacy)

- **Reste sur le Mac** — repos/code, audio micro, boards, threads, mémoire, documents, loops, réglages, cache vocal, profils, usage/tokens.
- **Pas d'analytics ni de télémétrie**.
- **Sort du Mac** — sign-in → Firebase Auth ; jeton + version → serveurs Symvibe (crédits) ; jeton + id Mac → symvibe.com (abonnement) ; version → check update ~1×/h ; ordre + fil récent + snapshot board → planner → Groq `gpt-oss-120b` ; ligne parlée ≤ 500 car. → Inworld ; paiement → Paddle ; modèle STT ← Hugging Face.
- **Trafic des CLIs** — appartient aux CLIs.
- **Contenu du snapshot du board** — noms/types/rôles des consoles, ordre en cours, activité (outil ou ≤ 80 car. de question), groupes, agents custom, cartes orchestrateur, ordres récents, repo/workspace, compteurs, sélection, zoom, loops, ≤ 60 chemins Markdown, derniers messages du fil. Jamais de contenu de fichier ni d'audio.
- **Emplacements** — `~/Library/Application Support/Hypervibe` (boards + Archive, Threads, Memory, Documents, Profiles, Screenshots, cache vocal, réglages, journal d'activité, `Diagnostics/hitches.log`) ; `~/.hypervibe` (hook) ; `~/.claude/settings.json`, `~/.codex/hooks.json` (hooks) ; le repo (studios, `outputs/`, `.claude/skills`, git) ; `~/.claude/skills`, `~/.claude/commands` ; `~/.claude/skills/symvibe`, `~/.agents/skills/symvibe` ; `~/symvibe` et `~/symvibe/worktrees` (branches `symvibe/`) ; `~/Library/Application Support/FluidAudio` (modèle STT) ; backups `.hypervibe-backup`.
- **Suppression des données locales** — procédure documentée (désactiver live status, supprimer les dossiers, Keychain, WebKit, HTTPStorages) ; serveur : hello@symvibe.com.

## Installation (docs/install)

- **Prérequis** — Apple Silicon (M1+), macOS 14+ ; pas Intel/Windows/Linux ; hors App Store.
- **Compte** — Google ou email vérifié + Pro actif.
- **CLIs** — au moins un installé et connecté ; aucune clé API.
- **Réseau** — check d'abonnement ; grâce 15 min.
- **Micro** — optionnel.
- **Résolution du PATH** — login shell + Homebrew, `~/.local/bin`, npm, pnpm, bun, cargo, Volta, asdf, mise ; chemins surchargeables.
- **Étapes** — plan (Paddle) → dashboard (installeur, version, taille, SHA-256) → DMG signé/notarisé → « Sign in on the web ».
- **Mises à jour** — check au lancement puis ~1×/h ; téléchargement en arrière-plan ; signature vérifiée ; jamais de redémarrage forcé ; pastille « Update ready » ; installation au quit.
- **Désinstallation** — désactiver live status → Corbeille → nettoyage optionnel des dossiers listés.

## Premier lancement (docs/first-launch)

- **Séquence** — sign-in web (requête à usage unique, 5 min) → vérification email → check Pro → setup 3 étapes.
- **Écrans d'état** — Checking your Pro access ; Your workspace starts with Pro ; Let's check your access ; This copy of Symvibe was modified (signature).
- **Étape 1 : premier repo** — Open a folder / Clone (https, ssh, git) / Create new repo (branche `main`) → `~/symvibe/<name>` ; « Continue without a repo ».
- **Étape 2 : agent** — détectés d'abord, puis catalogue 34 ; devient agent par défaut ; « Start with » 1–4 agents (2 par défaut) ; case Yolo.
- **Étape 3 : agent teams** — « Teach my agents to use Symvibe » (skill symvibe ; agents peuvent lancer/piloter/arrêter des agents) ; notifications macOS.
- **Start** — board avec agents côte à côte, vierges.
- **Carte « Your first order »** — deux exemples cliquables.
- **Apparence** — OG par défaut ; Light ; Match macOS.
- **Micro** — permission à l'apparition du premier board.

## Quickstart (docs/quickstart)

- Ouvrir un board (clic ou Dispatch) ; outils à gauche, insertions à droite, barre de commande en bas, statut en haut à droite.
- Lancer des agents : T + clic, New console, clic droit, `spawn 3 claude`, composer Spawn 4.
- Donner du travail : console directe, `@Otto …` dans la barre (⌘ K), ou Space.
- Conseil worktrees : un worktree git par agent écrivain.
- N = console « needs you », X = Mission Map.
- Quitter termine les processus ; resume au retour.

## Détails techniques repérés (studios, compte, données)

- **Plateforme** — app native macOS Apple Silicon, macOS 14+, signée/notarisée, DMG hors App Store, auto-vérification de l'intégrité du binaire, bundle id `com.hypervibe.app`.
- **Authentification** — Firebase Authentication (Google / email) ; flux web avec requête à usage unique (5 min) ; email vérifié obligatoire ; renouvellement de session via symvibe.com en fallback (1.1.4).
- **Licence / entitlement** — check ~4 min + foreground + réveil ; réponse signée valable ≤ 15 min ; jeton + id aléatoire machine ; dégradation hors ligne sans tuer les consoles ; obsolescence forcée de version.
- **Paiement** — Paddle (checkout, portail) ; 19 $/mois, 190 $/an ; essai 7 j ; remboursement 14 j.
- **Crédits** — 10 000/mois, planner + TTS ; pas de dépassement ; pas de BYOK.
- **Services hébergés** — planner → Groq `gpt-oss-120b` ; TTS → Inworld (≤ 500 car./ligne, cache 100 Mo/30 j) ; check update horaire ; modèle STT ← Hugging Face.
- **Local-first** — STT on-device (`~/Library/Application Support/FluidAudio`, 25 langues) ; parseur local ; zéro télémétrie ; données dans `~/Library/Application Support/Hypervibe`.
- **Intégration CLIs** — binaires du PATH, résolution étendue, catalogue 34, aucune clé API.
- **Pattern « terminal invisible »** — Documents, Diagrams, scans mémoire, checks d'usage, juge de loop : PTY caché, un prompt/commande, scraping écran, fermeture ; pas de print mode/API/Yolo ; gestion des prompts bloquants.
- **Multi-comptes** — isolation par `CLAUDE_CONFIG_DIR` / `CODEX_HOME` ; copie des fichiers d'identité ; limite Keychain.
- **Live status** — hooks Claude/Codex + script `~/.hypervibe` + backups.
- **Skill symvibe / agent teams** — `~/.claude/skills/symvibe`, `~/.agents/skills/symvibe`.
- **GitHub** — `gh` CLI (auth en console, jeton dans le keyring gh).
- **Usage/tokens** — commandes natives (`/usage`, `/status`, `/stats`, `amp usage`, `opencode stats`) + parsing de logs locaux ; seuils 75/90 % ; carillon.
- **Permissions macOS** — micro, notifications, touche Globe.
- **Limites chiffrées** — Documents 400–1 500 mots, 6/12/25 min, 200 s ; Diagrams 6–16 composants, PNG 2× ; Code 800 Ko / 120 000 car. / 40 fichiers ; Markdown 2 000 fichiers / 1,5 s ; Skills 400 / 64 car. / 1 536 car. / 500 lignes ; snapshot ≤ 80 car. question, ≤ 60 chemins ; historique 50 ; TTS ≤ 500 car.
- **Lacune du scrape** — blocs `<code>`/`<pre>` non capturés (commandes d'installation des CLIs, `shasum`).


---

# PARTIE 4 — Positionnement, marketing, changelog, contraintes

## Positionnement & modèle économique

**Produit** — Symvibe (ex-Hypervibe, renommé en 1.0.42 le 15 oct. 2026 ; identifiants internes et dossier de données conservent le nom Hypervibe). Application native macOS, « command post » pour une flotte d'agents de code en CLI.

**Promesse** — « Don't let a screen decide how many agents you run. Put them on a board. » Un board visuel de *vrais* terminaux (PTY) exécutant Claude Code, Codex, Gemini CLI et 30+ autres CLIs, sur les abonnements que l'utilisateur possède déjà. Tout ce qu'un multiplexeur ne fait pas est ajouté *autour* du terminal : statut en direct, resume au relancement, handoffs entre agents, équipes, loops, voix, planification à côté du travail.

**Cible** — Développeurs qui font tourner ≥ 3 agents de code en parallèle, tous les jours, souvent avec plusieurs CLIs de vendeurs différents, et/ou plusieurs comptes d'un même CLI (seat Team pro + plan Max perso, consultants facturant par client). Le site reconnaît explicitement que tmux/onglets suffisent pour « deux agents, de temps en temps ».

**Ce que Symvibe n'est pas** — ne fournit aucun accès aux modèles ; ne proxy ni ne facture l'usage des agents ; n'augmente pas les limites des plans ; pas de pool/rotation de comptes ; pas de remote/SSH ; pas scriptable à la tmux (pas de format texte de layout versionnable).

**Prix & plans (un seul plan : Symvibe Pro)**
- USD 19 / mois, ou USD 190 / an (≈ 15,83 $/mois). Taxes au checkout (Paddle).
- Une personne par abonnement ; pas de partage d'équipe.
- Essai gratuit 7 jours sur les deux plans (annuel depuis 1.0.49), une fois par personne ; annuler ≥ 30 min avant la fin.
- Remboursement intégral dans les 14 jours du premier paiement mensuel ou de tout paiement annuel ; renouvellements mensuels non remboursables.
- Annulation à tout moment ; états de plan affichés dans l'app (renewing, canceled, grace period, refunded) ; « Renew Pro ».
- Inclus : app + mises à jour ; 34 CLIs ; teams, handoffs, loops, mission map ; studios ; dictée illimitée on-device ; **10 000 crédits/mois** (planner + voix), non reportables, pas de dépassement facturé.
- Distribution : DMG signé/notarisé depuis le dashboard (pas de Mac App Store « parce que de vrais terminaux doivent spawner de vrais processus »), SHA-256 affiché.
- Compte : Google ou email + mot de passe (≥ 12 car.), magic link (noreply@symvibe.com) ; mode test sur le dashboard.
- Support : hello@symvibe.com, Discord (tenu par les développeurs), bouton « Found a bug? », portail de facturation.

## Fonctionnalités mises en avant (marketing)

### Board
- **Vrais terminaux** — CLI non modifié dans un vrai PTY avec controlling terminal : Ctrl-C, job control, vim, htop, tmux, TUIs plein écran.
- **Board visuel pan & zoom** — agents placés comme nœuds, « un board garde chaque agent où vous l'avez laissé ».
- **Workspaces commutés comme des onglets**.
- **Presets en un tap** — ex. « Four Squads » = 16 agents.
- **Repo → board** — un dossier devient un board ; gestion iCloud Drive (1.0.2).
- **Live web tiles** — aperçu localhost + Web Inspector docké ; « Retry now » ; un agent peut ouvrir localhost dans un navigateur câblé à lui (1.1.0).
- **Kanban** — colonnes réordonnables par drag (1.0.4).
- **Sticky notes, texte, checklists, calendrier**.
- **Ink / dessin**, **Markup d'images**, **Shapes**, **Fichiers sur le board**.
- **Git sur le board** — carte branches + panneau GitHub ; worktrees, diff par agent, merge après vérification de conflits, ouverture de pull request GitHub (1.1.0).
- **Worktree par agent** — option « New worktree » au spawn : dossier + branche ; copie de fichiers gitignorés (.env) et commande de setup (1.1.0).
- **Sauvegarde continue** — JSON versionné sur disque.
- **Interface** — thème clair/sombre, sons, décorations de fête (désactivables) (1.1.2), « What's New » après mise à jour.

### Agents & consoles
- **34 CLIs supportés** ; **agents custom** ; chemin d'exécutable configurable.
- **Aucune clé API** — CLIs interactifs déjà connectés.
- **Spawn de consoles** par voix ou clavier ; démarrage séquentiel depuis un board vide (1.1.2).
- **Live agent status** — working / ready / needs you via hooks Claude Code et Codex.
- **Resume des sessions au relancement** — Claude Code, Codex, Gemini, OpenCode.
- **Console UPDATED** — Codex mis à jour → restart + reprise (1.0.47).
- **Pause / resume / restart** de console.
- **Messages clairs quand un CLI demande une connexion** (1.0.44) ; **stabilité en veille** (1.0.44).

### Voix
- **Voice orders (push-to-talk)** — langage naturel, transcription on-device, planner avec snapshot du board.
- **Réponses parlées** — voix naturelle.
- **Dictée** — Fn / Right ⌘ / Right Option, illimitée, on-device.
- **Test your microphone** (1.1.2).
- **Confirmation obligatoire** pour kill / étapes non demandées (1.0.47).

### Orchestration
- **Command bar / orchestrator** — @-mentions ; plusieurs agents nommés (1.0.45) ; réponses dans la langue de l'utilisateur (1.0.44) ; une réponse par ordre (1.1.0) ; carte de premiers ordres (1.1.2).
- **Orb animé** — listening / thinking / speaking / working / waiting / done (1.0.46).
- **Orchestrator cards**.
- **Délégation** — tâches lecture/rapport et questions sur le code (1.0.47).
- **Rapport de retour** — « See output », transfert.
- **Fallback sans planner** (1.1.1).
- **Mission map**, **Teams / groups avec rôles**, **Composer 12 consoles**.
- **Agent teams (agent → agents)** — un agent démarre/pilote/arrête d'autres agents ; Claude Code, Codex, Gemini, OpenCode (1.1.0).
- **Handoffs avec état**, **Forwards**, **Loops** avec objectif, **Project memory**, **Skills**.

### Studios
- **Document studio** (streaming, PDF paginé, efforts) ; **Diagram studio** (formes libres, PNG/.excalidraw) ; **Code studio** ; **Markdown studio** (vault Obsidian-like, graphe force-directed).

### Continuité, comptes, usage
- **Quitter sans rien perdre** ; **Account profiles** (CLAUDE_CONFIG_DIR / CODEX_HOME) ; **Usage pill par CLI** ; **Token analytics** ; **Checks d'accès robustes** (1.1.3, 1.1.4) ; **Premier lancement 3 étapes** (1.1.2).

### Communauté
- **Discord** — layouts, teams, loops, roadmap.

## Historique des versions (changelog)

| Version | Build | Date | Nouveautés principales |
|---|---|---|---|
| 1.0.0 | 12 | 1 oct. 2026 | Sortie « Hypervibe 1.0.0 » : board visuel, vrais terminaux, orchestrateur + voix, layout conservé, sign-in Google/email. |
| 1.0.1 | 15 | 5 oct. 2026 | Launcher et setup projet, personnalisation de profil, installation, stabilité. |
| 1.0.2 | 16 | 10 oct. 2026 | Fixes orchestrateur, voix/dictée, panneau GitHub ; iCloud Drive ; confirmation de redémarrage ; perf. |
| 1.0.3 | 17 | 12 oct. 2026 | Fixes drag/fenêtre ; confirmation de quit ; fermeture annulée garde le board. |
| 1.0.4 | 18 | 13 oct. 2026 | Fix crash sign-in ; colonnes Kanban réordonnables. |
| 1.0.41 | 19 | 13 oct. 2026 | Sign-in navigateur plus fiable. |
| 1.0.42 | 20 | 15 oct. 2026 | **Hypervibe → Symvibe** ; migration transparente. |
| 1.0.43 | 21 | 19 oct. 2026 | Fiabilité, perf. |
| 1.0.44 | 23 | 19 oct. 2026 | Orchestrateur multilingue ; messages sign-in CLI ; veille. |
| 1.0.45 | 26 | 21 oct. 2026 | Tâches vers agents existants (PT/ES/EN) ; plusieurs agents nommés. |
| 1.0.46 | 28 | 22 oct. 2026 | Orb animé ; retry de vérification Pro. |
| 1.0.47 | 33 | 27 oct. 2026 | Rapports Codex ; délégation lecture/rapport ; explication des confirmations ; pastille UPDATED. |
| 1.0.48 | 34 | 12 nov. 2026 | Essai 7 jours in-app ; états de plan ; Renew Pro. |
| 1.0.49 | 35 | 12 nov. 2026 | Essai 7 jours sur l'annuel. |
| 1.1.0 | 36 | 12 nov. 2026 | **Agent teams** ; navigateur câblé par agent ; **worktree par agent** ; Git : worktrees, diff, merge, PR ; une réponse par ordre ; What's New. |
| 1.1.1 | 37 | 14 nov. 2026 | Ordres longs multi-agents ; spawn sans planner. |
| 1.1.2 | 38 | 20 nov. 2026 | Premier lancement 3 étapes ; premiers ordres ; Test micro ; boot séquentiel ; décorations. |
| 1.1.3 | 39 | 20 nov. 2026 | Écran d'accès détaillé (short code, Copy details) ; tolérance horloge. |
| 1.1.4 | 40 | 20 nov. 2026 | Renouvellement de session via symvibe.com si Google bloqué ; short code envoyé au serveur. |

## Prérequis & contraintes techniques

**Matériel / OS** — Apple Silicon (M1+), macOS 14+ ; DMG signé/notarisé ; `shasum -a 256`.

**Dépendances** — ≥ 1 CLI installé et connecté sur le PATH. Plans acceptés : Claude Code → Pro/Max/Team/Enterprise/Console (`~/.claude`, `CLAUDE_CONFIG_DIR`) ; Codex → ChatGPT Plus/Pro/Business/Edu/Enterprise ou clé API (`~/.codex`, `CODEX_HOME`) ; Gemini CLI → Code Assist Standard/Enterprise, clé payante ou Vertex (depuis le 18 juin 2026, comptes Google perso redirigés vers Antigravity CLI). Micro optionnel. Internet (grâce 15 min). Compte Google/email vérifié. Git : SSH agent / credential helper ; `gh` pour publication.

**Limites connues** — quitter tue les consoles (pas de survie façon tmux) ; resume limité à 4 CLIs ; live status Claude/Codex seulement ; jamais de réponse automatique aux prompts de trust/sign-in ; 12 agents max par ordre/composer ; attente prompt 15 min ; > 600 car. sans planner refusé ; Space/Fn conflits de focus/Globe ; Keychain non isolé pour les profils ; usage selon ce que le CLI expose ; studios limités en temps ; GitHub 100 Mo/fichier ; pas de remote/SSH, pas de layout scriptable ; une licence = une personne.

**Erreurs documentées (troubleshooting)** — « not found on PATH » ; pas de NEEDS YOU/READY ; console bloquée sur trust/sign-in ; pas d'offre de resume ; Space inactif ; Fn ouvre l'emoji picker ; ordre non reçu (shell nu, prompt, pause, carte non câblée) ; « The planner didn't answer » / « Without the planner I can't write or split that order » ; « Let's check your access » ; update en attente ; studio stoppé ; web tile en attente ; push échoué ; freeze → `Diagnostics/hitches.log`.

## Détails techniques repérés (marketing & guides)

- **PTY avec controlling TTY**, aucun wrapper ; tmux possible dans une console (pattern board local + tmux SSH).
- **Hors App Store** à cause du sandbox (spawn de processus).
- **Local-first JSON versionné** ; `Diagnostics/hitches.log`.
- **Flux réseau** — uniquement sign-in, planner (ordre + fil + snapshot), TTS, short code d'échec ; jamais code/audio/repos/credentials.
- **STT on-device illimité ; TTS et planner serveur en crédits** (Groq/Cerebras non substituables par clés perso).
- **Sign-in web + magic link + fallback symvibe.com ; tolérance horloge ; grâce 15 min ; mode test dashboard.**
- **Paddle** ; **updates signées** installées au redémarrage/quit.
- **Hooks** Claude Code / Codex (Trust) ; autres CLIs par activité de sortie.
- **Resume natif** — Claude Code `--resume`, `--continue`, `-n`, `/rename`, `/branch`, `--fork-session`, `--worktree` (`.claude/worktrees/`, `.worktreeinclude`) ; transcripts `~/.claude/projects/`.
- **Worktrees** — un par agent écrivain ; copie de fichiers ignorés + setup ; diff/merge/PR via `gh`.
- **Handoff** — équivalent manuel HANDOFF.md + git diff.
- **Fichiers d'instructions** — CLAUDE.md, AGENTS.md (Codex), GEMINI.md.
- **Agent teams (1.1.0)** — agent → agents du board.
- **Documentation écrite pour 1.0.46 ; release courante 1.1.4** ; recherche docs `/`.


---

# PARTIE 5 — Grille de sélection pour le DAT

Objectif : permettre de cocher les fonctionnalités à reprendre dans la nouvelle application, en voyant d'un coup d'œil **le mécanisme technique sous-jacent**, **les dépendances**, **la complexité estimée** et **la transposabilité** hors macOS (si la cible n'est pas une app Mac native).

Légende complexité : ● faible · ●● moyenne · ●●● élevée. Transposabilité : ✅ portable · ⚠️ adaptation nécessaire · ❌ spécifique macOS/Apple.

## 5.1 Cœur : terminaux et agents

| ✔ | Fonctionnalité | Mécanisme Symvibe | Dépendances | Cplx | Transp. |
|---|---|---|---|---|---|
| ☐ | Console = vrai PTY exécutant un CLI non modifié | pseudo-terminal avec controlling TTY, `TERM=xterm-256color`, scrollback 10 k lignes, bracketed-paste, souris | émulateur de terminal (xterm.js, libvterm…), gestion de processus | ●● | ✅ |
| ☐ | Catalogue d'agents (nom, commande, flag yolo, capacités) | table statique 34 entrées + `custom-agents.json` | — | ● | ✅ |
| ☐ | Découverte des binaires | PATH du login shell + Homebrew, `~/.local/bin`, npm, pnpm, bun, cargo, Volta, asdf, mise | — | ● | ⚠️ (chemins par OS) |
| ☐ | Agents personnalisés (exécutable + args) | split sur espaces, pas de parsing de guillemets | — | ● | ✅ |
| ☐ | Mode Yolo (flag skip-permissions par CLI) | injection de flag au lancement ; badge ; jamais pour custom/studios | catalogue | ● | ✅ |
| ☐ | Nommage court des consoles + adressage `@Nom` | 16 prénoms, numérotation, unicité 23 car. | — | ● | ✅ |
| ☐ | Statuts STARTING/WORKING/RUNNING/NEEDS YOU/READY/PAUSED/DONE/ERROR | activité de sortie + hooks CLI | live status | ●● | ✅ |
| ☐ | Live agent status par hooks natifs | entrées dans `~/.claude/settings.json` / `~/.codex/hooks.json`, script → socket Unix local, backups | hooks des CLIs | ●● | ⚠️ (dépend des CLIs) |
| ☐ | Détection de prompts de permission/question à l'écran | screen-scraping du PTY | — | ●● | ✅ |
| ☐ | Resume natif des conversations | `claude --resume <id>`, `codex resume <id>`, `gemini --resume latest`, `opencode --continue` ; détection d'échec < 8 s | — | ●● | ✅ |
| ☐ | Arrêt propre + watchdog anti-orphelins | signal quit → kill ; watchdog séparé survivant au crash | — | ●● | ⚠️ |
| ☐ | Visualiseur de sortie (réponse complète, Copy, Save .md, Reply) | lecture des transcripts natifs Claude/Codex, sinon écran | formats de transcript | ●● | ✅ |
| ☐ | Profils multi-comptes par CLI | `CLAUDE_CONFIG_DIR` / `CODEX_HOME`, copie des fichiers d'identité | — | ●● | ⚠️ (Keychain) |
| ☐ | Pastille d'usage par CLI | terminal invisible éphémère → `/usage`, `/status`, `/stats`… → parsing écran | — | ●● | ✅ |
| ☐ | Analyse de tokens par jour/agent | parsing de `~/.claude/projects`, `~/.codex/sessions`, DB OpenCode | formats de logs | ●● | ✅ |
| ☐ | Worktree git par agent | `git worktree` + branche `symvibe/`, copie des fichiers ignorés, commande de setup | git | ●● | ✅ |

## 5.2 Orchestration

| ✔ | Fonctionnalité | Mécanisme Symvibe | Dépendances | Cplx | Transp. |
|---|---|---|---|---|---|
| ☐ | Barre de commande globale + fil persistant | injection texte dans PTY (collage + Return différé) ; thread 500 msg/repo | consoles | ●● | ✅ |
| ☐ | @mentions (console, groupe, everyone) avec désambiguïsation | menu @, matching phonétique, « Did you mean » | — | ● | ✅ |
| ☐ | Parseur local d'ordres simples (sans LLM) | grammaire spawn/pause/kill/open/workspace/git/caméra ; 6 langues | — | ●● | ✅ |
| ☐ | Planner LLM (phrase → plan par agent) | service hébergé → Groq `gpt-oss-120b` ; entrée = ordre + fil récent + snapshot structuré du board | LLM, crédits | ●●● | ✅ (choix du LLM libre) |
| ☐ | Snapshot structuré du board pour le LLM | noms/rôles/statuts/groupes/ordres récents/≤ 60 chemins md ; jamais de contenu de fichier | — | ●● | ✅ |
| ☐ | Mode dégradé sans planner | fallback parseur local ; refus > 600 car. ; backoff 1 min après 2 échecs | — | ● | ✅ |
| ☐ | Règles de confirmation (kill/restart, texte risqué `rm -rf`/`sudo`/`.env`…) | regex + attente « confirm » 60 s + dialogue OS | — | ● | ✅ |
| ☐ | Jamais d'injection dans un shell nu | détection agent vs shell | — | ● | ✅ |
| ☐ | Groupes avec rôles et teinte ; rôle → CLI par défaut | ⌘G, halo drag-drop ; mapping reviewers→Claude, backend→Codex, testers→Gemini | — | ● | ✅ |
| ☐ | Composer multi-slots (≤ 12) | UI | — | ● | ✅ |
| ☐ | Cartes orchestrateur à portée restreinte | câblage carte ↔ consoles | — | ●● | ✅ |
| ☐ | Mission Map (chaîne de commandement, filtres, inspecteurs) | vue dérivée de l'état | statuts | ●● | ✅ |
| ☐ | Rapports d'agent dans le fil (fin/échec/durée, 4 000 car.) | live status ou silence de sortie ; timeout 30 min | — | ●● | ✅ |
| ☐ | Handoff avec résumé (source → console neuve) | prompt de résumé dans la source (≤ 4 min) → brief tapé dans la destination | — | ●● | ✅ |
| ☐ | Forward des résultats (pipeline) | digest ≤ 72 k car., fenêtres 30 min / 4 h | — | ●● | ✅ |
| ☐ | Loops (schedule / idle / output contains) + conditions d'arrêt + objectif (commande zsh ou juge LLM) | planificateur local, sessions cachées, notifications OS | live status pour « idle » | ●●● | ✅ |
| ☐ | Mémoire projet (faits typés, scan par CLI, push câblé ≤ 3 400 car.) | fichiers locaux par repo ; session cachée pour le scan | — | ●● | ✅ |
| ☐ | Agent teams (un agent pilote d'autres agents) | skill `symvibe` installé dans `~/.claude/skills` / `~/.agents/skills` exposant des commandes de pilotage du board | skills des CLIs | ●●● | ✅ |
| ☐ | Pause/Resume/Kill all avec double confirmation | signaux de processus | — | ● | ✅ |

## 5.3 Voix

| ✔ | Fonctionnalité | Mécanisme Symvibe | Dépendances | Cplx | Transp. |
|---|---|---|---|---|---|
| ☐ | Push-to-talk (Espace) vers la barre de commande | STT on-device Parakeet v3 (FluidAudio), 25 langues, 60 s max, filtre d'hallucinations | modèle STT local | ●●● | ⚠️ (runtime STT par OS) |
| ☐ | Dictée dans n'importe quel champ (Fn / Right ⌘ / Right Option) | même STT ; cible = focus → console unique → barre ; 5 min max | STT | ●● | ⚠️ |
| ☐ | Réponses parlées courtes | TTS hébergé (Inworld), ≤ 500 car., cache local 100 Mo / 30 j, cache partagé serveur | TTS, crédits | ●● | ✅ |
| ☐ | Orb d'état (listening/thinking/speaking/working/waiting/done) | UI | — | ● | ✅ |
| ☐ | Test micro, choix de périphérique, langue épinglée | OS audio | — | ● | ✅ |

## 5.4 Board / canvas

| ✔ | Fonctionnalité | Mécanisme Symvibe | Dépendances | Cplx | Transp. |
|---|---|---|---|---|---|
| ☐ | Canvas infini pan/zoom (24 000², 20–300 %) | moteur de canvas | — | ●● | ✅ |
| ☐ | Nodes : console, note, texte, checklist, kanban, calendrier, formes, encre, image, fichier, web tile, cartes | modèle de nodes | — | ●●● | ✅ |
| ☐ | Workspaces (onglets) par repo, exécution en arrière-plan | état par workspace | — | ●● | ✅ |
| ☐ | Presets (18 intégrés + layouts sauvegardés) | JSON de layout | — | ● | ✅ |
| ☐ | Undo/redo 80 niveaux | pile de commandes | — | ●● | ✅ |
| ☐ | Persistance JSON debounce 2 s / 7 s max, version précédente, snapshots horaires (24), archive jamais purgée, forward-compat lecture seule | fichiers | — | ●● | ✅ |
| ☐ | Guides d'alignement sans snap, placement auto sans chevauchement | layout | — | ● | ✅ |
| ☐ | Rails gauche/droit, menu anneau contextuel, touches 1 lettre personnalisables | UI | — | ●● | ✅ |
| ☐ | Thèmes OG / Light / Match OS | UI | — | ● | ✅ |
| ☐ | Markup d'image (annotations, sauvegarde en nouvelle image) | canvas | — | ●● | ✅ |
| ☐ | Cartes code (snapshot, 800 Ko) / Markdown (live, file-watch) / fichier (Quick Look) | file-watching | Quick Look ❌ | ●● | ⚠️ |
| ☐ | Drop de fichiers externes : copier dans le repo (sans écrasement) ou référencer | fs | — | ● | ✅ |

## 5.5 Git & web

| ✔ | Fonctionnalité | Mécanisme Symvibe | Dépendances | Cplx | Transp. |
|---|---|---|---|---|---|
| ☐ | Panneau Git : changements (≤ 400), commit/push/pull FF, discard via Corbeille, historique 100, branches ≤ 200 | git CLI local, SSH batch, timeouts (push 5 min) | git | ●● | ✅ |
| ☐ | Message de commit suggéré (local) | génération locale | — | ● | ✅ |
| ☐ | Publication GitHub via `gh` (auth dans une console) | `gh auth login`, `gh repo create` | gh | ● | ✅ |
| ☐ | Gestion fichiers > 100 Mo (gitignore auto, réécriture avec branche backup) | git | — | ●● | ✅ |
| ☐ | Worktrees : liste, diff par agent, merge avec check de conflits, PR | git + gh | — | ●● | ✅ |
| ☐ | Git par commande/voix (`commit and push`…) | parseur local → boutons | — | ● | ✅ |
| ☐ | Web tiles (navigateur embarqué, onglets ≤ 12, tailles d'appareil, zoom) | WKWebView | moteur web embarqué | ●● | ⚠️ (Electron/CEF) |
| ☐ | Cadran localhost (3000/3001/4200/5173/8000/8080) avec sonde | probe TCP/HTTP | — | ● | ✅ |
| ☐ | Aperçu automatique quand une console imprime une URL locale | regex sur sortie PTY + sonde + câble visuel | — | ● | ✅ |
| ☐ | Web Inspector docké en carte | WebKit Inspector | — | ●● | ❌ (Safari) |
| ☐ | Politiques : pop-ups, downloads, audio, certificats localhost | webview | — | ● | ⚠️ |

## 5.6 Studios

| ✔ | Fonctionnalité | Mécanisme Symvibe | Dépendances | Cplx | Transp. |
|---|---|---|---|---|---|
| ☐ | Pattern « terminal invisible » (PTY caché, 1 prompt, scraping, fermeture) | réutilisé par Documents, Diagrams, mémoire, usage, juge de loop | consoles | ●● | ✅ |
| ☐ | Documents : 9 types + libre, 3 efforts, streaming, versions, PDF paginé (couverture, TOC, signets), Markdown | génération par CLI + moteur PDF | PDF | ●●● | ✅ |
| ☐ | Diagrams : 6 types, 3 efforts, 2 styles, rendu en formes natives, export PNG 2× / Excalidraw | format intermédiaire décrit par le CLI → formes | — | ●●● | ✅ |
| ☐ | Code : arbre filtré, éditeur 25 langages, conflits disque, préservation encodage/BOM/EOL | éditeur | — | ●● | ✅ |
| ☐ | Markdown : vault ≤ 2 000 fichiers, autosave 1,5 s, graphe wiki-links/liens, export PDF | parseur md + graphe force-directed | — | ●● | ✅ |
| ☐ | Skills : lecture `SKILL.md` (personal/project/plugins/commands), checkup local, éditeur, 12 starters, run | fs + règles de validation | format Claude Code | ●● | ✅ |

## 5.7 Compte, licence, données

| ✔ | Fonctionnalité | Mécanisme Symvibe | Dépendances | Cplx | Transp. |
|---|---|---|---|---|---|
| ☐ | Auth via navigateur (requête à usage unique 5 min, retour app), email vérifié | Firebase Auth + deep link | IdP | ●● | ✅ |
| ☐ | Entitlement : check 4 min, réponse signée ≤ 15 min, grâce hors ligne, coupure immédiate si rejet, obsolescence de version | serveur de licence | — | ●● | ✅ |
| ☐ | Intégrité du binaire (refus si modifié) | vérification de signature | ❌ | ● | ⚠️ |
| ☐ | Crédits mensuels (10 000) pour services hébergés uniquement, pas de dépassement | compteur serveur | — | ● | ✅ |
| ☐ | Paiement + portail (Paddle), essai 7 j, remboursement 14 j | Paddle | — | ● | ✅ |
| ☐ | Local-first sans télémétrie ; inventaire précis des flux sortants | politique | — | ● | ✅ |
| ☐ | Mises à jour signées, silencieuses, installées au quit | updater | — | ●● | ⚠️ |
| ☐ | Settings 8 volets (cf. tableau Partie 3) | UI | — | ● | ✅ |
| ☐ | Notifications OS (loops), carillon de reset d'usage | OS | — | ● | ✅ |
| ☐ | Premier lancement en 3 étapes (repo, agent, agent teams) | onboarding | — | ● | ✅ |

## 5.8 Décisions d'architecture à trancher dans le DAT (inspirées de Symvibe)

1. **Intégration des agents par injection PTY vs API** — Symvibe choisit 100 % PTY (zéro clé API, facturation sur les plans utilisateur, mais fragilité du screen-scraping et dépendance aux hooks). Alternative : SDK/API des agents (Claude Agent SDK, Codex SDK) → statut fiable, mais coûts API.
2. **Planner LLM hébergé vs local vs BYOK** — Symvibe : hébergé (Groq) + parseur local de secours, crédits ; pas de BYOK. Décider : LLM local (Ollama), BYOK, ou service managé.
3. **STT/TTS** — on-device (Parakeet) pour la confidentialité vs cloud ; TTS cloud avec cache.
4. **Persistance** — fichiers JSON locaux versionnés (snapshots horaires, archive) vs base locale (SQLite) vs sync cloud.
5. **Plateforme** — natif macOS (WKWebView, PTY, Quick Look, Keychain) vs Electron/Tauri multi-OS (perte : Web Inspector Safari, Quick Look ; gain : Windows/Linux).
6. **Modèle de sécurité** — confirmations graduées (texte risqué, kill, loops), jamais d'exécution dans un shell nu, jamais de réponse automatique aux prompts de confiance, Yolo opt-in.
7. **Multi-comptes** — isolation par variables d'environnement de config (`CLAUDE_CONFIG_DIR`, `CODEX_HOME`) ; limite Keychain.
8. **Licence** — entitlement périodique signé avec grâce hors ligne ; intégrité du binaire.
9. **Extensibilité** — catalogue d'agents déclaratif, agents custom, skills (SKILL.md), presets, agent teams via skill.

