# Helio Delivery Completion Design

**Status:** Approved for execution on 2026-09-04

## Objective

Turn Helio from a backend-heavy prototype with static frontend data into a reproducible, testable and demonstrable full-stack delivery. The finished repository must install, lint, typecheck, test and build through one root command; start from Docker Compose; provide a real authenticated Mock-payment workflow; and include deployment and evidence artifacts that can support a resume project.

## Delivery Boundary

The delivery keeps the current modular-monolith shape. It does not split services or require third-party payment merchant credentials. The production-facing payment integration remains Mock-first; real WeChat and Alipay adapters are documented as optional channels and must fail closed instead of returning synthetic success when selected without valid credentials.

## Architecture

`apps/api` remains the sole HTTP API and owns authorization, state transitions and database access. `apps/worker` consumes BullMQ jobs, but its internal API calls use a signed request with a timestamp, nonce and HMAC rather than a reusable static token. `apps/web` becomes a real SPA client with access-token storage, refresh-token rotation, typed API calls, protected routes and React Query mutations.

`packages/api-client` becomes the contract boundary. A build-time script exports the Nest Swagger document, generates OpenAPI TypeScript path definitions, and compiles a small typed fetch client. The web application imports its endpoint types and request helpers from this package rather than retaining its local demo-data adapter.

PostgreSQL owns both Prisma-managed business tables and the time-series schema. The time-series DDL moves into a repeatable SQL migration run by the API's startup command before the application serves traffic. Docker Compose gives every container service-name based URLs and exposes a separate Web service that proxies `/api` requests to API.

## User Workflow

```
Sign in -> access token in memory/local storage + refresh token storage
        -> protected dashboard loads /plants and related data
        -> create plant/device -> create bill -> create order -> submit payment
        -> create Mock payment -> invoke demo callback -> async settlement completes order
        -> refresh data and show success/error UI
```

The browser only sees data belonging to the authenticated user. API application services enforce ownership on every resource read and mutation. Administrative operations retain their RBAC requirement.

## Error Handling and Security

- The web API client normalizes API errors into one typed `ApiError`; pages render retryable error states rather than silently showing empty tables.
- API controller endpoints provide the current authenticated user to application services for all user-owned reads and writes.
- Payment close, refund and reconciliation-diff resolution authorize the order owner or an administrator/operator before a state change.
- Worker-to-API calls carry `x-helio-timestamp`, `x-helio-nonce`, and `x-helio-signature`. The API rejects missing, expired, malformed, or replayed requests.
- Real payment providers reject missing credentials and unsupported operations. Mock is selected only explicitly for local/demo workflows.

## Testing Strategy

- Unit tests cover new authorization, signature and client helper behavior.
- Testcontainers starts PostgreSQL and Redis for API integration tests. Tests execute migrations and exercise the persisted authenticated workflow.
- Worker tests cover signed internal request creation and settlement behavior.
- Playwright E2E uses the Docker/local app stack to cover login through Mock-payment completion.
- CI runs generated-contract validation, lint, typecheck, unit/integration tests, E2E, production builds, Docker Compose config validation and a documented deployment artifact check.

## Deployment and Evidence

Docker Compose is the reproducible local production deployment. A GitHub Actions workflow builds and publishes only when repository secrets for a container registry exist; otherwise it still verifies images locally in CI. Repository docs include startup, environment, API documentation URL, screenshots, a scripted demo recording command, and a deployment checklist. A public URL is recorded only after valid hosting credentials are supplied; no fabricated public deployment is acceptable.

## Acceptance Definition

The project is resume-ready when the root quality gate is green, Docker Compose starts API/worker/web/PostgreSQL/Redis from a fresh clone, the browser completes the documented authenticated Mock payment flow, ownership tests reject cross-user access, and the repository contains current architecture/runbook/test/evidence documentation.
