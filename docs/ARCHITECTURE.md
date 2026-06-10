# Architecture

The app is a React/Vite frontend served by a small Express backend.

## Runtime Flow

1. User enters a website URL.
2. `GET /api/scan?url=...` normalizes and validates the URL.
3. The backend fetches the public page, then follows a bounded set of relevant same-site links.
4. The scanner extracts cookies, resource domains, forms, storage signals, policy terms, security headers, and privacy links.
5. The backend builds a structured report.
6. If configured, the report is sent to AIPC/Ollama for a K-12 privacy review summary.
7. The frontend renders the technical evidence, Utah review notes, and AIPC evaluation.

## Important Files

- `server/index.js`: Express server, crawler, scanner, scoring, and AIPC/Ollama integration.
- `src/main.jsx`: Report UI and local report download.
- `src/styles.css`: Responsive app styling.
- `Dockerfile`: Production container image.
- `docker-compose.yml`: Local or VPS container runtime.
- `.env.example`: Safe environment template with no secrets.
- `deploy/`: Optional reverse proxy and systemd templates.

## Scan Boundaries

The scanner is intentionally bounded. It does not log in, accept cookie banners, submit forms, bypass access controls, or determine legal compliance.

Default limits:

- `SCAN_PAGE_LIMIT=6`
- `SCAN_PAGE_TIMEOUT_MS=15000`
- `AIPC_TIMEOUT_MS=30000`

These can be changed with environment variables.
