import { SEED_HTML } from "./seed.ts";

const KITS: Record<string, { name: string; price: number; stock: number; photo: string | null }[]> = {
  store: [
    { name: "Canvas tote", price: 890, stock: 12, photo: "/shop/tote.jpg" },
    { name: "Cap", price: 450, stock: 20, photo: "/shop/cap.jpg" },
    { name: "Tee", price: 1290, stock: 8, photo: "/shop/tee.jpg" },
  ],
  cafe: [
    { name: "Espresso", price: 80, stock: 40, photo: null },
    { name: "Pour-over", price: 120, stock: 24, photo: null },
    { name: "Butter croissant", price: 95, stock: 16, photo: null },
  ],
};

export async function ensureShop(
  db: D1Database,
  projectId: string,
  kit: "store" | "cafe" = "store",
): Promise<void> {
  const row = await db
    .prepare("SELECT COUNT(*) AS c FROM shop_products WHERE project_id = ?")
    .bind(projectId)
    .first<{ c: number }>();
  if ((row?.c ?? 0) > 0) return;
  for (const p of KITS[kit] || KITS.store) {
    await db
      .prepare("INSERT INTO shop_products (project_id, name, price, stock, photo) VALUES (?, ?, ?, ?, ?)")
      .bind(projectId, p.name, p.price, p.stock, p.photo)
      .run();
  }
}

export async function handlePreview(
  request: Request,
  env: { DB_PROJECTS: D1Database; R2_ASSETS: R2Bucket },
  projectId: string,
  rest: string,
): Promise<Response> {
  const path = rest || "/";
  if (path === "/api/products" && request.method === "GET") {
    await ensureShop(env.DB_PROJECTS, projectId);
    const { results } = await env.DB_PROJECTS.prepare(
      "SELECT id, name, price, stock, photo FROM shop_products WHERE project_id = ?",
    )
      .bind(projectId)
      .all();
    return Response.json({ products: results ?? [] });
  }
  if (path === "/api/orders" && request.method === "POST") {
    const body = (await request.json()) as { product_id?: number; qty?: number };
    const id = Number(body.product_id);
    const qty = Math.max(1, Number(body.qty) || 1);
    const row = await env.DB_PROJECTS.prepare(
      "SELECT stock FROM shop_products WHERE project_id = ? AND id = ?",
    )
      .bind(projectId, id)
      .first<{ stock: number }>();
    if (!row || row.stock < qty) return Response.json({ error: "out of stock" }, { status: 409 });
    const now = new Date().toISOString();
    await env.DB_PROJECTS.batch([
      env.DB_PROJECTS.prepare(
        "UPDATE shop_products SET stock = stock - ? WHERE project_id = ? AND id = ?",
      ).bind(qty, projectId, id),
      env.DB_PROJECTS.prepare(
        "INSERT INTO shop_orders (project_id, product_id, qty, created_at) VALUES (?, ?, ?, ?)",
      ).bind(projectId, id, qty, now),
    ]);
    return Response.json({ ok: true });
  }
  if (path === "/api/orders" && request.method === "GET") {
    const { results } = await env.DB_PROJECTS.prepare(
      "SELECT id, product_id, qty, created_at FROM shop_orders WHERE project_id = ? ORDER BY id DESC LIMIT 20",
    )
      .bind(projectId)
      .all();
    return Response.json({ orders: results ?? [] });
  }
  if (path.startsWith("/files/")) {
    const key = `proj/${projectId}/${path.slice("/files/".length)}`;
    const obj = await env.R2_ASSETS.get(key);
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
