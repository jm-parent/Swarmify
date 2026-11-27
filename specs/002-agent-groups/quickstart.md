# Guide de validation : Groupes d'agents

Scénarios exécutables pour prouver la feature de bout en bout. Pas de code d'implémentation ici : les tâches sont dans `tasks.md`.

## Prérequis

- Windows 10 21H2+ ou 11, Node.js LTS, Rust stable, WebView2 (voir [README.md](../../README.md)).
- Dépendances : `npm install`.
- Pour les scénarios manuels : `npm run tauri dev`.

## 1. Tests automatisés

```powershell
npm test
```

Attendu : les tests de `src/canvas/groups/groupOps.test.ts`, `boardFile.test.ts` et `boardStore.test.ts` passent. Les cas couverts sont ceux de la section « Tests » de `tasks.md`.

## 2. Vérification de type et build

```powershell
npm run build
```

Attendu : `tsc` sans erreur, puis build Vite réussi. Le build ne vérifie pas le rendu, voir section 3.

## 3. Scénarios manuels

Chaque scénario correspond à une User Story de [spec.md](./spec.md). Lancer l'app avec `npm run tauri dev`.

### S1. Créer un groupe et y placer des agents (US1)

1. Ajouter trois agents (barre d'ajout « + Agent »).
2. Clic droit sur le canvas, choisir « Groupe ». **Attendu** : un cadre « NOUVEAU GROUPE », rôle General, compteur `0 · 0 actif`.
3. Glisser deux agents dans le cadre (centre dans le cadre). **Attendu** : ils rejoignent, le cadre s'agrandit, compteur `2 · 0 actif`.
4. Déplacer le cadre. **Attendu** : les deux membres suivent, le troisième reste en place.
5. Glisser un membre hors du cadre et relâcher. **Attendu** : il quitte le groupe, compteur `1 · 0 actif`, le cadre se réduit.

### S2. Compteur d'agents actifs (US2)

1. Groupe de trois membres, lancer deux agents (commande dans la carte). **Attendu** : `3 · 2 actifs`.
2. Arrêter un agent. **Attendu** : `3 · 1 actif` sans recharger.
3. Un seul agent actif. **Attendu** : singulier, `3 · 1 actif`.

### S3. Nom et rôle (US3)

1. Clic sur le nom, le remplacer par « Équipe test ». **Attendu** : affichage « ÉQUIPE TEST ».
2. Valider un nom vide. **Attendu** : l'ancien nom revient.
3. Choisir le rôle Testers (menu déroulant, au clavier). **Attendu** : pastille et bordure en vert `#7FBF6A`.

### S4. Adaptation du cadre (US4)

1. Ajouter un agent loin du cadre, puis le glisser dedans. **Attendu** : le cadre englobe tous les membres avec une marge.
2. Tirer une poignée pour agrandir le cadre à la main, puis retirer un membre. **Attendu** : le cadre garde sa taille choisie (minimum).
3. Essayer de réduire le cadre sous ses membres. **Attendu** : la taille s'arrête à leur boîte.

### S5. Supprimer un groupe (US5)

1. Groupe de trois agents, dont deux en cours d'exécution. Supprimer le cadre (Suppr).
2. **Attendu** : le cadre disparaît, les trois agents restent à leur place, les deux sessions continuent.
3. Ctrl+Z. **Attendu** : le groupe revient avec ses membres.
4. Pendant toute la séquence (création du cadre, glissement d'un agent dedans, suppression du cadre), la sortie des deux agents qui tournent continue sans interruption. **Attendu** : pas de remontage de carte, aucun flux perdu (M4).

### S6. Clavier (FR-018)

1. Tab jusqu'au bouton « + Groupe » de la barre d'ajout, Entrée. **Attendu** : un groupe au centre de la vue.
2. Tab jusqu'au nom, saisir, Entrée. Tab jusqu'au rôle, choisir au clavier. **Attendu** : sans souris.

### S7. Persistance et export (FR-014, SC-004)

1. Créer un groupe avec deux membres, fermer l'app, la relancer. **Attendu** : groupe, nom, rôle, taille, position et membres identiques.
2. Exporter le board, l'importer. **Attendu** : mêmes groupes et mêmes membres.
3. Importer un ancien board (sans groupe). **Attendu** : chargement sans erreur, zéro groupe.

### S8. Points de contrôle techniques

- Ordre du tableau : après création de deux groupes, le fichier sauvegardé (`board.json` exporté) liste les groupes avant leurs membres (R3).
- Copier-coller d'un agent membre : le collé n'a pas de `parentId` (FR-017).

## 4. Passe impeccable

Après exécution et avant revue (constitution, « Passe front »), faire la passe `impeccable` sur le cadre, le compteur et la barre d'ajout. Les valeurs de `DEFAULT_GROUP_SIZE` et de la marge sont à confirmer à cette passe.
