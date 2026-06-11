# Deployment

This project can run as a normal Node app or as a Docker Compose service. Keep deployment-specific values out of git.

## Local Setup

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

## Production With Docker

```bash
cp .env.example .env
nano .env
docker compose up -d --build
```

The app listens on `127.0.0.1:5173` by default through `docker-compose.yml`.

## Environment

Do not commit `.env`.

Required only when teacher-notification generation is enabled:

```bash
AIPC_PROVIDER=ollama
AIPC_MODEL=qwen2.5:14b
OLLAMA_BASE_URL=http://YOUR-OLLAMA-HOST:11434
```

For a custom AIPC HTTP endpoint instead of Ollama:

```bash
AIPC_ENDPOINT=https://your-aipc-endpoint.example/api/evaluate
AIPC_API_KEY=
```

Optional frontend build value:

```bash
VITE_REPOSITORY_URL=https://github.com/hollyhackerteacher/privacy-checker
```

## VPS Pattern

Recommended shape for a public deployment:

1. Provision a VPS with Docker and Docker Compose.
2. Put the app in a server path such as `/opt/privacy-checker`.
3. Store runtime values in `/opt/privacy-checker/.env`.
4. Run `docker compose up -d --build`.
5. Put Caddy or Nginx in front of `127.0.0.1:5173`.
6. Point DNS for `privacychecker.example.com` to the VPS.

Do not commit VPS IP addresses, SSH users, private hostnames, Tailnet IPs, or server-specific `.env` values.

## Tailnet / Private AI Pattern

If the scanner uses a private AIPC/Ollama host, keep that host reachable only over a private network such as a Tailnet. The public VPS should call the private model endpoint through the Tailnet address stored in `.env`.

Example placeholder:

```bash
OLLAMA_BASE_URL=http://TAILNET-OLLAMA-HOST:11434
```

Keep actual Tailnet device names and IPs out of public docs.

## Reverse Proxy

For Caddy:

```caddyfile
privacychecker.example.com {
    encode zstd gzip
    reverse_proxy 127.0.0.1:5173
}
```

For Nginx, adapt `deploy/nginx.conf`; it intentionally uses `privacychecker.example.com`.

## Verification

```bash
curl -fsS http://127.0.0.1:5173/
curl -fsS "http://127.0.0.1:5173/api/scan?url=https://example.com"
```

For public HTTPS:

```bash
curl -I https://privacychecker.example.com/
```
