# Utah K-12 Privacy Checker

Public, reproducible web app for a first-pass privacy review of websites used in K-12 settings.

The app scans a public website, identifies privacy and security signals, and generates a report a district reviewer can use when evaluating a tool against Utah K-12 privacy expectations and FERPA considerations.

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

## Production Run

```bash
npm ci
npm run build
npm start
```

Docker:

```bash
cp .env.example .env
nano .env
docker compose up -d --build
```

## Run Your Own Version

Use these docs to reproduce the project without copying private deployment data:

- [Run Your Own Version](docs/RUN_YOUR_OWN.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Security Notes](docs/SECURITY.md)
- [Changelog](CHANGELOG.md)

## Recommended Public Deployment Shape

A common production setup is:

- A small VPS running Docker Compose.
- A reverse proxy such as Caddy or Nginx terminating HTTPS.
- Optional Tailnet access from the VPS to a private AI/Ollama/AIPC host.
- A `.env` file stored only on the VPS for endpoint URLs, model names, and API keys.

Do not commit your VPS IP, Tailnet IPs, SSH usernames, private hostnames, API keys, or `.env` file.

## What It Checks

- Cookies returned by scanned public pages
- Bounded crawl of relevant same-site public pages
- Advertising or analytics domains
- Third-party processors and infrastructure domains
- Browser storage signals
- Public forms and sensitive field signals
- Privacy policy, terms, student data, subprocessors, cookie, AI, security, and accessibility links
- Policy language signals such as FERPA, COPPA, targeted advertising, retention, subprocessors, and DPA
- Security header presence for CSP, HSTS, permissions policy, and referrer policy
- Utah K-12 review notes for teacher or IT director evaluation
- FERPA considerations for student PII, school official exception, redisclosure, and secondary use
- Reviewer workflow fields for district, grade band, intended use, login, student data entry, and DPA status
- Plain-language verdict with concrete reasons and next step
- Approval checklist for DPA, FERPA, advertising, student data, retention, subprocessors, breach/security, and public documentation
- Finding confidence labels and "why this matters" explanations
- Policy quote snippets from inspected public policies or terms
- Polished PDF export for teacher/IT review packets
- Local comparison mode and local known-vendor profile history
- Copy-paste teacher notification email explaining approval, denial, or review-needed status
- Clickable findings with drill-down evidence
- URL normalization/fallback for inputs like `example.com`, `www.example.com`, or full `https://example.com`

## Official References

- USBE Student Data Privacy: https://schools.utah.gov/studentdataprivacy/index.php
- USBE Laws & Policies: https://schools.utah.gov/studentdataprivacy/laws.php
- Board Rule R277-487: https://schools.utah.gov/adminrules/R277-487.php
- Utah Code 53E-9-301: https://le.utah.gov/xcode/Title53E/Chapter9/53E-9-S301.html
- FERPA Regulations: https://studentprivacy.ed.gov/ferpa

This tool is not a legal compliance determination. It is a technical screening report to support district review of contracts, data privacy agreements, subprocessors, student data elements, retention, and vendor terms.
