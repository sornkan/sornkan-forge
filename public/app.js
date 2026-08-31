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
  document.getElementById("modList").innerHTML = `
    <div class="mod"><b>web</b><span>Live preview</span></div>
    <div class="mod"><b>database</b><span>${p.modules?.database ? "Products and orders" : "Not attached"}</span></div>
    <div class="mod"><b>storage</b><span>${p.modules?.storage ? "Product photos" : "Not attached"}</span></div>`;
  const openPins = (p.annotations || []).filter((a) => !a.resolved);
  pinList.innerHTML = openPins
    .map((a) => `<div class="pin-item">${esc(a.note)}</div>`)
    .join("") || `<div class="hint">No pins yet</div>`;
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

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inviteUrl(id) {
  const u = new URL(location.href);
  u.search = `?p=${id}`;
  return u.toString();
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
  history.replaceState({}, "", `?p=${id}`);
  await bootProject();
}

let startMode = "store";

async function start(copyLink) {
  const brief = document.getElementById("brief").value.trim();
  const s = await api("/api/session", {
    method: "POST",
    body: JSON.stringify({ brief, start: startMode }),
  });
  projectId = s.projectId;
  history.replaceState({}, "", `?p=${s.projectId}`);
  await bootProject();
  if (copyLink) await copyInviteText(s.projectId);
}

document.getElementById("invite").addEventListener("click", () => start(true));
document.getElementById("startOnly").addEventListener("click", () => start(false));
document.querySelectorAll(".mode").forEach((el) => {
  el.addEventListener("click", () => {
    startMode = el.getAttribute("data-start") || "store";
    document.querySelectorAll(".mode").forEach((m) => m.classList.toggle("on", m === el));
    const next = el.getAttribute("data-brief");
    if (next) document.getElementById("brief").value = next;
    document.getElementById("brief").focus();
  });
});
document.getElementById("copyInvite").addEventListener("click", () => copyInviteText(projectId));
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
  if (projectId) {
    try {
      await api("/api/join", { method: "POST", body: JSON.stringify({ projectId }) });
      await bootProject();
      return;
    } catch {
      /* fall through to first screen */
    }
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
