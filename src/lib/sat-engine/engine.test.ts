// Unit tests for the pure SAT engine. Run: npm test
import { test, expect } from "vitest";
import { Rng } from "./rng";
import { routeTier } from "./router";
import { scoreSection, compositeScore } from "./scorer";
import { rwBlockCounts, mathDomainCounts } from "./blueprint";
import { validateModule, ModuleValidationError } from "./validator";
import { generateModule } from "./generator";
import type { BankItem } from "./types";

// Thin assert-style helpers over vitest's expect.
const expect_eq = (a: unknown, b: unknown) => expect(a).toEqual(b);
const expect_neq = (a: unknown, b: unknown) => expect(a).not.toEqual(b);
const expect_be = (a: unknown, b: unknown) => expect(a).toBe(b);
const expect_ok = (x: unknown) => expect(x).toBeTruthy();
const expect_throw = (fn: () => unknown, matcher: unknown) =>
  expect(fn).toThrow(matcher as RegExp);

// ---- synthetic bank with generous coverage ----------------------------------
function makeBank(): BankItem[] {
  const items: BankItem[] = [];
  let n = 0;
  const add = (o: Omit<BankItem, "id">) => items.push({ id: `q${n++}`, ...o });
  const diffs = [1.1, 1.3, 1.5, 1.7, 1.9, 2.1, 2.3, 2.5, 2.7, 2.9];

  const rwTypes = [
    "words_in_context", "text_structure_and_purpose", "cross_text_connections",
    "central_ideas_and_details", "command_of_evidence_textual",
    "command_of_evidence_quantitative", "inferences", "transitions", "rhetorical_synthesis",
  ];
  for (const type of rwTypes)
    for (let k = 0; k < 2; k++)
      for (const d of diffs) add({ section: "RW", type, subtype: null, domain: "X", difficulty: d, format: "mc" });
  // SEC with both subtypes
  for (const subtype of ["grammar_form_structure_sense", "punctuation_boundaries"])
    for (let k = 0; k < 3; k++)
      for (const d of diffs)
        add({ section: "RW", type: "standard_english_conventions", subtype, domain: "SEC", difficulty: d, format: "mc" });

  // Math: 4 domains, multiple subtopics, ~30% SPR
  const mathDomains: Record<string, string[]> = {
    algebra: ["linear_equations_one_variable", "linear_functions", "linear_equations_two_variables_and_systems", "linear_inequalities"],
    advanced_math: ["equivalent_expressions", "nonlinear_equations_and_systems", "nonlinear_functions_quadratic_exponential_polynomial_rational_absolute_value"],
    problem_solving_and_data_analysis: ["ratios_rates_proportions_units", "percentages", "one_variable_data_center_and_spread"],
    geometry_and_trigonometry: ["area_and_volume", "lines_angles_triangles", "circles", "right_triangles_and_trigonometry"],
  };
  for (const [domain, subs] of Object.entries(mathDomains))
    for (const subtype of subs)
      for (let k = 0; k < 3; k++)
        for (const d of diffs)
          add({ section: "MATH", type: domain, subtype, domain, difficulty: d, format: (n % 3 === 0 ? "spr" : "mc") });

  return items;
}
const BANK = makeBank();

test("Rng is deterministic for a given seed", () => {
  expect_eq(new Rng("abc").shuffle([1, 2, 3, 4, 5]), new Rng("abc").shuffle([1, 2, 3, 4, 5]));
  expect_neq(new Rng("abc").shuffle([1, 2, 3, 4, 5]), new Rng("xyz").shuffle([1, 2, 3, 4, 5]));
});

test("routeTier maps Module 1 correct → tier per spec", () => {
  expect_be(routeTier("RW", 3), 1);
  expect_be(routeTier("RW", 8), 2);
  expect_be(routeTier("RW", 14), 3);
  expect_be(routeTier("RW", 20), 4);
  expect_be(routeTier("RW", 27), 5);
  expect_be(routeTier("MATH", 2), 1);
  expect_be(routeTier("MATH", 22), 5);
});

test("scoreSection enforces tier caps", () => {
  // Perfect score on tier 1 is capped at 480.
  const t1 = scoreSection({ module1Correct: 27, module1Total: 27, module2Correct: 27, module2Total: 27, tier: 1 });
  expect_ok(t1 <= 480);
  // Perfect on tier 5 can reach 800.
  const t5 = scoreSection({ module1Correct: 22, module1Total: 22, module2Correct: 22, module2Total: 22, tier: 5 });
  expect_be(t5, 800);
  expect_be(compositeScore(700, 750), 1450);
});

test("blueprint counts total exactly 27 / 22", () => {
  for (let s = 0; s < 25; s++) {
    const rw = rwBlockCounts(new Rng(`s${s}`)).reduce((a, b) => a + b.count, 0);
    const ma = mathDomainCounts(new Rng(`s${s}`)).reduce((a, b) => a + b.count, 0);
    expect_be(rw, 27);
    expect_be(ma, 22);
  }
});

test("validateModule rejects a wrong total", () => {
  expect_throw(
    () => validateModule({ section: "RW", tier: 3, seed: "x", itemIds: [], items: [] }),
    ModuleValidationError,
  );
});

test("validateModule rejects consecutive math subtopics", () => {
  const dupe: BankItem[] = Array.from({ length: 22 }, (_, i) => ({
    id: `d${i}`, section: "MATH", type: "algebra", subtype: "linear_functions",
    domain: "algebra", difficulty: 1 + i * 0.09, format: "mc",
  }));
  expect_throw(
    () => validateModule({ section: "MATH", tier: 3, seed: "x", itemIds: dupe.map((d) => d.id), items: dupe }),
    /consecutive same-subtopic/,
  );
});

test("generateModule produces valid RW modules for all tiers", () => {
  for (let tier = 1; tier <= 5; tier++) {
    const m = generateModule("RW", tier, "form-1", BANK);
    expect_be(m.items.length, 27); // validateModule already ran inside
    expect_be(m.tier, tier);
  }
});

test("generateModule produces valid Math modules for all tiers", () => {
  for (let tier = 1; tier <= 5; tier++) {
    const m = generateModule("MATH", tier, "form-1", BANK);
    expect_be(m.items.length, 22);
  }
});

test("generateModule is deterministic for a given (section, tier, seed)", () => {
  const a = generateModule("MATH", 4, "form-7", BANK);
  const b = generateModule("MATH", 4, "form-7", BANK);
  expect_eq(a.itemIds, b.itemIds);
  const c = generateModule("MATH", 4, "form-8", BANK);
  expect_neq(a.itemIds, c.itemIds);
});
