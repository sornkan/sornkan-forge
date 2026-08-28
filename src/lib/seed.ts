export const SEED_SCHEMA = `CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  price INTEGER NOT NULL,
  stock INTEGER NOT NULL,
  photo TEXT
);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  qty INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO products (name, price, stock, photo) VALUES
  ('Canvas tote', 890, 12, '/shop/tote.jpg'),
  ('Cap', 450, 20, '/shop/cap.jpg'),
  ('Tee', 1290, 8, '/shop/tee.jpg');
`;

export const SEED_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Atelier</title>
<style>
:root{--ink:#1C1916;--muted:#6B6458;--line:rgba(28,25,22,.1);--bg:#F6F1E8}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Georgia,"Iowan Old Style",serif;background:var(--bg);color:var(--ink);-webkit-font-smoothing:antialiased}
header{display:flex;justify-content:space-between;align-items:center;padding:18px 28px}
header b{letter-spacing:.12em;text-transform:uppercase;font-size:12px}
#cart{font-family:system-ui,sans-serif;font-size:12px;border:1px solid var(--line);border-radius:999px;padding:7px 14px;background:#fff;font-variant-numeric:tabular-nums}
.hero{padding:12px 28px 8px}
.hero h1{font-size:clamp(36px,6vw,56px);font-weight:500;letter-spacing:-.04em;line-height:.95}
.hero p{margin-top:10px;color:var(--muted);max-width:28em;font-family:system-ui,sans-serif;font-size:14px}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;padding:18px 28px 40px}
.card{background:#fff;border-radius:18px;overflow:hidden;outline:1px solid rgba(0,0,0,.08);
  box-shadow:0 18px 40px -24px rgba(28,25,22,.35)}
.card img,.ph{width:100%;height:220px;object-fit:cover;display:block;outline:1px solid rgba(0,0,0,.08)}
.ph{background:linear-gradient(135deg,#E8E2D6,#C9B8A0)}
.card h2{font-size:18px;font-weight:500;padding:12px 14px 0}
.card p{font-family:system-ui,sans-serif;font-size:13px;color:var(--muted);padding:4px 14px 12px;font-variant-numeric:tabular-nums}
.card button{margin:0 14px 14px;width:calc(100% - 28px);border:0;background:var(--ink);color:#fff;
  border-radius:999px;padding:10px;font-weight:700;font-family:system-ui,sans-serif;cursor:pointer}
.card button:active{transform:scale(.96)}
#toast{position:fixed;bottom:18px;left:50%;transform:translateX(-50%);background:#1C1916;color:#F6F1E8;
  padding:8px 14px;border-radius:999px;font-size:13px;font-family:system-ui,sans-serif;display:none}
@media(max-width:700px){.grid{grid-template-columns:1fr;padding:16px}.hero{padding:8px 16px}}
</style>
</head>
<body>
<header><b>Atelier</b><span id="cart">Cart 0</span></header>
<div class="hero">
  <h1>New in.</h1>
  <p>Stock is live from the database. Photos are served from storage. Add something — the count drops.</p>
</div>
<div class="grid" id="grid"></div>
<div id="toast"></div>
<script>
const grid = document.getElementById("grid");
const cartEl = document.getElementById("cart");
const toast = document.getElementById("toast");
let cart = 0;
function say(t){ toast.textContent = t; toast.style.display = "block"; setTimeout(()=>toast.style.display="none", 1400); }
async function load(){
  const r = await fetch("api/products");
  const data = await r.json();
  grid.innerHTML = (data.products||[]).map(p => \`
    <article class="card">
      \${p.photo ? '<img src="'+p.photo+'" alt="'+p.name+'">' : '<div class="ph"></div>'}
      <h2>\${p.name}</h2>
      <p>\${p.price.toLocaleString()} · \${p.stock} left</p>
      <button data-id="\${p.id}">Add to bag</button>
    </article>\`).join("");
}
grid.addEventListener("click", async (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  const r = await fetch("api/orders", { method:"POST", headers:{ "content-type":"application/json" },
    body: JSON.stringify({ product_id: Number(btn.dataset.id), qty: 1 }) });
  if (!r.ok) { say("Out of stock"); return; }
  cart += 1;
  cartEl.textContent = "Cart " + cart;
  say("Added · stock updated");
  load();
});
load();
</script>
</body>
</html>
`;

export const BLANK_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Empty</title>
<style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#F6F1E8;color:#1C1916;
  font-family:Georgia,serif;text-align:center;padding:32px}
h1{font-size:42px;font-weight:500;letter-spacing:-.04em;margin:0 0 10px}
p{color:#6B6458;max-width:28em;margin:0 auto;font-family:system-ui,sans-serif}
</style>
</head>
<body>
  <div>
    <h1>Nothing here yet.</h1>
    <p>This is a blank canvas. Your agent will build the site from the brief.</p>
  </div>
</body>
</html>
`;

export const CAFE_HTML = SEED_HTML
  .replace("Atelier", "Hearth")
  .replace("New in.", "On the bar.")
  .replace("Stock is live from the database. Photos are served from storage. Add something — the count drops.", "Drinks and pastry. Orders write to the database.");

export type StartMode = "blank" | "store" | "cafe";

export function htmlForStart(start: StartMode): string {
  if (start === "blank") return BLANK_HTML;
  if (start === "cafe") return CAFE_HTML;
  return SEED_HTML;
}

export const BLANK_INDEX = `export default {
  async fetch() {
    return new Response(${JSON.stringify(BLANK_HTML)}, {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  },
};
`;

export const SEED_INDEX = `export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/products" && request.method === "GET") {
      if (!env.DB) return Response.json({ products: [] });
      const { results } = await env.DB.prepare("SELECT id, name, price, stock, photo FROM products").all();
      return Response.json({ products: results ?? [] });
    }
    if (url.pathname === "/api/orders" && request.method === "POST") {
      const body = await request.json();
      const id = Number(body.product_id);
      const qty = Math.max(1, Number(body.qty) || 1);
      if (!env.DB) return Response.json({ ok: true, local: true });
      const row = await env.DB.prepare("SELECT stock FROM products WHERE id = ?").bind(id).first();
      if (!row || row.stock < qty) return Response.json({ error: "out of stock" }, { status: 409 });
      await env.DB.batch([
        env.DB.prepare("UPDATE products SET stock = stock - ? WHERE id = ?").bind(qty, id),
        env.DB.prepare("INSERT INTO orders (product_id, qty, created_at) VALUES (?, ?, ?)").bind(id, qty, new Date().toISOString()),
      ]);
      return Response.json({ ok: true });
    }
    if (url.pathname.startsWith("/files/") && env.BUCKET) {
      const obj = await env.BUCKET.get(url.pathname.slice("/files/".length));
      if (!obj) return new Response("not found", { status: 404 });
      return new Response(obj.body, { headers: { "content-type": obj.httpMetadata?.contentType || "application/octet-stream" } });
    }
    return new Response(${JSON.stringify(SEED_HTML)}, { headers: { "content-type": "text/html; charset=utf-8" } });
  }
};
`;

export function indexForStart(start: StartMode): string {
  return start === "blank" ? BLANK_INDEX : SEED_INDEX;
}
