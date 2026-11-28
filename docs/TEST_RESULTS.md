# Production release — 28 November 2026

PR #3 merged into `main` (`d02a302`) with the owner's approval. Owner decisions: no fresh database backup
(risk accepted — no migrations, instant rollback); content rights and consent for lessons 1–3 confirmed.

| Step | Result |
|---|---|
| Production build `dpl_5fk3QZQ8sCriAn16KxkMRGXQcy8x` | ✅ `prisma migrate deploy`: “No pending migrations to apply” (schema and data untouched) |
| Live checks | ✅ `/api/health` ok (`mail.configured: false`, `verificationRequired: false`), all pages, security headers, wrong password 401, cross-site 403, password-reset notice |
| R2 | ✗ → ✅ The Tizim storage check found `S3_BUCKET` = `auforec-media` (typo; no such bucket) — the reason Production uploads never worked. The owner set it to `auforex-media` and redeployed (`dpl_Gje78tVkafJDYpnLF6QAjquG3kMX`): 5/5 (keys write/read, delete, CORS for the site, `ETag`, multipart) |
| Lessons 1–3 | ✅ imported through the Super admin panel (14–18 MB/s), 1-dars Bepul, 2–3 PRO, covers and descriptions; verify: each once, video 206; re-run 0 new; course published |
| Books | ✅ “Fayllarni tekshirish”: 3 book PDFs relinked to the bundled files (they were never in R2); “Trading Noldan” cover shows again |
| Student / admin / phone | ✅ registration without email, login, catalog with covers, lesson 1 plays (1280×720, audio decoded, seek), progress saved + resume, lesson 2 closed for FREE (PRO offer, video API 403), guest 401, all Super admin pages 200, lessons 2–3 play as admin, phone 390 px without horizontal scroll |
| Clean-up | ✅ temporary import admin: role removed and blocked by the owner (login refused, admin API 401); test student blocked (no data deleted) |

---

# Deployed Vercel Preview — 27 November 2026 (branch `claude/final-stabilization`)

Preview: `auforex-git-claude-final-st-eddf8f-hamidullos-projects-d86a2122.vercel.app` (Vercel Authentication on;
tested through Vercel's Protection Bypass for Automation, authorized by the owner, cookie scoped to the Preview host).

| Check | Result |
|---|---|
| Isolated database | Prisma API: `db_wlbm0xphvipstltex86glcef` “auforex-preview”, `us-east-1`, ready; connection `con_p9t8f8hrcu9o0jgd88ntsqgm` (direct `db.prisma.io`, pooled `pooled.db.prisma.io`) |
| Fingerprints in the Preview build | direct `443e410d3d96`, pooled `443e410d3d96` — production is `85bcf18c856b`; before init all 4 migrations “not yet applied” (empty database) |
| Migrations + seed (owner-authorized, test database only) | ✅ 4 migrations applied, seed: categories, settings, 3 bundled books, founder `asadbek`, test admin on a Resend test address; gate `PREVIEW_DB_FINGERPRINT=443e410d3d96` passed; no password in logs |
| Guest E2E on the Preview (public pages, guests sent to sign-in, phone layout) | ✅ 3/3 |
| Security headers | ✅ CSP (nonce, `frame-ancestors 'none'`), HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, COOP; no `X-Powered-By` |
| Object storage for this branch | Cloudflare R2 bucket `auforex-media-preview` (test bucket; the production bucket was not touched). Keys: R2 **temporary credentials** from the Cloudflare API (`temp-access-credentials`, scoped to this one bucket, `object-read-write`, valid until 3 Dec 2026 18:49 UTC with the owner's parent token). `S3_ENDPOINT`, `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_SESSION_TOKEN` set through the Vercel API on **Preview + branch `claude/final-stabilization` only** (encrypted); values never printed |
| Bucket CORS | only the Preview origin, methods GET/PUT/HEAD, headers `Content-Type`/`Range`, exposes `ETag`, max age 1 h; another origin is refused (checked by E2E). Lifecycle: unfinished multipart uploads are aborted after 1 day |
| `/api/health` | ✅ 200 `ok` (was 503 `config_invalid: S3_ENDPOINT` while the keys were missing) |
| Sign-in / registration (the 503) | ✅ fixed: wrong password → 401 “Email yoki parol noto‘g‘ri”, registration → verification email, sign-in after verification → dashboard |
| Super admin → Sozlamalar → Tizim | ✅ storage check 5/5 (keys, write/read/delete, CORS for the site, `ETag` exposed, multipart); test email sent through Resend |
| Uploads to R2 from the browser | ✅ image (founder portrait), PDF (book, opens in the reader), small video (single PUT), 13.5 MB video (2 × 10 MiB-part multipart, part retried after a dropped request, cancel aborts the multipart upload) |
| Playback from R2 | ✅ `/api/lessons/<id>/video` → 302 no-store to a presigned link (`X-Amz-Security-Token`, 3 h), Range 206 `video/mp4`; bytes at the start, across the part boundary and at the end match the source file; `<video>` reaches `readyState 4` |
| SMTP (Resend, `delivered+…@resend.dev` test addresses) | ✅ verification email, password reset email, link opens and works, test email from the Tizim tab |
| **Full E2E on the deployed Preview** (`8d3c785`, `E2E_S3=1` real R2, `E2E_RESEND=1`) | ✅ **39/39** in 4.4 min: auth (cookies present, cross-site 403, phone), email verification / resend / password reset / email change, guest, register, PRO gate + Telegram request, admin grants PRO, range streaming + progress, PDF reader, protected files, challenges, admin-only routes, founder login + team, phone layout, TradingView, payment confirmation, every Super admin page, categories, lessons (number + category heading, multipart, duplicate number, fake MP4 refused), upload cancel/retry, FREE/PRO/guest access, founder portrait, books + check-files, Tizim storage check |
| Re-run on `d9ea85c` (manual email confirmation added, bypass secret rotated, `effect` patched) | ✅ **40/40**: 35 in the full run + the 5 auth tests re-run after the first registration on the fresh deployment exceeded 30 s (cold start; second run 10/10 in 51 s). New: Super admin confirms an unverified email by hand → the user signs in |
| **No-SMTP release setup** (`9596a20`; Preview with SMTP removed and `REQUIRE_EMAIL_VERIFICATION=false`, as planned for Production) | ✅ **36/36** passed, 5 email tests skipped by design (no mail service): sign-up straight to the dashboard, sign-in, “password reset temporarily unavailable” notice, all Super admin / student / R2 flows. Same suite locally (no SMTP, local disk): 36/36 |
| Video import tool (`npm run content:import`) on the Preview | ✅ ZIP → plan (2 categories, 6 files: 1 identical file skipped, MOV + late index remuxed, HEVC re-encoded) → 5 lessons via the Super admin panel → verify: each lesson once, video 206 from R2 → publish. Second run: 0 new. 116 MB video at 26.7 MB/s |
| Fixed during this round | file picked before the admin page finished loading was lost (upload field now picks it up); PRO-video test raced the “completed” save |
| **Phase 1 content (28.11): first 3 lessons from Google Drive → Preview R2** | ✅ 3 × H.264 720p/AAC, 37:45–39:16, 138–146 MB; lossless remux (index to the front; identical frame counts and bitrates). Imported via the Super admin panel at 32–38 MB/s with title, category, description, level, access and a site-style cover; verify: each lesson once, video 206; re-run: 0 new. Student checks 35/35 (twice): sign-up without email, catalog + covers, playback with audio decoded, seek to the middle, progress saved + resume (1134 s), FREE/PRO lock, order rule after PRO, phone 390 px without horizontal scroll |
| Local checks on the same commit | ✅ `npm run typecheck`, `npm run lint` (0 warnings), unit 120/120, `next build` |
| Bulk import (`npm run videos:import -- <folder> --to r2 --yes`) | ✅ against the real bucket with a local test database: 2 lessons (single PUT + multipart) uploaded, size checked in the bucket, lessons saved as uploaded videos; second run skipped both |

### Bugs found on the deployed Preview and fixed

1. **R2 HEAD lost `Content-Length` inside the Next.js runtime** → every upload was reported as 0 bytes (“hajm mos emas”). The S3 client now reads the size with a one-byte ranged GET (`Content-Range`) when HEAD has no length (`lib/storage/s3.ts`, unit tests).
2. **Temporary R2 credentials** were not supported → `S3_SESSION_TOKEN` (optional) is signed into presigned URLs and requests.
3. **Auth rate limits** were too low for a class registering at once with verification on → per-endpoint limits.
4. **Test harness on a protected Preview**: Playwright storage state for the access cookie, proxy for API requests, no global custom header (it broke the bucket's CORS preflight), the extra cookie in the jar instead of a raw `cookie` header (that replaced the access cookie, so Vercel answered 401), progress check independent of lessons left by earlier runs.

Note: a Playwright error log printed the Preview access cookie once; it was redacted locally and never committed or posted. The owner should regenerate the Protection Bypass for Automation secret (Vercel → Project → Settings → Deployment Protection).

Production deployments, variables and data were not touched.

---

# Test results — 26 November 2026 (final stabilization, branch `claude/final-stabilization`, base `9a5fcdc`)

Environment: Linux, Node 22.23, PostgreSQL 16, Chromium (Playwright 1.65), production build (`next build` + `next start`).
Every E2E mode ran on its **own freshly created database** (migrations + seed) — auth rate limits are stored in the
database, so servers sharing one database interfere with each other's sign-ins.

| Mode | Server settings | External services |
|---|---|---|
| Local disk | `REQUIRE_EMAIL_VERIFICATION=false` | — |
| Vercel mode | `VERCEL=1` (read-only disk rules, 4 MiB response cap, pool 2), `STORAGE_DRIVER=s3` | S3 emulator (`moto_server`) with the exact CORS rule from `docs/FAYL-SAQLASH.md` (only the site origin, `GET/PUT/HEAD`, `Content-Type`/`Range`, `ExposeHeaders: ETag`); a foreign origin gets 403 |
| Real SMTP | SMTP_* set, verification on (production default) | local SMTP server (`aiosmtpd`) with AUTH, every message saved as `.eml` and parsed by the test |

## Summary

| Check | Result |
|---|---|
| `npm run typecheck` | ✅ 0 errors |
| `npm run lint` | ✅ 0 errors, **0 warnings** (was 5) |
| Unit tests | ✅ **103 / 103** (21 new: R2/S3 settings parser, S3 client retries/timeouts/re-signing, live storage check against a fake bucket, SMTP TLS default, mail error classification, redirect quirks) |
| `npm run build` | ✅ |
| E2E, local disk | ✅ **35 / 35** (+4 email tests skipped in this mode) |
| E2E, Vercel mode + S3 bucket | ✅ **35 / 35**; bucket afterwards: **0 unfinished multipart uploads** |
| E2E, real SMTP | ✅ **4 / 4**: sign-up → verification email → link → verified and signed in; unverified sign-in refused with resend; forged token rejected; password reset (link single-use, old password refused, **other device signed out**, unknown address gets the same answer and no email); email change → verification to the new address |
| SMTP unreachable (port closed) | ✅ sign-up still creates the account, “send verification” answers **503 `MAIL_SEND_FAILED`** in 0.5 s with a clear message; password reset still answers “sent” (no account enumeration) and the server log names the cause: `[mail] … yuborilmadi: Pochta serveriga ulanib bo‘lmadi (ESOCKET) …` |
| `npm run storage:check` against the emulator | ✅ all 5 steps; wrong origin → CORS step ✗ with the rule to add; ETag not exposed → ETag step ✗; `r2.dev` endpoint → refused with the fix |
| `npm run mail:check` | ✅ connect+login and test email; wrong password → “SMTP login yoki parol qabul qilinmadi”; closed port → connection error naming SMTP_HOST/PORT/SECURE; port 465 with empty `SMTP_SECURE` now uses TLS |
| Database connections (Vercel mode) | ✅ 80 concurrent page/API requests → 80 × 200; at most **2** connections from the app |
| Phone layout of the new Super admin → Tizim tab | ✅ no horizontal scroll (iPhone 13 and 1280 px) |
| Server logs during all runs | ✅ no unexpected errors (only the deliberate foreign-origin sign-in attempt) |

## Found and fixed

| Problem | Effect before | Fix |
|---|---|---|
| `SMTP_SECURE` empty was read as `false` | Port 465 without `SMTP_SECURE=true` tried STARTTLS on a TLS port → every email hung, then failed | Empty = not set → 465 uses TLS, 587 STARTTLS |
| No SMTP timeouts | A silent mail server held a sign-up/reset request for minutes (a Vercel function until its limit) | 10 s connect / 10 s greeting / 20 s socket |
| Mail failure → generic 500 | “Serverda vaqtinchalik xatolik”, nothing useful in the log | `MAIL_SEND_FAILED` (503) with a clear message; log line with the classified cause, never the link |
| `S3_ENDPOINT` accepted only `*.r2.cloudflarestorage.com` and threw from every storage call | AWS S3 / B2 / any S3 emulator impossible (so the Vercel-mode E2E could not run at `9a5fcdc`); a wrong value made `/api/health` report **“database_unavailable”** | Parser accepts R2 and S3-compatible hosts, explains r2.dev/http/path/bucket mistakes, accepts the bucket pasted at the end; health reports `storage.uploads: "config_invalid"` with the reason |
| No timeouts/retries on S3 requests | A hung R2 connection blocked the function; one transient 5xx failed an upload/read | 20 s header timeout, 3 attempts for idempotent requests (re-signed), POST sent once |
| Multipart parts uploaded one by one; a stalled XHR waited forever | Slow large uploads; frozen upload on a dropped connection | 4 parts in parallel, 60 s stall watchdog → retry; first final failure stops the other parts and aborts the bucket upload |
| E2E check “preflight seen” counted only `*.r2.cloudflarestorage.com` OPTIONS events | Chromium never reports preflights as page events → the assertion could not pass in any S3 mode | The test sends the browser’s preflight itself: site origin allowed, foreign origin refused |
| `/verify-email` said “Email tasdiqlandi” when opened directly | Misleading for unverified users | Shows the account's real state |
| Change-email mail failure | Generic error | Old email restored, clear message |
| Avatar removal left the file in storage | Storage leak | File deleted |
| “PRO bekor qilish” on a FREE user | Status set to `PRO_CANCELLED` for a user who never had PRO | Refused with a message |
| Avatar / challenge image limit 5 MB in the browser | 4.5–5 MB images failed on Vercel (4.5 MB request cap) with an unclear error | 4 MB in the browser, same as the server on Vercel |
| `?next=/\t/evil.com` | Browsers strip tabs → `//evil.com` | Control characters and backslashes refused, origin re-checked |
| Lesson page: 4 sequential DB queries | Extra latency per page view | Run in parallel |
| 5 ESLint warnings (React Compiler skipped forms using `form.watch`) | Forms not memoized | `useWatch` |
| Test fixtures | Not reproducible | `npm run e2e:media` creates them (2-page PDF, ~14 MB video = exactly 2 parts) |

## New

- **Super admin → Sozlamalar → Tizim**: configuration summary (no secrets), “Omborni tekshirish” (live R2 check),
  “Menga test xat yuborish”. Covered by E2E in both storage modes.
- `npm run storage:check`, `npm run mail:check`, `npm run e2e:media`; `npm run doctor` validates the R2 address and SMTP.
- `/api/health` reports `mail: {configured, verificationRequired}`.
- Docs: `docs/EMAIL.md`, `docs/RELIZ.md` (release and deployment steps, rollback), updates to `FAYL-SAQLASH.md`, `VERCEL.md`, README.

**Observed once, not reproduced:** in one intermediate local-disk run “founder portrait: upload …” did not see
“Portret yuklangan” within 30 s (the screenshot was lost when the next run cleaned `test-results`). The same upload
done by hand and the same test in the next three full runs (local and S3) passed.

**Not tested (no access from the test environment):** a real Cloudflare R2 bucket, a real email provider, the live
site auforex.vercel.app. Use Super admin → Sozlamalar → Tizim after deploying (docs/PREVIEW.md, then docs/RELIZ.md section 4).

---

# Test results — 23 November 2026, round 2 (local sign-in 503, database timeouts, missing package)

The three reported errors were reproduced on a `next dev` server **before** changing code, then re-tested after the fix.

| Reported error | Reproduced with | Before | After |
|---|---|---|---|
| `BETTER_AUTH_SECRET is required`, sign-up → 503 | valid secret in `.env`, `BETTER_AUTH_SECRET=""` in `.env.local` (what `vercel env pull` writes for Sensitive variables) | pre-start check **passed** (it read only `.env`); sign-up 503; log told to fix Vercel settings | pre-start check stops: “`.env.local` faylida bo‘sh va `.env` dagi qiymatni bekor qilmoqda … qatorini o‘chiring”; log names the local cause and `npm run doctor` |
| same, secret only in `.env.production.local` | — | passed the check, 503 at runtime | “faqat `.env.production.local` da bor — `npm run dev` bu faylni o‘qimaydi” |
| `timeout … when trying to connect` | `.env.local` → a port that accepts TCP and never answers | check **passed**; sign-in waited 11 s → generic 500 “Serverda vaqtinchalik xatolik” | check fails in 6 s naming the address (host:port/db only) and the file it came from; sign-in → **503 `DATABASE_UNAVAILABLE`** with a clear message; `/api/health` gives `reason: "timeout"` |
| `Cannot find module '@vercel/functions'` | package removed from `node_modules` (= `npm install` not run after the update) | `tsc`: TS2307 in `lib/db/prisma.ts` | pre-start check: “O‘rnatilmagan paketlar: @vercel/functions … Bajaring: npm install” |
| Prisma CLI used another database than the site | `.env` local DB, `.env.local` remote DB | `prisma migrate …` read only `.env` | Prisma reads the same files as Next.js and prints `[prisma] Baza: host:port/db (o‘qilgan: .env.local, .env)`; `migrate reset` on a remote DB is refused |

With correct settings, on the same `next dev` server: sign-up 200 → session shows the user (role USER) → sign-out 200 →
session `null` → wrong password 401 → sign-in 200 → `/super-admin` as a user 404 → admin sign-in 200 → `/super-admin` 200
→ founder sign-in by username 200.

Found while re-running e2e: pressing “Bekor qilish” while an upload was still being prepared was ignored (local-disk mode)
and the file was uploaded anyway. Fixed; covered by a new e2e step (no data is sent after the cancel).

| Check | Result |
|---|---|
| `npx tsc --noEmit` (`npm run typecheck`) | ✅ 0 errors |
| `npm run lint` | ✅ 0 errors, 5 warnings (unchanged, pre-existing) |
| Unit tests | ✅ 71 / 71 (11 new: env file order and shadowing, child-process load check, credential-free DB description, timeout classification, a silent port reported as timeout, missing packages) |
| `npm run build` | ✅ |
| E2E, local disk | ✅ 34 / 34 |
| E2E, Vercel mode + S3 bucket | ✅ 34 / 34; 0 unfinished multipart uploads |
| `npx prisma validate`, `prisma generate`, `prisma migrate status` with the new config | ✅ |

**Not tested:** auforex.vercel.app with this code (not deployed — GitHub `main` is still `d4cc2cf`), the user’s own `.env`
files and network path to Prisma Postgres.

---

# Test results — 23 November 2026 (production stabilization: sign-in, database connections, object storage, video LMS)

Environment: Linux, Node 22.23, PostgreSQL 16, Chrome (system) via Playwright, production build (`next build` + `next start`)
on a freshly created database with all four migrations applied and the seed run. Every run below was executed; nothing is
reported from a build alone.

Two server modes were tested with the same build:
- **Local disk** — as on Railway/Docker.
- **Vercel mode** — `VERCEL=1` (read-only disk rules, 4 MiB response cap, pool of 2) with an S3 emulator (`moto_server`)
  as the bucket. The bucket had the exact CORS policy from `docs/FAYL-SAQLASH.md` (only the site origin, `PUT/GET/HEAD`,
  `content-type`, `ExposeHeaders: ETag`); the emulator enforces CORS preflights (a foreign origin gets 403).

## Summary

| Check | Result |
|---|---|
| `npm run typecheck` | ✅ 0 errors |
| `npm run lint` | ✅ 0 errors, 5 warnings (React Compiler notes on React Hook Form `watch` and two unused-expression notes in `scripts/doctor.ts`; all existed before) |
| `npm run build` | ✅ success |
| Unit tests (`npm test`) | ✅ 60 / 60 (incl. AWS SigV4 signatures checked against AWS reference values, `.env.example` validated as shipped) |
| E2E, local disk | ✅ 34 / 34 passed (3.2 min) |
| E2E, Vercel mode + S3 bucket | ✅ 34 / 34 passed (3.0 min). Bucket afterwards: books, covers, founder portrait and videos present; **0 unfinished multipart uploads** (cancelled upload was aborted in the bucket) |
| Database connections (Vercel mode) | ✅ 80 concurrent page/API requests → 80 × 200 in 2.4 s; at most 2 connections from the app; no P2037 |
| Migration `20261123120000_lesson_category_number_access` | ✅ applied (in one transaction) to a database built from the three earlier migrations with: course A numbers 1,1,2 → 1,2,3; course B 0,1 → 1,2; course C 1,3,7 → **unchanged**; categories copied from courses; both progress rows identical before/after; a duplicate number afterwards is refused by the new unique index |
| Vercel build script (`npm run build:vercel`) | ✅ missing `BETTER_AUTH_SECRET` → build stops with the fix; `prisma+postgres://` URL → stops with the fix; production on an empty database → site URL taken from `VERCEL_PROJECT_PRODUCTION_URL`, 4 migrations applied, **no seed run** (0 users), build succeeds. (Prisma CLI replaced by a stand-in that applies the same migrations, because engine downloads are blocked in the test environment.) |
| `/api/health` | ✅ `status: ok`, `migrationsApplied: 4`, `database: {pooled, poolMax: 2}`, `storage: {driver: "s3", uploads: "ok"}` — no secrets in the output |

**Not tested (no access from the test environment):** the live site auforex.vercel.app, the real Prisma Postgres database
and a real Cloudflare R2 bucket. See `docs/VERCEL.md` → “Deploy’dan keyin tekshirish” for the checks to run after deploy.

## End-to-end tests (both modes)

| Spec | Test |
|---|---|
| `auth.spec.ts` | register while a cookie is already set, session survives reload |
| `auth.spec.ts` | sign in again with cookies present (the production failure), wrong password rejected |
| `auth.spec.ts` | cross-site requests stay rejected |
| `auth.spec.ts` | protected pages and admin area |
| `auth.spec.ts` | sign in on a phone |
| `platform.spec.ts` | 1. Guest opens the homepage |
| `platform.spec.ts` | 2. Users register successfully (duplicate email is rejected) |
| `platform.spec.ts` | 3. User logs out and logs in |
| `platform.spec.ts` | 15a. Admin creates a course, uploads a lesson video and publishes it |
| `platform.spec.ts` | 15b. Admin creates and publishes a quiz challenge |
| `platform.spec.ts` | 4-7. FREE user sees the PRO gate with the price; “PRO sotib olish” opens Telegram and files a request |
| `platform.spec.ts` | 9. Admin grants PRO to a user |
| `platform.spec.ts` | 10-11. PRO user watches a lesson (range streaming) and progress is tracked |
| `platform.spec.ts` | 12. PRO user opens an authorised PDF in the reader |
| `platform.spec.ts` | 8. FREE users and guests cannot fetch protected files by direct URL |
| `platform.spec.ts` | 13. FREE user cannot take part in a PRO challenge; PRO user can |
| `platform.spec.ts` | 14. Non-admins cannot access admin routes or APIs |
| `platform.spec.ts` | 15c. Admin unpublishes content, edits the founder profile and revokes PRO |
| `platform.spec.ts` | Super admin: founder signs in with a login and manages the team, founder profile and audit log |
| `platform.spec.ts` | 16. Phone layout: bottom tab bar, menu sheet, no zoom-on-focus, no horizontal scroll |
| `platform.spec.ts` | 17. TradingView page loads the widget or shows a helpful fallback |
| `platform.spec.ts` | 18. Super admin confirms the Telegram payment → PRO opens for that user |
| `routes.spec.ts` | public pages open for guests |
| `routes.spec.ts` | account pages send guests to sign-in |
| `routes.spec.ts` | admin reaches every Super admin page, including detail pages |
| `routes.spec.ts` | key pages fit a phone screen |
| `video-lms.spec.ts` | categories: create, rename, reorder, refuse deleting one in use, delete unused |
| `video-lms.spec.ts` | lessons: number + category heading, large upload in parts, duplicate number refused, invalid file rejected |
| `video-lms.spec.ts` | uploads: cancel stops and cleans up; a dropped part is retried |
| `video-lms.spec.ts` | FREE user: free lesson plays, PRO lesson locked; the video API refuses direct calls |
| `video-lms.spec.ts` | guest: catalogue visible with the subscription offer, media API answers 401 |
| `video-lms.spec.ts` | PRO user: numbered heading, video plays (from the bucket when S3 is on), progress saved |
| `video-lms.spec.ts` | founder portrait: upload, save, shown on the public Founder page |
| `video-lms.spec.ts` | books: PDF upload persists and opens; check-files relinks a seeded book whose file is gone |

Key assertions:
- **Sign-in with cookies already present** (the production failure “Amalni bajarib bo‘lmadi”) succeeds; a request from a
  foreign origin is still rejected with 403; non-admins get 404 on `/super-admin`; upload API refuses non-admins.
- **Lessons**: category is required; heading reads “<Kategoriya> — N-dars”; a duplicate number in the same course is
  refused with the name of the lesson that has it; ↑/↓ swaps numbers; a 13 MB video uploads in 10 MiB parts with progress;
  a renamed non-video file is rejected and removed from storage.
- **Uploads**: “Bekor qilish” stops the upload and aborts it in the bucket; a dropped part is retried and the upload completes.
- **Access**: guests see the catalogue and the PRO offer, media API → 401; FREE users play free lessons, PRO lessons show the
  lock and the video API → 403; PRO users play in sequence; in Vercel mode the video answers `302` (`private, no-store`) to a
  presigned bucket URL that serves `206` ranges.
- **Books**: uploaded PDF persists and opens; “Tekshirish” relinks a seeded book whose stored file is missing to the copy
  shipped with the app.
- **Routes**: every public, account and Super admin page (including detail pages) opens without an error page or page
  error; account pages send guests to sign-in; 7 key pages have no horizontal scroll at 375 px.

---

# Test results — 21 November 2026 (fix round: setup on a new computer, /superadmin, phone over Wi-Fi)

Environment: Linux, Node 22.23, PostgreSQL 16.15, Chrome (system) via Playwright 1.65, production build (`next build` + `next start`) on a freshly created database with all three migrations applied and the seed run.

## Summary

| Check | Result |
|---|---|
| `npm run typecheck` (route types + `tsc --noEmit`, strict) | ✅ 0 errors |
| `npm run lint` (ESLint 9, `eslint-config-next` 16) | ✅ 0 errors, 3 warnings (React Compiler notes on React Hook Form `watch`; the compiler is not enabled) |
| `npm run build` | ✅ success, 0 warnings |
| Unit tests (`npm test`) | ✅ 41 / 41 passed (incl. `.env.example` validated as shipped, empty values = not set, CRLF-safe `.env` editing, LAN-origin rules, price helpers, SUPER_ADMIN access level) |
| End-to-end tests (`npm run test:e2e`) | ✅ 17 / 17 passed (1.0 min), incl. `/superadmin`, `/super_admin`, `/admin` → `/super-admin` |
| Responsive sweep: 26 pages (public + Shaxsiy kabinet + every Super admin section) × 360 / 390 / 768 / 1024 / 1440 px = 130 combinations | ✅ no horizontal overflow, no HTTP errors, no console errors (except the blocked TradingView script, see below) |

## Specification QA scenarios

| # | Scenario | Covered by | Result |
|---|---|---|---|
| 1 | Guest opens homepage | e2e "1. Guest opens the homepage" (heading, slogan, CTA, 7 nav items, disclaimer, CSP header) | ✅ |
| 2 | User registers successfully | e2e "2. Users register…" (+ duplicate email rejected) | ✅ |
| 3 | User logs in | e2e "3. User logs out and logs in" (+ wrong password rejected) | ✅ |
| 4 | FREE user opens lessons | e2e "4-7" | ✅ |
| 5 | PRO restriction appears | e2e "4-7" (exact heading text and the three benefits; lessons and books) | ✅ |
| 6 | Subscription button opens the subscription page | e2e "4-7" (gate shows ~~1 200 000~~ 199 000 next to “OBUNA BO‘LISH”) | ✅ |
| 7 | “PRO sotib olish” → Telegram + request, no automatic PRO | e2e "4-7" (button `href` = `https://t.me/uktambekovv`, `target=_blank`; popup opens that URL; “Arizangiz yuborildi” shown; status stays FREE, gate still shown, pending note in Shaxsiy kabinet) | ✅ |
| 8 | FREE user cannot access protected files by direct URL | e2e "8": video and PDF → 403 for FREE, 401 for guests; private keys via public media route → 404 | ✅ |
| 9 | Super admin grants PRO manually | e2e "9" (+ audit log entry) | ✅ |
| 10 | PRO user accesses content | e2e "10-11" (video served with `206 Partial Content`, `no-store`) | ✅ |
| 11 | Lesson progress tracked | e2e "10-11" (mark complete → 100 % on catalogue and dashboard) | ✅ |
| 12 | PRO user opens an authorised PDF | e2e "12" (178-page reader renders, page navigation, progress saved and shown in dashboard) | ✅ |
| 13 | FREE user cannot participate in a PRO challenge | e2e "13" (gate shown, submission API → 403; PRO user completes the quiz, auto-graded 100, badge awarded) | ✅ |
| 14 | Non-admin cannot access admin routes or APIs | e2e "14" (`/super-admin` → 404 for users, login redirect for guests; old `/admin` → 404; upload API → 403 / 401) | ✅ |
| 15 | Admin can manage content | e2e "15a", "15b", "15c" (course, video upload, lesson publish/unpublish, quiz challenge, founder profile, PRO revoke) | ✅ |
| 16 | Phone layout | e2e "16" (390 px touch device: bottom tab bar with active state, sheet menu, no horizontal scroll on 4 pages, input font ≥ 16 px, purchase button ≥ 48 px tall) | ✅ |
| 17 | TradingView widget handles loading and errors | e2e "17" (fallback shown; instrument switching) | ✅ — see note |
| 18 | Production build succeeds | `npm run build` | ✅ |
| — | Founder confirms Telegram payment → PRO opens | e2e "18" (request listed on the overview and in PRO arizalari with 199 000 so‘m; approve with 1 month → toast “To‘lov tasdiqlandi — PRO ochildi”; moves to *Tasdiqlangan*; the user immediately sees “PRO faol” and the library without re-login; audit entry) | ✅ |

## Ready for Railway (21 Nov, v6)

Problems found before the first deploy (each would have stopped it):

| Problem | Effect on Railway | Fix | Verified |
|---|---|---|---|
| Pages such as `/challenge` were pre-rendered at build time and read the database | `next build` fails on Railway (builds have no database: “DATABASE_URL is not set”); elsewhere the pages would show frozen build-time data | Whole app renders per request (`dynamic = "force-dynamic"` in the root layout) | Build with **no `.env` and no database** → exit 0; only the sitemap stays static |
| `VOLUME` instruction in the Dockerfile | Railway rejects the Dockerfile before building | Removed; Railway Volume mounted at `/app/storage` | — |
| README’s `railway run npm run db:seed` | Runs on the developer’s PC: books never reach the server volume | Seed runs inside the container on every start (idempotent) | see below |
| `NEXT_PUBLIC_APP_URL` defaulted to `http://localhost:3000` in the build | Wrong site URL compiled in | `ARG NEXT_PUBLIC_APP_URL` + fallback to `RAILWAY_PUBLIC_DOMAIN` | shell logic checked for all 4 combinations |

**Production start simulated like Railway** (production build made without `.env`/database, `node scripts/start-prod.mjs`, `PORT=8080`, empty folder as `RAILWAY_VOLUME_MOUNT_PATH`, only the variables printed by `npm run deploy:env`):

| Check | Result |
|---|---|
| Missing `BETTER_AUTH_SECRET` | stops with a clear Uzbek/English message ✅ |
| First start | settings check → seed: founder created, 3 books copied into the volume → `Ready` ✅ |
| `/api/health` | 200 `{"status":"ok"}`; database stopped → 503; restarted → 200 ✅ |
| Browser | founder signs in with `FOUNDER_PASSWORD`, `/superadmin` → panel, a book from the volume renders in the reader, no page errors ✅ |
| SIGTERM (Railway redeploy) | server stops, port released ✅ |
| Second start | founder “ensured”, books “already present, skipped”, no duplicates ✅ |
| `docker compose config` | valid; `DB_PORT` controls the published database port ✅ |

Not run here: the Docker image build itself (Docker Hub and Prisma’s engine download are blocked in this sandbox) and `prisma migrate deploy` inside the container (the same command the previous image already used; migrations were applied with the equivalent WASM engine for the test).

## Database login rejected on the user's computer (21 Nov, v5)

Log: `npm run setup` created a **new** `.env` (`localhost:5432`, `postgres`/`postgres`), and every database call then failed with *P1000 Authentication failed*. The earlier setup used port 5433, which points to another PostgreSQL occupying 5432 (typically one installed on Windows) or to a Docker database with a different password. The VS Code errors were the editor reading files while `npm install` rebuilt `node_modules`: the project type-checks with 0 errors under TypeScript 5.9 (project), 6.0.3 and 7.0.2 (current VS Code).

| Change | Purpose |
|---|---|
| `npm run db:fix` | Diagnoses and repairs the local database connection without deleting data (see below) |
| Pre-dev database check | `npm run dev` stops with a one-paragraph explanation and `npm run db:fix` instead of a wall of Prisma errors (`SKIP_DB_CHECK=1` to bypass) |
| Error page hint (development only) | “Ma’lumotlar bazasiga ulanib bo‘lmadi → npm run db:fix” when a page fails for this reason |
| Seed / `founder:password` / doctor messages | Point to `npm run db:fix` on authentication or connection errors |
| `.env.example` uses `127.0.0.1` | Avoids `localhost` resolving to a different (IPv6) PostgreSQL on Windows |
| `.vscode/settings.json` | Offers the project’s TypeScript version in VS Code |
| `pg` declared as a direct dependency | Used by the new checks (same version as already installed) |

**db:fix verified with real `docker compose`** (Docker Engine 29 / Compose 5.7 here; Docker Hub is blocked in this sandbox, so a local image tagged `postgres:16` built from PostgreSQL 16.15 was used — it reproduces the official image’s password-over-TCP / trust-inside-container behaviour). This machine’s own PostgreSQL played the “Windows PostgreSQL” on 5432 with a different password, reproducing P1000 exactly.

| Scenario | Result |
|---|---|
| `.env` → `localhost:5432` (foreign PostgreSQL), project’s Docker DB stopped, old data in its volume | 5432 busy → Docker DB started on **5433**, `.env` rewritten, “3 users — data intact” ✅ |
| Docker DB password differs from `.env` | Password set from inside the container, connection OK, data intact ✅ |
| `.env` → 5432 while the Docker DB runs on 5433 | `.env` pointed to 5433 ✅ |
| Database missing | Created ✅ |
| Docker DB reported on a port where a foreign PostgreSQL also answers (Windows IPv4/IPv6 sharing; simulated with a wrapper that misreports the port once) | Password reset did not help → container moved to a free port (5434), data intact ✅ |
| Already working | “Tuzatish shart emas” ✅ |
| Docker Desktop closed / Docker not installed | Clear instruction, exit 1 ✅ |
| Full chain after the fix | migrations → seed → `founder:password` → `doctor` all ✓ → `npm run dev` → `/` 200, founder signs in, `/superadmin` → panel; with the database stopped the error page shows the `db:fix` hint ✅ |

Not reproducible here: the exact Windows IPv4/IPv6 port sharing (no IPv6 in this sandbox) — its code path was exercised as described above.

## Update of an existing install (21 Nov, v4 — from the user’s terminal log)

The log showed the commands were run in the folder with the **old (v2) code**: `Missing script: "setup"/"doctor"/"founder:password"`, “2 migrations found”, `GET /admin 200`, `GET /superadmin 404`. Also: database on port **5433**, a stray `package-lock.json` in the home folder, a `scroll-behavior` browser warning and npm’s `allowScripts` advisory.

| Problem | Fix |
|---|---|
| Shipped `docker-compose.yml` hard-coded 5432 — overwriting the user’s file would have moved the database container away from 5433 | Host port is `${DB_PORT:-5432}`; `npm run setup` copies the port from an existing `DATABASE_URL` into `DB_PORT`; `npm run doctor` warns when they differ |
| “Next.js ignored package-lock.json in C:\Users\… set turbopack.root” | `turbopack.root` and `outputFileTracingRoot` pinned to the project folder |
| “Detected scroll-behavior: smooth on <html>” | `data-scroll-behavior="smooth"` on `<html>` |
| npm 11 `allowScripts` advisory (npm 12 will block these scripts → Prisma and `tsx` would break) | `allowScripts` in `package.json` for `@prisma/engines`, `prisma`, `esbuild`, `fsevents` |
| Updating was undocumented | “Eski versiyani yangilash” in `docs/ISHGA-TUSHIRISH.md` and README; archive renamed `au-forex-academy-v4.zip` |

**Simulated update (same situation as the log):** v2 ZIP installed with a Windows-style (CRLF) `.env`, database reached through port 5433, v2 migrations + seed (founder with a once-shown password, an extra admin, 3 books in `storage/`), a `package-lock.json` in the home folder. v2 dev server reproduced: `/superadmin` 404, the lockfile warning, sign-up HTTP 500. Then the v4 ZIP was extracted **over** the folder and the guide’s commands were run: `npm run dev` first stopped with the `app/admin` instruction → `rm -rf app/admin .next` → `npm install` → `npm run setup` (kept all values and CRLF, added `DB_PORT=5433` and `FOUNDER_PASSWORD`) → migrations (only the 3rd applied) → `npm run db:seed` (books kept, admin promoted) → `npm run founder:password` → `npm run doctor` (all ✓) → `npm run dev` (no warnings). In the browser: founder signed in with `asadbek` and the new password, `/superadmin` → panel; the pre-existing admin opened `/admin/users` → `/super-admin/users`; a new customer registered with the old `.env`, pressed “PRO sotib olish” (Telegram opened), the founder approved, the customer saw the 3 books and the reader opened a book from the old `storage/`. No browser warnings or errors. ✅

## Fix round (21 Nov, after the three ZIPs were returned)

The newest ZIP (`…_3.zip`) was byte-identical to the last delivery and contains everything from the two older ones (their only extra files were the old `app/admin` pages, which moved to `app/super-admin`). Problems found and fixed:

| Problem | Effect before | Fix | Verified by |
|---|---|---|---|
| `REQUIRE_EMAIL_VERIFICATION=""` in `.env.example` was rejected by validation | With an `.env` copied as-is, **every sign-in returned HTTP 500** (“Invalid environment configuration”) | Empty values now mean “not set” for every variable | unit test parses `.env.example` (fails without the fix, passes with it); clean-install run |
| `ADMIN_EMAIL="admin@example.com"` with empty password in `.env.example` | `npm run db:seed` crashed after the founder step → **the 3 books were never added** | Default is empty; books are seeded before the optional admin; a misconfigured extra admin is skipped with a message | clean-install run: 3 books added |
| Panel address typed as `/superadmin` | 404 | `/superadmin`, `/super_admin`, `/admin/*` redirect to `/super-admin/*` | e2e “14” and “Super admin” |
| Founder password from my reply only existed in my test database | Could not sign in on your computer | `npm run setup` writes a founder password into `.env`; `npm run founder:password` sets it in your database | password hash verified; clean-install sign-in |
| `openssl` step in the README | Not available in Windows PowerShell | `npm run setup` generates the secret (Node only) | run on a fresh copy, re-run keeps values |
| Opening the dev server from a phone (`http://192.168.x.x:3000`) | Sign-in rejected (origin), hot reload blocked | Private-network origins allowed **in development only**; production still accepts only `BETTER_AUTH_URL` / `TRUSTED_ORIGINS` | dev: LAN 200 / foreign origin 403; prod: LAN 403 |
| Older ZIP extracted over the new one | Leftover `app/admin` → `next build` fails (80 type errors) | `npm run dev` / `npm run build` detect it and print the exact command to remove it | tested with the v2 folder |
| Next.js dev badge on phones | Covered the first bottom tab and the reader’s “Oldingi” button | Disabled (`devIndicators: false`); error overlay still works | screenshot |
| `.env` with Windows line endings (CRLF) | `setup` would have merged two lines | Line-safe editing | unit test |
| Seed run before migrations / with DB down | Raw stack trace | Short Uzbek message with the next command | manual run |

New helpers: `npm run setup`, `npm run doctor` (Node, files, `.env` format, database connection, migrations, founder account, book files — each ✗ with the fixing command), `npm run founder:password`, step-by-step Windows guide `docs/ISHGA-TUSHIRISH.md`, `.gitattributes` (LF for migrations).

### Clean install from the ZIP (as on a new computer)

ZIP extracted into an empty folder → `npm ci` → `npm run setup` (stock `.env.example`, only `DATABASE_URL` edited) → migrations → `npm run db:seed` (3 books added) → `npm run doctor` (all ✓) → `npm run build` → `npm run start` → founder signs in with login `asadbek` and the password `setup` generated → `/superadmin` opens the panel. ✅

### Phone on the same Wi-Fi, development mode

`npm run dev` on the clean copy; a mobile browser opened `http://192.168.77.7:3000` (routed to the dev server so the server sees a real private-network origin): register → bottom tab bar navigation → “PRO sotib olish” opened `https://t.me/uktambekovv` and showed “Arizangiz yuborildi” → founder on `localhost` approved for 1 month → the phone user saw 3 books, opened the reader, “Keyingi” moved to page 2, Obuna showed “PRO faol”. No page errors, no blocked dev requests. ✅

## Super admin panel (21 Nov)

Covered by the e2e test "Super admin: founder signs in with a login…":

| Check | Result |
|---|---|
| Founder signs in with login `asadbek` (no email) | ✅ |
| One panel at `/super-admin`: PRO arizalari, Foydalanuvchilar, Super adminlar, Founder, Sayt sozlamalari, Audit jurnali in the menu; `/admin` returns 404 | ✅ |
| `/founder` shows Asadbek Uktambekov, the supplied biography, mission, message and the Instagram link; no placeholders for visitors | ✅ |
| Every super admin (incl. the seeded one) opens requests, team, founder, settings and audit | ✅ |
| Promote a registered user by email → full panel access; demote → 404 | ✅ |
| Migration on the existing dev database: former `ADMIN` accounts became `SUPER_ADMIN`, `ProRequest` table created, no data lost | ✅ |

Phone screenshots of the purchase → request → approval flow and the PDF reader: `docs/screenshots/phone-pro-flow.webp`.

## Additional manual/API checks

| Check | Result |
|---|---|
| Sign-up with injected `"role":"SUPER_ADMIN"` | ignored — account created as `USER` |
| Weak password at sign-up / reset | rejected server-side with an Uzbek message |
| Password reset | link generated, 1 h token, single use (second use → `INVALID_TOKEN`), new password works, old password rejected |
| Reset request for unknown email | identical response (no account enumeration) |
| Email verification with SMTP configured (local SMTP server) | sign-up returns no session, sign-in blocked (`EMAIL_NOT_VERIFIED`), verification email delivered, link verifies and signs in (httpOnly, SameSite=Lax cookie), invalid link handled |
| Suspended account sign-in | blocked with `ACCOUNT_SUSPENDED` |
| Cross-origin POST to auth and app APIs | 403 |
| Rate limiting | sign-up limit triggered during repeated test runs (429 → Uzbek message) |
| Security headers | CSP with per-request nonce, `X-Frame-Options: DENY`, `nosniff`, Referrer-Policy, Permissions-Policy, COOP, HSTS (production) |
| Every Super admin server action checks the role (`assertAdmin()` / `assertSuperAdmin()`) | verified by code scan: 28 / 28 actions in `lib/actions/admin/` (incl. approve / reject PRO request); `createProRequest` requires a signed-in user and is rate-limited (20/h) |

## Not verified in this environment

| Item | Why |
|---|---|
| Live TradingView chart rendering | The sandbox network blocks `s3.tradingview.com`, so the test exercised the **fallback** path. The widget code follows TradingView's official embed; verify the live chart in your browser after deploying. |
| Docker image build | No Docker daemon available in the build environment. The `Dockerfile` and `docker-compose.yml` are provided but untested. |
| `prisma migrate dev` with the Prisma CLI | The Prisma binary download host was unreachable here; the migration SQL was generated with Prisma's official schema engine (WASM build of the same version) and applied successfully. On a normal machine `npx prisma migrate deploy` uses the standard engine. |
| Real SMTP provider, Safari/iOS, Firefox | Only Chrome (incl. mobile emulation with touch) and a local SMTP server were available. iOS-specific behaviour (safe areas, no zoom on focus) follows the standards but was not checked on a real iPhone |
| Opening Telegram | t.me is not reachable from the test network; the test answered `https://t.me/uktambekovv` locally and verified the popup URL |
