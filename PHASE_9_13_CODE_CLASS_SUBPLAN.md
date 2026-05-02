# Phase 9.13 - Code: Class

## Status

In progress.

## Objective

Build Class authoring on the accepted Phase 9 stack: REST through `apps/apis`, draft sidecar persistence, route-loader create/edit pages, frozen detail routes, shared authored list UI, and the generic node-driven TanStack renderer.

Base Classes and Subclasses are separate authored `CLASS` records. They share `/classes/new`, `/classes/$classId/edit`, and `CLASS_NODE_MAP`; the form `category` field drives base-only and subclass-only visibility.

## Architecture Decisions

- `/classes/new` is the only create route. Category belongs to form state, not the URL.
- `/classes/$classId` redirects to `/classes/$classId/edit` until detail pages have a Figma-backed read-only design.
- The stale Phase 8 inline subclass drawer pattern is not canonical for Phase 9.
- Draft and incomplete Class work stays in `authored_subject_drafts`; normalized Class tables are written only on activation.
- `CLASS_NODE_MAP` owns steps, sections, fields, groups, visibility, required state, options, and hidden clearing.

## Surface Set

- class list route
- class create route
- class edit/read-only authoring route
- draft save/resume/discard/activate
- locked-master duplicate-to-draft
- category filters for Base Class and Subclass

## Node-Driven Form Steps

1. Basics
2. Class Details
3. Equipment
4. Spellcasting
5. Advancement

Base-only fields include starting gold, starting equipment, hit points, and multiclass data. Subclass-only fields include parent class and specializations. Shared fields include details, proficiencies, spellcasting, resources, and features.

## Transport

- `GET /content/classes`
- `GET /content/classes/:id`
- `GET /content/classes/:id/draft`
- `POST /content/classes/draft`
- `DELETE /content/classes/:id/draft`
- `POST /content/classes/:id/draft/activate`
- `POST /content/classes`

Class activation normalizes through `normalizeNodeRuntimeValues({ mapId: 'class' })`, validates against strict active Class DTOs, writes through `createClassSubjectAuthoringService`, and discards successful drafts.

## Exit Criteria

- Class list, create, edit, draft, activation, locked-master read-only, and duplicate-to-draft work through the shared Phase 9 architecture.
- Base Class and Subclass are category-driven records in the same authoring flow.
- No active detail page is introduced.
- No local web option lists are added.
- Focused tests, Storybook, build gates, and an impeccable audit pass before PR.
