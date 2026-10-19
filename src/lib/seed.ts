export type StartMode = "blank" | "store" | "cafe" | "book" | "learn";
export type Look = "simple" | "playful" | "elegant" | "brutalist";
/** What the human picked. "custom" is not a look: it has no CSS, an agent builds it. */
export type ThemeChoice = Look | "custom";
/** Legacy alias kept so older imports keep compiling. */
export type ThemeId = Look;

export const LOOKS: readonly Look[] = ["simple", "playful", "elegant", "brutalist"];
export const STARTS: readonly StartMode[] = ["blank", "store", "cafe", "book", "learn"];
export const DEFAULT_LOOK: Look = "elegant";

// atelier and luna were the two themes before the four-look picker.
const LEGACY_LOOKS: Record<string, Look> = { atelier: "elegant", luna: "playful" };

/**
 * Strict allowlist. The raw value only ever selects one of four known CSS blocks —
 * it is never interpolated into generated CSS or HTML. Anything unknown is elegant.
 */
export function parseTheme(raw: unknown): Look {
  if (typeof raw !== "string") return DEFAULT_LOOK;
  if ((LOOKS as readonly string[]).includes(raw)) return raw as Look;
  return LEGACY_LOOKS[raw] ?? DEFAULT_LOOK;
}

export const parseLook = parseTheme;

/** Same allowlist, but keeps "custom" — the state where an agent builds the look. */
export function parseThemeChoice(raw: unknown): ThemeChoice {
  return raw === "custom" ? "custom" : parseTheme(raw);
}

export function parseStart(raw: unknown): StartMode {
  return typeof raw === "string" && (STARTS as readonly string[]).includes(raw) ? (raw as StartMode) : "store";
}

export const PROMPT_LIMIT = 2000;

/**
 * Custom build/style prompts are plain data an agent reads later. They are never
 * rendered server-side, so this only has to make them safe to store and relay:
 * drop control characters, keep tab and newline, cap the length.
 */
export function sanitizePrompt(raw: unknown, limit: number = PROMPT_LIMIT): string {
  if (typeof raw !== "string") return "";
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, "")
    .trim()
    .slice(0, limit);
}

/** Custom projects are only reachable through the invite link, never "Open project". */
export function requiresInvite(choice: unknown): boolean {
  return parseThemeChoice(choice) === "custom";
}

const TABLES = `CREATE TABLE IF NOT EXISTS products (
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
`;

const STORE_ROWS = `INSERT INTO products (name, price, stock, photo) VALUES
  ('Canvas tote', 890, 12, '/shop/tote.jpg'),
  ('Cap', 450, 20, '/shop/cap.jpg'),
  ('Tee', 1290, 8, '/shop/tee.jpg');
`;

const CAFE_ROWS = `INSERT INTO products (name, price, stock, photo) VALUES
  ('Espresso', 80, 40, NULL),
  ('Pour-over', 120, 24, NULL),
  ('Butter croissant', 95, 16, NULL);
`;

const BOOK_TABLES = `CREATE TABLE IF NOT EXISTS rooms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  seats INTEGER NOT NULL,
  price INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  time_slot TEXT NOT NULL,
  guest_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'held',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

const BOOK_ROWS = `INSERT INTO rooms (name, seats, price) VALUES
  ('Studio A', 6, 450),
  ('Focus Room', 2, 250),
  ('Garden Room', 10, 650);
`;

const LEARN_TABLES = `CREATE TABLE IF NOT EXISTS lessons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  sort_order INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS progress (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  current_order INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

const LEARN_ROWS = `INSERT INTO lessons (title, sort_order) VALUES
  ('Light', 1),
  ('Camera', 2),
  ('Exposure', 3),
  ('Prints', 4);
INSERT INTO progress (id, current_order) VALUES (1, 3);
`;

export function schemaForStart(start: StartMode): string {
  if (start === "blank") return TABLES;
  if (start === "cafe") return TABLES + CAFE_ROWS;
  if (start === "book") return BOOK_TABLES + BOOK_ROWS;
  if (start === "learn") return LEARN_TABLES + LEARN_ROWS;
  return TABLES + STORE_ROWS;
}

export const SEED_SCHEMA = schemaForStart("store");

// ---------------------------------------------------------------------------
// Looks. Four fixed CSS blocks, same selector shape, swapped in wholesale.
// ---------------------------------------------------------------------------

const ELEGANT_CSS = `:root{--ink:#1C1916;--muted:#6B6458;--line:rgba(28,25,22,.1);--bg:#F6F1E8}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Georgia,"Iowan Old Style",serif;background:var(--bg);color:var(--ink);-webkit-font-smoothing:antialiased}
header{display:flex;justify-content:space-between;align-items:center;padding:18px 28px}
header b{letter-spacing:.12em;text-transform:uppercase;font-size:12px}
#cart,#queue{font-family:system-ui,sans-serif;font-size:12px;border:1px solid var(--line);border-radius:999px;padding:7px 14px;background:#fff;font-variant-numeric:tabular-nums}
.sec{font-family:system-ui,sans-serif;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);padding:16px 28px 0}
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
.pick{display:flex;flex-wrap:wrap;gap:10px;align-items:center;padding:6px 28px 0;font-family:system-ui,sans-serif}
.pick input{font:inherit;font-size:13px;padding:8px 12px;border:1px solid var(--line);border-radius:999px;background:#fff;color:var(--ink)}
.slots{display:flex;gap:8px;flex-wrap:wrap}
.slot{font:inherit;font-size:12px;padding:8px 13px;border:1px solid var(--line);border-radius:999px;background:#fff;color:var(--ink);cursor:pointer}
.slot[aria-pressed=true]{background:var(--ink);color:var(--bg);border-color:var(--ink)}
.grid.list{grid-template-columns:1fr;max-width:640px}
.card.on{outline:2px solid var(--ink)}
.card .step{font-family:system-ui,sans-serif;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);padding:12px 14px 0}
#toast{position:fixed;bottom:18px;left:50%;transform:translateX(-50%);background:#1C1916;color:#F6F1E8;
  padding:8px 14px;border-radius:999px;font-size:13px;font-family:system-ui,sans-serif;display:none}
@media(max-width:700px){.grid{grid-template-columns:1fr;padding:16px}.hero{padding:8px 16px}.pick{padding:6px 16px 0}.sec{padding:14px 16px 0}}`;

const PLAYFUL_CSS = `:root{--ink:#3B1230;--muted:#7A4560;--line:rgba(190,24,93,.16);--bg:#FFF4F8;--accent:#DB2777;--price:#BE185D}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:"Segoe UI","Leelawadee UI","Sukhumvit Set",system-ui,sans-serif;background:var(--bg);color:var(--ink);-webkit-font-smoothing:antialiased}
header{display:flex;justify-content:space-between;align-items:center;padding:18px 28px}
header b{letter-spacing:.12em;text-transform:uppercase;font-size:12px}
#cart,#queue{font-family:system-ui,sans-serif;font-size:12px;border:1px solid var(--line);border-radius:999px;padding:7px 14px;background:#fff;font-variant-numeric:tabular-nums}
.sec{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--price);font-weight:700;padding:16px 28px 0}
.hero{padding:12px 28px 8px}
.hero h1{font-size:clamp(36px,6vw,56px);font-weight:900;letter-spacing:-.04em;line-height:.95;color:#fff;-webkit-text-stroke:3px #3B1230;paint-order:stroke fill}
.hero p{margin-top:10px;color:var(--muted);max-width:28em;font-size:14px}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;padding:18px 28px 40px}
.card{background:#fff;border-radius:18px;overflow:hidden;outline:1px solid rgba(0,0,0,.08);
  box-shadow:0 18px 40px -24px rgba(219,39,119,.35)}
.card img,.ph{width:100%;height:220px;object-fit:cover;display:block;outline:1px solid rgba(0,0,0,.08)}
.ph{background:linear-gradient(135deg,#fce7f3,#f9a8d4)}
.card h2{font-size:18px;font-weight:700;padding:12px 14px 0}
.card p{font-size:13px;color:var(--price);padding:4px 14px 12px;font-variant-numeric:tabular-nums}
.card button{margin:0 14px 14px;width:calc(100% - 28px);border:0;background:var(--accent);color:#fff;
  border-radius:999px;padding:10px;font-weight:700;font-family:system-ui,sans-serif;cursor:pointer}
.card button:active{transform:scale(.96)}
.pick{display:flex;flex-wrap:wrap;gap:10px;align-items:center;padding:6px 28px 0}
.pick input{font:inherit;font-size:13px;padding:8px 12px;border:1px solid var(--line);border-radius:999px;background:#fff;color:var(--ink)}
.slots{display:flex;gap:8px;flex-wrap:wrap}
.slot{font:inherit;font-size:12px;padding:8px 13px;border:1px solid var(--line);border-radius:999px;background:#fff;color:var(--price);font-weight:700;cursor:pointer}
.slot[aria-pressed=true]{background:var(--accent);color:#fff;border-color:var(--accent)}
.grid.list{grid-template-columns:1fr;max-width:640px}
.card.on{outline:2px solid var(--accent)}
.card .step{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--price);font-weight:700;padding:12px 14px 0}
#toast{position:fixed;bottom:18px;left:50%;transform:translateX(-50%);background:#3B1230;color:#FFF4F8;
  padding:8px 14px;border-radius:999px;font-size:13px;font-family:system-ui,sans-serif;display:none}
@media(max-width:700px){.grid{grid-template-columns:1fr;padding:16px}.hero{padding:8px 16px}.pick{padding:6px 16px 0}.sec{padding:14px 16px 0}}`;

const SIMPLE_CSS = `:root{--ink:#0f172a;--muted:#64748b;--line:#e2e8f0;--bg:#ffffff;--accent:#0f172a}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;background:var(--bg);color:var(--ink);-webkit-font-smoothing:antialiased}
header{display:flex;justify-content:space-between;align-items:center;padding:18px 28px}
header b{letter-spacing:.12em;text-transform:uppercase;font-size:12px}
#cart,#queue{font-size:12px;border:1px solid var(--line);border-radius:10px;padding:7px 14px;background:#fff;font-variant-numeric:tabular-nums}
.sec{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);padding:16px 28px 0}
.hero{padding:12px 28px 8px}
.hero h1{font-size:clamp(32px,5vw,46px);font-weight:600;letter-spacing:-.02em;line-height:1.05}
.hero p{margin-top:10px;color:var(--muted);max-width:28em;font-size:14px}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;padding:18px 28px 40px}
.card{background:#fff;border-radius:14px;overflow:hidden;border:1px solid var(--line);
  box-shadow:0 1px 2px rgba(15,23,42,.06),0 14px 30px -20px rgba(15,23,42,.28)}
.card img,.ph{width:100%;height:220px;object-fit:cover;display:block;border-bottom:1px solid var(--line)}
.ph{background:linear-gradient(135deg,#f1f5f9,#e2e8f0)}
.card h2{font-size:17px;font-weight:600;padding:12px 14px 0}
.card p{font-size:13px;color:var(--muted);padding:4px 14px 12px;font-variant-numeric:tabular-nums}
.card button{margin:0 14px 14px;width:calc(100% - 28px);border:0;background:var(--accent);color:#fff;
  border-radius:10px;padding:10px;font-weight:600;font-family:inherit;cursor:pointer}
.card button:active{transform:scale(.98)}
.pick{display:flex;flex-wrap:wrap;gap:10px;align-items:center;padding:6px 28px 0}
.pick input{font:inherit;font-size:13px;padding:8px 12px;border:1px solid var(--line);border-radius:8px;background:#fff;color:var(--ink)}
.slots{display:flex;gap:8px;flex-wrap:wrap}
.slot{font:inherit;font-size:12px;padding:8px 13px;border:1px solid var(--line);border-radius:8px;background:#fff;color:var(--ink);cursor:pointer}
.slot[aria-pressed=true]{background:var(--accent);color:#fff;border-color:var(--accent)}
.grid.list{grid-template-columns:1fr;max-width:640px}
.card.on{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent)}
.card .step{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);padding:12px 14px 0}
#toast{position:fixed;bottom:18px;left:50%;transform:translateX(-50%);background:#0f172a;color:#fff;
  padding:8px 14px;border-radius:10px;font-size:13px;display:none}
@media(max-width:700px){.grid{grid-template-columns:1fr;padding:16px}.hero{padding:8px 16px}.pick{padding:6px 16px 0}.sec{padding:14px 16px 0}}`;

const BRUTALIST_CSS = `:root{--ink:#111;--muted:#111;--line:#111;--bg:#FDE047;--accent:#111}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:ui-monospace,Menlo,Consolas,monospace;background:var(--bg);color:var(--ink);-webkit-font-smoothing:antialiased}
header{display:flex;justify-content:space-between;align-items:center;padding:18px 28px}
header b{letter-spacing:.12em;text-transform:uppercase;font-size:12px}
#cart,#queue{font-size:12px;border:2px solid var(--line);border-radius:0;padding:7px 14px;background:#fff;font-variant-numeric:tabular-nums;text-transform:uppercase}
.sec{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);font-weight:700;padding:16px 28px 0}
.hero{padding:12px 28px 8px}
.hero h1{font-size:clamp(32px,5.5vw,50px);font-weight:700;letter-spacing:-.02em;line-height:1;text-transform:uppercase}
.hero p{margin-top:10px;color:var(--muted);max-width:34em;font-size:13px}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;padding:18px 28px 44px}
.card{background:#fff;border-radius:0;overflow:hidden;border:3px solid var(--ink);
  box-shadow:6px 6px 0 #111}
.card img,.ph{width:100%;height:220px;object-fit:cover;display:block;border-bottom:3px solid var(--ink)}
.ph{background:repeating-linear-gradient(45deg,#FDE047,#FDE047 12px,#fff 12px,#fff 24px)}
.card h2{font-size:17px;font-weight:700;padding:12px 14px 0;text-transform:uppercase;letter-spacing:.04em}
.card p{font-size:13px;color:var(--muted);padding:4px 14px 12px;font-variant-numeric:tabular-nums}
.card button{margin:0 14px 14px;width:calc(100% - 28px);border:0;background:var(--accent);color:#FDE047;
  border-radius:0;padding:11px;font-weight:700;font-family:inherit;text-transform:uppercase;letter-spacing:.04em;cursor:pointer}
.card button:active{transform:translate(2px,2px)}
.pick{display:flex;flex-wrap:wrap;gap:10px;align-items:center;padding:6px 28px 0}
.pick input{font:inherit;font-size:13px;padding:8px 12px;border:2px solid var(--line);border-radius:0;background:#fff;color:var(--ink)}
.slots{display:flex;gap:8px;flex-wrap:wrap}
.slot{font:inherit;font-size:12px;padding:8px 13px;border:2px solid var(--line);border-radius:0;background:#fff;color:var(--ink);text-transform:uppercase;cursor:pointer}
.slot[aria-pressed=true]{background:var(--ink);color:#FDE047}
.grid.list{grid-template-columns:1fr;max-width:640px}
.card.on{box-shadow:6px 6px 0 #111,inset 0 0 0 3px #111}
.card .step{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);padding:12px 14px 0}
#toast{position:fixed;bottom:18px;left:50%;transform:translateX(-50%);background:#111;color:#FDE047;
  padding:9px 14px;border-radius:0;font-size:12px;font-family:inherit;text-transform:uppercase;display:none}
@media(max-width:700px){.grid{grid-template-columns:1fr;padding:16px}.hero{padding:8px 16px}.pick{padding:6px 16px 0}.sec{padding:14px 16px 0}}`;

const PAGE_CSS: Record<Look, string> = {
  elegant: ELEGANT_CSS,
  playful: PLAYFUL_CSS,
  simple: SIMPLE_CSS,
  brutalist: BRUTALIST_CSS,
};

const ELEGANT_BLANK_CSS = `body{margin:0;min-height:100vh;display:grid;place-items:center;background:#F6F1E8;color:#1C1916;
  font-family:Georgia,serif;text-align:center;padding:32px}
h1{font-size:42px;font-weight:500;letter-spacing:-.04em;margin:0 0 10px}
p{color:#6B6458;max-width:28em;margin:0 auto;font-family:system-ui,sans-serif}`;

const PLAYFUL_BLANK_CSS = `body{margin:0;min-height:100vh;display:grid;place-items:center;background:#FFF4F8;color:#3B1230;
  font-family:"Segoe UI","Leelawadee UI","Sukhumvit Set",system-ui,sans-serif;text-align:center;padding:32px}
h1{font-size:42px;font-weight:900;letter-spacing:-.04em;margin:0 0 10px;color:#fff;-webkit-text-stroke:3px #3B1230;paint-order:stroke fill}
p{color:#7A4560;max-width:28em;margin:0 auto;font-family:system-ui,sans-serif}`;

const SIMPLE_BLANK_CSS = `body{margin:0;min-height:100vh;display:grid;place-items:center;background:#ffffff;color:#0f172a;
  font-family:system-ui,-apple-system,"Segoe UI",sans-serif;text-align:center;padding:32px}
h1{font-size:40px;font-weight:600;letter-spacing:-.02em;margin:0 0 10px}
p{color:#64748b;max-width:28em;margin:0 auto}`;

const BRUTALIST_BLANK_CSS = `body{margin:0;min-height:100vh;display:grid;place-items:center;background:#FDE047;color:#111;
  font-family:ui-monospace,Menlo,Consolas,monospace;text-align:center;padding:32px}
h1{font-size:38px;font-weight:700;letter-spacing:-.02em;margin:0 0 10px;text-transform:uppercase}
p{color:#111;max-width:32em;margin:0 auto;font-size:13px}`;

const BLANK_CSS_BY_LOOK: Record<Look, string> = {
  elegant: ELEGANT_BLANK_CSS,
  playful: PLAYFUL_BLANK_CSS,
  simple: SIMPLE_BLANK_CSS,
  brutalist: BRUTALIST_BLANK_CSS,
};

// ---------------------------------------------------------------------------
// Templates. One per start; the <style> block is swapped per look.
// ---------------------------------------------------------------------------

export const SEED_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Atelier</title>
<style>
${ELEGANT_CSS}
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
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
async function load(){
  const r = await fetch("api/products");
  const data = await r.json();
  grid.innerHTML = (data.products||[]).map(p => \`
    <article class="card">
      \${p.photo ? '<img src="'+esc(p.photo)+'" alt="'+esc(p.name)+'">' : '<div class="ph"></div>'}
      <h2>\${esc(p.name)}</h2>
      <p>\${Number(p.price).toLocaleString()} · \${Number(p.stock)} left</p>
      <button data-id="\${Number(p.id)}">Add to bag</button>
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
${ELEGANT_BLANK_CSS}
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

// A counter, not a shop: the menu sends tickets to a queue. It shares the shop's
// tables and endpoints, but nothing about the page is a cart.
export const CAFE_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Hearth</title>
<style>
${ELEGANT_CSS}
</style>
</head>
<body>
<header><b>Hearth</b><span id="queue">Orders 0</span></header>
<div class="hero">
  <h1>On the bar.</h1>
  <p>Drinks and pastry from the database. Send one over and it joins the queue behind the counter.</p>
</div>
<div class="sec">Menu</div>
<div class="grid" id="menu"></div>
<div class="sec">On the rail</div>
<div class="grid list" id="rail"></div>
<div id="toast"></div>
<script>
const menu = document.getElementById("menu");
const rail = document.getElementById("rail");
const queueEl = document.getElementById("queue");
const toast = document.getElementById("toast");
let ticket = 0;
const queue = [];
function say(t){ toast.textContent = t; toast.style.display = "block"; setTimeout(()=>toast.style.display="none", 1400); }
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function drawQueue(){
  queueEl.textContent = "Orders " + queue.length;
  if (!queue.length) {
    rail.innerHTML = '<article class="card"><div class="step">Rail clear</div><h2>Nothing brewing.</h2><p>Pick something off the menu.</p></article>';
    return;
  }
  rail.innerHTML = queue.map(o => \`
    <article class="card\${o.status === "Ready" ? " on" : ""}">
      <div class="step">\${esc(o.status)}</div>
      <h2>#\${Number(o.no)} · \${esc(o.name)}</h2>
      <p>\${esc(o.note)}</p>
    </article>\`).join("");
}
async function loadMenu(){
  const r = await fetch("api/products");
  const data = await r.json();
  menu.innerHTML = (data.products||[]).map(p => \`
    <article class="card">
      \${p.photo ? '<img src="'+esc(p.photo)+'" alt="'+esc(p.name)+'">' : '<div class="ph"></div>'}
      <h2>\${esc(p.name)}</h2>
      <p>\${Number(p.price).toLocaleString()} · \${Number(p.stock)} left today</p>
      <button data-id="\${Number(p.id)}" data-name="\${esc(p.name)}">Add to order</button>
    </article>\`).join("");
}
menu.addEventListener("click", async (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  const r = await fetch("api/orders", { method:"POST", headers:{ "content-type":"application/json" },
    body: JSON.stringify({ product_id: Number(btn.dataset.id), qty: 1 }) });
  if (!r.ok) { say("Off the menu for today"); return; }
  ticket += 1;
  const order = { no: ticket, name: btn.dataset.name, status: "Preparing", note: "just called out" };
  queue.unshift(order);
  drawQueue();
  setTimeout(() => { order.status = "Ready"; order.note = "waiting at the bar"; drawQueue(); }, 2500);
  say("Ticket #" + ticket + " on the rail");
  loadMenu();
});
drawQueue();
loadMenu();
</script>
</body>
</html>
`;

export const BOOK_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Loft</title>
<style>
${ELEGANT_CSS}
</style>
</head>
<body>
<header><b>Loft</b><span id="cart">Booked 0</span></header>
<div class="hero">
  <h1>Book the room.</h1>
  <p>Rooms come from the database. Pick a day and a slot — a taken slot stops being offered.</p>
</div>
<div class="pick">
  <input id="date" type="date" aria-label="Date">
  <div class="slots" id="slots"></div>
  <input id="guest" placeholder="Your name" aria-label="Your name" maxlength="60">
</div>
<div class="grid" id="grid"></div>
<div id="toast"></div>
<script>
const grid = document.getElementById("grid");
const slotsEl = document.getElementById("slots");
const dateEl = document.getElementById("date");
const guestEl = document.getElementById("guest");
const cartEl = document.getElementById("cart");
const toast = document.getElementById("toast");
const SLOTS = ["09:00", "11:00", "14:00", "16:00"];
let slot = SLOTS[0];
let booked = 0;
let taken = [];
dateEl.value = new Date().toISOString().slice(0, 10);
function say(t){ toast.textContent = t; toast.style.display = "block"; setTimeout(()=>toast.style.display="none", 1400); }
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function drawSlots(){
  slotsEl.innerHTML = SLOTS.map(s => \`<button class="slot" type="button" aria-pressed="\${s === slot}" data-slot="\${esc(s)}">\${esc(s)}</button>\`).join("");
}
function isTaken(roomId){
  return taken.some(b => Number(b.room_id) === Number(roomId) && String(b.time_slot) === slot);
}
async function load(){
  const [roomRes, bookRes] = await Promise.all([
    fetch("api/rooms"),
    fetch("api/bookings?date=" + encodeURIComponent(dateEl.value)),
  ]);
  const rooms = (await roomRes.json()).rooms || [];
  taken = (await bookRes.json()).bookings || [];
  grid.innerHTML = rooms.map(r => \`
    <article class="card">
      <div class="ph"></div>
      <h2>\${esc(r.name)}</h2>
      <p>\${Number(r.seats)} seats · \${Number(r.price).toLocaleString()}/hr</p>
      <button data-id="\${Number(r.id)}"\${isTaken(r.id) ? " disabled" : ""}>\${isTaken(r.id) ? "Taken" : "Reserve"}</button>
    </article>\`).join("");
}
slotsEl.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  slot = btn.dataset.slot;
  drawSlots();
  load();
});
dateEl.addEventListener("change", load);
grid.addEventListener("click", async (e) => {
  const btn = e.target.closest("button");
  if (!btn || btn.disabled) return;
  const r = await fetch("api/bookings", { method:"POST", headers:{ "content-type":"application/json" },
    body: JSON.stringify({ room_id: Number(btn.dataset.id), date: dateEl.value, time_slot: slot, guest_name: guestEl.value }) });
  if (!r.ok) { say("That slot is taken"); load(); return; }
  booked += 1;
  cartEl.textContent = "Booked " + booked;
  say("Reserved · " + slot);
  load();
});
drawSlots();
load();
</script>
</body>
</html>
`;

export const LEARN_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Night School</title>
<style>
${ELEGANT_CSS}
</style>
</head>
<body>
<header><b>Night School</b><span id="cart">Lesson 1</span></header>
<div class="hero">
  <h1>Night Photography.</h1>
  <p>Four lessons. Where you are is kept in the database — Continue moves the whole course forward.</p>
</div>
<div class="grid list" id="grid"></div>
<div id="toast"></div>
<script>
const grid = document.getElementById("grid");
const cartEl = document.getElementById("cart");
const toast = document.getElementById("toast");
let current = 1;
function say(t){ toast.textContent = t; toast.style.display = "block"; setTimeout(()=>toast.style.display="none", 1400); }
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function label(order){
  if (order < current) return "Done";
  if (order === current) return "Now playing";
  return "Up next";
}
async function load(){
  const data = await (await fetch("api/lessons")).json();
  const lessons = data.lessons || [];
  current = Number(data.current) || 1;
  cartEl.textContent = "Lesson " + current;
  grid.innerHTML = lessons.map(l => \`
    <article class="card\${Number(l.sort_order) === current ? " on" : ""}">
      <div class="step">\${esc(label(Number(l.sort_order)))}</div>
      <h2>\${Number(l.sort_order)}. \${esc(l.title)}</h2>
      <p>\${Number(l.sort_order) < current ? "Watched" : "Roughly 12 minutes"}</p>
      \${Number(l.sort_order) === current ? '<button type="button">Continue</button>' : ""}
    </article>\`).join("");
}
grid.addEventListener("click", async (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  const r = await fetch("api/progress", { method:"POST", headers:{ "content-type":"application/json" }, body: "{}" });
  if (!r.ok) { say("Could not save your place"); return; }
  say("Saved · next lesson");
  load();
});
load();
</script>
</body>
</html>
`;

const TEMPLATES: Record<StartMode, string> = {
  blank: BLANK_HTML,
  store: SEED_HTML,
  cafe: CAFE_HTML,
  book: BOOK_HTML,
  learn: LEARN_HTML,
};

/** Swap the whole <style> block for the look's block. Nothing from input is interpolated. */
export function restyleForLook(html: string, look: Look): string {
  const css = html.includes("Nothing here yet") ? BLANK_CSS_BY_LOOK[look] : PAGE_CSS[look];
  return html.replace(/<style>[\s\S]*?<\/style>/, `<style>\n${css}\n</style>`);
}

export function htmlForStart(start: StartMode, theme: unknown = DEFAULT_LOOK): string {
  return restyleForLook(TEMPLATES[start] ?? SEED_HTML, parseTheme(theme));
}

function honoBlank(pageHtml: string): string {
  return `import { Hono } from "hono";

const app = new Hono();

app.get("*", (c) => c.html(${JSON.stringify(pageHtml)}));

export default app;
`;
}

const FILES_ROUTE = `app.get("/files/*", async (c) => {
  if (!c.env.BUCKET) return c.text("not found", 404);
  const key = c.req.path.slice("/files/".length);
  const obj = await c.env.BUCKET.get(key);
  if (!obj) return c.text("not found", 404);
  return new Response(obj.body, { headers: { "content-type": obj.httpMetadata?.contentType || "application/octet-stream" } });
});`;

function honoShop(pageHtml: string): string {
  return `import { Hono } from "hono";

const app = new Hono();

app.get("/api/products", async (c) => {
  if (!c.env.DB) return c.json({ products: [] });
  const { results } = await c.env.DB.prepare("SELECT id, name, price, stock, photo FROM products").all();
  return c.json({ products: results ?? [] });
});

app.post("/api/orders", async (c) => {
  const body = await c.req.json();
  const id = Number(body.product_id);
  const qty = Math.max(1, Number(body.qty) || 1);
  if (!c.env.DB) return c.json({ ok: true, local: true });
  const row = await c.env.DB.prepare("SELECT stock FROM products WHERE id = ?").bind(id).first();
  if (!row || row.stock < qty) return c.json({ error: "out of stock" }, { status: 409 });
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE products SET stock = stock - ? WHERE id = ?").bind(qty, id),
    c.env.DB.prepare("INSERT INTO orders (product_id, qty, created_at) VALUES (?, ?, ?)").bind(id, qty, new Date().toISOString()),
  ]);
  return c.json({ ok: true });
});

${FILES_ROUTE}

app.get("*", (c) => c.html(${JSON.stringify(pageHtml)}));

export default app;
`;
}

function honoBook(pageHtml: string): string {
  return `import { Hono } from "hono";

const app = new Hono();

app.get("/api/rooms", async (c) => {
  if (!c.env.DB) return c.json({ rooms: [] });
  const { results } = await c.env.DB.prepare("SELECT id, name, seats, price FROM rooms ORDER BY id").all();
  return c.json({ rooms: results ?? [] });
});

app.get("/api/bookings", async (c) => {
  if (!c.env.DB) return c.json({ bookings: [] });
  const date = String(c.req.query("date") || "").slice(0, 10);
  const { results } = await c.env.DB.prepare(
    "SELECT id, room_id, date, time_slot, status FROM bookings WHERE date = ? ORDER BY id",
  ).bind(date).all();
  return c.json({ bookings: results ?? [] });
});

app.post("/api/bookings", async (c) => {
  const body = await c.req.json();
  const roomId = Number(body.room_id);
  const date = String(body.date || "").slice(0, 10);
  const slot = String(body.time_slot || "").slice(0, 20);
  const guest = String(body.guest_name || "Guest").slice(0, 60);
  if (!Number.isFinite(roomId) || !date || !slot) return c.json({ error: "bad booking" }, { status: 400 });
  if (!c.env.DB) return c.json({ ok: true, local: true });
  const clash = await c.env.DB.prepare(
    "SELECT id FROM bookings WHERE room_id = ? AND date = ? AND time_slot = ? AND status != 'cancelled'",
  ).bind(roomId, date, slot).first();
  if (clash) return c.json({ error: "slot taken" }, { status: 409 });
  await c.env.DB.prepare(
    "INSERT INTO bookings (room_id, date, time_slot, guest_name, status, created_at) VALUES (?, ?, ?, ?, 'held', ?)",
  ).bind(roomId, date, slot, guest, new Date().toISOString()).run();
  return c.json({ ok: true });
});

${FILES_ROUTE}

app.get("*", (c) => c.html(${JSON.stringify(pageHtml)}));

export default app;
`;
}

function honoLearn(pageHtml: string): string {
  return `import { Hono } from "hono";

const app = new Hono();

app.get("/api/lessons", async (c) => {
  if (!c.env.DB) return c.json({ lessons: [], current: 1 });
  const { results } = await c.env.DB.prepare("SELECT id, title, sort_order FROM lessons ORDER BY sort_order").all();
  const row = await c.env.DB.prepare("SELECT current_order FROM progress WHERE id = 1").first();
  return c.json({ lessons: results ?? [], current: Number(row?.current_order ?? 1) });
});

app.post("/api/progress", async (c) => {
  if (!c.env.DB) return c.json({ ok: true, local: true });
  const last = await c.env.DB.prepare("SELECT MAX(sort_order) AS last FROM lessons").first();
  const max = Number(last?.last ?? 1);
  const row = await c.env.DB.prepare("SELECT current_order FROM progress WHERE id = 1").first();
  const next = Math.min(max, Number(row?.current_order ?? 1) + 1);
  await c.env.DB.prepare(
    "INSERT INTO progress (id, current_order, updated_at) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET current_order = excluded.current_order, updated_at = excluded.updated_at",
  ).bind(next, new Date().toISOString()).run();
  return c.json({ ok: true, current: next });
});

${FILES_ROUTE}

app.get("*", (c) => c.html(${JSON.stringify(pageHtml)}));

export default app;
`;
}

export function indexForStart(start: StartMode, theme: unknown = DEFAULT_LOOK): string {
  const page = htmlForStart(start, theme);
  if (start === "blank") return honoBlank(page);
  if (start === "book") return honoBook(page);
  if (start === "learn") return honoLearn(page);
  return honoShop(page);
}
