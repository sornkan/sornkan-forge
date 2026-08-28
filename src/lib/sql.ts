const MUTATING = /^\s*(insert|update|delete|drop|alter|create|replace|truncate|pragma|attach|detach)\b/i;

export function isMutatingSql(sql: string): boolean {
  const stripped = sql.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--.*$/gm, " ");
  return stripped
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .some((stmt) => MUTATING.test(stmt));
}
