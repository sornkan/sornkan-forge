import { describe, expect, it } from "vitest";
import { sanitizePath } from "../src/lib/paths.ts";
import { isMutatingSql } from "../src/lib/sql.ts";
import { toolsForState, TOOLS, LOBBY_TOOLS } from "../src/lib/catalog.ts";

describe("sanitizePath", () => {
  it("accepts project files", () => {
    expect(sanitizePath("src/index.ts")).toBe("src/index.ts");
    expect(sanitizePath("public/index.html")).toBe("public/index.html");
    expect(sanitizePath("schema.sql")).toBe("schema.sql");
  });
  it("rejects escapes", () => {
    expect(() => sanitizePath("../secret")).toThrow();
    expect(() => sanitizePath("src/../../etc/passwd")).toThrow();
    expect(() => sanitizePath("/etc/passwd")).toThrow();
  });
});

describe("isMutatingSql", () => {
  it("flags writes", () => {
    expect(isMutatingSql("INSERT INTO guests VALUES (1)")).toBe(true);
    expect(isMutatingSql("SELECT * FROM guests")).toBe(false);
    expect(isMutatingSql("/* INSERT */ SELECT 1")).toBe(false);
  });
});

describe("catalog", () => {
  it("forbids additional properties", () => {
    for (const t of [...LOBBY_TOOLS, ...TOOLS]) {
      expect(t.inputSchema.additionalProperties).toBe(false);
      expect(t.title).toMatch(/\S/);
      expect(typeof t.annotations.readOnlyHint).toBe("boolean");
      expect(typeof t.annotations.untrustedContentHint).toBe("boolean");
    }
  });
  it("hides sql until D1 exists", () => {
    const names = toolsForState({ hasD1: false, hasR2: false }).map((t) => t.name);
    expect(names).not.toContain("run_sql");
    expect(toolsForState({ hasD1: true, hasR2: false }).map((t) => t.name)).toContain("run_sql");
  });
  it("includes attach_module", () => {
    expect(TOOLS.map((t) => t.name)).toContain("attach_module");
  });
  it("registers lobby tools ChatGPT can call on the first screen", () => {
    expect(LOBBY_TOOLS.map((t) => t.name)).toEqual(["get_page_context", "start_project", "join_project"]);
  });
  it("registers search_products on the top-level editor", () => {
    expect(TOOLS.map((t) => t.name)).toContain("search_products");
    expect(TOOLS.map((t) => t.name)).toContain("add_annotation");
  });
});
