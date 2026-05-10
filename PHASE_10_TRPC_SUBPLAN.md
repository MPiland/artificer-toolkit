# Phase 10 - tRPC Transport Cutover

## Status: Full Cutover In Progress

## Summary

Phase 10 replaces the active frontend REST transport with one tRPC surface mounted at same-origin `/api/trpc`. `apps/apis` remains the product-data boundary for `apps/web`; the frontend adapter keeps the existing `api.content.spells.list()` style call surface while routing product-data calls through tRPC procedures.

The security goal is explicit: Supabase auth material may live in Supabase cookies/session internals, but the app must not echo access tokens, refresh tokens, bearer headers, or credentials into TanStack route context, rendered HTML, URLs, logs, or query-cache payloads.

## Locked Decisions

- `apps/apis` owns the transport/domain boundary.
- `apps/web` does not import DB/functions directly for product data.
- The browser adapter does not read `supabase.auth.getSession()` or attach `Authorization` headers.
- The same-origin `/api/trpc` handler derives auth server-side from Supabase SSR cookies.
- TanStack router context contains `queryClient` and `user`, not access tokens.
- REST is no longer the active frontend product-data transport after this cutover.

## Procedure Surface

Canonical procedure namespaces:

- `systems.list`, `systems.get`
- `content.{spells,backgrounds,feats,races,equipment,creatures,vehicles,classes}.{list,get,getDraft,saveDraft,discardDraft,activateDraft,activate,duplicate,upsert}`
- `content.features.{list,get,upsert}`
- `characters.{list,draft,get,getDraft,saveDraft,discardDraft,sheet,resolve,previewSave,upsert,history,command}`
- `nodeRuntime.{resolve,normalizeValues}`

## Implementation Notes

- The initial tRPC router delegates into the existing `apps/apis/src/routes/*` handlers to preserve schema validation, error mapping, repository usage, and `withUserContext` behavior while removing token serialization from the web app.
- The web adapter uses tRPC client calls to `/api/trpc`; server-side loader fetches forward the incoming cookie header instead of passing bearer tokens through route context.
- DTO schemas in `packages/schema` remain the input/output validation boundary.

## Exit Criteria

- No active frontend product-data calls use REST.
- Route context and server-session payloads do not include access-token fields.
- Focused unit coverage proves the adapter does not serialize `Authorization` or bearer token material.
- App smoke coverage verifies `/home`, authored list/detail/create-edit routes, and character sheet commands through the tRPC transport.
