# Phase 9.12 - Code: Vehicle

## Status

Implemented - ready for PR review.

## Objective

Build Vehicle as the next Phase 9 authored domain on the accepted stack: REST through `apps/apis`, draft sidecar persistence, route-loader-driven create/edit pages, shared authored list/form UI, and the generic node-driven TanStack renderer.

Vehicle is one shared authoring flow for land, water, air, and spelljammer records. Do not split Vehicle into category-specific forms in this tranche.

## Current Architecture Rules

- Detail pages are frozen until a Figma-backed read-only design exists.
- Active routes are `/vehicles`, `/vehicles/new`, and `/vehicles/$vehicleId/edit`.
- Direct `/vehicles/$vehicleId` redirects to `/vehicles/$vehicleId/edit`.
- Draft and incomplete Vehicle work lives in `authored_subject_drafts`.
- Normalized Vehicle rows are written only when a draft is activated or an authored record is activated directly.
- The frontend renders the backend-resolved `steps -> sections -> nodes` model through `createAuthoringFormRenderer`.
- No Vehicle-specific reference-data loader should be added for node-map field options.

## Implementation Tracks

1. Update Vehicle schema/API contracts so authoring input allows optional `userId`, while server activation normalizes identity from auth.
2. Bring `apps/apis/src/routes/vehicles.ts` to parity with Equipment/Creature draft endpoints, list-with-drafts, route/body mismatch checks, node-runtime normalization, and draft discard on activation.
3. Align `VEHICLE_NODE_MAP` with the node-driven renderer: stable steps/sections, rich text description/detail fields, shared category options, shared currency-backed cost map, and group metadata for details, cost, properties, and features.
4. Add `apps/web/src/data/vehicles` query/mutation/list-mapper adapters using `queryKeys.content.vehicles`.
5. Add `apps/web/src/domains/vehicles` using the Equipment folder pattern: `pages`, `components`, `stories`, `tests`, fixtures, and utils.
6. Add active Vehicle routes and navigation only after the list route is live.

## Acceptance Criteria

- Vehicle list merges active rows with owned drafts.
- Vehicle create requires a real system id from `systems.list`; no blank `systemId` or `userId` placeholders.
- Vehicle edit prefers a valid draft over active data and shows invalid-draft recovery when needed.
- Locked/master Vehicles render through the edit route as read-only with duplicate-to-draft.
- List row click/view and edit both navigate to `/vehicles/$vehicleId/edit`.
- Direct `/vehicles/$vehicleId` redirects to `/vehicles/$vehicleId/edit`.
- Activation runs `normalizeNodeRuntimeValues({ mapId: 'vehicle' })` before persistence.

## Validation

- API tests cover Vehicle draft save/get/discard/activate, route/body id mismatch rejection, server-owned identity, malformed body validation, list draft merging, and activation normalization.
- Runtime/shared tests cover Vehicle steps, rich text fields, category/size/currency options, group metadata, and hidden clear paths.
- Web tests cover Vehicle list mapping, create/edit route behavior, invalid draft fallback, locked-master duplicate, and group add/edit/remove through the renderer.
- Storybook covers Vehicle list states, create form, edit form, locked-master read-only form, grouped sections, invalid draft alert, and empty/error states.
- Closeout includes focused tests, targeted lint, build gates, Storybook, and an impeccable audit/critique/polish pass.
