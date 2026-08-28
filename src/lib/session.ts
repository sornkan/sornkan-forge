const COOKIE = "forge_sid";

export function readSid(request: Request): string | null {
  const raw = request.headers.get("Cookie") || "";
  const m = raw.match(/(?:^|;\s*)forge_sid=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export function sidCookie(id: string, secure: boolean): string {
  const flags = secure ? "; Secure" : "";
  return `${COOKIE}=${encodeURIComponent(id)}; Path=/; HttpOnly${flags}; SameSite=Lax; Max-Age=604800`;
}

export function json(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init.headers || {}),
    },
  });
}
