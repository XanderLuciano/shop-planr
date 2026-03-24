---
inclusion: always
description: Points agents to AI-MAP.md and .ai/ sub-maps for codebase navigation
---

# AI Map Reference

Before searching the codebase with grep/find commands, consult `AI-MAP.md` at the project root. It contains:

- Project structure and tech stack
- Route → service mappings (backend)
- Frontend page inventory
- Key entry points and file locations
- Run/build/test commands
- Known quirks and gotchas

For deeper dives, check the `.ai/` folder for sub-maps:

- `.ai/architecture.md` — Layer boundaries, separation of concerns, DI patterns
- `.ai/data-model.md` — SQLite schema, domain types, migrations
- `.ai/jira-integration.md` — PI project custom fields, REST API, push/pull
- `.ai/testing.md` — Property tests, integration tests, seed data

Use `#[[file:AI-MAP.md]]` to pull the full map into context when needed.

## Living Document

The AI map and `.ai/` sub-maps are living documents that evolve as the project is built. They reflect the current state of the codebase, not a frozen spec. If reality diverges from what the map says, update the map — don't treat it as gospel.

- Sections marked "Planned" or "TBD" are aspirational and may change during implementation.
- If a design decision changes during development, update the relevant map/sub-map to match.
- It's fine to add, remove, or restructure sections as the project takes shape.
- The map should describe what IS, not what was originally planned.

## When to Update the Map

After any task that changes the project's shape, update `AI-MAP.md` and relevant `.ai/*.md` files. Specifically when you:

- Add, rename, or remove routes / API endpoints
- Add, rename, or remove pages or major UI components
- Add or change services, repositories, or key utilities
- Change run/build/test/deploy commands
- Add new subsystems that warrant a sub-map
- Install or remove dependencies that affect the tech stack
- Discover new quirks or resolve existing ones

Keep updates lightweight — a one-line table row or bullet point is fine. Don't let map maintenance become a bottleneck.

## Sub-Agent Instructions

When delegating tasks to sub-agents, include this context so they understand the project layout:

> Consult `AI-MAP.md` at the project root for project structure, tech stack, entry points, and route/service mappings. For deeper context, check `.ai/architecture.md`, `.ai/data-model.md`, `.ai/jira-integration.md`, and `.ai/testing.md`. Do NOT run any git commands. Do NOT modify `AI-MAP.md` or any files in `.ai/` — map updates are handled by the main agent only.

Sub-agents may READ the map files for context but MUST NOT WRITE to them. The main agent owns all map updates because it has the full picture of what changed across all delegated tasks. After sub-agent work concludes, the main agent should review what changed and update the map in a single coherent pass.
