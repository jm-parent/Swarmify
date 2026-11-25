# DESIGN.md — Swarmify

> Système de design de Swarmify (Windows), dérivé de la référence Symvibe (macOS, démo vidéo).
> Les valeurs de couleur viennent de la référence, approchées depuis la vidéo : elles sont arrondies ici.
> Les adaptations Windows sont marquées **[Windows]**. Les éléments propres à Symvibe hors V1 sont marqués **[hors V1]**.

## Overview

Un atelier sombre et calme, où seuls les agents « brillent ».

L'interface est presque invisible (gris sur presque noir). La couleur ne sert qu'à deux choses : identifier le fournisseur d'un agent et montrer l'état d'un groupe. Le contenu principal est le terminal de l'agent.

Principes :
1. **Le contenu, c'est le terminal.** Le chrome reste discret, le texte mono des agents occupe l'écran.
2. **La couleur a un sens.** Orange = Claude / action principale. Indigo = Codex. Couleur de rôle = groupe. Jamais de couleur décorative.
3. **Zoom spatial plutôt que navigation.** On zoome, dézoome et déplace la vue sur le canvas, sans changer de page.
4. **Tout se commande au clavier.** La barre de commande est toujours présente.
5. **Densité assumée, hiérarchie nette.** Un tableau de 6 à 9 terminaux reste lisible grâce aux bordures colorées et aux en-têtes compacts.

## Colors

### Fondations (thème sombre unique)

| Token | Valeur | Usage |
|---|---|---|
| `--bg-canvas` | `#0E0E09` | Fond du canvas (noir légèrement chaud) |
| `--bg-dot` | `#2A2A24` | Grille de points du canvas |
| `--bg-card` | `#0C0C08` | Intérieur des cartes terminal |
| `--bg-surface` | `#151714` | Dialogues, popovers, panneaux |
| `--bg-surface-2` | `#20221F` | Barre de commande, chips pleins |
| `--border-subtle` | `rgba(255,255,255,0.08)` | Contours de panneaux, séparateurs |
| `--border-strong` | `rgba(255,255,255,0.14)` | Boutons fantômes, champs |
| `--text-primary` | `#F2F2EC` | Titres, libellés de boutons |
| `--text-secondary` | `#BEC4B7` | Libellés de rôle, texte de dialogue |
| `--text-muted` | `#878784` | Placeholder, méta (« 6 running ») |
| `--text-faint` | `#494B48` | Lignes de log secondaires |

### Accents

| Token | Valeur | Usage |
|---|---|---|
| `--accent` | `#FA6232` | Outil actif, agent Claude, action principale |
| `--accent-border` | `#9F442B` | Bordure des cartes Claude |
| `--accent-tint` | `#2A1A12` | Fond des badges Claude |
| `--codex` | `#5B63E6` | Logo et bordure des cartes Codex |
| `--codex-border` | `#42467F` | Bordure des cartes Codex |
| `--codex-tint` | `#252C46` | Fond des badges Codex |
| `--teal` | `#6DBEBE` | Rôle Docs, bouton « Spawn » |
| `--group-line` | `#5A7776` | Cadre de groupe |
| `--success` | `#6F9657` | Point « live », statut connecté |
| `--warn` | `#E6B450` | Avertissements dans les terminaux |
| `--danger` | `#E5483A` (texte), `#402018` (fond) | Fermer, arrêter, tout effacer |
| `--link-term` | `#7E8CF0` | Chemins et liens dans les terminaux |

### Rôles de groupe

Pastille de 6 px devant le nom, reprise par le cadre du groupe.

| Rôle | Couleur |
|---|---|
| Frontend | `#E0A060` |
| Backend | `#B48CE0` |
| Testers | `#7FBF6A` |
| Reviewers | `#7FA8E8` |
| Design | `#E07A9A` |
| Docs | `#6DBEBE` |
| Security | `#E0705A` |
| General | `#9A9A94` |

### Chips « néon » [hors V1]

Le contour en dégradé multicolore des chips d'action de la référence est la seule touche « joueuse » de l'interface. Il n'entre pas dans la V1.

## Typography

Deux familles : une sans-serif pour le chrome, une mono pour tout ce qui est terminal ou canvas.

| Rôle | Famille | Taille / graisse |
|---|---|---|
| UI : bouton, chip, onglet | **Segoe UI** [Windows] (repli : Inter, system-ui) | 14 px / 500–600 |
| Titre de panneau | Segoe UI | 15–16 px / 600 |
| Corps de dialogue | Segoe UI | 15 px / 400 |
| Libellé de groupe sur le canvas | Segoe UI | 13 px / 700, capitales, interlettrage +0,04em |
| Titre de zone du canvas | **Cascadia Mono** [Windows] (repli : JetBrains Mono, Consolas) | 14 px / 400 |
| Terminal | **Cascadia Mono** [Windows] (repli : Consolas, monospace) | 13 px / 400, interligne 1,35 |
| Badge d'état | Segoe UI | 9 px / 700, capitales |
| Méta de statut | Cascadia Mono | 13 px, chiffres tabulaires |

Règles :
- Chiffres tabulaires partout où un compteur change (agents actifs, zoom, quota).
- Dans les terminaux, on garde les couleurs d'origine de la CLI (verbes de réflexion, avertissements). Le thème ne les recolore pas.

## Layout

- **Unité de base : 4 px.** Échelle : 4, 8, 12, 16, 24, 32, 48.
- **Canvas plein écran** sous une barre supérieure fine (h ≈ 48 px).
- **Barre de commande** : centrée en bas, flottante.
- **Rail d'outils** : pilule verticale flottante à gauche, 40 px de large.
- **Panneaux** : pilule verticale à droite, icônes contour 22 px.
- **Zoom** : pilule en bas à droite (« − 64 % + »), chiffres en mono.
- **Zoom spatial** : 22 % à 100 %. Panoramique à la souris, zoom à la molette.
- **Cartes terminal** : environ 470 × 340 px à 100 %, ratio ≈ 1,4:1, gouttière de 20 px.
- **Responsive** : version bureau uniquement pour la V1. Largeur minimale de fenêtre à définir.

## Elevation & Depth

- Pas d'ombre portée visible sur fond noir. On sépare par **luminance du fond** (canvas → surface → surface-2) et par **bordure 1 px subtile**.
- Éléments flottants (barre de commande, rails) : `backdrop-filter: blur(20px)` sur fond semi-opaque.
- Voile modal : canvas assombri à environ 55 % et flouté.

## Shapes

| Élément | Rayon |
|---|---|
| Pilule (chips, onglets, boutons de dialogue) | 999 px |
| Carte terminal | 6 px |
| Tuile d'agent | 10 px |
| Popover, dialogue, panneau flottant | 16 px |
| Barre de commande étendue | 20 px |
| Fenêtre de l'app | Géré par Windows (coins natifs) [Windows] |

## Components

### Carte terminal (agent)

- Bordure 1 px de la couleur du fournisseur (`--accent-border` pour Claude, `--codex-border` pour Codex). Fond `--bg-card`, rayon 6 px.
- En-tête (h ≈ 22 px) : logo du fournisseur (12 px), point d'état, nom de l'agent, puis à droite le badge d'état et les icônes Redémarrer, Dupliquer, Fermer.
- Badge d'état : `• WORKING` en orange (Claude) ou indigo (Codex) ; `IDLE` en gris. Pilule 9 px, capitales.
- Corps : sortie brute de la CLI en mono.
- Sélection : poignées rondes blanches de 8 px aux 4 coins, contour orange accentué.

### Cadre de groupe

- Rectangle arrondi (8 px) autour des cartes, trait de 1,5 px de la couleur du rôle.
- Libellé sur le trait, en haut à gauche : pastille de rôle, nom en capitales grasses, compteur et statut en mono gris.
- Titre de zone en mono centré au-dessus, facultatif.

### Barre de commande

- Pilule large (≈ 560 px), fond `--bg-surface-2`, rayon 20 px, hauteur ≈ 56 px.
- À gauche : orbe orange, seule « illustration » de l'interface, qui pulse doucement.
- Placeholder : « Entrée pour envoyer · @ pour cibler… ».
- À droite : trois boutons ronds de 32 px (étendre, envoyer, dicter [hors V1]).

### Menu radial (clic droit sur le canvas)

- Six boutons ronds de 52 à 64 px disposés en cercle autour d'un bouton central « More ».
- Fond `--bg-surface`, bordure subtile, icônes contour 20–24 px.
- Éclatement depuis le centre, décalage de 25 ms par bouton.

### Dialogue de confirmation

- Carte de 375 px, rayon 16 px, fond `--bg-surface`, bordure `rgba(255,255,255,.18)`.
- Titre 18 px / 600, corps 16 px.
- Deux boutons pilule de même largeur : **Annuler** (fond `#2A2A28`) et **Fermer l'agent** (fond `--danger` sombre, texte rouge vif).

### Petits éléments

- **Astuce** : pilule `--bg-surface`, « Essayer » en gris, suggestion en primaire.
- **Statut live** : point vert de 6 px et compteur en mono.
- **Zoom** : pilule « − 64 % + ».

## Iconography

- Icônes contour, trait 1,5 px, coins arrondis (style Lucide), 20 à 24 px.
- Les logos des fournisseurs gardent leurs couleurs de marque. Ce sont les seules icônes en couleur.

## Motion

| Interaction | Comportement |
|---|---|
| Zoom / panoramique du canvas | Easing doux `cubic-bezier(.22,1,.36,1)`, 400 à 600 ms |
| Popover / panneau | Fondu et montée de 8 px, 180 ms |
| Menu radial | Éclatement depuis le centre, 25 ms de décalage entre boutons, sans rebond |
| Dialogue modal | Voile qui s'assombrit (200 ms), carte à l'échelle 0,96 → 1 |
| Badge « WORKING » | Point qui clignote doucement (opacité 1 → 0,4, 1,2 s) |

Respecter `prefers-reduced-motion` : remplacer zooms et éclatements par des fondus.

## Do's and Don'ts

**À faire**
- Garder le fond quasi noir et la couleur réservée au sens (fournisseur, rôle, état).
- Afficher les compteurs (agents actifs, zoom, quota).
- Utiliser Ctrl dans les libellés de raccourcis (Windows).
- Garder le texte des terminaux lisible : contraste fort, mono, taille 13 px minimum.

**À ne pas faire**
- Ne pas ajouter de couleur décorative ni de dégradé hors chips néon [hors V1].
- Ne pas utiliser les contrôles de fenêtre macOS : la barre de titre reste celle de Windows [Windows].
- Ne pas mettre d'ombres portées lourdes sur fond noir.
- Ne pas recolorer la sortie des CLI : elle garde ses couleurs d'origine.

## Ce qui n'est pas défini

- Thème clair : absent de la référence, hors V1.
- Page d'accueil (liste des espaces de travail), réglages, onboarding.
- États d'erreur d'une carte (agent planté, déconnecté) : à définir à l'étape 5.
- Captures des écrans : les images de référence de Symvibe (`frames/`) ne sont pas dans ce repo.
- Typographies exactes : Segoe UI et Cascadia Mono sont les équivalents Windows retenus, à valider sur la machine.
