# Security Notes

## Secrets

Secrets belong in `.env` on the server only.

Do not commit:

- API keys
- passwords
- SSH keys
- private keys
- OAuth tokens
- `.env` files

The committed `.env.example` intentionally contains blank placeholders.

## Scanner Safety

The scanner only fetches public HTTP/HTTPS pages. It does not:

- log in
- submit forms
- accept consent banners
- bypass access controls
- scrape private pages
- store scan history server-side

## Privacy Limits

Reports are technical screening aids, not legal determinations. District review should still verify vendor contracts, data privacy agreements, subprocessors, retention, deletion, breach terms, and student data elements.

## AIPC/Ollama Data Flow

When AIPC is configured, the backend sends the structured scan report to the configured endpoint. The report can include public page URLs, detected domains, policy signals, form field names, and cookie names. Do not configure AIPC to send reports to an endpoint you do not trust.
