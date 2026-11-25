# Instructions pour les agents — Swarmify

## Workflow de développement

Pour toute feature, suivre `docs/dev-workflow.md` et la constitution `.specify/memory/constitution.md`.

- Commencer par le cadrage SpecKit : `/speckit-specify`, `/speckit-clarify`, `/speckit-plan`, `/speckit-tasks`, puis `/speckit-analyze`.
- Ne pas invoquer les skills `superpowers:brainstorming` ni `superpowers:writing-plans` dans ce repo : leur rôle est tenu par SpecKit.
- Pour exécuter, utiliser `superpowers:subagent-driven-development` ou `superpowers:executing-plans` sur `specs/<id>/tasks.md`, sans re-planifier.
- Ne jamais lancer `/speckit-implement`.
- Pour tout changement d'interface (composants, styles, HTML sous `src/`), faire une passe `impeccable` après l'exécution et avant la revue de code.

## Subagents

- Pour les subagents (y compris ceux des workflows Superpowers), utiliser `claude-haiku-5.5` par défaut.
