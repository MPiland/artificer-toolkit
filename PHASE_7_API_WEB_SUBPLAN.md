# Phase 7: API Transport Stabilization

## Objective

Connect the API transport layer to the stabilized domain, schema, DB, server, and engine layers. Add real input validation, error handling, and response shaping. Keep the API thin and replaceable by a future tRPC transport.

## Key Framing

Validation is owned entirely by this phase. `packages/schema` (Phase 3) defines the Zod schemas. `apps/apis` (Phase 7) applies them. The current route stubs have no validation at all — every request passes through unchecked. That changes here.

## Prerequisite

Phase 7 cannot begin until Phase 5 is complete. Route handlers delegate to Phase 5 services — those services must exist before the routes can be wired.

## Tasks

### 1. Apply Zod Validation to All Request Bodies

Every route handler must parse its incoming request body against the relevant `packages/schema` Zod DTO before calling any service.

- If validation fails: return a structured 400 response with the Zod error details
- If validation passes: pass the typed, validated object to the Phase 5 service

This ensures malformed inputs are rejected at the API boundary before they reach domain or persistence logic.

### 2. Validate Response Shapes

Before returning responses to clients, validate them against the response DTO schema. This catches service or compiler output drift early rather than silently sending malformed data.

### 3. Add Structured Error Handling

Replace implicit throw-on-error behavior with explicit structured error responses:

- `400` — validation error (malformed input, schema parse failure)
- `404` — entity not found
- `500` — internal failure (compiler error, DB error, unexpected exception)

Each error response should include enough context for clients to display meaningful feedback.

### 4. Keep Route Handlers Thin

Route handlers must only:

1. Parse and validate the request (Zod)
2. Call the Phase 5 service
3. Return the response

No domain logic, no direct DB access, no compiler calls belong in route handlers.

### 5. Future tRPC Compatibility

Keep the API surface compatible with a future tRPC replacement:

- All service boundaries should be callable from tRPC procedures using the same signatures
- Do not embed transport-specific assumptions (e.g. raw `Request`/`Response` shapes) inside service logic

## Deliverables

- Validated route handlers for all subject endpoints (race, class, spell, feat, equipment, background)
- Structured error handling across all routes
- Stable backend contract notes for the Phase 8 frontend rewrite
- Transport compatibility notes for future tRPC adoption

## Exit Criteria

- All routes validate request bodies using `packages/schema` Zod schemas
- All routes return structured error responses for validation, not-found, and internal failure cases
- Route handlers delegate to Phase 5 services — no domain logic in handlers
- `apps/apis` typechecks cleanly
- Phase 8 frontend rewrite can begin against these stable contracts
