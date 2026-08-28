export type CfEnv = {
  CLOUDFLARE_ACCOUNT_ID: string;
  CLOUDFLARE_API_TOKEN: string;
  DISPATCH_NAMESPACE?: string;
};

async function cf(
  env: CfEnv,
  method: string,
  path: string,
  body?: BodyInit | null,
  headers: Record<string, string> = {},
): Promise<Response> {
  return fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}${path}`, {
    method,
    headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`, ...headers },
    body: body ?? undefined,
  });
}

export async function createD1(env: CfEnv, name: string): Promise<{ uuid: string; name: string }> {
  const res = await cf(env, "POST", "/d1/database", JSON.stringify({ name }), {
    "content-type": "application/json",
  });
  const data = (await res.json()) as { success: boolean; result?: { uuid: string; name: string }; errors?: { message: string }[] };
  if (!data.success || !data.result) throw new Error(data.errors?.[0]?.message || "d1 create failed");
  return data.result;
}

export async function execD1(
  env: CfEnv,
  id: string,
  sql: string,
  params?: unknown[],
): Promise<{ success: boolean; result?: { results?: Record<string, unknown>[] }[]; errors?: { message: string }[] }> {
  const res = await cf(env, "POST", `/d1/database/${id}/query`, JSON.stringify(params ? { sql, params } : { sql }), {
    "content-type": "application/json",
  });
  const data = (await res.json()) as {
    success: boolean;
    result?: { results?: Record<string, unknown>[] }[];
    errors?: { message: string }[];
  };
  if (!data.success) throw new Error(data.errors?.[0]?.message || "d1 query failed");
  return data;
}

export async function queryD1(
  env: CfEnv,
  id: string,
  sql: string,
  params?: unknown[],
): Promise<Record<string, unknown>[]> {
  const data = await execD1(env, id, sql, params);
  return data.result?.[0]?.results ?? [];
}

export async function execD1Script(env: CfEnv, id: string, script: string): Promise<void> {
  const parts = script
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const stmt of parts) await execD1(env, id, stmt);
}

export async function createR2(env: CfEnv, name: string): Promise<{ name: string }> {
  const res = await cf(env, "POST", "/r2/buckets", JSON.stringify({ name }), {
    "content-type": "application/json",
  });
  const data = (await res.json()) as { success: boolean; errors?: { code?: number; message: string }[] };
  if (data.success) return { name };
  const msg = data.errors?.[0]?.message || "r2 create failed";
  if (/already exists|409/i.test(msg) || data.errors?.[0]?.code === 10004) return { name };
  const put = await cf(env, "PUT", `/r2/buckets/${name}`, null);
  const putData = (await put.json()) as { success: boolean; errors?: { message: string }[] };
  if (putData.success || put.status === 409) return { name };
  throw new Error(msg);
}

export async function putR2Object(
  env: CfEnv,
  bucket: string,
  key: string,
  body: Uint8Array,
  contentType: string,
): Promise<void> {
  const res = await cf(env, "PUT", `/r2/buckets/${bucket}/objects/${encodeURIComponent(key)}`, body, {
    "content-type": contentType,
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { errors?: { message: string }[] };
    throw new Error(data.errors?.[0]?.message || `r2 put failed ${res.status}`);
  }
}

export async function getR2Object(
  env: CfEnv,
  bucket: string,
  key: string,
): Promise<{ body: ArrayBuffer; contentType: string } | null> {
  const res = await cf(env, "GET", `/r2/buckets/${bucket}/objects/${encodeURIComponent(key)}`);
  if (res.status === 404) return null;
  if (!res.ok) return null;
  return {
    body: await res.arrayBuffer(),
    contentType: res.headers.get("content-type") || "application/octet-stream",
  };
}

export async function listR2Objects(env: CfEnv, bucket: string): Promise<string[]> {
  const res = await cf(env, "GET", `/r2/buckets/${bucket}/objects?per_page=100`);
  const data = (await res.json()) as {
    success?: boolean;
    result?: { objects?: { key?: string; name?: string }[]; delimited?: { objects?: { key?: string }[] } };
  };
  const rows = data.result?.objects || data.result?.delimited?.objects || [];
  return rows.map((o) => o.key || o.name || "").filter(Boolean);
}

export function rewriteHonoImports(source: string): string {
  return source.replace(/from\s+["']hono(?:\/[^"']*)?["']/g, 'from "./hono.mjs"');
}

export async function uploadUserWorker(
  env: CfEnv,
  scriptName: string,
  source: string,
  bindings: Record<string, unknown>[],
  extraModules: { name: string; source: string }[] = [],
): Promise<{ url: string }> {
  const metadata = {
    main_module: "index.mjs",
    compatibility_date: "2026-08-20",
    bindings,
  };
  const form = new FormData();
  form.set("metadata", JSON.stringify(metadata));
  form.set(
    "index.mjs",
    new Blob([rewriteHonoImports(source)], { type: "application/javascript+module" }),
    "index.mjs",
  );
  for (const mod of extraModules) {
    form.set(mod.name, new Blob([mod.source], { type: "application/javascript+module" }), mod.name);
  }

  const path = env.DISPATCH_NAMESPACE
    ? `/workers/dispatch/namespaces/${env.DISPATCH_NAMESPACE}/scripts/${scriptName}`
    : `/workers/scripts/${scriptName}`;

  const res = await cf(env, "PUT", path, form);
  const data = (await res.json()) as { success: boolean; errors?: { message: string }[] };
  if (!data.success) throw new Error(data.errors?.[0]?.message || "worker upload failed");

  if (env.DISPATCH_NAMESPACE) {
    return { url: `https://forge-worker-dispatch.${env.CLOUDFLARE_ACCOUNT_ID}.workers.dev/${scriptName}/` };
  }
  return { url: `https://${scriptName}.sornkan.workers.dev` };
}
