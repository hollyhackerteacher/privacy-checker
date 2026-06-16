# Architecture

The app is a React/Vite frontend served by a small Express backend.

## Runtime Flow

1. User enters a website URL.
2. `GET /api/scan?url=...` normalizes and validates the URL, then tries safe protocol/`www` fallbacks.
3. The backend fetches the public page, then follows a bounded set of relevant same-site links.
4. The scanner extracts cookies, resource domains, forms, storage signals, policy terms, security headers, and privacy links.
5. The backend builds a structured report with reviewer context, confidence labels, policy excerpts, a plain-language verdict, approval checklist, and vendor profile.
6. If configured, the report is sent to AIPC/Ollama to generate a copy-paste teacher notification email.
7. The frontend renders the technical evidence, high-level ruling, Utah/FERPA notes, comparison view, local vendor history, and teacher notification email.
8. `POST /api/report/pdf` generates a PDF from a completed report.

## Important Files

- `server/index.js`: Express server, crawler, scanner, scoring, PDF export, and AIPC/Ollama integration.
- `src/main.jsx`: Report UI, reviewer workflow, local comparison/vendor history, and report downloads.
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
- Plain-Language Verdict: approved, deny, or needs-review result with concrete reasons and next step.
- Reviewer Workflow: local reviewer context that can mark login, student data entry, and DPA status.
- Approval Checklist: DPA, FERPA, targeted advertising, student data, retention/deletion, subprocessors, breach/security, and public documentation checks.
- Likely Violation Without Agreement: denial-level concerns such as advertising trackers, advertising cookies, missing privacy documentation, or sale/share language.
- Needs Detailed Review: items that may be approvable only after DPA, contract, FERPA, or IT review.
- Policy Quote Snippets: short excerpts from public pages that triggered policy-language signals.
- Known Vendor Profile and Comparison: local browser history for repeated vendors and side-by-side review of pinned reports.
- FERPA Notes: student PII, school official exception, direct control, redisclosure, and secondary-use considerations.
- Summarized Email Explanation: copy-paste message for notifying a teacher of approval, denial, or review-needed status.
- Finding Drill-down: clicking a finding opens the exact detected cookies, tracker domains, processor domains, form fields, policy signals, page list, or headers behind that row.
- Expanded Evaluation Checks: standardized rubric covering login/SSO, student data categories, COPPA, FERPA contract fit, targeted advertising, retention/deletion, subprocessors, AI use, security posture, breach terms, data location, accessibility, age/content suitability, vendor trust, and privacy/terms inspection.
