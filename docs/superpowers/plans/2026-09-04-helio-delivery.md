# Helio Delivery Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a reproducible, authenticated, testable and demonstrable Helio full-stack application suitable for a resume project.

**Architecture:** The existing NestJS modular monolith remains the business-system boundary. `packages/api-client` supplies generated contract types and a typed HTTP transport to React; PostgreSQL time-series DDL becomes a repeatable deployment migration; Compose runs API, worker and Web through service-name networking. Authorization stays in API application services, while the frontend owns session presentation and React Query cache updates.

**Tech Stack:** pnpm 9, Turborepo, NestJS/Fastify, Prisma/PostgreSQL, Redis/BullMQ, React 19, React Router, TanStack Query, Tailwind, Vitest, Testcontainers, Playwright, Docker Compose, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-04-helio-delivery-design.md`

## Global Constraints

- Preserve the modular-monolith boundaries and TypeScript strict mode.
- Make every new public behavior test-first and run the focused test before implementing it.
- Use only Mock payment for automated and local demonstrations; do not claim real WeChat or Alipay settlement.
- Run the relevant verification command before every commit; push each verified milestone to `origin/codex/helio-delivery`.
- Do not add public deployment URLs unless a real deployed endpoint is reachable.
- Keep `docs/` tracked and keep credentials in `.env`, never in committed files.

---

## Delivery Order and Acceptance Gates

| Order | Milestone | Entry condition | Acceptance gate | Commit |
|---|---|---|---|---|
| 0 | Plan and repository visibility | Isolated worktree exists | Design and plan are tracked; docs are no longer ignored | `docs: add delivery completion plan` |
| 1 | Delivery foundation | Existing root quality gate fails | Generated API client exists; root lint/typecheck/test/build all pass | `build: repair workspace quality gate` |
| 2 | Fresh-environment startup | Root quality gate is green | Repeatable time-series migration, service-name Compose network, Web service and production start guide work | `infra: make compose startup reproducible` |
| 3 | Authenticated end-to-end business path | API/client contract is stable | Login, refresh, plants, bills, orders, Mock payment callback and settlement run through real API | `feat: connect authenticated payment workflow` |
| 4 | Interactive frontend | Core path works | CRUD, billing/payment/refund, alerts, chart, loading/empty/error states work against API | `feat: complete operations console interactions` |
| 5 | Authorization boundary | UI supports mutations | Cross-user reads/mutations fail; worker requests are signed and replay protected | `fix: enforce resource authorization` |
| 6 | Automated delivery confidence | Authorization is tested locally | Testcontainers integration, worker tests, Playwright E2E and CI all run | `test: add full-stack delivery coverage` |
| 7 | Demonstration package | All functional quality gates pass | Tracked docs, screenshots, demo script, Compose runbook, Swagger link and deploy configuration exist | `docs: publish project delivery evidence` |

## File Structure

- `packages/api-client/src/`: generated OpenAPI paths plus typed fetch transport and public exports.
- `scripts/`: contract export and quality/deployment helper scripts shared by CI and local contributors.
- `apps/api/prisma/migrations/`: business and time-series schema migrations executed by Prisma.
- `apps/api/src/common/`: shared auth ownership, internal-signature and health helpers.
- `apps/api/src/modules/*/`: business services accept authenticated principals for resource reads and mutations.
- `apps/web/src/lib/`: session store, typed API adapters, error normalization and chart data transformation.
- `apps/web/src/pages/`: protected workflow pages, mutation forms, feedback states and charts.
- `apps/web/src/components/`: reusable dialogs, forms, feedback panels and chart presentation.
- `apps/*/test` and `apps/*/src/**/*.spec.ts`: unit, integration and worker coverage.
- `e2e/`: Playwright configuration and the login-to-payment journey.
- `.github/workflows/`: quality, integration, E2E, image and artifact workflow definitions.
- `docs/`: maintained runbook, architecture, testing, deployment and evidence files.

### Task 0: Track the approved delivery plan

**Files:**
- Modify: `.gitignore`
- Create: `docs/superpowers/specs/2026-09-04-helio-delivery-design.md`
- Create: `docs/superpowers/plans/2026-09-04-helio-delivery.md`

**Interfaces:**
- Produces: a single source of truth for all following milestone acceptance gates.

- [x] **Step 1: Verify the existing ignore rule excludes `docs/`**

Run: `git check-ignore -v docs/DEVELOPMENT.md`

Expected: `.gitignore` reports the `docs/` rule.

- [x] **Step 2: Remove the `docs/` ignore rule and add design/plan documents**

The design must define API-client ownership, internal worker signing, Mock payment scope and the testing/deployment boundary. The plan must list milestones 1–7 in the requested order and include command-level acceptance gates.

- [x] **Step 3: Verify the plan is tracked and internally consistent**

Run: `git diff --check` and `rg -n "TODO|TBD|implement later" docs/superpowers`

Expected: no whitespace errors and no unfinished plan markers.

- [x] **Step 4: Commit and push the plan**

Run: `git add .gitignore docs/superpowers && git commit -m "docs: add delivery completion plan" && git push -u origin codex/helio-delivery`

### Task 1: Repair the workspace quality gate and contract client

**Files:**
- Create: `apps/api/openapi.ts`, `packages/api-client/src/schema.d.ts`, `packages/api-client/src/client.ts`, `packages/api-client/src/index.ts`, `eslint.config.mjs`
- Modify: `package.json`, `turbo.json`, `packages/api-client/package.json`, `apps/api/package.json`, `apps/web/package.json`, `.github/workflows/ci.yml`
- Test: `packages/api-client/src/client.spec.ts`, `apps/web/src/lib/api.spec.ts`

**Interfaces:**
- Produces: `createHelioClient(options)` and generated `paths` types exported by `@helio/api-client`.
- Consumes: API Swagger configuration and `VITE_API_BASE_URL`.

- [x] **Step 1: Write failing API-client tests**

Add a Vitest test that calls a stubbed fetch through `createHelioClient` and asserts bearer authorization, JSON encoding and normalized errors. Add a Web adapter test that verifies a typed plant-list call replaces the demo array.

- [x] **Step 2: Run focused tests to verify failure**

Run: `pnpm --filter @helio/api-client test` and `pnpm --filter @helio/web test -- api.spec.ts`

Expected: failure because the client module and test scripts do not exist.

- [x] **Step 3: Implement contract export/generation and transport**

Export the OpenAPI document without binding a listening port. Generate `schema.d.ts` from the document in a reproducible script. Make the API-client package build from `src/index.ts`, provide lint/typecheck/test scripts, and add root scripts that invoke it.

- [x] **Step 4: Add flat ESLint configuration and correct Turbo task dependencies**

Use ESLint 9 flat configuration for TypeScript/React files. Make `lint`, `typecheck`, `test` and `build` tasks depend on the appropriate contract build without treating an absent generated source as success.

- [x] **Step 5: Update CI quality stages**

Make CI run contract generation/verification, root lint/typecheck/test/build, and retain artifacts required by later E2E stages.

- [x] **Step 6: Verify the full root quality gate**

Run: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`

Expected: every command exits 0 and no workspace package is skipped due to missing scripts.

- [x] **Step 7: Commit and push**

Run: `git add package.json turbo.json eslint.config.mjs apps packages .github && git commit -m "build: repair workspace quality gate" && git push`

### Task 2: Make clean Docker startup reproducible

**Files:**
- Create: `apps/api/prisma/migrations/<timestamp>_time_series/migration.sql`, `apps/web/Dockerfile`, `apps/web/nginx.conf`, `docs/DEPLOYMENT.md`
- Modify: `docker-compose.yml`, `apps/api/.env.example`, `apps/api/Dockerfile`, `apps/worker/Dockerfile`, `README.md`
- Test: `scripts/verify-compose.ps1`

**Interfaces:**
- Produces: `docker compose up --build` starts Web at port 8080 and API/worker use `postgres` and `redis` service hostnames.

- [x] **Step 1: Write a failing Compose configuration test**

Create a PowerShell verifier that parses `docker compose config`, requires `web`, requires API/worker service-name URLs, and requires a time-series migration file.

- [x] **Step 2: Run the verifier to verify failure**

Run: `pwsh -File scripts/verify-compose.ps1`

Expected: failure because `web` is absent and time-series DDL is not a migration.

- [x] **Step 3: Implement migration and container topology**

Move idempotent partition functions and the materialized view into an ordered Prisma SQL migration. Add Web build/serve image and Nginx reverse proxy. Configure containers with `DATABASE_URL=postgresql://helio:helio@postgres:5432/helio`, `REDIS_HOST=redis`, `REDIS_URL=redis://redis:6379`, and `API_BASE_URL=http://api:3000`.

- [x] **Step 4: Add health checks and a documented production start path**

Expose API health/readiness endpoints, health-check API/worker/Web where appropriate, and describe local production deployment and browser API proxy behavior.

- [x] **Step 5: Verify Compose definition and image builds**

Run: `pwsh -File scripts/verify-compose.ps1`, `docker compose config --quiet`, and `docker compose build api worker web`

Expected: each command exits 0. When Docker daemon is unavailable, record its exact external failure and retain static-config verification.

Validation note (2026-09-04): `pwsh -File scripts/verify-compose.ps1` and `docker compose config --quiet` passed. `docker compose build api worker web` could not run because Docker Desktop's `//./pipe/dockerDesktopLinuxEngine` daemon pipe was unavailable.

- [x] **Step 6: Commit and push**

Run: `git add docker-compose.yml apps docs scripts README.md && git commit -m "infra: make compose startup reproducible" && git push`

### Task 3: Connect the authenticated Mock-payment workflow

**Files:**
- Create: `apps/web/src/lib/session.ts`, `apps/web/src/lib/api-client.ts`, `apps/web/src/lib/auth.ts`
- Modify: `apps/web/src/lib/api.ts`, `apps/web/src/router.tsx`, `apps/web/src/main.tsx`, `apps/web/src/pages/auth/login.tsx`, API controllers/services required by the workflow
- Test: `apps/web/src/lib/session.spec.ts`, `apps/web/src/lib/api.spec.ts`, targeted API workflow specs

**Interfaces:**
- Produces: authenticated `api` list/mutation methods, `useSession`, protected routes and a demo-safe Mock callback action.

- [x] **Step 1: Write failing session and API adapter tests**

Test login persistence, one refresh retry after a 401, Authorization header creation, and calling `/plants` rather than a local static array.

- [x] **Step 2: Run focused tests to verify failure**

Run: `pnpm --filter @helio/web test -- session.spec.ts api.spec.ts`

Expected: failure because session/client modules and real adapters do not yet exist.

- [x] **Step 3: Implement session lifecycle and protected routing**

Submit credentials to `/api/auth/login` with a stable browser device ID, persist token state, refresh once through `/api/auth/refresh`, clear the session on refresh failure, and redirect unauthenticated users to login.

- [x] **Step 4: Replace demo data with real typed endpoints**

Use the generated API client for plants/devices/bills/orders/payments/anomalies. Preserve React Query keys and add invalidation after every state-changing mutation.

- [x] **Step 5: Implement the API workflow seam**

Expose only Mock-demo callback orchestration in development/demo configuration; it must create a signed Mock callback, process it through the existing payment service, and allow worker settlement to complete the order without trusting browser-provided status.

- [x] **Step 6: Verify workflow-focused tests and typecheck**

Run: `pnpm --filter @helio/web test`, `pnpm --filter @helio/api test`, `pnpm typecheck`

Expected: tests and types pass.

Validation note (2026-09-04): `pnpm contracts:generate`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` passed after the final Mock-callback and session-refresh fixes. The optional final security review was intentionally deferred at the user's request. A late P2 review observation about a delayed same-session concurrent-refresh ordering is tracked as deferred work; it did not fail the current test or typecheck gates.

- [x] **Step 7: Commit and push**

Run: `git add apps packages && git commit -m "feat: connect authenticated payment workflow" && git push`

### Task 4: Complete operational-console interactions

**Files:**
- Create: `apps/web/src/components/forms/*`, `apps/web/src/components/feedback/*`, `apps/web/src/components/charts/*`
- Modify: `apps/web/src/pages/plants/page.tsx`, `devices/page.tsx`, `bills/page.tsx`, `orders/page.tsx`, `payments/page.tsx`, `anomalies/page.tsx`, `dashboard/page.tsx`, `components/AppShell.tsx`, `index.css`
- Test: React component tests for forms, errors and chart transformation

**Interfaces:**
- Consumes: Task 3 typed API methods and session state.
- Produces: accessible mutation dialogs, errors, empty/loading states and dashboard trend visualization.

- [x] **Step 1: Write failing component tests**

Test that a new-plant form submits a typed mutation, a failed query displays retry affordance, and chart data renders a labelled SVG/canvas summary with no data fallback.

- [x] **Step 2: Run focused tests to verify failure**

Run: `pnpm --filter @helio/web test -- plants.page.spec.tsx feedback.spec.tsx`

Expected: failure because interaction components and behavior tests are absent.

- [x] **Step 3: Build mutation forms and row actions**

Add create/edit/delete plant/device dialogs; generate/issue bills; create/submit/Mock-complete orders; close/refund payments; resolve anomaly and reconciliation status where APIs permit. Disable actions while mutations run and invalidate exact React Query keys on success.

- [x] **Step 4: Add chart and feedback presentation**

Render daily energy data in a responsive chart, add loading/empty/error/retry panels on every data page, and create user-visible success/error notifications.

- [x] **Step 5: Verify responsive interaction behavior**

Run: `pnpm --filter @helio/web test`, `pnpm --filter @helio/web build`, and browser screenshots at desktop/mobile sizes.

Expected: tests/build pass and controls remain visible without horizontal page overflow.

Validation note (2026-09-04): `pnpm --filter @helio/web test` passed 15 files / 44 tests; Web lint, typecheck and production build passed. Desktop and mobile browser snapshots verified the responsive shell, drawer and no-overflow condition against the local frontend error state. Root `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` also passed.

- [x] **Step 6: Commit and push**

Run: `git add apps/web && git commit -m "feat: complete operations console interactions" && git push`

### Task 5: Enforce ownership and signed worker requests

**Files:**
- Create: `apps/api/src/common/security/internal-request.service.ts`, `apps/api/src/common/security/internal-request.service.spec.ts`
- Modify: resource controllers/application services, `apps/worker/src/handlers/reconciliation.handler.ts`, `.env.example`, relevant test files
- Test: ownership and signature/replay unit tests

**Interfaces:**
- Produces: `assertInternalRequest(headers)` and application-service methods receiving `AuthUser`.
- Consumes: `INTERNAL_REQUEST_SECRET`, request headers and nonce storage.

- [x] **Step 1: Write failing ownership and internal-signature tests**

Test user B cannot read user A's plant, device, bill, order or payment; test B cannot close/refund A's payment or resolve its reconciliation diff. Test an expired timestamp and a repeated nonce are rejected.

- [x] **Step 2: Run focused tests to verify failure**

Run: `pnpm --filter @helio/api test -- authorization internal-request`

Expected: failures expose missing principal propagation or absent signing verification.

- [x] **Step 3: Implement application-level authorization**

Pass `AuthUser` through all relevant controller methods. Resolve ownership through linked plant/bill/order/payment records, allow privileged roles only where specified, and make services reject unauthorized data before return or mutation.

- [x] **Step 4: Implement signed worker requests**

Worker signs `method + path + timestamp + nonce + body hash` with HMAC SHA-256. API validates timestamp skew, signature equality and one-time nonce storage in Redis; it rejects no-secret configuration outside local test mode.

- [x] **Step 5: Verify API and worker security behavior**

Run: `pnpm --filter @helio/api test`, `pnpm --filter @helio/worker test`, `pnpm typecheck`

Expected: all targeted security tests and workspace types pass.

- [x] **Step 6: Commit and push**

Run: `git add apps && git commit -m "fix: enforce resource authorization" && git push`

Validation note (2026-09-05): focused authorization and internal-request tests, API (136 tests), worker tests, root lint, typecheck, test, and build all passed. The commit and remote push for this milestone are recorded after the final working-tree checks.

### Task 6: Add integration, worker and browser coverage

**Files:**
- Create: `apps/api/test/integration/*`, `apps/worker/src/**/*.spec.ts`, `e2e/playwright.config.ts`, `e2e/payment-flow.spec.ts`, helper scripts
- Modify: package manifests, `turbo.json`, `.github/workflows/ci.yml`, Docker test configuration

**Interfaces:**
- Produces: `pnpm test:integration`, `pnpm test:e2e`, and CI artifacts.

- [ ] **Step 1: Write the first failing PostgreSQL/Redis integration test**

Use Testcontainers to migrate a disposable PostgreSQL instance, start Redis, register/login a user, create a plant/bill/order/payment, send a signed Mock callback and assert settlement state.

- [ ] **Step 2: Run the integration test to verify failure**

Run: `pnpm --filter @helio/api test:integration`

Expected: failure because the script/test setup is absent.

- [ ] **Step 3: Add test infrastructure and worker tests**

Create controlled database/Redis lifecycle helpers, execute all Prisma migrations, test worker settlement and internal signing, and guarantee cleanup from `afterAll` even when assertions fail.

- [ ] **Step 4: Add Playwright core-flow test**

Start the application dependencies through Playwright `webServer`, seed an admin user, execute browser login, plant inspection, bill/order/payment actions, Mock callback and completed-order assertion.

- [ ] **Step 5: Integrate tests into CI**

Use Docker service containers or Compose in GitHub Actions, cache pnpm, upload Playwright reports/screenshots on failure, and make the final build job depend on all quality jobs.

- [ ] **Step 6: Verify all test layers**

Run: `pnpm test`, `pnpm test:integration`, `pnpm test:e2e`, `pnpm lint`, `pnpm typecheck`, `pnpm build`

Expected: all commands exit 0. If local Docker is unavailable, run unit/static checks and retain the CI service-container verification path.

- [ ] **Step 7: Commit and push**

Run: `git add apps e2e scripts package.json turbo.json .github && git commit -m "test: add full-stack delivery coverage" && git push`

### Task 7: Package evidence and deployment handoff

**Files:**
- Create: `docs/SHOWCASE.md`, `docs/DEPLOYMENT.md`, `docs/DEMO.md`, `docs/assets/*`, deployment workflow/configuration files
- Modify: `README.md`, `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`, `docs/TEST-PLAN.md`, `.github/workflows/ci.yml`

**Interfaces:**
- Produces: startup instructions, Swagger URL, screenshot/video workflow and deploy instructions using the verified Compose stack.

- [ ] **Step 1: Capture fresh evidence after all functional gates pass**

Run the Web against the authenticated API stack, capture desktop/mobile dashboard and Mock payment completion screenshots, and record the exact browser recording command in `docs/DEMO.md`.

- [ ] **Step 2: Update project documentation**

Replace prototype claims with verified capabilities, report exact current test totals, state Mock-payment scope, link Swagger at `/api/docs`, and document `docker compose up --build` plus health checks.

- [ ] **Step 3: Add deployment configuration**

Commit Compose-based deployment instructions and an optional GitHub Actions image/deploy workflow that activates only when real registry/hosting secrets exist. Do not add fake credentials or placeholder public URLs.

- [ ] **Step 4: Verify documentation and evidence links**

Run: `git check-ignore -v docs/README.md; rg -n "95|TODO|TBD|未完成" README.md docs; docker compose config --quiet`

Expected: docs are not ignored, obsolete test counts are absent, and Compose configuration is valid.

- [ ] **Step 5: Commit and push**

Run: `git add README.md docs .github docker-compose.yml && git commit -m "docs: publish project delivery evidence" && git push`

## External Deployment Gate

Public deployment is contingent on an authorized hosting account, DNS/registry credentials and a reachable target environment. The codebase will include a verified deploy configuration and runbook. After those credentials become available, run the documented deploy workflow, check `/api/health`, `/api/docs` and the Web root, then add only the actual resulting URL to `docs/SHOWCASE.md` and README.
