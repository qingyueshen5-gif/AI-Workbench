# AI Workbench Managed Proxy

Cloudflare Workers service for production `shared_managed` model access.

## Purpose

The desktop app and employees keep using the local model proxy:

```text
Workbench / Hermes / OpenClaw -> 127.0.0.1:18800 -> Managed Proxy -> DeepSeek
```

The real DeepSeek key is stored only as a Cloudflare Worker Secret.

## Required Secrets

Set these with Wrangler. Do not put values in command arguments, chat, Git, `.env`, logs, or reports.

```bash
npx wrangler secret put DEEPSEEK_API_KEY
npx wrangler secret put TOKEN_SIGNING_SECRET
npx wrangler secret put INSTALLATION_HASH_SALT
```

## D1

Create and bind a D1 database named `aiw-managed-proxy`, then replace `database_id` in `wrangler.jsonc`.

```bash
npx wrangler d1 create aiw-managed-proxy
npx wrangler d1 execute aiw-managed-proxy --remote --file ./schema.sql
```

## Deploy

```bash
npx wrangler deploy
```

Use the returned `workers.dev` URL as the public managed proxy URL for `model-proxy.mjs`.

## Security Boundary

- Do not log Authorization headers.
- Do not log prompts or responses.
- Do not let clients choose an upstream URL.
- Only `deepseek-chat` is allowed in the first alpha.
- `MANAGED_PROXY_ENABLED=false` is the emergency stop.
