# Security

## Reporting

Found a vulnerability? Please open a private security advisory or email the
maintainer rather than filing a public issue.

## Secrets & configuration

- **No secrets are committed.** All keys live in `.env` (git-ignored). Only
  `.env.example` (placeholders) is tracked. `.gitignore` excludes `.env`,
  `.env.*` (except the example), the SQLite dev DB, and `.vercel/`.
- Server-only secrets (`DEEPSEEK_API_KEY`, `NEXTAUTH_SECRET`, database URLs) are
  never exposed to the client. Only `NEXT_PUBLIC_*` values reach the browser, and
  the only one used (`NEXT_PUBLIC_DESMOS_API_KEY`) is a public, client-side key by
  design — no secret is hardcoded in source.
- On Vercel, environment variables are stored encrypted/write-only.

> If any key was ever shared outside the deployment (chat, screenshot, a prior
> commit), rotate it: regenerate the DeepSeek key and `NEXTAUTH_SECRET`, and
> revoke the Vercel token.

## Authentication & authorization

- Passwords are hashed with **bcrypt** (cost 12); plaintext is never stored.
- Sessions use **NextAuth JWTs**; role/tier are re-hydrated from the DB.
- Every server action and API route authorizes the caller: `requireUser`,
  `requireRole`, and `requireTier` gate access by role and subscription tier.
- `middleware.ts` blocks `/admin` (ADMIN only) and `/tutor` (TUTOR/ADMIN).
- The internal `ReferenceCorpusItem` table is ADMIN-only and never served through
  a student-facing route — enforced and covered by a test.

## Rate limiting

`src/lib/rate-limit.ts` (fixed-window) throttles abuse-prone / cost-bearing
endpoints:

| Endpoint | Limit |
|---|---|
| Registration (`/api/register`) | 5 / min / IP |
| Login (`authorize`) | 10 / 5 min / IP + email |
| AI summary analysis | 20 / hour / user |

State is per-process (fine for a single instance / low-traffic serverless). For
horizontally-scaled production, back it with a shared store (Upstash Redis /
Vercel KV) behind the same interface.

## Input validation

All external input is validated with **Zod** at the boundary (auth, registration,
summaries, drills). Prisma parameterizes every query (no raw SQL), so injection
is not possible via the ORM. Summary/AI inputs are length-capped.

## HTTP security headers

Set globally in `next.config.mjs`:

- `Content-Security-Policy` (self + Desmos origin only)
- `X-Frame-Options: DENY` and CSP `frame-ancestors 'none'` (clickjacking)
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` (camera/mic/geolocation disabled)
- `Strict-Transport-Security` (HSTS, 2 years, preload)
- `poweredByHeader: false` (no framework fingerprint)

The CSP uses `'unsafe-inline'`/`'unsafe-eval'` where Next.js hydration, Tailwind,
and Desmos require them; a nonce-based strict CSP is the next hardening step.

## Content integrity

Only original, platform-owned questions are served. The authoring pipeline runs a
`similarityGate()` n-gram check, and generated items land as `DRAFT` for review
before publish.
