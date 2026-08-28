import { toolsForState } from "./lib/catalog.ts";
import { sanitizePath } from "./lib/paths.ts";
import { isMutatingSql } from "./lib/sql.ts";
import { json, readSid, sidCookie } from "./lib/session.ts";
import { htmlForStart, indexForStart, SEED_SCHEMA, type StartMode } from "./lib/seed.ts";
import { createD1, execD1, uploadUserWorker, type CfEnv } from "./lib/cf.ts";
import { ensureShop, handlePreview } from "./lib/shop.ts";

function requireCf(env: EditorEnv): CfEnv {
  if (!env.CLOUDFLARE_API_TOKEN) throw new Error("CLOUDFLARE_API_TOKEN missing");
  return {
    CLOUDFLARE_ACCOUNT_ID: env.CLOUDFLARE_ACCOUNT_ID,
    CLOUDFLARE_API_TOKEN: env.CLOUDFLARE_API_TOKEN,
    DISPATCH_NAMESPACE: env.DISPATCH_NAMESPACE,
  };
}

type EditorEnv = Cloudflare.Env & {
  CLOUDFLARE_API_TOKEN?: string;
  DISPATCH_NAMESPACE?: string;
  PREVIEW_HOST?: string;
};

type Project = {
  id: string;
  brief: string;
  created_at: string;
  preview_url: string | null;
  published_url: string | null;
  d1_id: string | null;
  d1_name: string | null;
  r2_prefix: string | null;
  logs: string;
};

export default {
  async fetch(request, env): Promise<Response> {
    try {
      const url = new URL(request.url);
      if (url.pathname.startsWith("/preview/")) {
        const parts = url.pathname.split("/").filter(Boolean);
        const projectId = parts[1];
        if (!projectId) return json({ error: "missing project" }, { status: 404 });
        const rest = "/" + parts.slice(2).join("/");
        return handlePreview(request, env, projectId, rest === "/" ? "/" : rest);
      }
      if (url.pathname.startsWith("/api/")) {
        return await handleApi(request, env);
      }
      return env.ASSETS.fetch(request);
    } catch (err) {
      const message = err instanceof Error ? err.message : "error";
      return json({ error: message }, { status: 400 });
    }
  },
} satisfies ExportedHandler<EditorEnv>;

async function handleApi(request: Request, env: EditorEnv): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname === "/api/session" && request.method === "POST") {
    const body = (await request.json().catch(() => ({}))) as { brief?: string; start?: StartMode };
    const start: StartMode =
      body.start === "blank" || body.start === "cafe" || body.start === "store" ? body.start : "store";
    return createSession(env, url.protocol === "https:", String(body.brief || "").slice(0, 2000), start);
  }

  if (url.pathname === "/api/join" && request.method === "POST") {
    const body = (await request.json()) as { projectId?: string };
    return joinSession(env, url.protocol === "https:", String(body.projectId || ""));
  }

  const sid = readSid(request);
  if (!sid) return json({ error: "no session" }, { status: 401 });
  const session = await env.DB_PROJECTS.prepare("SELECT project_id FROM sessions WHERE id = ?")
    .bind(sid)
    .first<{ project_id: string }>();
  if (!session) return json({ error: "unknown session" }, { status: 401 });
  const projectId = session.project_id;

  if (url.pathname === "/api/catalog" && request.method === "GET") {
    const p = await getProject(env, projectId);
    return json({
      tools: toolsForState({ hasD1: !!p.d1_id && p.d1_id !== "editor", hasR2: !!p.r2_prefix }),
    });
  }

  if (url.pathname === "/api/project" && request.method === "GET") {
    return json(await projectView(env, projectId));
  }

  if (url.pathname === "/api/annotations" && request.method === "POST") {
    const body = await request.json<{ x: number; y: number; note: string }>();
    const id = crypto.randomUUID();
    await env.DB_PROJECTS.prepare(
      "INSERT INTO annotations (id, project_id, x, y, note, resolved, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)",
    )
      .bind(id, projectId, body.x, body.y, String(body.note || "").slice(0, 500), new Date().toISOString())
      .run();
    return json({ id });
  }

  if (url.pathname === "/api/tools" && request.method === "POST") {
    const body = await request.json<{ name: string; input?: Record<string, unknown> }>();
    return json(await runTool(env, projectId, body.name, body.input || {}));
  }

  return json({ error: "not found" }, { status: 404 });
}

async function createSession(
  env: EditorEnv,
  secure: boolean,
  brief: string,
  start: StartMode,
): Promise<Response> {
  const projectId = crypto.randomUUID().slice(0, 8);
  const sid = crypto.randomUUID();
  const now = new Date().toISOString();
  const preview = `/preview/${projectId}/`;
  await env.DB_PROJECTS.batch([
    env.DB_PROJECTS.prepare(
      "INSERT INTO projects (id, brief, created_at, logs, preview_url) VALUES (?, ?, ?, '[]', ?)",
    ).bind(projectId, brief, now, preview),
    env.DB_PROJECTS.prepare("INSERT INTO sessions (id, project_id, created_at) VALUES (?, ?, ?)").bind(
      sid,
      projectId,
      now,
    ),
    env.DB_PROJECTS.prepare(
      "INSERT INTO files (project_id, path, content, updated_at) VALUES (?, ?, ?, ?)",
    ).bind(projectId, "src/index.js", indexForStart(start), now),
    env.DB_PROJECTS.prepare(
      "INSERT INTO files (project_id, path, content, updated_at) VALUES (?, ?, ?, ?)",
    ).bind(projectId, "public/index.html", htmlForStart(start), now),
    env.DB_PROJECTS.prepare(
      "INSERT INTO files (project_id, path, content, updated_at) VALUES (?, ?, ?, ?)",
    ).bind(projectId, "schema.sql", SEED_SCHEMA, now),
  ]);
  if (start !== "blank") {
    await ensureShop(env.DB_PROJECTS, projectId, start === "cafe" ? "cafe" : "store");
    await env.DB_PROJECTS.prepare(
      "UPDATE projects SET d1_id = ?, d1_name = ?, r2_prefix = ? WHERE id = ?",
    )
      .bind("editor", "database", `proj/${projectId}/`, projectId)
      .run();
  }
  return json({ projectId, preview, start }, { headers: { "set-cookie": sidCookie(sid, secure) } });
}

async function joinSession(env: EditorEnv, secure: boolean, projectId: string): Promise<Response> {
  if (!/^[0-9a-f-]{8,36}$/i.test(projectId)) return json({ error: "bad project" }, { status: 400 });
  const row = await env.DB_PROJECTS.prepare("SELECT id FROM projects WHERE id = ?")
    .bind(projectId)
    .first();
  if (!row) return json({ error: "unknown project" }, { status: 404 });
  const sid = crypto.randomUUID();
  await env.DB_PROJECTS.prepare("INSERT INTO sessions (id, project_id, created_at) VALUES (?, ?, ?)").bind(
    sid,
    projectId,
    new Date().toISOString(),
  ).run();
  return json({ projectId }, { headers: { "set-cookie": sidCookie(sid, secure) } });
}

async function getProject(env: EditorEnv, id: string): Promise<Project> {
  const row = await env.DB_PROJECTS.prepare("SELECT * FROM projects WHERE id = ?").bind(id).first<Project>();
  if (!row) throw new Error("project missing");
  return row;
}

async function projectView(env: EditorEnv, id: string) {
  const p = await getProject(env, id);
  const files = await env.DB_PROJECTS.prepare(
    "SELECT path, updated_at FROM files WHERE project_id = ? ORDER BY path",
  )
    .bind(id)
    .all<{ path: string; updated_at: string }>();
  const pins = await env.DB_PROJECTS.prepare(
    "SELECT id, x, y, note, resolved FROM annotations WHERE project_id = ? ORDER BY created_at",
  )
    .bind(id)
    .all();
  return {
    id: p.id,
    brief: p.brief,
    preview_url: p.preview_url,
    published_url: p.published_url,
    hasD1: !!p.d1_id,
    hasR2: !!p.r2_prefix,
    modules: {
      web: !!p.preview_url,
      database: !!p.d1_id,
      storage: !!p.r2_prefix,
    },
    files: files.results ?? [],
    annotations: pins.results ?? [],
    logs: JSON.parse(p.logs || "[]"),
    tools: toolsForState({ hasD1: !!p.d1_id && p.d1_id !== "editor", hasR2: !!p.r2_prefix }).map((t) => t.name),
  };
}

async function attachDatabase(env: EditorEnv, projectId: string) {
  const p = await getProject(env, projectId);
  if (p.d1_id) return { ok: true, module: "database" };
  try {
    return await runTool(env, projectId, "provision_d1", { confirmation: true });
  } catch {
    await ensureShop(env.DB_PROJECTS, projectId);
    await env.DB_PROJECTS.prepare("UPDATE projects SET d1_id = ?, d1_name = ? WHERE id = ?")
      .bind("editor", "database", projectId)
      .run();
    return { ok: true, module: "database", local: true };
  }
}

async function runTool(env: EditorEnv, projectId: string, name: string, input: Record<string, unknown>) {
  const p = await getProject(env, projectId);
  const now = new Date().toISOString();

  switch (name) {
    case "get_project":
      return projectView(env, projectId);
    case "attach_module": {
      if (input.confirmation !== true) throw new Error("confirmation required");
      const mod = String(input.module || "");
      if (mod === "database") return attachDatabase(env, projectId);
      if (mod === "storage") return runTool(env, projectId, "provision_r2", { confirmation: true });
      if (mod === "web") return runTool(env, projectId, "deploy_preview", {});
      throw new Error("unknown module");
    }
    case "set_brief":
      await env.DB_PROJECTS.prepare("UPDATE projects SET brief = ? WHERE id = ?")
        .bind(String(input.brief || ""), projectId)
        .run();
      return { ok: true };
    case "list_files":
      return env.DB_PROJECTS.prepare("SELECT path FROM files WHERE project_id = ? ORDER BY path")
        .bind(projectId)
        .all();
    case "read_file": {
      const path = sanitizePath(String(input.path || ""));
      const row = await env.DB_PROJECTS.prepare(
        "SELECT content FROM files WHERE project_id = ? AND path = ?",
      )
        .bind(projectId, path)
        .first<{ content: string }>();
      if (!row) throw new Error("file not found");
      return { path, content: row.content };
    }
    case "write_file": {
      const path = sanitizePath(String(input.path || ""));
      const content = String(input.content ?? "");
      if (content.length > 400_000) throw new Error("file too large");
      await env.DB_PROJECTS.prepare(
        "INSERT INTO files (project_id, path, content, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(project_id, path) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at",
      )
        .bind(projectId, path, content, now)
        .run();
      return { ok: true, path };
    }
    case "apply_patch": {
      const path = sanitizePath(String(input.path || ""));
      const row = await env.DB_PROJECTS.prepare(
        "SELECT content FROM files WHERE project_id = ? AND path = ?",
      )
        .bind(projectId, path)
        .first<{ content: string }>();
      if (!row) throw new Error("file not found");
      const oldText = String(input.old_text ?? "");
      if (!oldText || !row.content.includes(oldText)) throw new Error("old_text not found");
      const next = row.content.replace(oldText, String(input.new_text ?? ""));
      await env.DB_PROJECTS.prepare("UPDATE files SET content = ?, updated_at = ? WHERE project_id = ? AND path = ?")
        .bind(next, now, projectId, path)
        .run();
      return { ok: true, path };
    }
    case "delete_file": {
      const path = sanitizePath(String(input.path || ""));
      if (path === "src/index.js" || path === "src/index.ts") {
        if (input.confirmation !== true) throw new Error("confirmation required");
      }
      await env.DB_PROJECTS.prepare("DELETE FROM files WHERE project_id = ? AND path = ?")
        .bind(projectId, path)
        .run();
      return { ok: true };
    }
    case "list_annotations":
      return env.DB_PROJECTS.prepare(
        "SELECT id, x, y, note, resolved FROM annotations WHERE project_id = ? AND resolved = 0",
      )
        .bind(projectId)
        .all();
    case "resolve_annotation":
      await env.DB_PROJECTS.prepare("UPDATE annotations SET resolved = 1 WHERE id = ? AND project_id = ?")
        .bind(String(input.id), projectId)
        .run();
      return { ok: true };
    case "provision_d1": {
      if (input.confirmation !== true) throw new Error("confirmation required");
      if (p.d1_id) return { ok: true, d1_id: p.d1_id };
      const created = await createD1(requireCf(env), `forge-d1-proj-${projectId}`);
      const schema = await env.DB_PROJECTS.prepare(
        "SELECT content FROM files WHERE project_id = ? AND path = 'schema.sql'",
      )
        .bind(projectId)
        .first<{ content: string }>();
      if (schema?.content) await execD1(requireCf(env), created.uuid, schema.content);
      await env.DB_PROJECTS.prepare("UPDATE projects SET d1_id = ?, d1_name = ? WHERE id = ?")
        .bind(created.uuid, created.name, projectId)
        .run();
      return { ok: true, d1_id: created.uuid };
    }
    case "run_sql": {
      if (!p.d1_id) throw new Error("no D1 yet");
      const sql = String(input.sql || "");
      if (isMutatingSql(sql) && input.confirmation !== true) throw new Error("confirmation required");
      return execD1(requireCf(env), p.d1_id, sql);
    }
    case "provision_r2": {
      if (input.confirmation !== true) throw new Error("confirmation required");
      const prefix = `proj/${projectId}/`;
      await env.DB_PROJECTS.prepare("UPDATE projects SET r2_prefix = ? WHERE id = ?").bind(prefix, projectId).run();
      return { ok: true, prefix };
    }
    case "put_object": {
      if (!p.r2_prefix) throw new Error("no R2 yet");
      const key = String(input.key || "").replace(/^\/+/, "");
      if (!key || key.includes("..")) throw new Error("bad key");
      const bytes = Uint8Array.from(atob(String(input.content_base64 || "")), (c) => c.charCodeAt(0));
      await env.R2_ASSETS.put(p.r2_prefix + key, bytes, {
        httpMetadata: { contentType: String(input.content_type || "application/octet-stream") },
      });
      return { ok: true, key };
    }
    case "list_objects": {
      if (!p.r2_prefix) throw new Error("no R2 yet");
      const listed = await env.R2_ASSETS.list({ prefix: p.r2_prefix });
      return { objects: listed.objects.map((o) => o.key.slice(p.r2_prefix!.length)) };
    }
    case "deploy_preview":
    case "publish": {
      if (name === "publish" && input.confirmation !== true) throw new Error("confirmation required");
      const localUrl = `/preview/${projectId}/`;
      try {
        const sourceRow = await env.DB_PROJECTS.prepare(
          "SELECT content FROM files WHERE project_id = ? AND path IN ('src/index.js', 'src/index.ts') ORDER BY path LIMIT 1",
        )
          .bind(projectId)
          .first<{ content: string }>();
        if (!sourceRow) throw new Error("missing src/index.js");
        const fresh = await getProject(env, projectId);
        const bindings: Record<string, unknown>[] = [];
        if (fresh.d1_id && fresh.d1_id !== "editor") {
          bindings.push({ type: "d1", name: "DB", database_id: fresh.d1_id });
        }
        if (fresh.r2_prefix) bindings.push({ type: "r2_bucket", name: "BUCKET", bucket_name: "forge-r2-assets" });
        const scriptName = `forge-user-${projectId}`;
        const uploaded = await uploadUserWorker(requireCf(env), scriptName, sourceRow.content, bindings);
        const url = env.PREVIEW_HOST
          ? `${env.PREVIEW_HOST.replace(/\/$/, "")}/${scriptName}/`
          : uploaded.url;
        if (name === "publish") {
          await env.DB_PROJECTS.prepare("UPDATE projects SET published_url = ?, preview_url = ? WHERE id = ?")
            .bind(url, url, projectId)
            .run();
          return { ok: true, url, runtime: "worker" };
        }
        await env.DB_PROJECTS.prepare("UPDATE projects SET preview_url = ? WHERE id = ?").bind(url, projectId).run();
        return { ok: true, url, runtime: "worker" };
      } catch {
        await env.DB_PROJECTS.prepare("UPDATE projects SET preview_url = ? WHERE id = ?")
          .bind(localUrl, projectId)
          .run();
        if (name === "publish") {
          await env.DB_PROJECTS.prepare("UPDATE projects SET published_url = ? WHERE id = ?")
            .bind(localUrl, projectId)
            .run();
        }
        return { ok: true, url: localUrl, runtime: "hosted", local: true };
      }
    }
    case "get_preview_logs":
      return { logs: JSON.parse(p.logs || "[]") };
    default:
      throw new Error(`unknown tool ${name}`);
  }
}
