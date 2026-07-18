import { SPEC, questionsPerModule } from "./spec";
import type { GeneratedModule } from "./types";

export class ModuleValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ModuleValidationError";
  }
}

/**
 * Validate a generated module against the spec's structural rules. Throws a
 * descriptive ModuleValidationError on the first violation.
 */
export function validateModule(m: GeneratedModule): void {
  const total = questionsPerModule(m.section);
  if (m.items.length !== total) {
    throw new ModuleValidationError(
      `${m.section} module must have exactly ${total} questions, got ${m.items.length}`,
    );
  }
  // No question may appear twice in a module.
  const ids = new Set<string>();
  for (const it of m.items) {
    if (ids.has(it.id)) {
      throw new ModuleValidationError(`Duplicate question "${it.id}" in ${m.section} module`);
    }
    ids.add(it.id);
  }

  if (m.section === "RW") validateRw(m);
  else validateMath(m);
}

function validateRw(m: GeneratedModule): void {
  const order = SPEC.reading_writing.blueprint.map((b) => b.type);

  // (a) Types appear in fixed block order (no returning to an earlier block).
  let maxSeen = -1;
  const counts = new Map<string, number>();
  for (const it of m.items) {
    const idx = order.indexOf(it.type);
    if (idx === -1) throw new ModuleValidationError(`Unknown R&W type "${it.type}"`);
    if (idx < maxSeen) {
      throw new ModuleValidationError(
        `R&W block order violated: "${it.type}" appears after a later block`,
      );
    }
    maxSeen = Math.max(maxSeen, idx);
    counts.set(it.type, (counts.get(it.type) ?? 0) + 1);
  }

  // (b) Each block count within tolerance of its spec target.
  for (const b of SPEC.reading_writing.blueprint) {
    const c = counts.get(b.type) ?? 0;
    if (Math.abs(c - b.count) > b.tolerance) {
      throw new ModuleValidationError(
        `R&W block "${b.type}" count ${c} outside ${b.count}±${b.tolerance}`,
      );
    }
  }

  // (c) Within each block, difficulty non-decreasing (block boundaries by type,
  //     except the SEC block which is sorted only by difficulty anyway).
  let prevType = "";
  let prevDiff = 0;
  for (const it of m.items) {
    if (it.type !== prevType) {
      prevDiff = 0; // difficulty resets at each block start
    }
    if (it.difficulty < prevDiff - 0.001) {
      throw new ModuleValidationError(
        `R&W difficulty must not decrease within block "${it.type}"`,
      );
    }
    prevDiff = it.difficulty;
    prevType = it.type;
  }

  // (d) SEC block interleaves both subtypes (not fully grouped).
  const sec = m.items.filter((it) => it.type === "standard_english_conventions");
  const subtypes = new Set(sec.map((s) => s.subtype));
  if (sec.length >= 3 && subtypes.size < 2) {
    throw new ModuleValidationError(
      "SEC block must mix grammar and punctuation subtypes, not a single subtype",
    );
  }
}

function validateMath(m: GeneratedModule): void {
  // (a) Difficulty non-decreasing across the module (small tolerance for the
  //     local swaps used to break consecutive-subtopic repeats).
  for (let i = 1; i < m.items.length; i++) {
    if (m.items[i].difficulty < m.items[i - 1].difficulty - 0.5) {
      throw new ModuleValidationError(
        `Math difficulty drops too much at Q${i + 1} (${m.items[i - 1].difficulty} → ${m.items[i].difficulty})`,
      );
    }
  }

  // (b) No two consecutive questions share a subtopic.
  for (let i = 1; i < m.items.length; i++) {
    const a = m.items[i - 1].subtype;
    const b = m.items[i].subtype;
    if (a && b && a === b) {
      throw new ModuleValidationError(
        `Math has consecutive same-subtopic questions at Q${i} and Q${i + 1} ("${a}")`,
      );
    }
  }

  // (c) SPR share within spec tolerance.
  const spr = m.items.filter((it) => it.format === "spr").length;
  const { spr_count, spr_tolerance } = SPEC.math.format;
  if (Math.abs(spr - spr_count) > spr_tolerance + 1) {
    throw new ModuleValidationError(
      `Math SPR count ${spr} outside ${spr_count}±${spr_tolerance + 1}`,
    );
  }

  // (d) Domain counts within tolerance.
  const counts = new Map<string, number>();
  for (const it of m.items) counts.set(it.domain, (counts.get(it.domain) ?? 0) + 1);
  for (const d of SPEC.math.domain_counts_per_module) {
    const c = counts.get(d.domain) ?? 0;
    if (Math.abs(c - d.count) > d.tolerance + 1) {
      throw new ModuleValidationError(
        `Math domain "${d.domain}" count ${c} outside ${d.count}±${d.tolerance + 1}`,
      );
    }
  }
}
