# Run Your Own Version

This guide is written for a public GitHub repo. It explains the production idea without including private infrastructure details.

## 1. Fork Or Clone

```bash
git clone https://github.com/your-org/privacy-checker.git
cd privacy-checker
npm install
npm run dev
```

Open `http://localhost:5173`.

## 2. Configure Public-Safe Environment Values

Copy the template:

```bash
cp .env.example .env
```

Only use placeholders in committed docs. Put real values only on the server.

Common values:

```bash
PORT=5173
SCAN_PAGE_LIMIT=6
SCAN_PAGE_TIMEOUT_MS=15000
AIPC_PROVIDER=ollama
AIPC_MODEL=qwen2.5:14b
OLLAMA_BASE_URL=http://TAILNET-OLLAMA-HOST:11434
VITE_REPOSITORY_URL=https://github.com/your-org/privacy-checker
```

## 3. Deploy On A VPS

Use any VPS provider. The expected layout is:

- Docker and Docker Compose installed.
- App files placed in `/opt/privacy-checker` or another service directory.
- `.env` created on the VPS and excluded from git.
- Container bound to `127.0.0.1:5173`.
- Caddy or Nginx serves HTTPS and proxies to the container.

Docker command:

```bash
docker compose up -d --build
```

Health checks:

```bash
curl -fsS http://127.0.0.1:5173/
curl -fsS "http://127.0.0.1:5173/api/scan?url=https://example.com"
```

## 4. Optional Tailnet AI Setup

The app can generate the summarized teacher notification through a private AIPC/Ollama service. A safe pattern is:

- Public VPS hosts the web app.
- AI host runs on another machine.
- Both machines join the same Tailnet.
- VPS `.env` points `OLLAMA_BASE_URL` or `AIPC_ENDPOINT` at the private Tailnet address.

Do not publish the real Tailnet IP, device name, auth keys, or API keys.

## 5. Publish The Repo Link In The UI

Set `VITE_REPOSITORY_URL` before building if your fork lives somewhere else:

```bash
VITE_REPOSITORY_URL=https://github.com/your-org/privacy-checker npm run build
```

If unset, the app uses the default repository link in `src/main.jsx`.

## Public Repo Checklist

- `.env` is not committed.
- No VPS IP addresses or SSH usernames are committed.
- No Tailnet IPs, device names, or auth keys are committed.
- No API keys or model endpoint secrets are committed.
- Reverse proxy examples use `privacychecker.example.com`.
- Docs explain the pattern with placeholders only.
