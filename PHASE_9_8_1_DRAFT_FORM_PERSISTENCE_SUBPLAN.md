# Phase 9.8.1: Draft/Form Persistence Correction

## Status: Complete

## Objective

Lock the authored-content persistence model before continuing Race. TanStack Form owns local editor state, `apps/apis` owns transport, incomplete authored work is saved to a generic JSONB sidecar, and normalized domain tables are written only when a draft is activated into a complete record.

## Persistence Decisions

- `DRAFT` and edit-in-progress data live in `public.authored_subject_drafts`.
- `ACTIVE` data remains the normalized domain record used by lists, play, runtime reads, and copied content.
- Editing an active record creates or updates an owned draft sidecar while the last active version remains live.
- Activating a draft runs node-runtime normalization, hidden-value clearing, strict DTO validation, and normalized domain persistence.
- Successful activation deletes the matching draft sidecar.
- Version history and rollback are deferred until after MVP.
- GraphQL is deferred; REST through `apps/apis` remains the MVP transport baseline, with tRPC still later and adapter-backed.

## Implemented Model

- Added generic authored draft DTOs in `packages/schema`:
  - subject kind
  - subject id
  - user id
  - system id
  - label
  - draft status/state
  - payload
  - base active metadata
  - timestamps
- Added `public.authored_subject_drafts` with RLS policies for authenticated users to manage only their own drafts.
- Added a DB draft repository that can get, list, save, and delete owned draft sidecars.
- Added API helpers to merge owned drafts into authored list responses:
  - active rows with drafts show `status: DRAFT` and include draft metadata.
  - draft-only rows appear as owned draft list items.
  - master rows remain locked/view-copy only.
- Added REST route handlers for Spell, Background, and Feat draft get/save/discard/activate.
- Added web adapter methods:
  - `getDraft`
  - `saveDraft`
  - `discardDraft`
  - `activateDraft`
  - duplicate now creates an owned draft sidecar instead of immediately writing normalized rows.
- Updated Spell, Background, and Feat forms:
  - `Save Draft` writes only the sidecar.
  - `Activate` writes normalized rows through the existing strict domain save path.
  - active records with an edit draft show that the active version is unchanged until activation.

## UX Rules

- `Save Draft` is allowed before all active-required fields are complete.
- `Activate` validates the complete authored payload and does not modify the active record if validation fails.
- If a draft exists for an active record, edit routes load the draft first.
- Master/seed records remain locked from direct editing; duplicating creates an owned draft sidecar.
- Draft list rows use owned permissions, while locked master active rows do not show edit/delete actions.

## Validation Notes

- Manual review accepted the draft/form persistence correction and Race can resume on the sidecar model.
- `yarn build:schema`: passed.
- `yarn build:db`: passed.
- `yarn build:functions`: passed.
- `yarn build:apis`: passed.
- `yarn test:schema`: passed.
- `yarn vitest run apps/apis/src/routes/authoredContent.test.ts`: passed.
- `yarn workspace @artificer-toolkit/web test src/lib/api.test.ts`: passed.
- `yarn workspace @artificer-toolkit/web test`: passed.
- `yarn workspace @artificer-toolkit/web build-storybook`: passed with the existing Storybook/Vite chunk-size warning.
- `yarn build:web`: still blocked only by the documented legacy `apps/web/src/utils` alias/type failures, after active draft integration errors were fixed.
- `yarn test:db`: not green before closeout; failures are existing repository expectation drift around `status` and optional `undefined` fields across many domain tests, not the new draft sidecar repository path.

## Remaining Follow-Up

- Route deployment wiring must expose the new draft handlers wherever the REST host maps `apps/apis` route exports.
- Race and later domains should adopt the same draft sidecar pattern rather than writing incomplete normalized rows.
- A later MVP+ versioning pass can introduce authored subject versions if rollback becomes a real product requirement.
