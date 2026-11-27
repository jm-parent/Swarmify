# Guide de validation : carte Image

**Date** : 2026-11-25 | **Plan** : [plan.md](plan.md)

Scénarios à exécuter une fois la feature implémentée. Ils couvrent les critères de [spec.md](spec.md).

## Prérequis

- Windows 10/11, Node.js LTS, Rust stable, WebView2 (voir README).
- Dépendances installées : `npm install`.
- Pour les tests Rust : `cargo` disponible dans `src-tauri`.

## Commandes

```powershell
npm test                      # Vitest : boardFile, boardStore, images front
npm run build                 # tsc puis vite build
cd src-tauri; cargo test      # images.rs : octets magiques, taille, purge
cd ..; npm run tauri dev      # application pour les scénarios manuels
```

## Scénarios manuels

| # | Scénario | Attendu | Critère |
|---|---|---|---|
| 1 | Glisser un PNG depuis l'Explorateur sur le canvas | Carte image au point de dépôt, image entière, proportions conservées, largeur ≤ 480 px | US1.1, FR-001, FR-008 |
| 2 | Copier une image, Ctrl+V sur le canvas | Carte créée au centre de la vue | US1.2, FR-002 |
| 3 | Sélecteur « Image » du menu radial, choisir un JPEG | Carte créée au centre de la vue | US1.3, FR-003 |
| 4 | Déposer un `.bmp` | Aucune carte, message « Format non supporté » | US1.4, FR-004 |
| 5 | Déposer 3 images d'un coup | Trois cartes, sans superposition | US1.5, FR-005 |
| 6 | Ctrl+V avec du texte seul dans le presse-papiers | Comportement inchangé (collage de cartes ou rien) | Edge case |
| 7 | Fermer puis relancer l'app | Chaque image revient à la même position et taille | US2.1, FR-007 |
| 8 | Supprimer le fichier d'origine après import | La carte affiche toujours l'image | US2.2, SC-006 |
| 9 | Exporter le board, le réimporter (autre dossier) | Images affichées, dossier `<nom>-images/` créé à l'export | US2.3, R8 |
| 10 | Supprimer manuellement un fichier de `images/` puis relancer | Carte « image introuvable », reste du board chargé | FR-013 |
| 11 | Sur cette carte : « Remplacer » par un autre fichier | Image remplacée, carte à jour | FR-013 |
| 12 | Ajouter un GIF animé | L'animation tourne en boucle | US3.1, FR-009 |
| 13 | Ajouter un SVG contenant `<script>` et `onload` | Aucun script exécuté, éléments dangereux absents du fichier copié | US3.2, FR-010, SC-003 |
| 14 | Ajouter une image de 25 Mo | Refus avec « 20 Mo maximum » | FR-012 |
| 15 | Supprimer une carte image puis Ctrl+Z | Carte restaurée avec son image | US4.2, FR-014 |
| 16 | Ouvrir un board de 20 cartes image | Ouverture en moins de 2 s | SC-005 |
| 17 | Dossier `images/` en lecture seule, puis ajouter une image | Message « Copie impossible », aucune carte créée | Edge case, T005 |
| 18 | Copier une carte image puis la coller (Ctrl+C, Ctrl+V), redémarrer, supprimer l'une des deux | L'autre carte garde son image | Edge case, T035 |

## Résultats attendus des tests automatisés

- `npm test` : les tests de `boardFile` acceptent un nœud image valide et rejettent un nœud sans `data.image.file` valide.
- `cargo test` : rejet d'un `.bmp`, rejet d'un fichier `.png` dont les octets ne sont pas PNG, rejet d'une image > 20 Mo, purge qui ne supprime que les fichiers non référencés.

## Contrats

- Commandes Tauri : [contracts/tauri-commands.md](contracts/tauri-commands.md)
- Format du board : [contracts/board-file.md](contracts/board-file.md)
