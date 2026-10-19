import { describe, expect, it } from "vitest";
import { handlePreview } from "../src/lib/shop.ts";

const PROJECT = "11111111-2222-3333-4444-555555555555";

type PreviewEnv = Parameters<typeof handlePreview>[1];

function fakeEnv(sessionProject: string | null): PreviewEnv {
  return {
    DB_PROJECTS: {
      prepare: (sql: string) => ({
        bind: () => ({
          first: async () => {
            if (sql.includes("FROM sessions")) {
              return sessionProject ? { project_id: sessionProject } : null;
            }
            return { d1_id: null, r2_bucket: null, r2_prefix: null };
          },
        }),
      }),
    },
  } as unknown as PreviewEnv;
}

function req(method: string, cookie?: string, body?: unknown): Request {
  return new Request("https://forge.test/preview/x/api/orders", {
    method,
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

describe("preview order auth", () => {
  it("rejects POST /api/orders without a session", async () => {
    const res = await handlePreview(req("POST", undefined, { product_id: 1, qty: 1 }), fakeEnv(null), PROJECT, "/api/orders");
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "auth required" });
  });

  it("rejects GET /api/orders without a session", async () => {
    const res = await handlePreview(req("GET"), fakeEnv(null), PROJECT, "/api/orders");
    expect(res.status).toBe(401);
  });

  it("rejects a session bound to another project", async () => {
    const res = await handlePreview(
      req("POST", "forge_sid=abc", { product_id: 1, qty: 1 }),
      fakeEnv("other-project"),
      PROJECT,
      "/api/orders",
    );
    expect(res.status).toBe(401);
  });

  it("lets the project session through to the handler", async () => {
    const res = await handlePreview(
      req("POST", "forge_sid=abc", { product_id: 1, qty: 1 }),
      fakeEnv(PROJECT),
      PROJECT,
      "/api/orders",
    );
    // No D1 attached in the fixture, so the handler answers 409 — past the 401 gate.
    expect(res.status).toBe(409);
  });

  it("keeps the product catalog public", async () => {
    const res = await handlePreview(req("GET"), fakeEnv(null), PROJECT, "/api/products");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ products: [] });
  });
});
