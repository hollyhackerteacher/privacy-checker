# Codex Handoff

Repo: privacy-checker
Current branch: main
Current objective: Live Utah K-12 privacy checker with expanded reviewer workflow, public GitHub repo, VPS deployment, and cross-machine handoff docs.
Last updated: 2026-06-18

## Files changed

- `server/index.js`: scanner/report API, reviewer context, confidence labels, policy snippets, PDF export, approval checklist, vendor profile fields.
- `src/main.jsx`: reviewer workflow UI, plain-language verdict, PDF download, comparison mode, local vendor profile history, confidence labels, policy snippets.
- `src/styles.css`: responsive styles for reviewer workflow, verdict, checklist, comparison, snippets, and vendor profile sections.
- `README.md`, `docs/ARCHITECTURE.md`, `CHANGELOG.md`: documented current feature set and runtime flow.
- `package.json`, `package-lock.json`: added `pdfkit`; moved/upgraded Vite tooling to dev dependencies.

## Decisions made

- GitHub repo is public and source of truth: `https://github.com/hollyhackerteacher/privacy-checker`.
- Live app is deployed at `https://privacychecker.fireboltservices.com/`.
- VPS deployment uses Docker Compose from `/opt/privacy-checker`; `.env` remains server-only and must not be committed.
- "Run your own version" link points to the public GitHub repo.
- Vite is dynamically imported only in development so production runtime does not depend on dev tooling.
- PDF generation uses server-side `pdfkit` through `POST /api/report/pdf`.
- Local browser storage is used only for comparison/vendor history; there is no server-side scan history database.

## Commands run

- `git fetch --all --prune`
- `git pull --rebase`
- `npm install pdfkit`
- `npm install -D vite@latest @vitejs/plugin-react@latest`
- `npm run build`
- `node --check server/index.js`
- `npm audit --audit-level=high`
- `curl` scan checks against local and live `/api/scan`
- `curl` PDF checks against local and live `/api/report/pdf`
- Docker deploy to VPS with timestamped backup and `docker compose up -d --build privacy-checker`
- `git push origin main`

## Validation/tests run

- Local build passed with Vite 8.
- `node --check server/index.js` passed.
- `npm audit --audit-level=high` returned `found 0 vulnerabilities`.
- Private-string scan found no VPS IP, Tailnet IP, SkippyBot, SSH user, or key material in committed files.
- Local `/api/scan` returned reviewer context, plain verdict, checklist, finding confidence, and vendor profile fields.
- Local `/api/report/pdf` returned a valid PDF.
- Browser QA passed for desktop scan workflow, reviewer fields, plain verdict, checklist, comparison pin, drill-down confidence/why, and mobile no-overflow load.
- VPS rebuild passed local container health.
- Public site returned HTTP 200.
- Public `/api/scan` and `/api/report/pdf` returned expected live results.

## Known issues

- The scanner remains bounded to public pages only; it does not log in, accept banners, submit forms, or verify login-only workflows.
- Policy snippets appear only when scanned public pages contain matching policy language.
- AIPC/Ollama teacher notification depends on server `.env`; if unavailable, fallback email generation is used.
- Docker build logs still warn that `NODE_ENV=production` in `.env` is not supported by Vite during build; build completes successfully.

## Next recommended task

- Add a small automated test suite for URL normalization, scoring/verdict logic, and PDF endpoint behavior.
- Consider adding server-side rate limiting and request size/time controls before wider public use.
- Add import/export for local comparison/vendor history if reviewers want to move browser-local data between devices.

## Notes for next Codex session

- Start by running `git status`, `git fetch --all --prune`, and `git pull --rebase`.
- Read `AGENTS.md`, `docs/workflow.md`, and this file.
- Do not commit `.env`, VPS-specific IPs, Tailnet device/IP values, SSH users, keys, local Codex state, `node_modules`, or `dist`.
- GitHub is the durable source of truth; VPS is deployment target only.
- Update this file before switching machines, ending a long Codex session, or handing work between Mac, PC, VPS, and AIPC.
