# Workflow

## Cross-Machine Codex Workflow

- AIPC is the persistent Codex host.
- AIPC holds the repos, GPU-dependent runtime, local tools, project state, and active Codex work.
- VPS is only the broker/frontend/jump host used to reach the AIPC.
- GitHub is the source of truth for durable project files.
- Mac and PC connect to the AIPC-hosted Codex environment for continuity.
- Mac and PC may clone repos for review or light edits, but should avoid creating separate long-running Codex histories for the same work.

Before starting work:

- connect to AIPC, directly or through VPS
- git status
- git fetch --all --prune
- git pull --rebase
- read AGENTS.md
- read docs/codex-handoff.md

Before ending work:

- update docs/codex-handoff.md
- run available validation
- check git status
- commit only when instructed
- push only when instructed

Common commands:

`ash
git status
git fetch --all --prune
git pull --rebase
git checkout -b feature/name
git add .
git commit -m "message"
git push
`

Do not sync:

- .env
- .env.*
- credentials
- tokens
- local Codex state
- local conversation databases
- virtual environments
- dependency folders
- build outputs
- logs
- OS-specific files
