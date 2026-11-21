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
