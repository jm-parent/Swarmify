# Constitution Swarmify

## Principes fondamentaux

### 1. Cadrage avant code
Toute feature au-dessus du seuil « prompt direct » (voir Calibrage) passe par `/speckit-specify`, `/speckit-clarify`, `/speckit-plan`, `/speckit-tasks`, puis `/speckit-analyze`, avant tout code.

### 2. Brainstorming en conversation
Le brainstorming se fait en conversation ; son résultat alimente `/speckit-specify`. Les skills Superpowers `brainstorming` et `writing-plans` ne s'appliquent pas à ce repo.

### 3. Exécution confiée à Superpowers
L'exécution passe uniquement par Superpowers : worktree, TDD, subagents, revue, finition de branche. Ne jamais lancer `/speckit-implement`, ni `specify workflow run` qui l'enchaîne.

### 4. Le plan est tasks.md
Au moment de l'exécution, `tasks.md` fait foi. Ne pas re-planifier.

### 5. La spec suit le code
Si le code diverge de la spec, relancer `/speckit-specify` sur la zone concernée avant de continuer.

## Passe front (impeccable)

Toute feature qui modifie l'interface (composants, styles, HTML sous `src/`) passe par une passe `impeccable` après l'exécution et avant la revue de code.

## Calibrage

- Moins de 30 min et moins de 3 fichiers : pas de cadre, prompt direct.
- 30 min à 2 h sur une préoccupation : Superpowers seul (TDD, finition).
- Plus de 2 h ou multi-composants : cadre complet.

## Gouvernance

Cette constitution prévaut sur les autres pratiques du repo. Le cadre complet est décrit dans `docs/dev-workflow.md`.

**Version**: 1.0.0 | **Ratified**: 2026-11-25 | **Last Amended**: 2026-11-25
