# Architecture

The app is a React/Vite frontend served by a small Express backend.

## Runtime Flow

1. User enters a website URL.
2. `GET /api/scan?url=...` normalizes and validates the URL, then tries safe protocol/`www` fallbacks.
3. The backend fetches the public page, then follows a bounded set of relevant same-site links.
4. The scanner extracts cookies, resource domains, forms, storage signals, policy terms, security headers, and privacy links.
5. The backend builds a structured report.
6. If configured, the report is sent to AIPC/Ollama to generate a copy-paste teacher notification email.
7. The frontend renders the technical evidence, high-level ruling, Utah/FERPA notes, and teacher notification email.

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

## Report Sections

- High Level Summary: overall score, rating, and approval/denial/review-needed ruling.
- Likely Violation Without Agreement: denial-level concerns such as advertising trackers, advertising cookies, missing privacy documentation, or sale/share language.
- Needs Detailed Review: items that may be approvable only after DPA, contract, FERPA, or IT review.
- FERPA Notes: student PII, school official exception, direct control, redisclosure, and secondary-use considerations.
- Summarized Email Explanation: copy-paste message for notifying a teacher of approval, denial, or review-needed status.
- Finding Drill-down: clicking a finding opens the exact detected cookies, tracker domains, processor domains, form fields, policy signals, page list, or headers behind that row.
