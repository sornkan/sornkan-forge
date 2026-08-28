import { build } from "esbuild";
import { mkdir } from "node:fs/promises";

await mkdir("public/stack", { recursive: true });
await build({
  stdin: {
    contents: `export { Hono } from "hono";\nexport { cors } from "hono/cors";\n`,
    resolveDir: process.cwd(),
    sourcefile: "hono-entry.js",
    loader: "js",
  },
  bundle: true,
  format: "esm",
  platform: "neutral",
  minify: true,
  outfile: "public/stack/hono.min.mjs",
  logLevel: "info",
});
