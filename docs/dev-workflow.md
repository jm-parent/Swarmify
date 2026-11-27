# Boucle de développement

SpecKit cadre le quoi (idée, spec, plan, tâches). Superpowers exécute le comment (worktree, TDD, subagents, revue, finition). Le design complet est dans `docs/superpowers/specs/2026-11-25-speckit-superpowers-workflow-design.md`, et les règles projet dans `.specify/memory/constitution.md`.

## Boucle par feature

| Étape | Outil | Résultat |
|---|---|---|
| 0. Programme, si la feature est découpée en plusieurs features (voir « Programme ») | discussion principale | `docs/programs/<nom>.md` : découpage, dépendances, statut |
| 1. Brainstorming (en conversation, sans skill Superpowers brainstorming) | SpecKit | idées et alternatives validées |
| 2. `/speckit-specify` | SpecKit | `specs/<id>/spec.md` |
| 3. `/speckit-clarify` | SpecKit | questions ouvertes résolues |
| 4. `/speckit-plan` | SpecKit | `specs/<id>/plan.md` |
| 5. `/speckit-tasks` | SpecKit | `specs/<id>/tasks.md` |
| 6. `/speckit-analyze` | SpecKit | rapport de cohérence spec / plan / tâches, à corriger avant exécution |
| 6b. Cartographie : lire `graphify-out/GRAPH_REPORT.md`, ou `graphify query "<question>"` | graphify | repérer les modules, dépendances et hubs concernés avant de spécifier |
| 7. Worktree, TDD, exécution par subagents | Superpowers | code et tests, une tâche par subagent |
| 7b. Passe `impeccable` (si la feature modifie l'interface) | impeccable | critique et polissage de l'UI, avant la revue |
| 8. Revue de code | Superpowers | liste de points par sévérité |
| 9. Finition de branche | Superpowers | PR ouverte ou branche fusionnée |

## Programme (grosse feature en plusieurs sessions)

Une grosse feature découpée en plusieurs features se pilote depuis la discussion principale, qui ne code pas.

- Le programme est un document committé sur `main` : `docs/programs/<nom>.md`. Il contient le découpage en features numérotées, les dépendances (`depends_on`), les contrats partagés, les zones de code touchées par feature (pour repérer les chevauchements), et le statut.
- La discussion principale alloue les numéros de feature (`specs/<id>/`) avant de lancer les sessions.
- Chaque feature suit la boucle ci-dessus dans sa propre session. Une spec validée (sortie de `/speckit-analyze`) est mergée sur `main` par PR. Les sessions dépendantes repartent de `main`, ou rebasent dessus, pour lire la spec amont.
- Une feature démarre son implémentation quand toutes ses dépendances sont mergées. Sa phase spec peut démarrer dès que le contrat amont est mergé.
- Chaque session remonte son statut à la discussion principale. Celle-ci propose la feature suivante prête, et l'utilisateur valide chaque lancement de session.

## Règles

- Ne pas sauter `tasks.md`.
- Au passage à l'exécution, dire à l'agent : « Le plan est dans `specs/<id>/tasks.md`. Ne pas re-planifier, exécuter. »
- Ne jamais lancer `/speckit-implement`, ni `specify workflow run` qui l'enchaîne.
- Si le code diverge de la spec, relancer `/speckit-specify` sur la zone concernée.
- Cartographie : `graphify-out/graph.json` et `GRAPH_REPORT.md` sont versionnés. Le hook post-commit (`graphify hook install`) les régénère après chaque commit, sans LLM. Après une refonte, lancer `graphify update .` puis committer le graphe mis à jour.
- Avant de chercher dans le code, consulter le graphe (`graphify query`, `graphify path`, `graphify explain`).
- Front : toute modification de l'interface (composants, styles, HTML sous `src/`) passe par `impeccable` à l'étape 7b.

## Calibrage

- Moins de 30 min et moins de 3 fichiers : prompt direct, sans cadre.
- 30 min à 2 h sur une préoccupation : Superpowers seul (TDD, finition).
- Plus de 2 h ou multi-composants : cadre complet.
- Grosse feature à découper en plusieurs features : programme d'abord, puis cadre complet par feature.
