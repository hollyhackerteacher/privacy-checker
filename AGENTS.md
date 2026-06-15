# Project Agent Instructions


## Cross-Machine Codex Workflow

- This repo is a Codex project.
- GitHub is the source of truth for durable project files.
- The AIPC is the persistent Codex host.
- The VPS is only a broker/frontend/jump host for reaching the AIPC.
- Mac and PC should connect to the AIPC-hosted Codex environment when possible.
- Avoid separate long-running Codex sessions on Mac and PC for the same task.
- At the start of a session, read AGENTS.md and docs/codex-handoff.md.
- At the end of meaningful work, update docs/codex-handoff.md.
- Keep Codex output concise: summary, changed files, validation run, next steps.
- Never commit secrets, .env files, credentials, local caches, virtual environments, build artifacts, machine-specific state, or Codex local state.
- Do not push unless explicitly instructed.
