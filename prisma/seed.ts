/**
 * XeduSAT seed — demo users, the original question bank, practice modules, two
 * full adaptive mock tests (with Easy/Hard Module 2 variants + per-form scale
 * tables), vocab, and the internal reference corpus. Idempotent.
 *
 * Demo accounts (password for all: "password123"):
 *   student@xedusat.test  — STUDENT, FREE
 *   plus@xedusat.test     — STUDENT, PLUS
 *   tutor@xedusat.test    — TUTOR
 *   admin@xedusat.test    — ADMIN
 */
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { rwQuestions } from "./seed-data/rw-questions";
import { mathQuestions } from "./seed-data/math-questions";
import type { SeedQuestion } from "./seed-data/types";
import { RW_DOMAINS, MATH_DOMAINS } from "../src/lib/enums";
import { toSpecFields, difficultyValueFor } from "../src/lib/sat-engine/mapping";
import { generateModule } from "../src/lib/sat-engine/generator";
import { BASELINE_TIER } from "../src/lib/sat-engine/router";
import type { BankItem } from "../src/lib/sat-engine/types";
import type { Section } from "../src/lib/sat-engine/spec";

const prisma = new PrismaClient();

async function seedUsers() {
  const passwordHash = await hash("password123", 12);
  const users = [
    { name: "Sam Student", email: "student@xedusat.test", role: "STUDENT", tier: "FREE", tutoringCredits: 0 },
    { name: "Priya Plus", email: "plus@xedusat.test", role: "STUDENT", tier: "PLUS", subscriptionStatus: "active", tutoringCredits: 0 },
    { name: "Max Premium", email: "premium@xedusat.test", role: "STUDENT", tier: "PREMIUM", subscriptionStatus: "active", tutoringCredits: 4 },
    { name: "Tara Tutor", email: "tutor@xedusat.test", role: "TUTOR", tier: "PREMIUM", subscriptionStatus: "active", tutoringCredits: 0 },
    { name: "Alex Admin", email: "admin@xedusat.test", role: "ADMIN", tier: "PREMIUM", subscriptionStatus: "active", tutoringCredits: 0 },
  ];
  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { role: u.role, tier: u.tier, tutoringCredits: u.tutoringCredits },
      create: { ...u, passwordHash },
    });
  }

  // Two demo tutors with weekly recurring availability.
  const tutors = [
    { email: "tutor@xedusat.test", bio: "Former test-prep instructor with 8 years of Digital SAT coaching. Math specialist, patient with fundamentals.", subjects: ["Math", "Reading & Writing"], rate: 6000, days: [1, 3, 5] },
  ];
  for (const t of tutors) {
    const tutorUser = await prisma.user.findUniqueOrThrow({ where: { email: t.email } });
    const profile = await prisma.tutorProfile.upsert({
      where: { userId: tutorUser.id },
      update: { bio: t.bio, subjects: JSON.stringify(t.subjects), hourlyRate: t.rate },
      create: { userId: tutorUser.id, bio: t.bio, subjects: JSON.stringify(t.subjects), hourlyRate: t.rate },
    });
    // Reset + seed recurring availability (weekdays, 16:00–19:00).
    await prisma.availability.deleteMany({ where: { tutorId: profile.id } });
    for (const weekday of t.days) {
      await prisma.availability.create({
        data: { tutorId: profile.id, kind: "RECURRING", weekday, startMinute: 16 * 60, endMinute: 19 * 60 },
      });
    }
  }
  console.log(`✓ Seeded ${users.length} users (+ tutor availability)`);
}

/** Insert a question (dedup by unique explanation). Returns its id. */
async function upsertQuestion(q: SeedQuestion): Promise<string> {
  const existing = await prisma.question.findFirst({
    where: { explanation: q.explanation },
    select: { id: true },
  });
  if (existing) return existing.id;

  let passageId: string | undefined;
  if (q.passageText || q.graphSpec) {
    const passage = await prisma.passage.create({
      data: {
        content: q.passageText ?? "",
        graphSpec: q.graphSpec ? JSON.stringify(q.graphSpec) : null,
      },
    });
    passageId = passage.id;
  }
  const spec = toSpecFields({
    id: q.explanation,
    section: q.section,
    domain: q.domain,
    skill: q.skill,
    type: q.type,
    hasGraph: !!q.graphSpec,
  });
  const created = await prisma.question.create({
    data: {
      section: q.section,
      domain: q.domain,
      skill: q.skill,
      difficulty: q.difficulty,
      difficultyValue: q.difficultyValue ?? difficultyValueFor(q.difficulty, q.explanation),
      subtype: spec.subtype,
      subtopic: q.subtopic ?? null,
      type: q.type,
      stem: q.stem,
      choices: q.choices ? JSON.stringify(q.choices) : null,
      correctAnswer: String(q.correctAnswer),
      explanation: q.explanation,
      status: "PUBLISHED",
      passageId,
    },
  });
  return created.id;
}

/**
 * Backfill difficultyValue + subtype for questions seeded before the 5-tier
 * engine existed (idempotent: only touches rows still at defaults).
 */
async function backfillQuestionMeta(): Promise<void> {
  const stale = await prisma.question.findMany({
    where: { subtype: null },
    select: { id: true, section: true, domain: true, skill: true, difficulty: true, type: true, passage: { select: { graphSpec: true } } },
  });
  let n = 0;
  for (const q of stale) {
    const spec = toSpecFields({
      id: q.id,
      section: q.section,
      domain: q.domain,
      skill: q.skill,
      type: q.type,
      hasGraph: !!q.passage?.graphSpec,
    });
    await prisma.question.update({
      where: { id: q.id },
      data: { subtype: spec.subtype ?? spec.type, difficultyValue: difficultyValueFor(q.difficulty, q.id) },
    });
    n++;
  }
  if (n) console.log(`✓ Backfilled meta on ${n} questions`);
}

/** Load the whole published bank as engine BankItems (from the DB). */
async function loadBank(): Promise<BankItem[]> {
  const qs = await prisma.question.findMany({
    where: { status: "PUBLISHED" },
    select: { id: true, section: true, domain: true, skill: true, difficultyValue: true, type: true, passage: { select: { graphSpec: true } } },
  });
  return qs.map((q) => {
    const spec = toSpecFields({ id: q.id, section: q.section, domain: q.domain, skill: q.skill, type: q.type, hasGraph: !!q.passage?.graphSpec });
    return {
      id: q.id,
      section: q.section as Section,
      type: spec.type,
      subtype: spec.subtype,
      domain: spec.domain,
      difficulty: q.difficultyValue,
      format: q.type === "SPR" ? "spr" : "mc",
    };
  });
}

async function seedQuestionBank(): Promise<{ rwIds: string[]; mathIds: string[] }> {
  const rwIds: string[] = [];
  for (const q of rwQuestions) rwIds.push(await upsertQuestion(q));
  const mathIds: string[] = [];
  for (const q of mathQuestions) mathIds.push(await upsertQuestion(q));

  // DeepSeek-authored bank (committed JSON so seeding is deterministic/offline).
  let generated = 0;
  for (const file of ["seed-data/generated-bank.json", "seed-data/challenge-bank.json"]) {
    const p = join(__dirname, file);
    if (!existsSync(p)) continue;
    const items = JSON.parse(readFileSync(p, "utf8")) as SeedQuestion[];
    for (const q of items) {
      await upsertQuestion(q);
      generated++;
    }
  }
  console.log(`✓ Seeded question bank (${rwIds.length} R&W + ${mathIds.length} Math hand-authored, ${generated} generated)`);
  return { rwIds, mathIds };
}


async function seedPracticeModules(ids: { rwIds: string[]; mathIds: string[] }) {
  const specs = [
    { title: "Practice Module — Reading & Writing", section: "RW", questionIds: ids.rwIds, description: "A full 27-question Reading & Writing module. Fixed form, scored on completion." },
    { title: "Practice Module — Math", section: "MATH", questionIds: ids.mathIds, description: "A full 22-question Math module with multiple-choice and grid-in questions." },
  ];
  for (const spec of specs) {
    if (await prisma.test.findFirst({ where: { title: spec.title }, select: { id: true } })) continue;
    const test = await prisma.test.create({
      data: {
        title: spec.title,
        kind: "DRILL",
        description: spec.description,
        isPublished: true,
        modules: { create: { section: spec.section, order: 1, path: "BASE" } },
      },
      include: { modules: true },
    });
    await prisma.moduleQuestion.createMany({
      data: spec.questionIds.map((questionId, i) => ({ moduleId: test.modules[0].id, questionId, order: i + 1 })),
    });
  }
  console.log(`✓ Seeded ${specs.length} practice modules`);
}

async function createModule(
  testId: string,
  section: string,
  order: number,
  path: string,
  itemIds: string[],
) {
  const module = await prisma.module.create({ data: { testId, section, order, path } });
  await prisma.moduleQuestion.createMany({
    data: itemIds.map((questionId, i) => ({ moduleId: module.id, questionId, order: i + 1 })),
  });
}

/**
 * Pre-build the 10 full adaptive tests using the spec-driven generator: each
 * test-form is a reproducible seed with a tier-3 Module 1 and all five tier
 * variants of Module 2 per section (routed at attempt time).
 */
async function seedFullTests() {
  // Drop any legacy 2-route (EASY/HARD) full tests so they rebuild as 5-tier.
  const legacy = await prisma.test.findMany({
    where: { kind: "FULL" },
    select: { id: true, modules: { select: { path: true } } },
  });
  for (const t of legacy) {
    if (t.modules.some((m) => m.path === "EASY" || m.path === "HARD")) {
      await prisma.test.delete({ where: { id: t.id } }); // cascades modules/attempts
    }
  }

  const bank = await loadBank();
  const titles = Array.from({ length: 10 }, (_, i) => `Full Practice Test ${i + 1}`);
  let built = 0;
  for (const title of titles) {
    if (await prisma.test.findFirst({ where: { title }, select: { id: true } })) continue;
    const test = await prisma.test.create({
      data: {
        title,
        kind: "FULL",
        description:
          "A complete, section-adaptive Digital SAT: two sections, four modules, with a 5-tier routed Module 2 and tier-capped scoring.",
        isPublished: true,
      },
    });
    for (const section of ["RW", "MATH"] as Section[]) {
      const m1 = generateModule(section, BASELINE_TIER, `${title}:${section}:M1`, bank);
      await createModule(test.id, section, 1, "BASE", m1.itemIds);
      for (let tier = 1; tier <= 5; tier++) {
        const m2 = generateModule(section, tier, `${title}:${section}:M2`, bank);
        await createModule(test.id, section, 2, `TIER${tier}`, m2.itemIds);
      }
    }
    built++;
  }
  console.log(`✓ Seeded full adaptive tests (5-tier engine): ${built} built, ${titles.length - built} existed`);
}

const starterVocab = [
  { word: "ubiquitous", partOfSpeech: "adjective", definition: "present or found everywhere", example: "Smartphones have become so ubiquitous that public payphones have nearly vanished." },
  { word: "corroborate", partOfSpeech: "verb", definition: "to confirm or support with evidence", example: "Two independent witnesses corroborated the scientist's account of the discovery." },
  { word: "pragmatic", partOfSpeech: "adjective", definition: "dealing with things practically rather than idealistically", example: "Her pragmatic approach favored small fixes that worked over grand plans that didn't." },
  { word: "ephemeral", partOfSpeech: "adjective", definition: "lasting a very short time", example: "The desert bloom is ephemeral, vanishing within days of the spring rain." },
  { word: "scrutinize", partOfSpeech: "verb", definition: "to examine closely and critically", example: "Editors scrutinize every figure in the paper before publication." },
  { word: "ambivalent", partOfSpeech: "adjective", definition: "having mixed or contradictory feelings", example: "He was ambivalent about the move — excited by the job, reluctant to leave home." },
  { word: "mitigate", partOfSpeech: "verb", definition: "to make less severe or serious", example: "Planting shade trees can mitigate the heat of city summers." },
  { word: "tenuous", partOfSpeech: "adjective", definition: "very weak or slight; insubstantial", example: "The link between the two events was tenuous at best." },
  { word: "galvanize", partOfSpeech: "verb", definition: "to shock or excite into action", example: "The flood galvanized the town into rebuilding the levee." },
  { word: "candor", partOfSpeech: "noun", definition: "openness and honesty in expression", example: "The coach's candor about the team's weaknesses earned the players' trust." },
];

async function seedVocab() {
  // Prefer the generated vocab bank; fall back to the hand-authored starters.
  const vocabPath = join(__dirname, "seed-data/vocab.json");
  const words: { word: string; partOfSpeech: string; definition: string; example: string; deck?: string }[] =
    existsSync(vocabPath) ? JSON.parse(readFileSync(vocabPath, "utf8")) : starterVocab;
  let n = 0;
  for (const w of words) {
    await prisma.vocabWord.upsert({
      where: { word: w.word },
      update: {},
      create: {
        word: w.word,
        partOfSpeech: w.partOfSpeech,
        definition: w.definition,
        example: w.example,
        deck: w.deck ?? "Core SAT",
      },
    });
    n++;
  }
  console.log(`✓ Seeded ${n} vocab words`);
}

interface LessonSeed {
  section: string;
  domain: string;
  skill: string;
  title: string;
  summary: string;
  body: unknown;
}

async function seedLessons() {
  const lessonsPath = join(__dirname, "seed-data/lessons.json");
  if (!existsSync(lessonsPath)) {
    console.log("✓ No lessons.json — skipping lessons");
    return;
  }
  const lessons = JSON.parse(readFileSync(lessonsPath, "utf8")) as LessonSeed[];
  let order = 0;
  for (const l of lessons) {
    order++;
    await prisma.lesson.upsert({
      where: { skill: l.skill },
      update: { title: l.title, summary: l.summary, body: JSON.stringify(l.body) },
      create: {
        section: l.section,
        domain: l.domain,
        skill: l.skill,
        title: l.title,
        summary: l.summary,
        body: JSON.stringify(l.body),
        order,
      },
    });
  }
  console.log(`✓ Seeded ${lessons.length} lessons`);
}

/**
 * Topic-based practice drill presets: for each skill × difficulty, a named
 * drill test that draws matching questions. Produces ~100 presets students can
 * start directly (in addition to the on-the-fly drill builder).
 */
async function seedTopicDrills() {
  if ((await prisma.test.count({ where: { kind: "TOPIC" } })) > 0) {
    console.log("✓ Topic drills already seeded — skipping");
    return;
  }

  const skillDomain = new Map<string, { section: string; domain: string }>();
  for (const [domain, skills] of Object.entries(RW_DOMAINS))
    for (const skill of skills) skillDomain.set(skill, { section: "RW", domain });
  for (const [domain, skills] of Object.entries(MATH_DOMAINS))
    for (const skill of skills) skillDomain.set(skill, { section: "MATH", domain });

  const DIFFS = ["easy", "medium", "hard", "mixed"] as const;
  let created = 0;

  for (const [skill, { section, domain }] of skillDomain) {
    for (const difficulty of DIFFS) {
      const questions = await prisma.question.findMany({
        where: {
          section,
          skill,
          status: "PUBLISHED",
          ...(difficulty === "mixed" ? {} : { difficulty }),
        },
        select: { id: true },
        take: 12,
      });
      if (questions.length < 3) continue; // need enough to be worth a drill

      const label = `${skill} — ${difficulty[0].toUpperCase()}${difficulty.slice(1)}`;
      const test = await prisma.test.create({
        data: {
          title: label,
          kind: "TOPIC",
          description: `Focused ${difficulty} drill on ${skill}.`,
          isPublished: true,
          section,
          domain,
          skill,
          difficulty,
          modules: { create: { section, order: 1, path: "BASE" } },
        },
        include: { modules: true },
      });
      await prisma.moduleQuestion.createMany({
        data: questions.map((q, i) => ({ moduleId: test.modules[0].id, questionId: q.id, order: i + 1 })),
      });
      created++;
    }
  }
  console.log(`✓ Seeded ${created} topic-based drill presets`);
}

const referenceCorpus = [
  { domain: "Advanced Math", skill: "Nonlinear Systems", difficulty: "hard", structureNotes: "Circle equation paired with a linear function; asks for a derived quantity of the intersection (sum/product of coordinates) rather than the points themselves, rewarding Vieta's over brute force." },
  { domain: "Craft and Structure", skill: "Cross-Text Connections", difficulty: "hard", structureNotes: "Two ~60-word passages from researchers with partially overlapping claims; correct answer characterizes the second author's likely response to a specific assertion in the first (agree-with-qualification pattern)." },
  { domain: "Information and Ideas", skill: "Command of Evidence", difficulty: "hard", structureNotes: "Quantitative variant: table with 3–4 rows accompanies a two-part claim; distractors quote real values that fail to support the specific comparative claim in the stem." },
  { domain: "Expression of Ideas", skill: "Rhetorical Synthesis", difficulty: "hard", structureNotes: "Bulleted note set (4–6 facts); stem specifies audience + rhetorical goal; distractors are factually accurate syntheses that serve the wrong goal." },
  { domain: "Algebra", skill: "Linear Equations", difficulty: "hard", structureNotes: "\"Reason about constants\" pattern: ax + b = cx + d with a stated solution property (no solution / infinite); answer requires deducing relations among constants without solving." },
];

interface ArticleSeed {
  title: string;
  source: string;
  category: string;
  content: string;
  modelSummary: string;
}

async function seedArticles() {
  const path = join(__dirname, "seed-data/articles.json");
  if (!existsSync(path)) {
    console.log("✓ No articles.json — skipping reading articles");
    return;
  }
  const articles = JSON.parse(readFileSync(path, "utf8")) as ArticleSeed[];
  if ((await prisma.readingArticle.count()) > 0) {
    console.log("✓ Reading articles already seeded — skipping");
    return;
  }
  let dayIndex = 0;
  for (const a of articles) {
    await prisma.readingArticle.create({
      data: {
        title: a.title,
        source: a.source,
        category: a.category,
        content: a.content,
        modelSummary: a.modelSummary,
        dayIndex: dayIndex++,
      },
    });
  }
  console.log(`✓ Seeded ${articles.length} reading articles`);
}

async function seedReferenceCorpus() {
  if ((await prisma.referenceCorpusItem.count()) > 0) {
    console.log("✓ Reference corpus already seeded — skipping");
    return;
  }
  await prisma.referenceCorpusItem.createMany({ data: referenceCorpus });
  console.log(`✓ Seeded ${referenceCorpus.length} reference-corpus attribute rows (internal)`);
}

async function main() {
  console.log("Seeding XeduSAT…");

  await seedUsers();

  // Seed the question bank + practice modules once (idempotent dedup by
  // explanation; skip the expensive pass if the bank is already populated).
  const bankPopulated = (await prisma.question.count().catch(() => 0)) > 400;
  if (!bankPopulated) {
    const ids = await seedQuestionBank();
    await seedPracticeModules(ids);
  }

  // 5-tier engine migration (idempotent): backfill question meta, then (re)build
  // the full adaptive tests with the spec-driven generator.
  await backfillQuestionMeta();
  await seedFullTests();
  await seedTopicDrills();
  await seedVocab();
  await seedLessons();
  await seedArticles();
  await seedReferenceCorpus();
  console.log("Done. Log in with student@xedusat.test / password123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
