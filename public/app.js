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

const log = (name, detail) => {
  const row = document.createElement("div");
  row.className = "act";
  row.textContent = `${name} · ${detail || "ok"}`;
  actEl.prepend(row);
};

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

async function callTool(name, input = {}) {
  log(name, "…");
  workStatus.dataset.live = "1";
  workStatus.textContent = `Running ${name}`;
  const result = await api("/api/tools", {
    method: "POST",
    body: JSON.stringify({ name, input }),
  });
  log(name, "done");
  workStatus.textContent = `Just used ${name}`;
  await refresh();
  return result;
}

function inviteUrl(id) {
  const u = new URL(location.href);
  u.search = `?p=${id}`;
  return u.toString();
}

async function copyInviteText(id) {
  const text = `Open this URL in ChatGPT desktop (GPT-5.6 Sol or Terra) or Chrome with chrome://flags/#enable-webmcp-testing:\n${inviteUrl(id)}\n\nCall get_project first — the human already typed a brief. Attach modules web, database, storage if needed. Keep the store working. After they pin notes, call list_annotations and patch.`;
  await navigator.clipboard.writeText(text);
  log("invite", "copied");
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
    .map((a) => `<div class="pin-item">${a.note}</div>`)
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
    .map((a) => `<i class="pin" style="left:${a.x * 100}%;top:${a.y * 100}%"></i>`)
    .join("");
  const src = p.preview_url || `/preview/${p.id}/`;
  if (!preview.getAttribute("data-src") || preview.getAttribute("data-src") !== src) {
    preview.src = src;
    preview.setAttribute("data-src", src);
  }
}

async function registerTools(tools) {
  if (typeof document.modelContext?.registerTool !== "function") {
    who.classList.add("wait");
    whoState.textContent = "waiting";
    return;
  }
  who.classList.remove("wait");
  whoState.textContent = "in the room";
  for (const tool of tools) {
    await document.modelContext.registerTool({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      annotations: tool.annotations,
      async execute(input) {
        const result = await callTool(tool.name, input || {});
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      },
    });
  }
}

async function bootProject() {
  empty.classList.add("hidden");
  ed.classList.remove("hidden");
  const catalog = await api("/api/catalog");
  await registerTools(catalog.tools);
  await refresh();
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
})();
