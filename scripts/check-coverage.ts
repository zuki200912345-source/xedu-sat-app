/**
 * Builds the BankItem[] from the real content sources (same items the seed
 * loads) and checks that generateModule() succeeds for every section × tier
 * across many seeds. Reports coverage gaps so we know what fill-ins to author.
 *
 * Run: npx tsx scripts/check-coverage.ts
 */
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { rwQuestions } from "../prisma/seed-data/rw-questions";
import { mathQuestions } from "../prisma/seed-data/math-questions";
import type { SeedQuestion } from "../prisma/seed-data/types";
import { toSpecFields, difficultyValueFor, bandOf } from "../src/lib/sat-engine/mapping";
import { generateModule } from "../src/lib/sat-engine/generator";
import type { BankItem } from "../src/lib/sat-engine/types";
import type { Section } from "../src/lib/sat-engine/spec";

function loadAll(): SeedQuestion[] {
  const all = [...rwQuestions, ...mathQuestions];
  const genPath = join(__dirname, "../prisma/seed-data/generated-bank.json");
  if (existsSync(genPath)) all.push(...(JSON.parse(readFileSync(genPath, "utf8")) as SeedQuestion[]));
  return all;
}

export function buildBank(items: SeedQuestion[]): BankItem[] {
  return items.map((q, i) => {
    const key = `${q.stem}::${q.explanation}::${i}`;
    const spec = toSpecFields({
      id: key,
      section: q.section,
      domain: q.domain,
      skill: q.skill,
      type: q.type,
      hasGraph: !!q.graphSpec,
    });
    return {
      id: key,
      section: q.section as Section,
      type: spec.type,
      subtype: spec.subtype,
      domain: spec.domain,
      difficulty: difficultyValueFor(q.difficulty, key),
      format: q.type === "SPR" ? "spr" : "mc",
    };
  });
}

function coverageReport(bank: BankItem[]) {
  const cells = new Map<string, number>();
  for (const it of bank) {
    const k = `${it.section} | ${it.type}${it.subtype ? " / " + it.subtype : ""} | ${bandOf(it.difficulty)}`;
    cells.set(k, (cells.get(k) ?? 0) + 1);
  }
  return cells;
}

function main() {
  const bank = buildBank(loadAll());
  console.log(`Loaded ${bank.length} items (${bank.filter((b) => b.section === "RW").length} RW, ${bank.filter((b) => b.section === "MATH").length} Math)\n`);

  const failures: string[] = [];
  let ok = 0;
  for (const section of ["RW", "MATH"] as Section[]) {
    for (let tier = 1; tier <= 5; tier++) {
      for (let s = 0; s < 12; s++) {
        try {
          generateModule(section, tier, `form-${s}`, bank);
          ok++;
        } catch (e) {
          failures.push(`${section} tier ${tier} seed ${s}: ${(e as Error).message}`);
        }
      }
    }
  }
  console.log(`Generation: ${ok} ok, ${failures.length} failed`);
  for (const f of failures.slice(0, 15)) console.log("  ✗ " + f);

  // Show the thinnest cells (potential gaps).
  const cells = [...coverageReport(bank).entries()].sort((a, b) => a[1] - b[1]);
  console.log("\nThinnest coverage cells:");
  for (const [k, v] of cells.slice(0, 20)) console.log(`  ${v.toString().padStart(3)}  ${k}`);
}

main();
