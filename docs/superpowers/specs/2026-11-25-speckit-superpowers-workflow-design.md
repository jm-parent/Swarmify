# Cadre de développement : SpecKit + Superpowers — Design

Design court, validé dans la conversation. Il décrit la mise en place, pas une fonctionnalité de l'app.

> **Mise à jour après exécution :** les commandes s'écrivent `/speckit-<nom>` (SpecKit 1.0.8, skills dans `.github/skills/speckit-*`), et non `/speckit.<nom>` comme ci-dessous. Une étape 7b `impeccable` (passe front) s'ajoute entre l'exécution et la revue. La version à jour de la boucle est `docs/dev-workflow.md`.

## 1. Intention et pourquoi

Ajouter un cadre aux développements futurs de Swarmify :
- **Cadrage, brainstorming, specs et supervision de leur cohérence** : SpecKit.
- **Exécution** (TDD, subagents, revue, finition de branche) : Superpowers.

Succès : chaque feature a une constitution, une spec, un plan et des tâches versionnés dans le repo ; `/speckit.analyze` a passé ; l'implémentation se fait sans re-planification.

## 2. Objectifs / non-objectifs / anti-objectifs

**Objectifs**
- Installer `specify` (1.0.8 déjà présent) et initialiser SpecKit pour l'agent utilisé (GitHub Copilot CLI).
- Rédiger la constitution du projet (règles de cadrage et de passage à Superpowers).
- Définir la boucle par feature décrite ci-dessous, et la documenter dans le repo.

**Non-objectifs**
- Migrer les specs et plans existants dans `docs/superpowers/` : ils restent en place.
- Modifier le code applicatif (Tauri, React).

**Anti-objectifs**
- Faire coexister `/speckit.implement` et Superpowers pour l'exécution.
- Laisser Superpowers brainstormer, écrire une spec ou planifier à la place de SpecKit.

## 3. Contraintes

- Windows. `specify` est installé dans `C:\Users\jeanmarie.parent\.local\bin\specify.exe`.
- Un seul utilisateur, un seul repo (`jm-parent/Swarmify`).
- Les skills Superpowers sont installés côté agent (`superpowers-marketplace`).

## 4. Approches considérées

- **A. SpecKit jusqu'aux tâches, Superpowers pour l'exécution** (retenue).
- B. Hybride, avec writing-plans Superpowers pour le plan détaillé. Écartée : deux formats de plan qui peuvent dériver.
- C. Juxtaposition sans règle. Écartée : les deux outils se marchent dessus.

L'approche A reprend le partage de l'article de référence (SpecKit « quoi », Superpowers « comment »), avec deux écarts :
- le brainstorming passe dans SpecKit (conversation, puis `/speckit.specify`), et non dans le skill Superpowers ;
- `/speckit.analyze` est ajouté après `/speckit.tasks` pour la supervision de cohérence.

## 5. Parties du comment, telles que décidées

**Boucle par feature**

| Étape | Outil | Résultat |
|---|---|---|
| 1. Brainstorming (conversation, sans skill Superpowers brainstorming) | SpecKit | idées et alternatives validées |
| 2. `/speckit.specify` | SpecKit | `specs/<id>/spec.md` |
| 3. `/speckit.clarify` | SpecKit | questions ouvertes résolues |
| 4. `/speckit.plan` | SpecKit | `specs/<id>/plan.md` |
| 5. `/speckit.tasks` | SpecKit | `specs/<id>/tasks.md` |
| 6. `/speckit.analyze` | SpecKit | rapport de cohérence spec / plan / tasks, à corriger avant exécution |
| 7. Worktree, TDD, exécution par subagents | Superpowers | code et tests, une tâche par subagent |
| 8. Revue de code | Superpowers | liste de points par sévérité |
| 9. Finition de branche | Superpowers | PR ouverte ou branche fusionnée |

**Règles**
- Ne pas sauter `tasks.md`.
- Au passage à l'exécution, dire à l'agent : « Le plan est dans `specs/<id>/tasks.md`. Ne pas re-planifier, exécuter. »
- Ne jamais lancer `/speckit.implement` en parallèle de Superpowers.
- Si le code diverge de la spec, relancer `/speckit.specify` sur la zone concernée.

**Calibrage**
- Moins de 30 min et moins de 3 fichiers : pas de cadre, prompt direct.
- 30 min à 2 h, une préoccupation : Superpowers seul (TDD, finition).
- Plus de 2 h ou multi-composants : cadre complet.

## 6. Ce qui reste au constructeur

- Contenu exact de la constitution, à rédiger avec l'utilisateur.
- Choix des fichiers et des commandes de l'init SpecKit selon la version 1.0.8.
- Emplacement exact de la doc de workflow dans le repo (README ou `docs/`).
