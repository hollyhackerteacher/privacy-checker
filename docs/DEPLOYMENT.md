# Deployment

This project can run as a normal Node app or as a Docker Compose service.

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

Required only when AI evaluation is enabled:

```bash
AIPC_PROVIDER=ollama
AIPC_MODEL=qwen2.5:14b
OLLAMA_BASE_URL=http://YOUR-OLLAMA-HOST:11434
```

For a custom AIPC HTTP endpoint instead of Ollama:

```bash
AIPC_ENDPOINT=https://your-aipc-endpoint.example/api/evaluate
AIPC_API_KEY=your-secret-key
```

## Reverse Proxy

For Caddy:

```caddyfile
privacychecker.example.com {
    encode zstd gzip
    reverse_proxy 127.0.0.1:5173
}
```

For Nginx, adapt `deploy/nginx.conf`.

## Verification

```bash
curl -fsS http://127.0.0.1:5173/
curl -fsS "http://127.0.0.1:5173/api/scan?url=https://example.com"
```

For public HTTPS:

```bash
curl -I https://privacychecker.example.com/
```
