/**
 * Question-generation pipeline STUB.
 *
 * Intended production flow:
 *
 *   1. AUTHOR DRAFT   — a writer (human or LLM-assisted) drafts an ORIGINAL
 *                       item from an attribute rubric: domain, skill,
 *                       difficulty, and structural notes pulled from the
 *                       internal ReferenceCorpusItem table. The rubric holds
 *                       attributes only — never copyrighted question text.
 *   2. SIMILARITY GATE — similarityGate() rejects any candidate whose n-gram
 *                       overlap with reference material exceeds threshold.
 *   3. HUMAN REVIEW   — an editor verifies accuracy, single-correct-answer,
 *                       and blueprint fit; sets status to approved.
 *   4. PUBLISH        — the item is inserted into Question and becomes
 *                       eligible for module assembly.
 *
 * Run: npx tsx scripts/generate-questions.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SIMILARITY_THRESHOLD = 0.35; // max allowed n-gram overlap ratio
const NGRAM_SIZE = 5;

function ngrams(text: string, n = NGRAM_SIZE): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const grams = new Set<string>();
  for (let i = 0; i + n <= words.length; i++) {
    grams.add(words.slice(i, i + n).join(" "));
  }
  return grams;
}

/**
 * Rejects a candidate item if its n-gram overlap against any reference text
 * exceeds SIMILARITY_THRESHOLD. Returns { ok, maxOverlap }.
 *
 * NOTE: the shipped reference corpus stores structural attributes only, so in
 * this repo the gate runs against previously published XeduSAT items to
 * prevent near-duplicates. In a production authoring pipeline the same gate
 * would run against any licensed reference text held internally.
 */
export function similarityGate(
  candidateText: string,
  referenceTexts: string[],
): { ok: boolean; maxOverlap: number } {
  const candidate = ngrams(candidateText);
  if (candidate.size === 0) return { ok: true, maxOverlap: 0 };

  let maxOverlap = 0;
  for (const ref of referenceTexts) {
    const refGrams = ngrams(ref);
    if (refGrams.size === 0) continue;
    let shared = 0;
    for (const g of candidate) if (refGrams.has(g)) shared++;
    maxOverlap = Math.max(maxOverlap, shared / candidate.size);
  }
  return { ok: maxOverlap <= SIMILARITY_THRESHOLD, maxOverlap };
}

interface CandidateItem {
  section: string;
  domain: string;
  skill: string;
  difficulty: string;
  type: string;
  stem: string;
  choices: string[] | null;
  correctAnswer: string;
  explanation: string;
  passageContent?: string;
}

interface Rubric {
  section?: string;
  domain: string;
  skill: string;
  difficulty: string;
  structureNotes: string;
}

/**
 * Stage 1: author an ORIGINAL item from the attribute rubric only.
 *
 * If DEEPSEEK_API_KEY is set, this drafts with DeepSeek; the prompt passes ONLY
 * attribute metadata (domain/skill/difficulty/structure), never any copyrighted
 * source text, and instructs the model to invent entirely original content.
 * With no key it returns null (documentation-only stub run).
 */
async function draftFromRubric(rubric: Rubric): Promise<CandidateItem | null> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    console.log(
      `  [draft] (no DEEPSEEK_API_KEY) would author an original ${rubric.difficulty} ` +
        `${rubric.skill} item following: "${rubric.structureNotes.slice(0, 70)}…"`,
    );
    return null;
  }

  const section =
    rubric.section ??
    (["Algebra", "Advanced Math", "Problem-Solving and Data Analysis", "Geometry and Trigonometry"].includes(
      rubric.domain,
    )
      ? "MATH"
      : "RW");

  const system =
    "You are a Digital SAT item writer producing ORIGINAL, copyright-clean questions. " +
    "You are given only ATTRIBUTE metadata (domain, skill, difficulty, structural notes). " +
    "You must invent entirely new content — never reproduce any real, published, or copyrighted " +
    "passage or question. Exactly one answer must be correct. Respond with strict JSON only.";

  const user = `Write one original ${section} Digital SAT question.
Domain: ${rubric.domain}
Skill: ${rubric.skill}
Difficulty: ${rubric.difficulty}
Structure to follow (attributes only): ${rubric.structureNotes}

Return JSON with this exact shape:
{
  "type": "MCQ" | "SPR",
  "passageContent": string | null,   // 25-150 word original passage for R&W, else null
  "stem": string,
  "choices": [string, string, string, string] | null,  // 4 options for MCQ, null for SPR
  "correctAnswer": string,           // "A".."D" for MCQ, the numeric value for SPR
  "explanation": string
}`;

  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
      temperature: 1.0,
    }),
  });

  if (!res.ok) {
    console.log(`  [draft] DeepSeek error ${res.status} — skipping`);
    return null;
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) return null;

  try {
    const parsed = JSON.parse(content) as Partial<CandidateItem>;
    if (!parsed.stem || !parsed.correctAnswer || !parsed.explanation) return null;
    return {
      section,
      domain: rubric.domain,
      skill: rubric.skill,
      difficulty: rubric.difficulty,
      type: parsed.type === "SPR" ? "SPR" : "MCQ",
      stem: parsed.stem,
      choices: parsed.choices ?? null,
      correctAnswer: parsed.correctAnswer,
      explanation: parsed.explanation,
      passageContent: parsed.passageContent ?? undefined,
    };
  } catch {
    console.log("  [draft] could not parse model JSON — skipping");
    return null;
  }
}

/** Stage 4: publish an approved draft into the bank as DRAFT (awaits human review). */
async function saveDraft(candidate: CandidateItem): Promise<void> {
  let passageId: string | undefined;
  if (candidate.passageContent) {
    const passage = await prisma.passage.create({
      data: { content: candidate.passageContent },
    });
    passageId = passage.id;
  }
  await prisma.question.create({
    data: {
      section: candidate.section,
      domain: candidate.domain,
      skill: candidate.skill,
      difficulty: candidate.difficulty,
      type: candidate.type,
      stem: candidate.stem,
      choices: candidate.choices ? JSON.stringify(candidate.choices) : null,
      correctAnswer: candidate.correctAnswer,
      explanation: candidate.explanation,
      status: "DRAFT", // never auto-published; an admin reviews before publish
      passageId,
    },
  });
}

async function main() {
  console.log("XeduSAT question pipeline (stub run)\n");

  const rubrics = await prisma.referenceCorpusItem.findMany({ take: 5 });
  console.log(`Loaded ${rubrics.length} attribute rubrics from internal corpus.\n`);

  const published = await prisma.question.findMany({
    select: { stem: true, passage: { select: { content: true } } },
  });
  const referenceTexts = published.map((q) =>
    [q.passage?.content ?? "", q.stem].join(" "),
  );

  let drafted = 0;
  for (const rubric of rubrics) {
    console.log(`Rubric: ${rubric.domain} / ${rubric.skill} (${rubric.difficulty})`);
    const candidate = await draftFromRubric(rubric);
    if (!candidate) {
      console.log("  [skip] no draft produced\n");
      continue;
    }

    // Stage 2: similarity gate against existing published items.
    const gate = similarityGate(
      [candidate.passageContent ?? "", candidate.stem].join(" "),
      referenceTexts,
    );
    if (!gate.ok) {
      console.log(`  [REJECTED] overlap ${(gate.maxOverlap * 100).toFixed(1)}% exceeds gate\n`);
      continue;
    }

    // Stage 3→4: passes the gate → save as DRAFT for human review (never
    // auto-published to students).
    await saveDraft(candidate);
    drafted++;
    console.log(
      `  [DRAFTED] overlap ${(gate.maxOverlap * 100).toFixed(1)}% — saved as DRAFT for review\n`,
    );
  }

  console.log(
    process.env.DEEPSEEK_API_KEY
      ? `Pipeline complete. ${drafted} item(s) queued as DRAFT for admin review.`
      : "Pipeline stub complete (set DEEPSEEK_API_KEY to draft items).",
  );
}

// Only run the pipeline when executed directly — importing similarityGate()
// from this module (e.g. in scripts/generate-bank.ts) must not trigger it.
if (require.main === module) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
