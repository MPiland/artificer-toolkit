# Web workspace

`apps/web` is the TanStack Start frontend. It owns route composition, authenticated application shells, the Authoring Workspace UI, and the character Builder and Sheet surfaces.

## Owns and does not own

- Owns `src/routes`, route loaders, query/mutation adapters in `src/data`, the typed transport adapter in `src/lib/api.ts`, and shared UI/forms composition.
- `src/server/trpc.ts` is the frontend/server adapter: it checks same-origin requests, reads Supabase claims, and forwards an authenticated context to `apps/apis`.
- Does not own product-data rules, persistence, node-map resolution, or engine calculations. Those remain behind the [`apps/apis` seam](../apis/README.md) and the shared packages.
- Character Builder is intentionally a domain workflow distinct from node-map-driven content authoring; it may reuse form primitives without becoming another node-map.

## Key flow

Routes call a `src/data` query or mutation adapter. The adapter uses `src/lib/api.ts`, which sends tRPC requests and parses responses with shared Zod DTOs. TanStack Query owns cache and invalidation; route components render the resulting DTOs through domain presenters and form/layout components.

For authoring, the flow is route → node-runtime DTO → `AuthoringFormLayout`/`FormRenderer` → TanStack Form state. Group presentation is supplied explicitly by the resolved node map: simple content stays inline, deep branches use the structure rail, and staged leaf collections use the shared overlay drawer. For characters, Builder draft/resolve/preview/commit and Sheet commands stay in character-specific adapters and routes.

## Invariants

- `apps/apis` is the only product-data boundary; do not add direct database or Supabase data writes to browser features.
- The `packages/db/types` dependency is type-only Supabase client metadata, not a product-data read/write path.
- Use focused exports from `packages/schema` and `packages/shared`; do not invent local DTO shapes.
- Keep detail/read routes separate from `/edit` authoring routes and keep Builder state separate from Sheet play-state commands.
- Public-registration behavior comes from the server-owned `PUBLIC_SIGN_UP_ENABLED` flag. The root loader exposes only its parsed boolean to routes; the sign-up server function rechecks it before calling Supabase Auth.
- Library import remains hidden unless the server-owned `LIBRARY_IMPORT_ENABLED` flag is exactly `true`. Disabled direct-route requests return to the authenticated Home surface.
- `auth/confirmed` verifies Supabase invitation tokens and redirects invitees to password setup. Authenticated invite sessions remain limited to that setup until completion is recorded in auth metadata. Every auth-user insert creates its private profile automatically; username remains optional profile data and is not part of account creation or sign-in. Password reset and ordinary email-confirmation routes remain independent of the public-registration flag.

## Focused validation

Use the cheapest surface that covers the change: `yarn workspace @artificer-toolkit/web test:forms`, `test:authoring`, or a focused route test; use `yarn turbo:typecheck:web` for type changes. Use `yarn dev` plus browser verification for meaningful layout or interaction changes. The root `yarn dev` first rebuilds the API workspace so the web server does not load stale `apps/apis/dist` artifacts; run `yarn dev:prepare` first when starting the web workspace directly.

## Netlify deployment

TanStack Start is deployed with `@netlify/vite-plugin-tanstack-start`, which packages SSR, server routes, and server functions for Netlify. The same project also deploys client-independent functions from the repository's root [`netlify/functions`](../../netlify/functions) directory. The workspace's [`netlify.toml`](netlify.toml) deliberately runs from the monorepo root so Yarn workspaces and Turbo build dependencies resolve correctly.

When creating the Netlify project, set the package directory to `apps/web` and leave the base directory at the repository root. The committed configuration runs `yarn build:web` and publishes `apps/web/dist/client`.

The committed edge function limits `/api/trpc/*` to 60 requests per 60 seconds per IP and domain so mixed tRPC batches cannot bypass it. The application rejects tRPC POST bodies over 1 MiB from their actual streamed bytes before authentication or JSON parsing, and Postgres enforces the durable per-account root-creation windows. Confirm the rate-limit rule appears in each production deploy log; Netlify may accept a deploy even when a rule is invalid.

Set these values in the Netlify UI rather than in `netlify.toml`:

- `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` for the browser and SSR Supabase client. They are publishable values, not secrets.
- `VITE_SENTRY_DSN` for production browser and server error reporting plus the opt-in feedback form. The DSN is a public client identifier, not a secret. Both runtimes use the same Sentry project because they ship as one TanStack Start deployment.
- `SENTRY_ORG=artificer-toolkit-rc` and `SENTRY_PROJECT=javascript-tanstackstart-react` for production source-map uploads during the build.
- `SENTRY_AUTH_TOKEN` for production source-map uploads. Keep it secret and available only to the build environment.
- `SUPABASE_URL` and `SUPABASE_SECRET_KEY` for server-only request authentication. They are required by the current server functions; make them available to Functions at runtime only.
- `RESEND_API_KEY`, `SEND_EMAIL_HOOK_SECRET`, `AUTH_EMAIL_FROM`, and the canonical public app origin as `SITE_URL` for the server-only Supabase Auth Send Email Hook in `netlify/functions`. These values must be available to Functions at runtime only.
- `DATABASE_CONNECTION_STRING` for database-backed server routes. Use Supabase's Transaction Pooler connection string for Netlify's transient serverless functions. Make it available during the build and to Functions at runtime.
- `PUBLIC_SIGN_UP_ENABLED=false` for closed alpha. Make it available during the build and to Functions at runtime.
- `LIBRARY_IMPORT_ENABLED=false` until the importer is ready for public use. Make it available during the build and to Functions at runtime.

Do not set `SUPABASE_SECRET_KEY`, `RESEND_API_KEY`, `SEND_EMAIL_HOOK_SECRET`, `SENTRY_AUTH_TOKEN`, or any database credential in a `VITE_` variable. These values must remain build or server secrets and must never reach browser code. Redeploy after changing an environment variable. Once the first production URL exists, add its `/auth/confirmed`, `/update-password`, and `/settings/account` paths to Supabase Auth's redirect URL allow list before sending invitations, password-recovery emails, or email-change confirmations.

## Canonical references

- [Architecture overview](../../docs/architecture/overview.md)
- [Transport and tRPC](../../docs/architecture/transport.md)
- [Authoring Schema](../../docs/architecture/authoring-schema.md)
- [Character Builder and Sheet](../../docs/architecture/character.md)
- [Product intent](../../PRODUCT.md) and [design system](../../DESIGN.md)
