# Task 3 Report: Connect Authenticated Payment Workflow

## Implementation Summary

- Added a persisted browser session with a stable device ID, login persistence,
  `useSession`, and query-cache clearing after session removal.
- Added an authenticated API client using `@helio/api-client`. It adds the
  bearer token, performs one refresh attempt after a 401, retries the original
  request once with rotated tokens, and clears the session when refresh fails.
- Protected the application shell routes and connected the login form to
  `/auth/login`, including safe return-route handling.
- Replaced web demo list adapters with authenticated API calls for plants,
  devices, bills, orders, payments, and anomaly events. Added typed mutation
  adapters and React Query invalidation hooks for every state-changing adapter.
- Added authenticated collection endpoints needed by the console. Each list is
  derived from the authenticated user's plants.
- Added `POST /payments/:id/mock-complete`, a JWT-protected, development-only,
  Mock-provider-only orchestration endpoint. It accepts only the payment ID;
  the server derives the transaction details, amount, merchant order ID,
  `SUCCESS` state, raw payload, and signature before using the existing
  `PaymentService.handleCallback` path.
- Regenerated `apps/api/openapi.json` and
  `packages/api-client/src/schema.d.ts`.

## Files Changed

### Web

- `apps/web/src/lib/session.ts`
- `apps/web/src/lib/api-client.ts`
- `apps/web/src/lib/auth.ts`
- `apps/web/src/lib/session.spec.ts`
- `apps/web/src/lib/api.ts`
- `apps/web/src/lib/api.spec.ts`
- `apps/web/src/lib/types.ts`
- `apps/web/src/router.tsx`
- `apps/web/src/main.tsx`
- `apps/web/src/pages/auth/login.tsx`

### API and Contract

- `apps/api/src/modules/energy/application/device.service.ts`
- `apps/api/src/modules/energy/presentation/energy.controller.ts`
- `apps/api/src/modules/billing/application/billing.service.ts`
- `apps/api/src/modules/billing/presentation/billing.controller.ts`
- `apps/api/src/modules/order/application/order.service.ts`
- `apps/api/src/modules/order/infrastructure/order.repository.ts`
- `apps/api/src/modules/order/presentation/order.controller.ts`
- `apps/api/src/modules/anomaly/application/anomaly.service.ts`
- `apps/api/src/modules/anomaly/infrastructure/anomaly.repository.ts`
- `apps/api/src/modules/anomaly/presentation/anomaly.controller.ts`
- `apps/api/src/modules/payment/application/payment.service.ts`
- `apps/api/src/modules/payment/application/mock-payment.service.ts`
- `apps/api/src/modules/payment/application/mock-payment.service.spec.ts`
- `apps/api/src/modules/payment/infrastructure/mock.gateway.ts`
- `apps/api/src/modules/payment/infrastructure/payment.repository.ts`
- `apps/api/src/modules/payment/payment.module.ts`
- `apps/api/src/modules/payment/presentation/payment.controller.ts`
- `apps/api/src/modules/payment/presentation/payment.controller.spec.ts`
- `apps/api/src/openapi.spec.ts`
- `apps/api/openapi.json`
- `packages/api-client/src/schema.d.ts`
- `.superpowers/sdd/2026-09-04-helio-delivery/task-3-report.md`

## TDD Evidence

### RED

Command:

```powershell
pnpm --filter @helio/web test -- session.spec.ts api.spec.ts
```

Result: exit 1. Both suites failed to load because `./auth` and
`./api-client` did not exist. This was expected: the required session/auth
modules and authenticated client had not been implemented yet.

Command:

```powershell
pnpm --filter @helio/api test -- mock-payment.service.spec.ts payment.controller.spec.ts
```

Result: exit 1. `./mock-payment.service` was absent and
`PaymentController.completeMockPayment` did not exist. This was expected:
the server-only Mock callback seam had not been implemented yet.

Command:

```powershell
pnpm --filter @helio/api test -- openapi.spec.ts mock-payment.service.spec.ts payment.controller.spec.ts
```

Result: exit 1. In addition to the missing Mock service/controller method,
the OpenAPI contract lacked `/anomalies`. This demonstrated that the live
collection API surface was not yet present.

### GREEN

Command:

```powershell
pnpm --filter @helio/web test -- session.spec.ts api.spec.ts
```

Result: exit 0. 2 files and 8 tests passed.

Command:

```powershell
pnpm --filter @helio/api test -- openapi.spec.ts mock-payment.service.spec.ts payment.controller.spec.ts
```

Result: exit 0. 3 files and 7 tests passed.

### Fresh Final GREEN Evidence

Command:

```powershell
pnpm --filter @helio/web test -- session.spec.ts api.spec.ts
```

Result: exit 0. 2 files and 8 tests passed in the final verification run.

## Verification Commands and Results

```powershell
pnpm contracts:generate
```

Result: exit 0. Prisma client, OpenAPI JSON, and generated client schema were
regenerated successfully.

```powershell
pnpm --filter @helio/web test
```

Result: exit 0. 2 files and 8 tests passed in the final verification run.

```powershell
pnpm --filter @helio/api test
```

Result: exit 0. 15 files and 115 tests passed in the final verification run.

```powershell
pnpm typecheck
```

Result: exit 0. Prisma generation succeeded and Turbo reported 6 successful
package typecheck tasks: API, API client, config, UI, web, and worker, in the
final verification run. The command emitted only existing Prisma configuration
and Node URL-parser deprecation warnings; no typecheck failed.

## Self-Review

- The Mock completion endpoint has no request body and no `@Public()` marker.
  Its generated OpenAPI operation declares bearer security.
- The endpoint passes only the route payment ID to `MockPaymentService`. That
  service rejects production and non-Mock-provider configurations before it
  loads a payment, derives all callback fields server-side, signs through the
  server-side `MockGateway`, and calls the existing callback service.
- A repository-wide search confirmed the Mock signing secret is not referenced
  by `apps/web` or `packages`.
- Session tests cover login persistence, stable device ID, bearer header
  creation, one refresh retry, token rotation, and refresh-failure clearing.
- Adapter tests cover real list endpoint use instead of demo data and mutation
  invalidation after Mock completion.
- `git diff --check` completed without whitespace errors.
- Final staged-diff review covered 32 Task 3 files (web session/adapters,
  authenticated API workflow, generated contract, tests, and this report).
  `git diff --cached --check` exited 0 with no whitespace errors or unrelated
  paths staged.

## Concerns

- Resource ownership for individual existing resources and worker request
  signing remain Task 5 work. The new Mock completion route requires JWT but
  intentionally does not add the broader per-resource ownership policy.
- The new user-scoped collection services aggregate per-plant data, which is
  suitable for the current console but may need query-level consolidation as
  plant counts grow.
- Full persistent database, worker settlement, and browser E2E coverage are
  not part of Task 3's specified verification commands; Task 6 owns that
  scenario coverage.
