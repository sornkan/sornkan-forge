import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { sanitizePath } from "../src/lib/paths.ts";
import { isMutatingSql } from "../src/lib/sql.ts";
import { toolsForState, TOOLS, LOBBY_TOOLS } from "../src/lib/catalog.ts";
import { d1Name, isOwnDb, r2Name } from "../src/lib/isolate.ts";
import { htmlForStart, indexForStart, parseTheme, schemaForStart } from "../src/lib/seed.ts";
import { sidCookie } from "../src/lib/session.ts";
import { rewriteHonoImports } from "../src/lib/cf.ts";
import { APP_STACK } from "../src/lib/isolate.ts";

describe("sanitizePath", () => {
  it("accepts project files", () => {
    expect(sanitizePath("src/index.ts")).toBe("src/index.ts");
    expect(sanitizePath("public/index.html")).toBe("public/index.html");
    expect(sanitizePath("schema.sql")).toBe("schema.sql");
  });
  it("rejects escapes", () => {
    expect(() => sanitizePath("../secret")).toThrow();
    expect(() => sanitizePath("src/../../etc/passwd")).toThrow();
    expect(() => sanitizePath("/etc/passwd")).toThrow();
  });
});

describe("isMutatingSql", () => {
  it("flags writes", () => {
    expect(isMutatingSql("INSERT INTO guests VALUES (1)")).toBe(true);
    expect(isMutatingSql("SELECT * FROM guests")).toBe(false);
    expect(isMutatingSql("/* INSERT */ SELECT 1")).toBe(false);
  });
});

describe("catalog", () => {
  it("forbids additional properties", () => {
    for (const t of [...LOBBY_TOOLS, ...TOOLS]) {
      expect(t.inputSchema.additionalProperties).toBe(false);
      expect(t.title).toMatch(/\S/);
      expect(typeof t.annotations.readOnlyHint).toBe("boolean");
      expect(typeof t.annotations.untrustedContentHint).toBe("boolean");
    }
  });
  it("hides sql until D1 exists", () => {
    const names = toolsForState({ hasD1: false, hasR2: false }).map((t) => t.name);
    expect(names).not.toContain("run_sql");
    expect(toolsForState({ hasD1: true, hasR2: false }).map((t) => t.name)).toContain("run_sql");
  });
  it("includes attach_module", () => {
    expect(TOOLS.map((t) => t.name)).toContain("attach_module");
  });
  it("registers lobby tools ChatGPT can call on the first screen", () => {
    expect(LOBBY_TOOLS.map((t) => t.name)).toEqual(["get_page_context", "start_project", "join_project"]);
  });
  it("registers search_products on the top-level editor", () => {
    expect(TOOLS.map((t) => t.name)).toContain("search_products");
    expect(TOOLS.map((t) => t.name)).toContain("add_annotation");
  });
});

describe("per-app isolate", () => {
  it("does not treat the studio database as an app database", () => {
    expect(isOwnDb("editor")).toBe(false);
    expect(isOwnDb(null)).toBe(false);
    expect(isOwnDb("01d0822e-2dc8-49a2-b9e5-052a07b46985")).toBe(true);
  });
  it("names d1 and r2 per project", () => {
    expect(d1Name("aabbccdd")).toBe("forge-d1-proj-aabbccdd");
    expect(r2Name("aabbccdd")).toBe("forge-r2-proj-aabbccdd");
  });
  it("cafe schema is not the store catalog", () => {
    expect(schemaForStart("store")).toContain("Canvas tote");
    expect(schemaForStart("cafe")).toContain("Espresso");
    expect(schemaForStart("cafe")).not.toContain("Canvas tote");
    expect(schemaForStart("blank")).not.toContain("INSERT");
  });
  it("locks generated workers to Hono", () => {
    expect(APP_STACK.backend).toBe("hono");
    expect(indexForStart("blank")).toContain('import { Hono } from "hono"');
    expect(indexForStart("store")).toContain("new Hono()");
    expect(indexForStart("cafe")).toContain("/api/products");
    expect(rewriteHonoImports('import { Hono } from "hono"')).toContain("./hono.mjs");
  });
});

describe("editor routing", () => {
  it("runs the Worker first for preview and API so SPA fallback cannot swallow them", () => {
    const config = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");
    expect(config).toContain('"/api/*"');
    expect(config).toContain('"/preview/*"');
    expect(config).toContain("run_worker_first");
  });
});

describe("agent chip", () => {
  it("names the host Agent, not ChatGPT · Codex", () => {
    const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
    expect(html).toContain("<b>Agent</b>");
    expect(html).not.toMatch(/ChatGPT<\/b>\s*·\s*Codex/);
  });
});

describe("themes", () => {
  it("resolves legacy atelier/luna aliases and defaults unknown values to elegant", () => {
    expect(parseTheme(undefined)).toBe("elegant");
    expect(parseTheme("atelier")).toBe("elegant");
    expect(parseTheme("luna")).toBe("playful");
    expect(parseTheme("evil")).toBe("elegant");
    expect(parseTheme({ css: "body{}" })).toBe("elegant");
  });
  it("keeps the cream atelier shop as default", () => {
    const html = htmlForStart("store");
    expect(html).toContain("Atelier");
    expect(html).toContain("#F6F1E8");
    expect(html).toContain("Iowan");
    expect(html).not.toContain("fonts.googleapis");
    expect(html.toLowerCase()).not.toContain("shopee");
  });
  it("applies luna as a static pink sample without renaming the shop", () => {
    const html = htmlForStart("store", "luna");
    expect(html).toContain("Atelier");
    expect(html).toContain("#FFF4F8");
    expect(html).toContain("#DB2777");
    expect(html).toContain("#BE185D");
    expect(html).not.toContain("Iowan");
    expect(html).not.toContain("fonts.googleapis");
    expect(html.toLowerCase()).not.toContain("shopee");
    expect(html).not.toContain("evil");
  });
  it("keeps cafe named Hearth under luna", () => {
    expect(htmlForStart("cafe", "luna")).toContain("Hearth");
    expect(htmlForStart("cafe", "luna")).toContain("#FFF4F8");
  });
  it("does not interpolate untrusted theme strings into CSS", () => {
    const html = htmlForStart("store", parseTheme("luna;background:url(https://evil.test)"));
    expect(html).toContain("#F6F1E8");
    expect(html).not.toContain("evil.test");
  });
  it("leaves the studio chrome cream", () => {
    const css = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");
    expect(css).toContain("--bg:#F6F1E8");
    expect(css).toContain("Iowan");
  });
  it("exposes the four looks on the lobby switcher", () => {
    const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
    expect(html).toContain('data-theme="simple"');
    expect(html).toContain('data-theme="playful"');
    expect(html).toContain('data-theme="elegant"');
    expect(html).toContain('data-theme="brutalist"');
  });
});

describe("project ownership", () => {
  it("uses full UUIDs for new projects", () => {
    const src = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");
    expect(src).toContain("crypto.randomUUID()");
    expect(src).not.toContain("randomUUID().slice(0, 8)");
  });
  it("does not put ?p= in the URL when opening a private project", () => {
    const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
    expect(app).toContain("clearInviteFromUrl");
    expect(app).toContain("resumeIfOwned");
    expect(app).toMatch(/if \(copyLink\) \{[\s\S]*showInviteInUrl/);
  });
  it("keeps the session cookie host-only", () => {
    expect(sidCookie("abc", true)).toBe("forge_sid=abc; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800");
    expect(sidCookie("abc", true)).not.toContain("Domain=");
  });
});

describe("demo domain", () => {
  it("binds forge.sornkan.com as a custom domain and not the apex", () => {
    const config = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");
    expect(config).toContain('"pattern": "forge.sornkan.com"');
    expect(config).toContain('"custom_domain": true');
    expect(config).toContain('"workers_dev": true');
    expect(config).not.toMatch(/"pattern":\s*"sornkan\.com"/);
  });
});

// ---------------------------------------------------------------------------
// Worker A: lobby picker tests
// Everything below this banner covers the lobby/picker frontend
// (public/index.html, public/app.js, public/styles.css, public/preview-data.js,
// public/looks/). Nothing above this banner is modified here.
// ---------------------------------------------------------------------------

import { existsSync } from "node:fs";
import {
  SYSTEMS, LOOKS, SYSTEM_META, STORE, CAFE_TICKETS, CAFE_BOARD, ROOMS, HOST,
  LEARN_IMG, LEARN_LESSONS, TAGLINE, BUILD_CHIPS, STYLE_CHIPS, LOOK_ROOM,
  LOOK_GROUP, roomImg, defaultRoom, allImages,
} from "../public/preview-data.js";

const lobbyHtml = () => readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const lobbyJs = () => readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const lobbyCss = () => readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");
const looksPath = (f: string) => new URL(`../public/looks/${f}`, import.meta.url);

describe("lobby picker markup", () => {
  it("offers all five systems with the wire values the backend expects", () => {
    const html = lobbyHtml();
    for (const start of ["blank", "store", "cafe", "book", "learn"]) {
      expect(html).toContain(`data-start="${start}"`);
    }
    for (const label of ["Store", "Cafe", "Book", "Learn", "Conjure"]) {
      expect(html).toContain(`<b>${label}</b>`);
    }
  });

  it("offers four looks plus custom, and drops the atelier/luna vocabulary", () => {
    const html = lobbyHtml();
    for (const look of ["simple", "playful", "elegant", "brutalist", "custom"]) {
      expect(html).toContain(`data-theme="${look}"`);
    }
    expect(html).not.toContain('data-theme="atelier"');
    expect(html).not.toContain('data-theme="luna"');
  });

  it("ships the custom builder as two separate textareas with a live echo", () => {
    const html = lobbyHtml();
    expect(html).toContain('id="cbBuild"');
    expect(html).toContain('id="cbStyle"');
    expect(html).toContain('id="cbPvBuild"');
    expect(html).toContain('id="cbPvStyle"');
    expect(html.match(/<textarea/g)?.length).toBeGreaterThanOrEqual(3);
  });
});

describe("lobby wire contract", () => {
  it("sends buildPrompt and stylePrompt as separate fields, never concatenated", () => {
    const js = lobbyJs();
    expect(js).toContain("body.buildPrompt = buildPrompt");
    expect(js).toContain("body.stylePrompt = stylePrompt");
    expect(js).not.toMatch(/buildPrompt\s*\+\s*[^;]*stylePrompt/);
  });

  it("only attaches the custom prompts when the theme is custom", () => {
    const js = lobbyJs();
    expect(js).toMatch(/const custom = startTheme === "custom"[\s\S]*if \(custom\) \{[\s\S]*buildPrompt/);
  });

  it("really disables Open project for custom rather than just dimming it", () => {
    expect(lobbyJs()).toContain("openBtn.disabled = isCustom");
    expect(lobbyCss()).toContain(".ghost:disabled");
  });

  it("defaults to a system and look the backend accepts", () => {
    const js = lobbyJs();
    expect(js).toMatch(/let startMode = "store"/);
    expect(js).toMatch(/let startTheme = "simple"/);
  });
});

describe("lobby preview data", () => {
  it("keys every system by its wire value", () => {
    expect(SYSTEMS).toEqual(["store", "cafe", "book", "learn", "blank"]);
    for (const sys of SYSTEMS) expect(SYSTEM_META[sys].brief).toMatch(/\S/);
  });

  it("gives every look its own store product, learn hero and host", () => {
    expect(new Set(LOOKS.map((l) => STORE[l].img)).size).toBe(4);
    expect(new Set(LOOKS.map((l) => LEARN_IMG[l])).size).toBe(4);
    expect(new Set(LOOKS.map((l) => HOST[l].img)).size).toBe(4);
  });

  it("gives every look three distinct cafe tickets and no shared set", () => {
    const sets = new Set<string>();
    for (const look of LOOKS) {
      const imgs = CAFE_TICKETS[look].map((t) => t[0]);
      expect(imgs).toHaveLength(3);
      expect(new Set(imgs).size).toBe(3);
      sets.add([...imgs].sort().join("|"));
    }
    expect(sets.size).toBe(4);
  });

  it("lands the four looks on four different default room photos", () => {
    const heroes = LOOKS.map((l) => roomImg(defaultRoom(l), l));
    expect(new Set(heroes).size).toBe(4);
    expect(roomImg(defaultRoom("simple"), "simple")).toBe("desk.jpg");
    expect(roomImg(defaultRoom("elegant"), "elegant")).toBe("studio.jpg");
    expect(roomImg(defaultRoom("playful"), "playful")).toBe("meeting-bright.jpg");
    expect(roomImg(defaultRoom("brutalist"), "brutalist")).toBe("meeting-industrial.jpg");
  });

  it("gives every room both a calm and a bold photo", () => {
    expect(ROOMS).toHaveLength(3);
    for (const r of ROOMS) {
      expect(r.imgs.calm).toMatch(/\.jpg$/);
      expect(r.imgs.bold).toMatch(/\.jpg$/);
      expect(r.imgs.calm).not.toBe(r.imgs.bold);
    }
    for (const look of LOOKS) expect(["calm", "bold"]).toContain(LOOK_GROUP[look]);
    for (const look of LOOKS) expect(ROOMS.map((r) => r.id)).toContain(LOOK_ROOM[look]);
  });

  it("writes a distinct tagline for all twenty system x look pairs", () => {
    const seen = new Set<string>();
    for (const sys of SYSTEMS) for (const look of LOOKS) seen.add(TAGLINE[sys][look]);
    expect(seen.size).toBe(20);
  });

  it("offers quick-fill chips including a blank option and all four styles", () => {
    expect(BUILD_CHIPS.length).toBeGreaterThanOrEqual(4);
    expect(BUILD_CHIPS.some((c) => c.value === "")).toBe(true);
    expect(STYLE_CHIPS.map((c) => c.label)).toEqual(["Simple", "Playful", "Elegant", "Brutalist"]);
  });

  it("marks exactly one lesson as the current one", () => {
    expect(LEARN_LESSONS.filter((l) => l.state === "current")).toHaveLength(1);
    expect(LEARN_LESSONS.filter((l) => l.state === "done")).toHaveLength(2);
  });
});

describe("lobby assets", () => {
  it("serves every referenced photo from the local public/looks folder", () => {
    const imgs = allImages();
    expect(imgs.length).toBeGreaterThanOrEqual(23);
    for (const img of imgs) expect(existsSync(looksPath(img))).toBe(true);
  });

  it("ships the photo credits alongside the photos", () => {
    expect(existsSync(looksPath("CREDITS.md"))).toBe(true);
    expect(readFileSync(looksPath("CREDITS.md"), "utf8")).toContain("Pexels License");
  });

  it("never hotlinks an external image", () => {
    expect(lobbyHtml()).not.toMatch(/<img[^>]+src="https?:/);
    expect(lobbyJs()).not.toMatch(/https?:\/\/[^"'\s]*\.(jpg|png|webp)/);
    expect(lobbyJs()).toContain('const LOOKS_URL = "/looks/"');
  });
});

describe("lobby preview rendering", () => {
  it("builds the preview through DOM APIs, not concatenated markup strings", () => {
    const js = lobbyJs();
    expect(js).toContain("document.createElement(tag)");
    expect(js).toContain("pvHost.replaceChildren");
    expect(js).not.toMatch(/["'`]\s*<(article|div|img)\b/);
  });

  it("keeps the cafe back-of-house board out of every other system", () => {
    const js = lobbyJs();
    const start = js.indexOf("function viewCafe");
    const end = js.indexOf("function viewBook");
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    expect(js.slice(start, end)).toContain('"kds"');
    expect(js.slice(0, start) + js.slice(end)).not.toContain('"kds');
    expect(Object.keys(CAFE_BOARD)).toEqual(LOOKS);
  });

  it("gives Conjure no photo at all", () => {
    const js = lobbyJs();
    const body = js.slice(js.indexOf("function viewBlank"), js.indexOf("const VIEWS"));
    expect(body).not.toContain("img(");
    expect(body).toContain("No cart. No menu.");
  });

  it("resets the manually picked room whenever the look changes", () => {
    expect(lobbyJs()).toMatch(/function selectLook[\s\S]*?pickedRoom = null/);
  });

  it("does not share one state rule between the option chips and the lesson rows", () => {
    const css = lobbyCss();
    expect(css).not.toContain(".lesson.on");
    expect(css).toContain(".lesson.current");
    // The in-progress row highlights icon + text; it must never fill the row.
    for (const chunk of css.split("}")) {
      if (/\.lesson\.current\s*\{/.test(`${chunk}}`)) {
        expect(chunk).not.toMatch(/(^|;|\{)\s*background(-color)?\s*:/);
      }
    }
  });
});

describe("no code pane in the studio", () => {
  // The studio is a picker, not an IDE. Nobody should ever be shown raw source.
  it("ships no code editor markup", () => {
    const html = lobbyHtml();
    expect(html.toLowerCase()).not.toContain("monaco");
    expect(html.toLowerCase()).not.toContain("codemirror");
    expect(html).not.toMatch(/<pre[\s>]/i);
    expect(html).not.toMatch(/<code[\s>]/i);
  });

  it("uses textareas only for the brief and the custom prompts", () => {
    const ids = [...lobbyHtml().matchAll(/<textarea[^>]*\bid="([^"]+)"/g)].map((m) => m[1]);
    expect(ids).toEqual(["brief", "cbBuild", "cbStyle"]);
    // Every textarea is accounted for above — none is an unnamed code area.
    expect(lobbyHtml().match(/<textarea/g)).toHaveLength(ids.length);
  });
});

describe("generated app templates", () => {
  const STARTS = ["store", "cafe", "book", "learn"] as const;
  const page = (s: (typeof STARTS)[number]) => htmlForStart(s, "elegant");
  // The <style> block is shared by design (one look, swapped in wholesale), so
  // template-vs-template comparisons look at the markup and script only.
  const body = (s: (typeof STARTS)[number]) => page(s).replace(/<style>[\s\S]*?<\/style>/, "");

  it("serves the cafe as an order queue, never a cart", () => {
    const html = page("cafe");
    expect(html).not.toContain("Cart ");
    expect(html).not.toContain('id="cart"');
    expect(html).not.toContain("Add to bag");
    expect(html).toContain("Add to order");
    expect(html).toContain('id="queue"');
    expect(html).toContain("Orders 0");
    expect(html).toContain("Hearth");
  });

  it("keeps the cafe on the shared products and orders endpoints", () => {
    const html = page("cafe");
    expect(html).toContain('fetch("api/products")');
    expect(html).toContain('fetch("api/orders"');
    expect(schemaForStart("cafe")).toContain("INSERT INTO products");
  });

  it("gives every start its own title", () => {
    const titles = STARTS.map((s) => page(s).match(/<title>(.*)<\/title>/)![1]);
    expect(titles).toEqual(["Atelier", "Hearth", "Loft", "Night School"]);
    expect(new Set(titles).size).toBe(STARTS.length);
  });

  it("builds each template independently instead of patching the store", () => {
    // A .replace()-patched copy of the store scores ~1500 here; four independent
    // templates share only small helpers and the /api/orders call (~300).
    const longestShared = (a: string, b: string) => {
      let best = 0;
      for (let i = 0; i < a.length; i++) {
        for (let j = 0; j < b.length; j++) {
          let n = 0;
          while (i + n < a.length && j + n < b.length && a[i + n] === b[j + n]) n++;
          if (n > best) best = n;
        }
      }
      return best;
    };
    for (let i = 0; i < STARTS.length; i++) {
      for (let j = i + 1; j < STARTS.length; j++) {
        const [a, b] = [STARTS[i], STARTS[j]];
        expect(body(a)).not.toBe(body(b));
        expect({ a, b, shared: longestShared(body(a), body(b)) }).toEqual({ a, b, shared: expect.any(Number) });
        expect(longestShared(body(a), body(b))).toBeLessThan(600);
      }
    }
  });

  it("keeps the store's shopping vocabulary out of the other three", () => {
    for (const start of ["cafe", "book", "learn"] as const) {
      expect(page(start)).not.toContain("Add to bag");
      expect(page(start)).not.toContain("New in.");
    }
    expect(page("store")).toContain("Add to bag");
  });
});

describe("lobby look skins", () => {
  it("scopes each look through one data-look attribute", () => {
    const css = lobbyCss();
    for (const look of LOOKS) expect(css).toContain(`.first-grid[data-look=${look}]`);
  });

  it("carries the approved token per look", () => {
    const css = lobbyCss();
    expect(css).toContain("#DB2777");         // playful pink
    expect(css).toContain("#FFD6E3");         // playful soft pink
    expect(css).toContain("#F6F1E8");         // elegant cream
    expect(css).toContain("#9A4218");         // elegant rust
    expect(css).toContain("#FDE047");         // brutalist yellow
    expect(css).toContain("6px 6px 0 #111");  // brutalist hard offset shadow
    expect(css).toContain("ui-monospace");    // brutalist mono
  });
});
