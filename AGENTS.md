# Instructions pour les agents — Swarmify

## Comptes Git

Toute action Git sur ce projet (push, création de PR, etc.) doit être effectuée avec le compte **jm-parent**. Les pushs faits avec le compte `jeanmarie-parent_exakisc` sont refusés (403) sur `jm-parent/Swarmify`.

## Workflow de développement

Pour toute feature, suivre `docs/dev-workflow.md` et la constitution `.specify/memory/constitution.md`.

- Au-dessus du seuil « prompt direct » de `docs/dev-workflow.md`, commencer par le cadrage SpecKit : `/speckit-specify`, `/speckit-clarify`, `/speckit-plan`, `/speckit-tasks`, puis `/speckit-analyze`.
- Ne pas invoquer les skills `superpowers:brainstorming` ni `superpowers:writing-plans` dans ce repo : leur rôle est tenu par SpecKit.
- Pour exécuter, utiliser `superpowers:subagent-driven-development` ou `superpowers:executing-plans` sur `specs/<id>/tasks.md`, sans re-planifier.
- Ne jamais lancer `/speckit-implement`, ni `specify workflow run` qui l'enchaîne.
- Pour toute feature qui modifie l'interface (composants, styles, HTML sous `src/`), faire une passe `impeccable` après l'exécution et avant la revue de code.

## Subagents

- Pour les subagents (y compris ceux des workflows Superpowers), utiliser `claude-haiku-5.5` par défaut.
