# ADR 0012: Private media assets with domain-owned references

- **Status:** decision
- **Date:** 2026-08-05

> `VTT_MAP` byte storage is amended by [ADR 0028](0028-r2-vtt-map-storage.md). Stable asset identity and domain-owned references remain unchanged.

## Context

Account avatars, Character portraits, authored artwork, future Campaign files, Marketplace releases, and VTT maps need shared upload and delivery mechanics. Their authorization and lifecycle semantics belong to different product domains. Temporary signed URLs cannot serve as durable identity, and a generic polymorphic attachment row cannot enforce those domain relationships.

## Decision

Store stable asset and immutable variant metadata in Supabase Postgres and bytes in one private Supabase Storage bucket. `apps/apis` authorizes exact signed transfer permissions while `packages/functions` verifies, normalizes, attaches, and deletes assets through `packages/db` repositories.

Domain tables own real references: profiles own avatars, Characters own portraits, and authored route identities own explicit active/draft image slots. Authored activation promotes draft artwork transactionally under [ADR 0011](0011-active-authored-content-and-json-drafts.md). No authored revision or generic `owner_type + owner_id` model is introduced.

Phase 02 enables only image profiles required by current product surfaces. Campaign supporting files, public Marketplace derivatives, and resumable VTT maps extend the same identity later without prebuilding their scanners, permissions, or processing outputs.

## Consequences

- Direct byte transfer does not bypass product authorization because the API issues one short-lived permission for one generated key.
- Replacements and recrops create immutable objects, avoiding CDN and stale-reader ambiguity.
- Private delivery requires authorized URL refresh rather than storing public URLs.
- Object storage and database transactions cannot commit atomically, so every new key stays in a durable deletion queue until metadata commits or Storage confirms removal.
- The last detached reference starts a 24-hour recovery grace period. Auth-user deletion cascades owned media metadata and queues object deletion transactionally; scheduled cleanup retries unavailable Storage.
- Moving object storage later requires copying objects and updating stored keys, not changing Character or authored-content identities.
