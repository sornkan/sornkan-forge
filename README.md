# SORNKan Forge

[![License: MIT](https://img.shields.io/badge/License-MIT-0B6E4F.svg)](LICENSE)

Live: **https://forge-worker-editor.sornkan.workers.dev**

A Lovable-style editor where **your** agent builds a real Cloudflare Worker. The human types a brief, invites ChatGPT (desktop in-app browser) or Chrome with WebMCP, and watches the preview. Preview and publish sit on **Workers + D1 + R2** — more than a ChatGPT Site.

Forge does not run an LLM. The page registers tools with `document.modelContext.registerTool`. You watch, pin notes, and publish.

Submission for the [OpenAI WebMCP Challenge](https://webmcp.devpost.com/) (deadline 3 Sep 2026, 1:00pm PT). License: **MIT** (OSI, visible in GitHub About).

## For judges

1. Open the [live URL](https://forge-worker-editor.sornkan.workers.dev) in **ChatGPT desktop** (GPT-5.6 **Sol** or **Terra**, not Luna) or **Chrome 149+** with `chrome://flags/#enable-webmcp-testing`.
2. Click **Store** (or Cafe / Conjure).
3. Ask the agent:

   > Use the site tools. Read `get_project`. Attach database and storage if needed. Edit the shop. After I pin a note, read `list_annotations` and patch the UI.

4. Click the preview, leave a pin, wait for the patch, then **Publish**.

Declarative form tools and iframe tools are not used. All tools register on the **top-level** editor document.

### WebMCP registration (in this repo)

```js
await document.modelContext.registerTool({
  name: "search_products",
  description: "Search the product catalog",
  inputSchema: { /* ... */ },
  execute: async (input) => { /* ... */ },
});
```

The live catalog is registered the same way in [`public/app.js`](public/app.js):

```js
await document.modelContext.registerTool(
  {
    name: "search_products",
    title: "Search products",
    description: "Search the product catalog by name.",
    inputSchema: { type: "object", properties: { query: { type: "string" } }, additionalProperties: false },
    annotations: { readOnlyHint: true, untrustedContentHint: false },
    async execute(input, { signal } = {}) {
      return callTool("search_products", input || {}, signal);
    },
  },
  { signal: registration.signal },
);
```

Tool names live in [`src/lib/catalog.ts`](src/lib/catalog.ts) (`get_project`, `attach_module`, `write_file`, `deploy_preview`, `publish`, annotations, D1/R2, …).

## Why WebMCP

Humans and agents share one URL. The human sees the canvas; the agent gets structured tools on that same document. Invite uses `?p=` so ChatGPT’s in-app browser can join without the human’s cookie.

## Local

```bash
cp .dev.vars.example .dev.vars
# fill CLOUDFLARE_API_TOKEN (Workers Scripts Write + D1 Edit)
# fill CLOUDFLARE_ACCOUNT_ID (or keep wrangler.jsonc account_id)
npx wrangler d1 migrations apply forge-d1-projects --local
npx wrangler dev
npx vitest run
```

`CLOUDFLARE_API_TOKEN` is a **secret**. Put it in `.dev.vars` locally and `wrangler secret put CLOUDFLARE_API_TOKEN` in production. See [SECURITY.md](SECURITY.md).

## Cloudflare names

| Resource | Name |
|---|---|
| Editor Worker | `forge-worker-editor` |
| Dispatch Worker | `forge-worker-dispatch` |
| Dispatch namespace | `forge-apps` |
| Project metadata D1 | `forge-d1-projects` |
| Per-app D1 | `forge-d1-proj-{id}` |
| Shared R2 | `forge-r2-assets` |
| User Workers | `forge-user-{id}` |

Hackathon runtime is **our** Cloudflare account. Workers for Platforms (dispatch namespaces) is not enabled on this account yet, so user apps upload as named Workers `forge-user-{id}` when a token is present. Without a token, preview is hosted on the editor Worker at `/preview/:id/`.

## License

[MIT](LICENSE) — OSI-approved, required by the WebMCP Challenge rules (public repo + license visible in GitHub About).
