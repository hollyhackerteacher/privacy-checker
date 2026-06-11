# Utah K-12 Privacy Checker

Web interface for a first-pass privacy review of public websites used in K-12 settings.

Live deployment target: `privacychecker.fireboltservices.com`

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

## Production

Use `.env.example` as the server environment template. Set `OLLAMA_BASE_URL`, `AIPC_ENDPOINT`, and any API keys on the VPS, not in git.

Deployment templates are in `deploy/`:

- `privacychecker.service`: systemd service for `/opt/privacy-checker`
- `nginx.conf`: reverse proxy for `privacychecker.fireboltservices.com`

Production commands:

```bash
npm ci
npm run build
npm start
```

Docker deployment:

```bash
docker compose up -d --build
```

More replication notes:

- [Architecture](docs/ARCHITECTURE.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Security Notes](docs/SECURITY.md)
- [Changelog](CHANGELOG.md)

## What It Checks

- Cookies returned by the scanned public page
- A bounded crawl of up to 6 relevant public pages
- Advertising or analytics domains
- Third-party processors and infrastructure domains
- Browser storage signals
- Public forms and sensitive field signals
- Policy language signals such as FERPA, COPPA, targeted advertising, retention, subprocessors, and DPA
- Security header presence for CSP, HSTS, permissions policy, and referrer policy
- Public privacy, terms, data, or student policy links
- Utah K-12 review notes for teacher or IT director evaluation
- FERPA considerations for student PII, school official exception, redisclosure, and secondary use
- A copy-paste teacher notification email explaining approval, denial, or review-needed status
- Clickable findings with drill-down evidence for cookies, trackers, processors, forms, policy signals, and headers
- URL normalization/fallback for inputs like `example.com`, `www.example.com`, or full `https://example.com`

## Official References

- USBE Student Data Privacy: https://schools.utah.gov/studentdataprivacy/index.php
- USBE Laws & Policies: https://schools.utah.gov/studentdataprivacy/laws.php
- Board Rule R277-487: https://schools.utah.gov/adminrules/R277-487.php
- Utah Code 53E-9-301: https://le.utah.gov/xcode/Title53E/Chapter9/53E-9-S301.html

This tool is not a legal compliance determination. It is a technical screening report to support district review of contracts, data privacy agreements, subprocessors, student data elements, retention, and vendor terms.
