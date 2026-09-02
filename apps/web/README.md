# Web workspace

`apps/web` is the TanStack Start frontend. It owns route composition, authenticated application shells, the Authoring Workspace UI, and the character Builder and Sheet surfaces.

## Owns and does not own

- Owns `src/routes`, route loaders, query/mutation adapters in `src/data`, the typed transport composition seam in `src/lib/api.ts` with domain owners in `src/lib/api/`, and shared UI/forms composition.
- `src/server/trpc.ts` is the frontend/server adapter: it checks same-origin requests, reads Supabase claims, and forwards an authenticated context to `apps/apis`.
- Does not own product-data rules, persistence, node-map resolution, or engine calculations. Those remain behind the [`apps/apis` seam](../apis/README.md) and the shared packages.
- Character Builder is intentionally a domain workflow distinct from node-map-driven content authoring; it may reuse form primitives without becoming another node-map.

## Key flow

Routes call a `src/data` query or mutation adapter. The adapter uses the `src/lib/api.ts` composition seam; `src/lib/api/transport.ts` sends tRPC requests and domain API modules parse responses with shared Zod DTOs. TanStack Query owns cache and invalidation; route components render the resulting DTOs through domain presenters and form/layout components.

For authoring, the flow is route → node-runtime DTO → `AuthoringFormLayout`/`FormRenderer` → TanStack Form state. Group presentation is supplied explicitly by the resolved node map: simple content stays inline, deep branches use the structure rail, and staged leaf collections use the shared overlay drawer. For characters, Builder draft/resolve/preview/commit and Sheet commands stay in character-specific adapters and routes.

## Invariants

- `apps/apis` is the only product-data boundary; do not add direct database or Supabase data writes to browser features.
- SSR loaders must create and pass a request-scoped API with `createServerApi()`. Never use the browser module singleton during SSR: its tRPC batch queue would combine operations from different authenticated requests under one cookie context.
- The `packages/db/types` dependency is type-only Supabase client metadata, not a product-data read/write path.
- Use focused exports from `packages/schema` and `packages/shared`; do not invent local DTO shapes.
- Keep detail/read routes separate from `/edit` authoring routes and keep Builder state separate from Sheet play-state commands.
- Public-registration behavior comes from the server-owned `PUBLIC_SIGN_UP_ENABLED` flag. The root loader exposes only its parsed boolean to routes; the sign-up server function rechecks it before calling Supabase Auth.
- Library import remains hidden unless the server-owned `LIBRARY_IMPORT_ENABLED` flag is exactly `true`. Disabled direct-route requests return to the authenticated Home surface.
- Supabase Postgres owns product-notification feed engagement and channel preferences. Authenticated notification APIs resolve only the caller; private Realtime messages invalidate cached state but never replace the authoritative API read. Notification links contain public source IDs and always reauthorize through the owning Social or Campaign API.
- `auth/confirmed` verifies Supabase invitation tokens and redirects invitees to account setup. Authenticated invite sessions remain limited to that setup until a unique username and password are recorded and completion is marked in auth metadata. Public signup also requires a username. Sign-in accepts either the private account email directly or the username through the same-origin API without exposing the associated email; production username sign-in requires Supabase IP Address Forwarding to be enabled. Password reset and ordinary email-confirmation routes remain independent of the public-registration flag.

## Focused validation

Use the cheapest surface that covers the change: `yarn workspace @artificer-toolkit/web test:forms`, `test:authoring`, or a focused route test; use `yarn turbo:typecheck:web` for type changes. Use `yarn dev` plus browser verification for meaningful layout or interaction changes. The root `yarn dev` first rebuilds the API workspace so the web server does not load stale `apps/apis/dist` artifacts; run `yarn dev:prepare` first when starting the web workspace directly.

TanStack Start's Vite plugin owns `src/routeTree.gen.ts` during development and builds. Do not run a separate route generator or edit the generated file manually.

## Netlify deployment

TanStack Start is deployed with `@netlify/vite-plugin-tanstack-start`, which packages SSR, server routes, and server functions for Netlify. The same project also deploys client-independent functions from the repository's root [`netlify/functions`](../../netlify/functions) directory. The workspace's [`netlify.toml`](netlify.toml) deliberately runs from the monorepo root so Yarn workspaces and Turbo build dependencies resolve correctly.

When creating the Netlify project, set the package directory to `apps/web` and leave the base directory at the repository root. The committed configuration runs `yarn build:web` and publishes `apps/web/dist/client`.

Production releases must be built by Netlify from the connected Git repository on Linux. Do not use a Windows `netlify deploy` artifact for this application: the server and live-session executor depend on GoRules' platform-native binding, and Windows manual packaging also preserves unusable absolute workspace symlinks. A local Windows build remains useful for validation, but pushing the reviewed source and allowing Netlify's Linux build to package all four functions is the release path.

The committed edge function limits `/api/trpc/*` to 60 requests per 60 seconds per IP and domain so mixed tRPC batches cannot bypass it. The application rejects tRPC POST bodies over 1 MiB from their actual streamed bytes before authentication or JSON parsing, and Postgres enforces the durable per-account root-creation windows. Confirm the rate-limit rule appears in each production deploy log; Netlify may accept a deploy even when a rule is invalid.

Set these values in the Netlify UI rather than in `netlify.toml`:

- `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` for the browser and SSR Supabase client. They are publishable values, not secrets.
- `VITE_SENTRY_DSN` for production browser and server error reporting plus the opt-in feedback form. The DSN is a public client identifier, not a secret. Both runtimes use the same Sentry project because they ship as one TanStack Start deployment. Sentry callbacks remove URL queries, fragments, and referrers before transmission; the app also sends only the request origin in browser referrers. Product Campaign invitations are tokenless inbox records and never enter URLs.
- `SENTRY_ORG=artificer-toolkit-rc` and `SENTRY_PROJECT=javascript-tanstackstart-react` for production source-map uploads during the build.
- `SENTRY_AUTH_TOKEN` for production source-map uploads. Keep it secret and available only to the build environment.
- `SUPABASE_URL` and `SUPABASE_SECRET_KEY` for server-only request authentication. They are required by the current server functions; make them available to Functions at runtime only. The application reads that exact secret-key name and does not fall back to `SUPABASE_SERVICE_ROLE_KEY`.
- `RESEND_API_KEY`, `SEND_EMAIL_HOOK_SECRET`, `AUTH_EMAIL_FROM`, and the canonical public app origin as `SITE_URL` for the server-only Supabase Auth Send Email Hook in `netlify/functions`. These values must be available to Functions at runtime only.
- `DATABASE_CONNECTION_STRING` for database-backed server routes. Use Supabase's Transaction Pooler connection string for Netlify's transient serverless functions. Make it available during the build and to Functions at runtime.
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and `R2_VTT_MAP_BUCKET` for private VTT map multipart upload, processing, and delivery. Use separate bucket-scoped values for staging and production; see [`docs/runbooks/vtt-map-r2.md`](../../docs/runbooks/vtt-map-r2.md).
- `PUBLIC_SIGN_UP_ENABLED=false` for closed alpha. Make it available during the build and to Functions at runtime.
- `LIBRARY_IMPORT_ENABLED=false` until the importer is ready for public use. Make it available during the build and to Functions at runtime.

Do not set `SUPABASE_SECRET_KEY`, any `R2_*` credential, `RESEND_API_KEY`, `SEND_EMAIL_HOOK_SECRET`, `SENTRY_AUTH_TOKEN`, or any database credential in a `VITE_` variable. These values must remain build or server secrets and must never reach browser code. Redeploy after changing an environment variable. Once the first production URL exists, add its `/auth/confirmed`, `/update-password`, and `/settings/account` paths to Supabase Auth's redirect URL allow list before sending invitations, password-recovery emails, or email-change confirmations.

## Canonical references

- [Architecture overview](../../docs/architecture/overview.md)
- [Transport and tRPC](../../docs/architecture/transport.md)
- [Authoring Schema](../../docs/architecture/authoring-schema.md)
- [Character Builder and Sheet](../../docs/architecture/character.md)
- [Product intent](../../PRODUCT.md) and [design system](../../DESIGN.md)
