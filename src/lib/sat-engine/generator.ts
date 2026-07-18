import { Rng } from "./rng";
import { SPEC, tierByNumber, mathDifficultyCurve, type DiffLabel, type Section } from "./spec";
import { rwBlockCounts, mathDomainCounts, mathSprTarget } from "./blueprint";
import { bandOf } from "./mapping";
import { validateModule } from "./validator";
import type { BankItem, GeneratedModule } from "./types";

/**
 * Deterministically generate one exam module from the question bank, following
 * the spec's blueprint, ordering rules, tier difficulty mix, and ±1 jitter.
 * Validates its own output and throws on any structural violation.
 */
export function generateModule(
  section: Section,
  tier: number,
  seed: string,
  bank: BankItem[],
): GeneratedModule {
  const rng = new Rng(`${section}:${tier}:${seed}`);
  const items = section === "RW" ? buildRw(tier, rng, bank) : buildMath(tier, rng, bank);
  const mod: GeneratedModule = {
    section,
    tier,
    seed,
    itemIds: items.map((i) => i.id),
    items,
  };
  validateModule(mod);
  return mod;
}

// ---- shared selection -------------------------------------------------------

/** Split a count into easy/medium/hard sub-counts per the tier mix. */
function splitByMix(count: number, mix: Record<DiffLabel, number>): Record<DiffLabel, number> {
  const raw: Record<DiffLabel, number> = {
    easy: count * mix.easy,
    medium: count * mix.medium,
    hard: count * mix.hard,
  };
  const out: Record<DiffLabel, number> = {
    easy: Math.round(raw.easy),
    medium: Math.round(raw.medium),
    hard: Math.round(raw.hard),
  };
  // Fix rounding drift so the parts sum to count.
  let drift = count - (out.easy + out.medium + out.hard);
  const order: DiffLabel[] = ["medium", "easy", "hard"];
  let k = 0;
  while (drift !== 0) {
    const band = order[k % order.length];
    if (drift > 0) {
      out[band]++;
      drift--;
    } else if (out[band] > 0) {
      out[band]--;
      drift++;
    }
    k++;
  }
  return out;
}

/** Pick `count` items from a pool honoring a mix, borrowing across bands when short. */
function selectByMix(
  pool: BankItem[],
  count: number,
  mix: Record<DiffLabel, number>,
  rng: Rng,
  used: Set<string>,
): BankItem[] {
  const byBand: Record<DiffLabel, BankItem[]> = { easy: [], medium: [], hard: [] };
  for (const it of rng.shuffle(pool)) {
    if (!used.has(it.id)) byBand[bandOf(it.difficulty)].push(it);
  }
  const want = splitByMix(count, mix);
  const chosen: BankItem[] = [];
  const borrowOrder: Record<DiffLabel, DiffLabel[]> = {
    easy: ["easy", "medium", "hard"],
    medium: ["medium", "easy", "hard"],
    hard: ["hard", "medium", "easy"],
  };
  for (const band of ["easy", "medium", "hard"] as DiffLabel[]) {
    let need = want[band];
    for (const b of borrowOrder[band]) {
      while (need > 0 && byBand[b].length) {
        const it = byBand[b].shift()!;
        chosen.push(it);
        used.add(it.id);
        need--;
      }
      if (need === 0) break;
    }
  }
  return chosen;
}

const byDiff = (a: BankItem, b: BankItem) => a.difficulty - b.difficulty;

// ---- Reading & Writing ------------------------------------------------------

/**
 * Redistribute counts so no block exceeds its available pool while keeping the
 * total exact — graceful degradation when a content cell is thin.
 */
function fitToPool(counts: { count: number }[], avail: number[], total: number): void {
  let deficit = 0;
  for (let i = 0; i < counts.length; i++) {
    if (counts[i].count > avail[i]) {
      deficit += counts[i].count - avail[i];
      counts[i].count = avail[i];
    }
  }
  while (deficit > 0) {
    let moved = false;
    for (let i = 0; i < counts.length && deficit > 0; i++) {
      if (avail[i] > counts[i].count) {
        counts[i].count++;
        deficit--;
        moved = true;
      }
    }
    if (!moved) break; // not enough total content anywhere
  }
  void total;
}

function buildRw(tier: number, rng: Rng, bank: BankItem[]): BankItem[] {
  const mix = tierByNumber("RW", tier).mix;
  const counts = rwBlockCounts(rng);
  const rw = bank.filter((b) => b.section === "RW");
  const avail = counts.map((c) => rw.filter((it) => it.type === c.type).length);
  fitToPool(counts, avail, 27);
  const used = new Set<string>();
  const result: BankItem[] = [];

  for (const block of counts) {
    if (block.count <= 0) continue;
    if (block.type === "standard_english_conventions") {
      result.push(...buildSecBlock(block.count, mix, rng, rw, used));
    } else {
      const pool = rw.filter((it) => it.type === block.type);
      const picked = selectByMix(pool, block.count, mix, rng, used).sort(byDiff);
      result.push(...picked);
    }
  }
  return result;
}

/** Standard English Conventions: ~50/50 grammar/punctuation, interleaved, sorted by difficulty. */
function buildSecBlock(
  count: number,
  mix: Record<DiffLabel, number>,
  rng: Rng,
  rw: BankItem[],
  used: Set<string>,
): BankItem[] {
  const grammarN = Math.round(count / 2);
  const punctN = count - grammarN;
  const grammar = selectByMix(
    rw.filter((it) => it.type === "standard_english_conventions" && it.subtype === "grammar_form_structure_sense"),
    grammarN,
    mix,
    rng,
    used,
  );
  const punct = selectByMix(
    rw.filter((it) => it.type === "standard_english_conventions" && it.subtype === "punctuation_boundaries"),
    punctN,
    mix,
    rng,
    used,
  );
  // If one subtype is short, top up from the whole SEC pool.
  const picked = [...grammar, ...punct];
  if (picked.length < count) {
    const extra = selectByMix(
      rw.filter((it) => it.type === "standard_english_conventions"),
      count - picked.length,
      mix,
      rng,
      used,
    );
    picked.push(...extra);
  }
  // Sort only by difficulty (this interleaves the two subtypes).
  return picked.sort(byDiff);
}

// ---- Math -------------------------------------------------------------------

function buildMath(tier: number, rng: Rng, bank: BankItem[]): BankItem[] {
  const mix = tierByNumber("MATH", tier).mix;
  const domainCounts = mathDomainCounts(rng);
  const math = bank.filter((b) => b.section === "MATH");
  const avail = domainCounts.map((d) => math.filter((it) => it.domain === d.domain).length);
  fitToPool(domainCounts, avail, 22);
  const used = new Set<string>();

  const selected: BankItem[] = [];
  for (const dc of domainCounts) {
    const pool = math.filter((it) => it.domain === dc.domain);
    selected.push(...selectByMix(pool, dc.count, mix, rng, used));
  }

  adjustSpr(selected, math, used, rng);

  // Order by difficulty (Q1 easiest → Q22 hardest).
  selected.sort(byDiff);
  breakConsecutiveSubtype(selected);
  return selected;
}

/** Nudge the SPR count toward the spec target via same-domain swaps. */
function adjustSpr(selected: BankItem[], math: BankItem[], used: Set<string>, rng: Rng): void {
  const target = mathSprTarget();
  const spare = rng.shuffle(math.filter((it) => !used.has(it.id)));
  const sprCount = () => selected.filter((it) => it.format === "spr").length;

  // Add SPR: swap an MC for an unused SPR of the same domain.
  while (sprCount() < target - 1) {
    const mcIdx = selected.findIndex((it) => it.format === "mc");
    if (mcIdx === -1) break;
    const dom = selected[mcIdx].domain;
    const repl = spare.find((it) => it.format === "spr" && it.domain === dom && !used.has(it.id));
    if (!repl) break;
    used.add(repl.id);
    used.delete(selected[mcIdx].id);
    selected[mcIdx] = repl;
  }
  // Remove SPR: swap an SPR for an unused MC of the same domain.
  while (sprCount() > target + 1) {
    const sprIdx = selected.findIndex((it) => it.format === "spr");
    if (sprIdx === -1) break;
    const dom = selected[sprIdx].domain;
    const repl = spare.find((it) => it.format === "mc" && it.domain === dom && !used.has(it.id));
    if (!repl) break;
    used.add(repl.id);
    used.delete(selected[sprIdx].id);
    selected[sprIdx] = repl;
  }
}

/** True if swapping i,j introduces no same-subtopic adjacency and keeps
 *  difficulty roughly ordered (within the validator's 0.5 tolerance). */
function canSwap(items: BankItem[], i: number, j: number): boolean {
  if (Math.abs(items[i].difficulty - items[j].difficulty) > 0.5) return false;
  const test = items.slice();
  [test[i], test[j]] = [test[j], test[i]];
  for (const k of [i, j]) {
    const st = test[k].subtype;
    if (!st) continue;
    if (k > 0 && test[k - 1].subtype === st) return false;
    if (k < test.length - 1 && test[k + 1].subtype === st) return false;
  }
  return true;
}

/** Resolve consecutive same-subtopic pairs via nearest bidirectional swaps. */
function breakConsecutiveSubtype(items: BankItem[]): void {
  for (let pass = 0; pass < items.length * 2; pass++) {
    let changed = false;
    for (let i = 1; i < items.length; i++) {
      const a = items[i - 1].subtype;
      if (!a || items[i].subtype !== a) continue;
      let done = false;
      for (let dist = 1; dist < items.length && !done; dist++) {
        for (const j of [i - dist, i + dist]) {
          if (j < 1 || j >= items.length || j === i) continue;
          if (canSwap(items, i, j)) {
            [items[i], items[j]] = [items[j], items[i]];
            changed = true;
            done = true;
            break;
          }
        }
      }
    }
    if (!changed) break;
  }
}

/** The tier-adjusted math difficulty curve (offset applied, clamped 1–3). */
export function mathCurveForTier(tier: number): number[] {
  const offset = tierByNumber("MATH", tier).difficulty_offset;
  return mathDifficultyCurve().map((d) => Math.max(1, Math.min(3, d + offset)));
}

export const _spec = SPEC; // re-export for tests convenience
