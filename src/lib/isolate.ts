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
