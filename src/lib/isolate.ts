export function d1Name(projectId: string): string {
  return `forge-d1-proj-${projectId}`;
}

export function r2Name(projectId: string): string {
  return `forge-r2-proj-${projectId}`;
}

export function isOwnDb(id: string | null | undefined): id is string {
  return !!id && id !== "editor";
}

export function isOwnR2(bucket: string | null | undefined): bucket is string {
  return !!bucket && !bucket.startsWith("proj/");
}

export const APP_STACK = {
  backend: "hono",
  frontend: "public/",
  database: "d1",
  storage: "r2",
  bindings: { DB: "D1", BUCKET: "R2" },
  note: "Write a Hono app in src/index.js. Import { Hono } from \"hono\". Put pages in public/. Schema in schema.sql. Do not use Next, Prisma, or Postgres.",
} as const;
