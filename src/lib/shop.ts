import { SEED_HTML } from "./seed.ts";
import { isOwnDb } from "./isolate.ts";
import { getR2Object, queryD1, execD1, type CfEnv } from "./cf.ts";

type PreviewEnv = {
  DB_PROJECTS: D1Database;
  R2_ASSETS: R2Bucket;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_API_TOKEN?: string;
  DISPATCH_NAMESPACE?: string;
};

function cfEnv(env: PreviewEnv): CfEnv | null {
  if (!env.CLOUDFLARE_API_TOKEN || !env.CLOUDFLARE_ACCOUNT_ID) return null;
  return {
    CLOUDFLARE_ACCOUNT_ID: env.CLOUDFLARE_ACCOUNT_ID,
    CLOUDFLARE_API_TOKEN: env.CLOUDFLARE_API_TOKEN,
    DISPATCH_NAMESPACE: env.DISPATCH_NAMESPACE,
  };
}

export async function handlePreview(
  request: Request,
  env: PreviewEnv,
  projectId: string,
  rest: string,
): Promise<Response> {
  const path = rest || "/";
  const project = await env.DB_PROJECTS.prepare(
    "SELECT d1_id, r2_bucket, r2_prefix FROM projects WHERE id = ?",
  )
    .bind(projectId)
    .first<{ d1_id: string | null; r2_bucket: string | null; r2_prefix: string | null }>();
  const cf = cfEnv(env);
  const d1 = project && isOwnDb(project.d1_id) ? project.d1_id : null;

  if (path === "/api/products" && request.method === "GET") {
    if (!d1 || !cf) return Response.json({ products: [] });
    const products = await queryD1(cf, d1, "SELECT id, name, price, stock, photo FROM products ORDER BY id");
    return Response.json({ products });
  }
  if (path === "/api/orders" && request.method === "POST") {
    if (!d1 || !cf) return Response.json({ error: "no database" }, { status: 409 });
    const body = (await request.json()) as { product_id?: number; qty?: number };
    const id = Number(body.product_id);
    const qty = Math.max(1, Number(body.qty) || 1);
    const rows = await queryD1(cf, d1, "SELECT stock FROM products WHERE id = ?", [id]);
    const stock = Number(rows[0]?.stock ?? 0);
    if (!rows[0] || stock < qty) return Response.json({ error: "out of stock" }, { status: 409 });
    const now = new Date().toISOString();
    await execD1(cf, d1, "UPDATE products SET stock = stock - ? WHERE id = ?", [qty, id]);
    await execD1(cf, d1, "INSERT INTO orders (product_id, qty, created_at) VALUES (?, ?, ?)", [id, qty, now]);
    return Response.json({ ok: true });
  }
  if (path === "/api/orders" && request.method === "GET") {
    if (!d1 || !cf) return Response.json({ orders: [] });
    const orders = await queryD1(
      cf,
      d1,
      "SELECT id, product_id, qty, created_at FROM orders ORDER BY id DESC LIMIT 20",
    );
    return Response.json({ orders });
  }
  if (path.startsWith("/files/")) {
    const key = path.slice("/files/".length).replace(/^\/+/, "");
    if (project?.r2_bucket && cf) {
      const obj = await getR2Object(cf, project.r2_bucket, key);
      if (!obj) return new Response("not found", { status: 404 });
      return new Response(obj.body, { headers: { "content-type": obj.contentType } });
    }
    const prefix = project?.r2_prefix || `proj/${projectId}/`;
    const obj = await env.R2_ASSETS.get(prefix + key);
    if (!obj) return new Response("not found", { status: 404 });
    return new Response(obj.body, {
      headers: { "content-type": obj.httpMetadata?.contentType || "application/octet-stream" },
    });
  }

  const htmlRow = await env.DB_PROJECTS.prepare(
    "SELECT content FROM files WHERE project_id = ? AND path = 'public/index.html'",
  )
    .bind(projectId)
    .first<{ content: string }>();
  return new Response(htmlRow?.content || SEED_HTML, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
