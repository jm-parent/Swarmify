# Boucle de développement

SpecKit cadre le quoi (idée, spec, plan, tâches). Superpowers exécute le comment (worktree, TDD, subagents, revue, finition). Le design complet est dans `docs/superpowers/specs/2026-11-25-speckit-superpowers-workflow-design.md`, et les règles projet dans `.specify/memory/constitution.md`.

## Boucle par feature

| Étape | Outil | Résultat |
|---|---|---|
| 1. Brainstorming (en conversation, sans skill Superpowers brainstorming) | SpecKit | idées et alternatives validées |
| 2. `/speckit-specify` | SpecKit | `specs/<id>/spec.md` |
| 3. `/speckit-clarify` | SpecKit | questions ouvertes résolues |
| 4. `/speckit-plan` | SpecKit | `specs/<id>/plan.md` |
| 5. `/speckit-tasks` | SpecKit | `specs/<id>/tasks.md` |
| 6. `/speckit-analyze` | SpecKit | rapport de cohérence spec / plan / tâches, à corriger avant exécution |
| 7. Worktree, TDD, exécution par subagents | Superpowers | code et tests, une tâche par subagent |
| 7b. Passe `impeccable` (si la feature modifie l'interface) | impeccable | critique et polissage de l'UI, avant la revue |
| 8. Revue de code | Superpowers | liste de points par sévérité |
| 9. Finition de branche | Superpowers | PR ouverte ou branche fusionnée |

## Règles

- Ne pas sauter `tasks.md`.
- Au passage à l'exécution, dire à l'agent : « Le plan est dans `specs/<id>/tasks.md`. Ne pas re-planifier, exécuter. »
- Ne jamais lancer `/speckit-implement`, ni `specify workflow run` qui l'enchaîne.
- Si le code diverge de la spec, relancer `/speckit-specify` sur la zone concernée.
- Front : toute modification de l'interface (composants, styles, HTML sous `src/`) passe par `impeccable` à l'étape 7b.

## Calibrage

- Moins de 30 min et moins de 3 fichiers : prompt direct, sans cadre.
- 30 min à 2 h sur une préoccupation : Superpowers seul (TDD, finition).
- Plus de 2 h ou multi-composants : cadre complet.
