import {
  SYSTEM_META, LOOK_META, STORE, STORE_SIZES, CAFE_TICKETS, CAFE_BOARD,
  ROOMS, HOST, BOOK_DAYS, BOOK_TIMES, BOOK_TODAY, LEARN_IMG, LEARN_LESSONS,
  TAGLINE, CUSTOM_TAGLINE, BUILD_CHIPS, STYLE_CHIPS, roomImg, defaultRoom,
} from "/preview-data.js";

const empty = document.getElementById("empty");
const ed = document.getElementById("ed");
const actEl = document.getElementById("act");
const pinList = document.getElementById("pinList");
const pinsLayer = document.getElementById("pins");
const overlay = document.getElementById("overlay");
const preview = document.getElementById("preview");
const who = document.getElementById("who");
const whoState = document.getElementById("whoState");
const workStatus = document.getElementById("workStatus");
const pinBtn = document.getElementById("pinMode");
let pinning = false;
let projectId = new URLSearchParams(location.search).get("p");
let phase = "lobby";
let toolAbort = new AbortController();
let pendingBoot = null;
let pendingCatalog = false;
let listenedToolchange = false;

const log = (name, detail) => {
  if (!actEl) return;
  const row = document.createElement("div");
  row.className = "act";
  row.textContent = `${name} · ${detail || "ok"}`;
  actEl.prepend(row);
};

function webmcpReady() {
  return typeof document.modelContext?.registerTool === "function";
}

function setWho(state) {
  const wait = state !== "in the room";
  document.querySelectorAll("[data-who]").forEach((el) => el.classList.toggle("wait", wait));
  document.querySelectorAll("[data-who-state]").forEach((el) => {
    el.textContent = state;
  });
}

async function api(path, opts = {}) {
  const res = await fetch(path, {
    credentials: "same-origin",
    headers: { "content-type": "application/json", ...(opts.headers || {}) },
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

async function callTool(name, input = {}, signal) {
  log(name, "…");
  if (workStatus) {
    workStatus.dataset.live = "1";
    workStatus.textContent = `Running ${name}`;
  }
  const lobby = phase === "lobby" && (name === "get_page_context" || name === "start_project" || name === "join_project");
  const result = await api(lobby ? "/api/lobby/tools" : "/api/tools", {
    method: "POST",
    body: JSON.stringify({ name, input }),
    signal,
  });
  log(name, "done");
  if (workStatus) workStatus.textContent = `Just used ${name}`;
  if (result.projectId && (name === "start_project" || name === "join_project")) {
    pendingBoot = result.projectId;
  }
  if (phase === "editor") {
    await refresh();
    if (name === "attach_module" || name === "provision_d1" || name === "provision_r2") pendingCatalog = true;
  }
  return result;
}

async function registerTools(tools) {
  if (!webmcpReady()) {
    setWho("waiting");
    return;
  }
  setWho("in the room");
  toolAbort.abort();
  toolAbort = new AbortController();
  const regSignal = toolAbort.signal;
  if (!listenedToolchange && typeof document.modelContext.addEventListener === "function") {
    listenedToolchange = true;
    document.modelContext.addEventListener("toolchange", () => log("webmcp", "toolchange"));
  }
  for (const tool of tools) {
    if (regSignal.aborted) return;
    try {
      await document.modelContext.registerTool(
        {
          name: tool.name,
          title: tool.title || tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
          annotations: tool.annotations,
          async execute(input, options = {}) {
            const result = await callTool(tool.name, input || {}, options.signal);
            if (pendingBoot) {
              const id = pendingBoot;
              pendingBoot = null;
              queueMicrotask(() => bootFromAgent(id));
            }
            if (pendingCatalog) {
              pendingCatalog = false;
              queueMicrotask(() => syncCatalog());
            }
            return result;
          },
        },
        { signal: regSignal },
      );
    } catch (err) {
      log("register", `${tool.name} · ${err.message || err}`);
    }
  }
}

async function syncCatalog() {
  const catalog = await api("/api/catalog");
  phase = catalog.phase || phase;
  await registerTools(catalog.tools);
}

async function refresh() {
  const p = await api("/api/project");
  projectId = p.id;
  document.getElementById("briefView").textContent = p.brief || "(no brief yet)";
  document.getElementById("modWeb").classList.toggle("off", !p.modules?.web);
  document.getElementById("modDb").classList.toggle("off", !p.modules?.database);
  document.getElementById("modSt").classList.toggle("off", !p.modules?.storage);
  const mod = (name, detail) => h("div", { class: "mod" }, h("b", { text: name }), h("span", { text: detail }));
  document.getElementById("modList").replaceChildren(
    mod("web", "Live preview"),
    mod("database", p.modules?.database ? "Products and orders" : "Not attached"),
    mod("storage", p.modules?.storage ? "Product photos" : "Not attached"),
  );
  const openPins = (p.annotations || []).filter((a) => !a.resolved);
  pinList.replaceChildren(
    ...(openPins.length
      ? openPins.map((a) => h("div", { class: "pin-item", text: a.note }))
      : [h("div", { class: "hint", text: "No pins yet" })]),
  );
  if (openPins.length) {
    workStatus.textContent = openPins.length === 1
      ? "Working on pin 1"
      : `Working on ${openPins.length} pins`;
  } else if (!workStatus.dataset.live) {
    workStatus.textContent = "";
  }
  pinsLayer.innerHTML = (p.annotations || [])
    .filter((a) => !a.resolved)
    .map((a) => {
      const x = Math.min(100, Math.max(0, Number(a.x) * 100));
      const y = Math.min(100, Math.max(0, Number(a.y) * 100));
      return `<i class="pin" style="left:${x}%;top:${y}%"></i>`;
    })
    .join("");
  const src =
    p.preview_url && p.preview_url.startsWith("/") ? p.preview_url : `/preview/${p.id}/`;
  if (!preview.getAttribute("data-src") || preview.getAttribute("data-src") !== src) {
    preview.src = src;
    preview.setAttribute("data-src", src);
  }
}

function inviteUrl(id) {
  return `${location.origin}${location.pathname}?p=${encodeURIComponent(id)}`;
}

function clearInviteFromUrl() {
  history.replaceState({}, "", location.pathname);
}

function showInviteInUrl(id) {
  history.replaceState({}, "", `${location.pathname}?p=${encodeURIComponent(id)}`);
}

async function copyInviteText(id) {
  const text = `Open this URL in the ChatGPT desktop built-in browser (Work or Codex, GPT-5.6 Sol or Terra — not Luna) or Chrome 149+ with chrome://flags/#enable-webmcp-testing:\n${inviteUrl(id)}\n\nCodex CLI cannot use these site tools. Call get_page_context, then get_project. Attach modules web, database, storage if needed. Keep the store working. After they pin notes, call list_annotations and patch.`;
  await navigator.clipboard.writeText(text);
  log("invite", "copied");
}

async function bootProject() {
  empty.classList.add("hidden");
  ed.classList.remove("hidden");
  phase = "editor";
  await syncCatalog();
  await refresh();
}

async function bootFromAgent(id) {
  projectId = id;
  showInviteInUrl(id);
  await bootProject();
}

/* ---------------------------------------------------------------------------
   Lobby picker: 5 systems x 4 looks + a Custom builder.

   The preview is built with DOM APIs rather than concatenated template strings.
   A stray or missing closing tag in a string builder silently reparents later
   content and nothing catches it until you look at the rendered page; with
   createElement/append the nesting is whatever the call tree says it is.
--------------------------------------------------------------------------- */

const stage = document.getElementById("lobbyStage");
const pvHost = document.getElementById("pvHost");
const customBuilder = document.getElementById("customBuilder");
const taglineEl = document.getElementById("tagline");
const briefEl = document.getElementById("brief");
const briefField = document.getElementById("briefField");
const briefSwap = document.getElementById("briefSwap");
const openBtn = document.getElementById("startOnly");
const ctaNote = document.getElementById("ctaNote");
const cbBuild = document.getElementById("cbBuild");
const cbStyle = document.getElementById("cbStyle");

let startMode = "store";
let startTheme = "simple";
let pickedRoom = null; // manual room choice; cleared whenever the look changes

const LOOKS_URL = "/looks/";

function h(tag, props, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else node.setAttribute(k, v === true ? "" : String(v));
  }
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

const img = (file, alt, cls) => h("img", { class: cls, src: LOOKS_URL + file, alt: alt || "", loading: "lazy" });
const kicker = (t) => h("div", { class: "pv-kicker", text: t });

/** Small option chips (sizes, days, times). Own `.on` rule — see .chip-opt.on. */
function chips(cls, values, activeIndex) {
  return h(
    "div",
    { class: `pv-chips ${cls}` },
    values.map((v, i) => h("button", {
      type: "button",
      class: `chip-opt${i === activeIndex ? " on" : ""}`,
      "aria-pressed": i === activeIndex ? "true" : "false",
      text: v,
    })),
  );
}

function viewStore(look) {
  const d = STORE[look];
  return h(
    "article",
    { class: "pv pv-store" },
    img(d.img, d.name, "pv-shot"),
    h(
      "div",
      { class: "pv-body" },
      h("div", { class: "pv-row" }, h("h3", { class: "pv-title", text: d.name }), h("div", { class: "pv-price", text: d.price })),
      h("div", { class: "pv-sub", text: d.stock }),
      chips("pv-sizes", STORE_SIZES, 0),
      h(
        "div",
        { class: "pv-ctas" },
        h("span", { class: "pv-cta", text: d.buy }),
        h("span", { class: "pv-cta2", text: d.add }),
        h("span", { class: "pv-heart", "aria-hidden": "true", text: "♡" }),
      ),
    ),
  );
}

function viewCafe(look) {
  const tickets = CAFE_TICKETS[look];
  return h(
    "article",
    { class: "pv" },
    h(
      "div",
      { class: "pv-body" },
      kicker(`Live orders · ${tickets.length} open`),
      h("h3", { class: "pv-title", text: "Hearth bar" }),
      tickets.map(([file, name, status, at]) => h(
        "div",
        { class: "tk" },
        img(file, "", "tk-shot"),
        h("div", { class: "tk-meta" }, h("b", { text: name }), h("span", { text: status })),
        h("em", { text: at }),
      )),
      kicker("Behind the counter"),
      h(
        "div",
        { class: "kds" },
        CAFE_BOARD[look].map(([head, card]) => h(
          "div",
          { class: "kds-col" },
          h("div", { class: "kds-h", text: head }),
          h("div", { class: "kds-card", text: card }),
        )),
      ),
    ),
  );
}

function viewBook(look) {
  const host = HOST[look];
  const active = pickedRoom ? ROOMS.find((r) => r.id === pickedRoom) || defaultRoom(look) : defaultRoom(look);
  return h(
    "article",
    { class: "pv pv-book" },
    h(
      "div",
      { class: "room-row" },
      ROOMS.map((r) => h(
        "button",
        { type: "button", class: `room-pick${r.id === active.id ? " on" : ""}`, "data-room": r.id, "aria-pressed": r.id === active.id ? "true" : "false" },
        img(roomImg(r, look), "", "room-shot"),
        h("span", { text: r.name }),
      )),
    ),
    img(roomImg(active, look), active.name, "pv-hero"),
    h(
      "div",
      { class: "pv-body" },
      h("div", { class: "pv-row" }, h("h3", { class: "pv-title", text: active.name }), h("div", { class: "pv-price", text: active.price })),
      h("div", { class: "pv-sub", text: active.seats }),
      h(
        "div",
        { class: "persona" },
        img(host.img, "", "persona-shot"),
        h("span", {}, "Hosted by ", h("b", { text: host.name })),
      ),
      chips("pv-days", BOOK_DAYS, 1),
      chips("pv-times", BOOK_TIMES, 1),
      h("span", { class: "pv-cta", text: "Reserve" }),
      kicker("Today’s bookings"),
      h(
        "div",
        { class: "day-list" },
        BOOK_TODAY.map((b) => h(
          "div",
          { class: "day-row" },
          h("i", { class: `dot ${b.dot}`, "aria-hidden": "true" }),
          h("b", { text: b.time }),
          h("span", { text: b.who }),
          h("em", { text: b.state }),
        )),
      ),
    ),
  );
}

function viewLearn(look) {
  return h(
    "article",
    { class: "pv" },
    img(LEARN_IMG[look], "Night Photography", "pv-hero"),
    h(
      "div",
      { class: "pv-body" },
      kicker("Course"),
      h("h3", { class: "pv-title", text: "Night Photography" }),
      h("div", { class: "bar" }, h("i", { style: "width:38%" })),
      h("div", { class: "pv-sub", text: "3 of 8 lessons" }),
      LEARN_LESSONS.map((l) => h(
        "div",
        { class: `lesson${l.state === "done" ? " done" : l.state === "current" ? " current" : ""}` },
        h("i", { "aria-hidden": "true", text: l.state === "done" ? "✓" : "" }),
        h("span", { text: l.name }),
        l.state === "current" ? h("em", { text: "in progress" }) : null,
      )),
      h("span", { class: "pv-cta", text: "Continue" }),
    ),
  );
}

/** Conjure has no photo on purpose — a blank page is the product. */
function viewBlank() {
  return h(
    "article",
    { class: "pv pv-canvas" },
    h(
      "div",
      { class: "pv-body" },
      kicker("New page"),
      h("h3", { class: "pv-title pv-title-xl", text: "Untitled" }),
      h("p", { class: "pv-note", text: "Your agent writes here. No cart. No menu." }),
      h("span", { class: "pv-cta", text: "Start writing" }),
    ),
  );
}

const VIEWS = { store: viewStore, cafe: viewCafe, book: viewBook, learn: viewLearn, blank: viewBlank };

function paint() {
  stage.dataset.sys = startMode;
  stage.dataset.look = startTheme;

  const isCustom = startTheme === "custom";
  customBuilder.classList.toggle("hidden", !isCustom);
  pvHost.classList.toggle("hidden", isCustom);
  briefField.classList.toggle("hidden", isCustom);
  briefSwap.classList.toggle("hidden", !isCustom);
  ctaNote.classList.toggle("hidden", !isCustom);

  // Custom styles are written by the agent, so that path genuinely requires an
  // invite. Disable the control rather than only dimming it.
  openBtn.disabled = isCustom;
  openBtn.setAttribute("aria-disabled", isCustom ? "true" : "false");
  openBtn.title = isCustom ? "Custom needs an invited agent" : "";

  taglineEl.textContent = isCustom ? CUSTOM_TAGLINE : TAGLINE[startMode][startTheme];
  if (isCustom) return;

  pvHost.replaceChildren(VIEWS[startMode](startTheme));
}

function selectSystem(btn) {
  startMode = btn.dataset.start;
  document.querySelectorAll("#sysRow .sys").forEach((b) => {
    const on = b === btn;
    b.classList.toggle("on", on);
    b.setAttribute("aria-checked", on ? "true" : "false");
  });
  pickedRoom = null;
  if (startTheme !== "custom") briefEl.value = SYSTEM_META[startMode].brief;
  paint();
}

function selectLook(theme, btn) {
  startTheme = theme;
  pickedRoom = null; // switching look resets Book to that look's default room
  document.querySelectorAll("#looksRow .look").forEach((b) => {
    const on = b === btn;
    b.classList.toggle("on", on);
    b.setAttribute("aria-checked", on ? "true" : "false");
  });
  const customBtn = document.getElementById("customLook");
  customBtn.classList.toggle("on", theme === "custom");
  customBtn.setAttribute("aria-pressed", theme === "custom" ? "true" : "false");
  paint();
}

document.querySelectorAll("#sysRow .sys").forEach((btn) => {
  btn.addEventListener("click", () => selectSystem(btn));
});
document.querySelectorAll("#looksRow .look").forEach((btn) => {
  btn.addEventListener("click", () => selectLook(btn.dataset.theme, btn));
});
document.getElementById("customLook").addEventListener("click", () => selectLook("custom", null));

// Room thumbnails and option chips are delegated: the preview is re-rendered on
// every pick, so per-node listeners would be re-bound constantly.
pvHost.addEventListener("click", (ev) => {
  const room = ev.target.closest(".room-pick");
  if (room) {
    pickedRoom = room.dataset.room;
    paint();
    return;
  }
  const chip = ev.target.closest(".chip-opt");
  if (!chip) return;
  chip.parentNode.querySelectorAll(".chip-opt").forEach((c) => {
    c.classList.remove("on");
    c.setAttribute("aria-pressed", "false");
  });
  chip.classList.add("on");
  chip.setAttribute("aria-pressed", "true");
});

/* ---- custom builder ---- */

function syncCustomPreview() {
  document.getElementById("cbPvBuild").textContent = cbBuild.value.trim() || "—";
  document.getElementById("cbPvStyle").textContent = cbStyle.value.trim() || "—";
}

function fillChips(hostEl, items, target) {
  hostEl.replaceChildren(...items.map((c) => {
    const b = h("button", { type: "button", class: "cb-chip", text: c.label });
    b.addEventListener("click", () => {
      target.value = c.value; // fills the field only — never auto-submits
      target.focus();
      syncCustomPreview();
    });
    return b;
  }));
}

fillChips(document.getElementById("cbBuildChips"), BUILD_CHIPS, cbBuild);
fillChips(document.getElementById("cbStyleChips"), STYLE_CHIPS, cbStyle);
cbBuild.addEventListener("input", syncCustomPreview);
cbStyle.addEventListener("input", syncCustomPreview);
syncCustomPreview();
paint();

/* ---- start / invite ---- */

async function resumeIfOwned() {
  const lobby = await api("/api/lobby");
  if (lobby.screen === "editor" && lobby.id) {
    projectId = lobby.id;
    return true;
  }
  return false;
}

/** The wire contract: start, theme, and — only for custom — buildPrompt/stylePrompt. */
function sessionPayload() {
  const custom = startTheme === "custom";
  const buildPrompt = cbBuild.value.trim();
  const stylePrompt = cbStyle.value.trim();
  const body = {
    brief: custom ? buildPrompt : briefEl.value.trim(),
    start: startMode,
    theme: startTheme,
  };
  if (custom) {
    body.buildPrompt = buildPrompt;
    body.stylePrompt = stylePrompt;
  }
  return body;
}

async function start(copyLink) {
  if (startTheme === "custom") {
    if (!copyLink) return; // Open project is disabled for custom
    if (!cbBuild.value.trim()) {
      cbBuild.focus();
      log("custom", "describe what to build first");
      return;
    }
  }
  if (!projectId) {
    try {
      if (await resumeIfOwned()) {
        /* keep existing project for this browser */
      }
    } catch {
      /* no session yet */
    }
  }
  if (!projectId) {
    const s = await api("/api/session", {
      method: "POST",
      body: JSON.stringify(sessionPayload()),
    });
    projectId = s.projectId;
  }
  if (copyLink) {
    showInviteInUrl(projectId);
    await copyInviteText(projectId);
  } else {
    clearInviteFromUrl();
  }
  await bootProject();
}

document.getElementById("invite").addEventListener("click", () => start(true));
openBtn.addEventListener("click", () => start(false));
document.getElementById("copyInvite").addEventListener("click", () => {
  if (projectId) showInviteInUrl(projectId);
  copyInviteText(projectId);
});
document.getElementById("publish").addEventListener("click", async () => {
  if (!confirm("Publish this site to a public URL?")) return;
  const r = await callTool("publish", { confirmation: true });
  log("publish", r.runtime === "worker" ? `worker ${r.url}` : `hosted ${r.url}`);
  alert(
    r.runtime === "worker"
      ? `Published on its own Worker:\n${r.url}`
      : `Published on Forge hosting (dedicated Worker needs an account API token):\n${location.origin}${r.url}`,
  );
});

pinBtn.addEventListener("click", () => {
  pinning = !pinning;
  pinBtn.classList.toggle("on", pinning);
  overlay.classList.toggle("hidden", !pinning);
});

overlay.addEventListener("click", async (ev) => {
  const box = overlay.getBoundingClientRect();
  const x = (ev.clientX - box.left) / box.width;
  const y = (ev.clientY - box.top) / box.height;
  const note = prompt("What should change here?");
  if (!note) return;
  await api("/api/annotations", {
    method: "POST",
    body: JSON.stringify({ x, y, note }),
  });
  pinning = false;
  pinBtn.classList.remove("on");
  overlay.classList.add("hidden");
  await refresh();
});

(async () => {
  const invited = new URLSearchParams(location.search).get("p");
  if (invited) {
    try {
      await api("/api/join", { method: "POST", body: JSON.stringify({ projectId: invited }) });
      projectId = invited;
      await bootProject();
      return;
    } catch {
      /* fall through */
    }
  }
  try {
    if (await resumeIfOwned()) {
      clearInviteFromUrl();
      await bootProject();
      return;
    }
  } catch {
    /* lobby */
  }
  try {
    const catalog = await api("/api/catalog?phase=lobby");
    phase = "lobby";
    await registerTools(catalog.tools);
  } catch (err) {
    log("catalog", err.message || err);
    setWho("waiting");
  }
})();
