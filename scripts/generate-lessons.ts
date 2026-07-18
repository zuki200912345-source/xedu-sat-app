/**
 * Generates one original teaching lesson per Digital SAT skill using DeepSeek
 * and writes them to prisma/seed-data/lessons.json (committed) so seeding stays
 * deterministic and offline. Lessons are original explanatory content written
 * from the skill name only — never copyrighted material.
 *
 * Run: DEEPSEEK_API_KEY=... npx tsx scripts/generate-lessons.ts
 */
import { writeFileSync, existsSync, readFileSync } from "fs";
import { join } from "path";

const OUT = join(__dirname, "../prisma/seed-data/lessons.json");
const API_KEY = process.env.DEEPSEEK_API_KEY;
const CONCURRENCY = 5;

const RW: Record<string, string[]> = {
  "Craft and Structure": ["Words in Context", "Text Structure and Purpose", "Cross-Text Connections"],
  "Information and Ideas": ["Central Ideas and Details", "Command of Evidence", "Inferences"],
  "Standard English Conventions": ["Boundaries", "Form, Structure, and Sense"],
  "Expression of Ideas": ["Transitions", "Rhetorical Synthesis"],
};
const MATH: Record<string, string[]> = {
  Algebra: ["Linear Equations", "Linear Functions", "Systems of Linear Equations", "Linear Inequalities"],
  "Advanced Math": ["Quadratics", "Exponentials", "Polynomials and Rational Expressions", "Function Notation and Transformations", "Nonlinear Systems"],
  "Problem-Solving and Data Analysis": ["Ratios and Rates", "Percentages", "Statistics", "Probability", "Two-Way Tables", "Scatterplots and Line of Best Fit"],
  "Geometry and Trigonometry": ["Area and Volume", "Angles and Lines", "Triangles", "Circles", "Right-Triangle Trigonometry"],
};

interface Job {
  section: "RW" | "MATH";
  domain: string;
  skill: string;
}

interface Lesson extends Job {
  title: string;
  summary: string;
  body: {
    concepts: { heading: string; body: string }[];
    strategies: string[];
    worked: { problem: string; solution: string };
    mistakes: string[];
    takeaway: string;
  };
}

function buildJobs(): Job[] {
  const jobs: Job[] = [];
  for (const [domain, skills] of Object.entries(RW))
    for (const skill of skills) jobs.push({ section: "RW", domain, skill });
  for (const [domain, skills] of Object.entries(MATH))
    for (const skill of skills) jobs.push({ section: "MATH", domain, skill });
  return jobs;
}

async function generateLesson(job: Job): Promise<Lesson | null> {
  const system =
    "You are an expert Digital SAT tutor writing an original, self-contained lesson. " +
    "Use plain text math (x^2, sqrt(), 1/2) — no LaTeX. Be concrete, clear, and encouraging. " +
    "Respond with strict JSON only.";
  const user = `Write a complete lesson that teaches the Digital SAT ${job.section === "MATH" ? "Math" : "Reading & Writing"} skill "${job.skill}" (domain: ${job.domain}).
Return JSON with exactly this shape:
{
  "title": string,                         // catchy, specific lesson title
  "summary": string,                       // 1-2 sentence overview
  "concepts": [ {"heading": string, "body": string}, ... ],  // 3-4 core concepts, each body 2-4 sentences
  "strategies": [string, ...],             // 3-5 actionable test strategies
  "worked": {"problem": string, "solution": string},  // one original worked example with full solution
  "mistakes": [string, ...],               // 3-4 common mistakes to avoid
  "takeaway": string                       // one-sentence key takeaway
}`;

  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (!content) return null;
  try {
    const p = JSON.parse(content);
    if (!p.title || !p.concepts || !p.worked) return null;
    return {
      ...job,
      title: p.title,
      summary: p.summary ?? "",
      body: {
        concepts: p.concepts,
        strategies: p.strategies ?? [],
        worked: p.worked,
        mistakes: p.mistakes ?? [],
        takeaway: p.takeaway ?? "",
      },
    };
  } catch {
    return null;
  }
}

async function main() {
  if (!API_KEY) {
    console.error("DEEPSEEK_API_KEY required.");
    process.exit(1);
  }
  const jobs = buildJobs();
  const done: Lesson[] = existsSync(OUT) ? (JSON.parse(readFileSync(OUT, "utf8")) as Lesson[]) : [];
  const doneSkills = new Set(done.map((l) => l.skill));
  const todo = jobs.filter((j) => !doneSkills.has(j.skill));
  console.log(`Generating ${todo.length} lessons (${done.length} already done)…`);

  const queue = [...todo];
  async function worker() {
    while (queue.length) {
      const job = queue.pop()!;
      const lesson = await generateLesson(job);
      if (lesson) {
        done.push(lesson);
        console.log(`  ✓ ${lesson.skill}`);
        writeFileSync(OUT, JSON.stringify(done, null, 2));
      } else {
        console.log(`  ✗ ${job.skill} (failed)`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(`Done. ${done.length} lessons written to ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
