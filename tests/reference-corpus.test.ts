import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

/**
 * The internal reference corpus must be impossible to reach from any
 * student-facing route. These tests assert that the ONLY code touching
 * `referenceCorpusItem` is the admin-gated route + the authoring scripts, and
 * that the admin route enforces the ADMIN role.
 */

const APP_DIR = join(__dirname, "../src/app");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

describe("reference corpus access control", () => {
  const files = walk(APP_DIR);

  it("is referenced only by the admin-gated reference route", () => {
    const referencing = files.filter((f) =>
      /referenceCorpusItem/.test(readFileSync(f, "utf8")),
    );
    // Allowed: the admin reference page and the admin overview stat count.
    const allowed = [
      join(APP_DIR, "(app)/admin/reference/page.tsx"),
      join(APP_DIR, "(app)/admin/page.tsx"),
    ];
    for (const f of referencing) {
      expect(allowed).toContain(f);
    }
  });

  it("guards the reference route with requireRole ADMIN", () => {
    const src = readFileSync(join(APP_DIR, "(app)/admin/reference/page.tsx"), "utf8");
    expect(src).toMatch(/requireRole\(\s*["']ADMIN["']\s*\)/);
  });

  it("does not expose the corpus through any API route", () => {
    const apiFiles = files.filter((f) => f.includes(join("app", "api")));
    for (const f of apiFiles) {
      expect(readFileSync(f, "utf8")).not.toMatch(/referenceCorpusItem/);
    }
  });
});
