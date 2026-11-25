# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

Application de bureau Windows (Tauri 2) dont l'interface est une WebView : le design est traité comme du web.

## Users

Développeurs qui pilotent plusieurs agents IA en parallèle, et leurs équipes. Usage actuel : un seul utilisateur (le fondateur). Distribution à des collègues envisagée plus tard, sans date.

## Product Purpose

Un outil de travail multi-facettes réunissant :
- la gestion d'agents de développement multi-agents, avec gestion d'équipe ;
- la gestion des entrées de travail (tickets DevOps / Jira, etc.) ;
- des événements pour la communication entre équipes et entre agents.

Succès : superviser plusieurs agents sans perdre le fil, et retrouver son espace de travail à la réouverture.

## Positioning

Un canvas spatial où les agents IA tournent dans des cartes (terminaux réels), à côté des notes, du kanban et des tickets, sur un même espace de travail.

Les cartes d'équipe regroupent des agents qui communiquent entre eux, surtout en sous-agents.

Écrans prévus : un écran de supervision de tous les agents, des cartes d'équipe, un écran Kanban, un écran whiteboard, et d'autres à venir.

## Operating Context

- Travail quotidien de développement sur Windows (PowerShell, CMD, WSL, Git Bash).
- Agents IA lancés en CLI : Copilot CLI (testé), Claude Code et Codex (non installés pour l'instant).
- Sessions longues et parallèles : l'interface doit rester lisible pendant plusieurs flux de sortie.

## Open Decisions

- Forme exacte de la communication entre agents (messages, événements, partage de contexte) : non tranchée.
- Source des tickets (Jira, Azure DevOps, GitHub Issues) : non tranchée.
- Date et public d'une éventuelle distribution : non tranchée.
