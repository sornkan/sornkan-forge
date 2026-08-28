const ALLOWED = /^(src|public|templates)\/[A-Za-z0-9._\-\/]+$|^schema\.sql$|^wrangler\.jsonc$/;

export function sanitizePath(input: string): string {
  const trimmed = input.trim().replace(/\\/g, "/");
  if (!trimmed || trimmed.includes("\0")) throw new Error("invalid path");
  const parts = trimmed.split("/").filter((p) => p && p !== ".");
  if (parts.some((p) => p === "..")) throw new Error("path escapes sandbox");
  const joined = parts.join("/");
  if (!ALLOWED.test(joined)) throw new Error("path not in project tree");
  if (joined.length > 180) throw new Error("path too long");
  return joined;
}
