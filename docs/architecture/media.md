# Media lifecycle and delivery

> **Status:** canonical
> **Scope:** image and restricted Campaign-file asset identity, processing, domain references, and private delivery
> **Update when:** asset profiles, lifecycle states, variants, storage provider, or attachment ownership changes
> **Verification:** `packages/schema/src/api/media.ts`, `packages/functions/src/services/media`, `packages/db/src/domains/subjects/repositories/media.ts`, and the Phase 02 media tests

## Boundary

Supabase Postgres owns asset metadata, storage-provider identity, and product references. Private Supabase Storage owns ordinary media bytes; private Cloudflare R2 owns new `VTT_MAP` originals, variants, and tiles. `apps/apis` is the control plane: it authorizes upload, completion, finalization, attachment, removal, and delivery. Web and later native clients may transfer bytes directly only through an exact, short-lived signed permission issued by that control plane.

```mermaid
flowchart LR
  Client["Web or native client"] -->|"upload intent, finalize, attach"| API["apps/apis media router"]
  API --> Service["packages/functions media service"]
  Service --> DB["media_assets and domain references"]
  Service --> SupabaseStorage["private Supabase media bucket"]
  Service --> R2["private R2 VTT map bucket"]
  Client -->|"signed ordinary-media transfer"| SupabaseStorage
  Client -->|"signed VTT multipart PUT / GET"| R2
```

Signed URLs and upload tokens are credentials, never persisted domain truth. Domain rows store stable asset IDs; asset and variant rows store opaque object keys.

## Current profiles

Phase 02 enables `ACCOUNT_AVATAR`, `CHARACTER_PORTRAIT`, and `AUTHORED_IMAGE`. Each accepted upload is normalized once and produces immutable source, display, and thumbnail variants. Account avatars, Character portraits, and authored artwork store normalized square thumbnail framing; authored detail pages and Character Sheet inspectors use the uncropped display variant. Originals are temporary and are removed after successful normalization. Clients cannot choose a bucket, object key, visibility, or output variant path.

Phase 06 adds `CAMPAIGN_FILE` and `CAMPAIGN_HANDOUT_MAP`. Campaign files accept normalized JPEG/PNG/WebP or strict UTF-8 `text/plain`, and handout maps accept normalized images only. Both remain private, limited to 6 MiB, and require fresh Campaign membership before attachment listing or signed delivery. Handout maps are ordinary Campaign assets and have no VTT behavior. PDF, office, archive, executable, SVG/HTML, resumable upload, and external malware-scanning support remain deferred rather than being represented as accepted safe formats.

Phase 08 adds `VTT_MAP` for Campaign owners. Maps are JPEG, PNG, or WebP up to 25 MiB, 8,192 px per side, and 64 MP. New maps use private R2 multipart upload with exact 6 MiB parts (at most five); the browser receives only part-specific two-hour URLs and returns exact ETags to the completion command. Finalization verifies the source dimensions, produces immutable display and thumbnail variants, and generates 1,024 px renderer tiles (at most 64) in the same persisted provider. Delivery returns five-minute signed overview and tile URLs only after current Campaign authorization. Existing Supabase-backed map rows remain readable through their persisted `storage_provider`; they are not copied during this cutover. A scene definition continues to reference the stable asset ID, and database triggers prevent deleting or changing an asset while any scene definition or Encounter snapshot references it.

`yarn test:vtt-map:integration` is the local proof for this seam. It creates disposable local Supabase Auth/Campaign fixtures and an in-process loopback R2 substitute, then exercises interrupted/resumed multipart upload, idempotent completion, finalization, signed delivery, scene reference protection, oversized-map rejection, and exact cleanup. It refuses non-loopback Supabase URLs and is never a managed-data operation.

## Lifecycle

```mermaid
stateDiagram-v2
  [*] --> PENDING_UPLOAD
  PENDING_UPLOAD --> PROCESSING: finalize claims object
  PROCESSING --> READY: verified variants committed
  PROCESSING --> REJECTED: validation or processing fails
  READY --> DELETED: unreferenced cleanup
  REJECTED --> DELETED: diagnostic retention expires
```

Only `READY` assets may be attached. Each upload intent persists its exact authorized target, so an avatar or portrait crop cannot be reused by another domain record. Finalization is idempotent, replacements use new immutable keys, and the last detached reference starts a 24-hour recovery grace period.

Object-store writes cannot share a transaction with Postgres. Every queued deletion therefore retains both `storage_provider` and `object_key` until its live metadata commits or that provider confirms removal. Queue entries mature for 15 minutes before cleanup may claim them so an in-flight upload cannot race the cleaner. Abandoned R2 multipart uploads are explicitly aborted when their pending asset is claimed; R2's default seven-day incomplete-upload lifecycle is only a fallback. Account deletion cascades media metadata and queues its object keys in the same database transaction as the Auth user deletion; scheduled cleanup removes those objects after the maturity window and retries when the selected provider is unavailable.

## Domain ownership

- `profiles.avatar_asset_id` owns the current account avatar reference.
- `characters.portrait_asset_id` owns Character presentation independently of Builder aggregate replacement.
- `authored_image_slots` owns one `DRAFT` and one `ACTIVE` artwork slot per authored route identity.
- `campaign_attachments` owns Campaign file and handout references, including uploader identity and optional Session or Campaign-note association.

Saving an authored draft initializes its draft slot from active artwork once. Editing artwork changes only the draft slot. Activation promotes that slot in the same transaction that replaces the active aggregate and removes the draft. Discarding a draft removes only its draft slot. This follows [ADR 0011](../adr/0011-active-authored-content-and-json-drafts.md); media does not recreate authored revision history.

## Security and portability

Declared filename, MIME type, and size are hints. Finalization verifies decoded type, byte size, dimensions, pixel count, animation state, and actual processed quota under the account lock before creating variants. Normalization applies orientation and removes metadata including EXIF/GPS. Private delivery reuses the owning domain's read authorization.

The transport contract contains verified dimensions, accessibility metadata, expiry, and a signed delivery URL without browser-specific types. Image purpose owns that accessibility metadata: current domain artwork is decorative, while future mechanical diagrams and maps require descriptions through their own purpose-specific controls. Native clients reuse the same control plane with platform-native pickers and progress UI.

R2 credentials are server-only: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and `R2_VTT_MAP_BUCKET`. `R2_S3_ENDPOINT` is used only by the local substitute or another explicitly selected S3-compatible endpoint. Browser uploads require bucket CORS to allow the application origins and `PUT`/`GET`, and to expose `ETag`. See the [VTT map R2 runbook](../runbooks/vtt-map-r2.md).
