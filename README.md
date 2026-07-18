# XeduSAT

Full-stack Digital SAT prep platform: section-adaptive full-length tests, precision
drills, SM-2 vocabulary flashcards, tutor booking, subscriptions, and analytics.

Built with **Next.js 14 (App Router) + TypeScript**, **Tailwind + shadcn/ui**,
**Prisma (SQLite dev / Postgres prod)**, **NextAuth**, **Stripe** (mock fallback),
and a **Zoom** meeting adapter (mock fallback).

## Quick start

```bash
cp .env.example .env    # defaults work out of the box
npm install
npm run seed            # creates SQLite db + demo data
npm run dev             # http://localhost:3000
```

### Demo accounts (password: `password123`)

| Email | Role | Tier | Try |
|---|---|---|---|
| `student@xedusat.test` | Student | Free | Diagnostic, lessons, limited drills |
| `plus@xedusat.test` | Student | Plus | Full tests, unlimited drills, flashcards |
| `premium@xedusat.test` | Student | Premium | Everything + tutoring (4 credits) |
| `tutor@xedusat.test` | Tutor | Premium | Tutor hub, roster, sessions |
| `admin@xedusat.test` | Admin | Premium | Admin panel, question authoring, reference corpus |

### Scripts

- `npm run dev` — start the dev server
- `npm run seed` — push schema + seed demo data (idempotent)
- `npm run reset` — wipe the SQLite db, re-push schema, re-seed
- `npm test` — run the unit + safety test suite (scoring, scaling, SM-2, similarity, reference-corpus access control)

### Content generation (optional, needs `DEEPSEEK_API_KEY`)

- `npx tsx scripts/generate-bank.ts` — bulk-author the question pool → `prisma/seed-data/generated-bank.json`
- `npx tsx scripts/generate-lessons.ts` — one lesson per skill → `lessons.json`
- `npx tsx scripts/generate-vocab.ts` — ~150 vocab words → `vocab.json`
- `npx tsx scripts/generate-articles.ts` — ~30 news-style reading articles → `articles.json`

These write committed JSON, so a fresh clone seeds the full library offline with no key.

## What's included

- **10 full adaptive tests** — section-adaptive routing, Easy/Hard Module 2, capped scaled scores
- **~100 practice drills** — 97 topic-based presets (Words in Context, Boundaries, Algebra, …) plus a custom drill builder (section → skill → difficulty → count) and the **Weakness Conqueror** auto-drill
- **Daily Reading** — one required news-style article per day; the reader writes a 50–100 word summary (50-word minimum enforced) and an AI coach (DeepSeek, with a heuristic fallback) scores comprehension and lists what they understood vs. missed. A `NEWS_API_KEY` swaps the seeded original-article library for live news.
- **30 lessons** — one per skill: concepts, strategies, a worked example, common mistakes
- **20-question adaptive diagnostic** with an estimated score band and a prioritized study plan
- **157 vocabulary flashcards** on the SM-2 spaced-repetition algorithm
- **Tutoring** — availability-driven booking, `createMeeting()` Zoom adapter (mock fallback), session notes, tutor dashboard
- **Analytics** — score trend, skill-mastery heatmap, accuracy by difficulty, pacing, mistake log, predicted score, XP/levels/streak/badges
- **Admin panel** — question authoring with a live similarity check, user management, and the internal reference-corpus viewer
- **Subscriptions** — Stripe Checkout + webhook, with a mock provider (dev-only tier toggle) when Stripe isn't configured

## Environment & mock fallbacks

Everything runs with **zero external accounts**. See `.env.example` for all vars.

- **Stripe** — if `STRIPE_SECRET_KEY` is empty, a mock billing provider is used:
  every tier is selectable via a dev-only toggle on the billing page.
- **Zoom** — if Zoom credentials are empty, `createMeeting()` returns a clearly
  marked mock join URL stored on the booking.
- **Desmos** — if `NEXT_PUBLIC_DESMOS_API_KEY` is empty, the test runner falls
  back to a basic on-screen calculator.
- **DeepSeek** — optional. If `DEEPSEEK_API_KEY` is set, `npx tsx
  scripts/generate-questions.ts` drafts original items from the internal
  attribute rubrics, runs each through `similarityGate()`, and saves survivors
  as `DRAFT` (status never auto-published — an admin reviews before publish).
  With no key the script runs as a documentation-only stub. The prompt passes
  only attribute metadata, never copyrighted source text.
  `scripts/generate-bank.ts` bulk-authors the question pool the two full
  adaptive tests draw from and writes it to
  `prisma/seed-data/generated-bank.json` (committed), so seeding stays
  deterministic and offline — no key needed to seed a fresh clone.

## Full adaptive tests

Two complete mock tests ship seeded. Each has both sections and all four
modules — a fixed Module 1 plus an **Easy** and a **Hard** Module 2 variant per
section. The flow: take Module 1 → it's scored instantly → if you're at or above
70% correct you route to the **Hard** Module 2, otherwise the **Easy** one → a
10-minute break splits the sections → a combined **scaled score** (400–1600)
report with per-question review. The Easy path caps that section near **590** via
per-form `ScaleTable` rows (`src/lib/scale.ts`); the Hard path spans the full
200–800. The routing threshold and cap are config constants in `src/lib/config.ts`.

## Switching to Postgres (prod)

1. In `prisma/schema.prisma`, change the datasource provider from `"sqlite"` to `"postgresql"`.
2. Set `DATABASE_URL="postgresql://user:password@host:5432/xedusat"` in `.env`.
3. `npx prisma migrate deploy` (or `db push`), then `npm run seed`.

The schema uses no SQLite-only features; enum-like fields are Zod-validated
strings and structured payloads are JSON strings, both portable to Postgres.

## Content & legal

All questions served to users are **original, platform-owned items**. The
`ReferenceCorpusItem` table is internal and **admin-only**: it stores attribute
metadata (domain, skill, difficulty, structure notes) used to guide authoring —
never copyrighted text — and is never exposed through any student-facing route.
`scripts/generate-questions.ts` documents the authoring pipeline
(draft → `similarityGate()` n-gram check → human review → publish).

## Project layout

```
prisma/schema.prisma      full data model (SQLite dev, Postgres-compatible)
prisma/seed.ts            demo users + starter content
scripts/generate-questions.ts  authoring pipeline stub + similarityGate()
src/lib/auth.ts           NextAuth config, requireUser/requireRole helpers
src/lib/config.ts         SAT blueprint constants (timing, routing, caps, tiers)
src/lib/enums.ts          Zod enums (roles, tiers, sections, domains/skills)
src/app/(auth)/           login, register
src/app/(app)/            authenticated app (dashboard, …)
src/middleware.ts         session + role gating for app routes
```
