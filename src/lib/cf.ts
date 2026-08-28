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

export async function execD1(env: CfEnv, id: string, sql: string): Promise<unknown> {
  const res = await cf(env, "POST", `/d1/database/${id}/query`, JSON.stringify({ sql }), {
    "content-type": "application/json",
  });
  const data = (await res.json()) as { success: boolean; errors?: { message: string }[] };
  if (!data.success) throw new Error(data.errors?.[0]?.message || "d1 query failed");
  return data;
}

export async function uploadUserWorker(
  env: CfEnv,
  scriptName: string,
  source: string,
  bindings: Record<string, unknown>[],
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
    new Blob([source], { type: "application/javascript+module" }),
    "index.mjs",
  );

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
