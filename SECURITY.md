# Security

This repository is public for the [OpenAI WebMCP Challenge](https://webmcp.devpost.com/). Treat it as source anyone can read.

## What is not a secret

These identifiers appear in `wrangler.jsonc` so the live demo can deploy. They do not grant access:

- Cloudflare **account ID**
- D1 **database ID**
- R2 **bucket name**
- Worker **script names**

Forks should replace them with their own account resources.

## What must never be committed

| Value | Where it lives |
|---|---|
| `CLOUDFLARE_API_TOKEN` | local `.dev.vars` or `wrangler secret put` |
| Any `.dev.vars` / `.env` with real values | gitignored |
| Session cookies | HttpOnly, generated at runtime |

The example files (`.dev.vars.example`, `.env.example`) stay empty on purpose.

## Token scopes (if you self-host)

Create a **scoped** API token, not Global API Key:

- Account → Cloudflare Workers Scripts: Edit
- Account → D1: Edit
- Account → Account Settings: Read

Do not grant billing, DNS, or user-management scopes.

## Product notes for a public demo

- **Invite links** (`?p=` project id) are capability URLs. Anyone with the link can join the editor. Project ids are short hex; this is a hackathon demo, not a multi-tenant SaaS.
- **Preview** (`/preview/:id/`) is reachable without a session so ChatGPT’s in-app browser can load it.
- **SQL tools** refuse mutating statements unless the tool is the confirmed `run_sql` path. File writes are limited to `src/`, `public/`, `schema.sql`, and `wrangler.jsonc`.
- **No LLM keys** in this app. ChatGPT / Codex bring their own model. The page only registers WebMCP tools.

Report issues privately if you find a token or a way to run SQL / deploy against someone else’s Cloudflare account.
