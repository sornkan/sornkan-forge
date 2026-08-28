export interface Env {
  DISPATCHER: {
    get(name: string): Fetcher;
  };
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    const name = url.pathname.split("/").filter(Boolean)[0];
    if (!name || !name.startsWith("forge-user-")) {
      return new Response("Forge preview. Pass /forge-user-{id}/", { status: 404 });
    }
    const user = env.DISPATCHER.get(name);
    const rest = url.pathname.slice(name.length + 1) || "/";
    const dest = new URL(request.url);
    dest.pathname = rest.startsWith("/") ? rest : `/${rest}`;
    return user.fetch(new Request(dest, request));
  },
} satisfies ExportedHandler<Env>;
