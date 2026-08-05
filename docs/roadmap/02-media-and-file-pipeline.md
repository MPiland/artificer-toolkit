# Phase 02 — Media and supporting-file pipeline

> **Status:** planned
> **Depends on:** the current authenticated API baseline
> **Consumed by:** [Phase 03](03-campaign-core.md) for Campaign branding, [Phase 05](05-live-campaign-play.md) for Campaign files, [Phase 07](07-vtt.md) for VTT maps, and [Phase 10](10-cross-platform-foundation.md) for native upload and display surfaces
> **Unlocks:** Character portraits, authored-content artwork, Campaign branding and files, Marketplace release assets, and VTT maps
> **Primary ADRs:** [0001 package boundaries](../adr/0001-package-boundaries.md), [0006 Builder/Sheet boundary](../adr/0006-character-builder-sheet-boundary.md), [0011 active authored content and JSON drafts](../adr/0011-active-authored-content-and-json-drafts.md)

## Goal

Create one authorized upload, processing, association, delivery, and deletion pipeline for user-provided images and supporting files. The first image consumers are account avatars, Characters, user-authored content, and Campaign logos. Each Character or authored-content image uses one source asset plus normalized, user-selected thumbnail crop metadata; server-generated variants derive from that source. Marketplace assets and larger VTT maps reuse the same foundation through purpose-specific profiles rather than building separate upload systems.

This phase establishes the pipeline, portable contracts, and first web surfaces. [Phase 10](10-cross-platform-foundation.md) later displays the same assets in native and adds native upload controls only for editing experiences included in the mobile release; complex authored-content administration remains web-first.

## Assumptions

- A Character or authored-content revision references at most one source image. Its optional thumbnail crop is a normalized rectangle within that source, not a second upload.
- Initially only the Character Sheet header renders a generated thumbnail. Other Character and authored-content surfaces may retain the source and crop metadata without rendering it until their owning phase.
- Exact byte limits, image dimensions, attachment quotas, retention periods, and allowed supporting-file types remain product decisions. They are centrally configured per asset profile rather than scattered across clients.
- Original uploads are private by default. Public visibility is an explicit property of a published resource or listing, not a property inferred from its Storage path.
- Campaign supporting files initially serve downloadable handouts and references. VTT maps use a separate larger-file profile and are completed in [Phase 07](07-vtt.md).
- Supporting files do not include executables, archives, scripts, or other active content in the first release. Initial allowed types should be a small allowlist such as safe images, PDF, and plain text after the phase subplan confirms product need and scanning support.
- The existing local `50MiB` Supabase Storage setting is an infrastructure ceiling, not an accepted product limit for every upload type.

## Current starting point

- Supabase Storage is enabled with a local global `50MiB` ceiling, but no product-level asset profiles or quotas are defined.
- The database bootstrap creates an `avatars` bucket and stores an account-level `profiles.avatar_url`; this is not a Character portrait or general product-asset model.
- No current app/API flow owns upload intent, finalization, verified metadata, processing state, domain attachment, signed delivery, or orphan cleanup.
- No Storage policies for Character, authored root, Campaign, Marketplace, or VTT asset access are present in the current owning database sources.

Verify these statements against the phase branch before selecting migrations, buckets, or libraries.

## Requirements

### Asset purposes and ownership

Define centrally validated profiles for at least:

| Profile                  | Owner/reference                                  | Initial purpose                                                                          |
| ------------------------ | ------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `ACCOUNT_AVATAR`         | Account profile                                  | One private source image and generated account-menu/profile variants                     |
| `CHARACTER_PORTRAIT`     | Character                                        | One source image and crop-derived variants; initially rendered in the Sheet header       |
| `AUTHORED_IMAGE`         | Owned authored root or draft subject             | One source image and crop-derived variants reserved for owning authored-content surfaces |
| `CAMPAIGN_LOGO`          | Campaign                                         | Compact Campaign identity and roster/list surfaces                                       |
| `CAMPAIGN_ATTACHMENT`    | Campaign, optionally linked to a session or note | Size-limited supporting file or handout                                                  |
| `CAMPAIGN_HANDOUT_MAP`   | Campaign                                         | Downloadable/viewable map reference that is not a VTT scene map                          |
| `MARKETPLACE_PREVIEW`    | Package draft or immutable release               | Catalog and release preview media                                                        |
| `MARKETPLACE_SUPPLEMENT` | Package draft or immutable release               | Licensed supplemental downloads                                                          |
| `VTT_MAP`                | Encounter scene                                  | Larger map input with separate size, dimension, quota, transfer, and optimization rules  |

- A profile defines allowed verified media types, maximum bytes, image pixel/dimension limits, transfer method, required processing, generated variants, quota accounting, and delivery behavior.
- Clients submit the intended profile and domain target. They never choose an arbitrary bucket, object path, public visibility, or authorization policy.
- Phase 02 adds the account-avatar control to Profile Settings. Account avatars remain separate from Character portraits, and account deletion removes their owned source and variants through the asset lifecycle.
- Character portraits are mutable Character presentation metadata outside structural `CharacterAuthored` intent. Builder replacement writes must not delete the source asset or its crop metadata.
- Authored drafts may stage a ready image reference. Activation binds that image and crop metadata to the canonical active root; a later activation may replace it. Immutable Campaign content versions and Marketplace releases pin any asset they must retain independently.
- Thumbnail crop metadata uses normalized source-image coordinates so server and platform adapters derive the same framing at any output size. The crop must remain inside the source bounds after image orientation is normalized.
- Thumbnail, display, and other approved server variants derive from the one source image. Clients never upload an independently edited thumbnail as a second source of truth.
- Campaign logos, handouts, and attachments are Campaign-owned and remain outside `CharacterAuthored`.
- Marketplace releases and VTT scenes reference existing ready assets by ID; they do not duplicate bytes or invent another asset lifecycle.

### Upload, processing, and delivery

- Web requests a short-lived upload intent through `apps/apis`; Phase 10 native uses the same contract. Authorization and quota checks run before the API returns an opaque object key and signed upload permission.
- The client transfers bytes directly to a private Supabase Storage bucket, then calls a finalize procedure. Product bytes do not proxy through the tRPC server.
- The API owns asset metadata and lifecycle. Store stable asset IDs and object keys, never temporary signed URLs, as domain truth.
- Finalization verifies that the object exists and matches the approved intent before it becomes available.
- Do not trust the extension or client-declared MIME type. Verify actual file type, byte size, image dimensions/pixel count, and profile-specific constraints server-side.
- Normalize accepted images, remove embedded metadata including EXIF/GPS, reject decompression bombs, and produce only the variants required by the profile.
- Keep supporting files unavailable while required malware scanning or safety validation is incomplete. Unsafe or unverifiable files are rejected without becoming downloadable to Campaign members.
- Return authorized downloads or short-lived signed URLs through the API. Signed URLs are delivery credentials, not durable application data.
- Use immutable object keys for replacements. Do not overwrite an existing path and depend on CDN invalidation.
- Standard uploads are sufficient for small profiles. Use Supabase resumable uploads for profiles whose permitted sizes make interruption likely, especially `VTT_MAP`.

### Lifecycle, references, and deletion

Use an explicit lifecycle equivalent to:

`PENDING_UPLOAD → PROCESSING → READY | REJECTED → DELETED`

- Only `READY` assets may be attached to a visible product resource.
- A finalize retry is idempotent, and concurrent replacements cannot attach a half-processed object.
- Domain tables own references to assets through real foreign keys or explicit join records. Do not create an unenforced polymorphic `owner_type + owner_id` as the only integrity boundary.
- Replacing or removing an image detaches the old reference; physical deletion occurs only after the asset is unreferenced and a configured recovery grace period has elapsed.
- Assets referenced by immutable Campaign content versions, Marketplace releases, licenses, or replayable Encounter records cannot be silently mutated or deleted.
- Account deletion, moderation takedown, legal removal, Campaign deletion, and abandoned upload cleanup each have explicit reference and retention behavior.

### Authorization and visibility

- Product authorization is enforced in `packages/functions` and mirrored by least-privilege Storage RLS. A signed intent never grants access outside one approved object key and purpose.
- The service role remains server-only. Web and native never receive it.
- Character portrait access follows Character/Sheet visibility and any authorized Campaign or Encounter projection that exposes the portrait.
- Campaign asset mutation requires an explicit Campaign capability. Removed members immediately lose private attachment and handout access.
- An authored or Campaign image becomes publicly readable only when a separately authorized public resource requires it. Private originals remain private even when a safe derivative is public.
- Original filenames are display metadata only. Object keys are generated, opaque, and safe for Storage.
- Download responses use safe content disposition. Unsupported or active content is never rendered inline.

## Design

```mermaid
sequenceDiagram
  participant Client as Web or native client
  participant API as apps/apis
  participant Service as packages/functions
  participant DB as Asset metadata repository
  participant Storage as Private Supabase Storage

  Client->>API: Request upload intent(profile, target, declared metadata)
  API->>Service: Authorize target + enforce profile/quota
  Service->>DB: Create PENDING_UPLOAD asset + opaque object key
  Service-->>Client: Short-lived signed upload permission
  Client->>Storage: Upload bytes directly
  Client->>API: Finalize asset(asset ID)
  API->>Service: Verify object + inspect/process/scan
  Service->>DB: Mark READY or REJECTED
  Client->>API: Attach READY asset to domain record
  API->>Service: Authorize reference mutation
  Service->>DB: Commit asset reference
```

The signed transfer keeps large bytes out of the application server while preserving the existing product boundary: the API decides who may upload, where the object belongs, when it is safe, and which domain record may reference it.

```mermaid
flowchart TD
  Asset["Asset record<br/>profile, object key, status, verified metadata"]
  Asset --> Portrait["Character portrait reference"]
  Asset --> Authored["Authored root or draft asset slot"]
  Asset --> Campaign["Campaign logo"]
  Asset --> Attachment["Campaign attachment"]
  Asset --> Release["Marketplace release manifest"]
  Asset --> Scene["VTT scene map reference"]
```

The asset record owns storage and processing facts. Each product domain owns the relationship and visibility semantics. This prevents a generic upload table from becoming the authorization source for every feature.

## Package and client seams

- `packages/schema` owns asset-profile identifiers, upload-intent/finalize DTOs, ready-asset metadata, normalized crop metadata, and domain-specific attachment DTOs.
- `packages/functions` authorizes upload targets, resolves profiles and quotas, orchestrates finalization, and attaches ready assets.
- `packages/db` persists asset metadata, lifecycle, references, and cleanup queries. Storage objects are manipulated through the Storage API, not by editing `storage.objects` rows directly.
- `apps/apis` exposes thin intent, finalize, attach, detach, download, and listing procedures.
- `packages/shared` contains only pure profile-independent value types or image-placement semantics genuinely shared by rules/scene code; it does not own file I/O.
- `apps/web` owns browser selection, progress, crop/preview, replacement, validation messages, and attachment management. Initially only the Character Sheet header consumes the generated thumbnail.
- Phase 10 `apps/mobile` uses native pickers and native progress/error states for the upload surfaces included in its release. Native authored-content administration remains deferred.

The phase subplan should evaluate the smallest suitable tools rather than locking dependencies now: browser file APIs for web, Expo image/document pickers for native, Supabase signed/resumable uploads, server-side byte-type inspection, and either Supabase image transformations or server-side image normalization after verifying metadata, cost, deployment, and privacy behavior.

## Ordered workstreams

1. **Lock profile policy.** Decide allowed types, product byte/dimension limits, variants, per-user/Campaign quotas, filenames, visibility, retention, and which first-release surfaces accept uploads.
2. **Define asset contracts and lifecycle.** Add profile-discriminated DTOs, statuses, verified metadata, idempotency, and domain-specific reference rules.
3. **Add private Storage configuration and RLS.** Create least-privilege bucket policies and generated object-key conventions; keep service credentials server-only.
4. **Add persistence and upload orchestration.** Implement asset records, signed intent, direct upload, finalize, ready/rejected transitions, authorized download, and abandoned-upload cleanup.
5. **Add image safety, crop metadata, and variants.** Verify content bytes and dimensions, normalize orientation, remove metadata, validate the normalized user-selected thumbnail crop, reject unsafe images, and derive the exact approved variants from the one source asset.
6. **Add supporting-file safety.** Implement the smallest viable scanning/finalization path for the initial allowlist, quarantine until completion, and force downloads for formats not approved for inline viewing.
7. **Add the first domain references and web surfaces.** Ship Character and authored-content source-image upload/replacement/removal, normalized thumbnail-crop selection, and Campaign logo management using shared pipeline procedures. Render the generated Character thumbnail only in the Character Sheet header initially.
8. **Add Campaign attachments in Phase 05.** Reuse the ready-asset and download flow for size-limited handouts and supporting files rather than extending Phase 02 with Campaign collaboration behavior.
9. **Prepare native consumption.** Keep DTOs and delivery platform-neutral, provide contract fixtures, and leave native rendering and pickers to Phase 10.
10. **Validate security, integrity, and cost controls.** Test RLS/API matrices, forged targets, oversized and spoofed files, image bombs, metadata removal, scanning failure, stale signed URLs, concurrent replacement, orphan cleanup, quota enforcement, and egress-sensitive delivery.

## Acceptance gates

- A user can upload, crop, replace, view, and remove a Character portrait without changing the account avatar or structural character intent.
- A Character or owned authored draft stores one source image plus valid normalized thumbnail crop metadata; server variants reproduce the selected framing without a separately uploaded thumbnail.
- Activating a later authored draft does not mutate an asset pinned by an existing immutable Campaign content version or Marketplace release.
- Initially the Character Sheet header is the only product surface required to render the generated thumbnail.
- An authorized Campaign editor can add or replace its logo, while a removed member cannot fetch private Campaign assets.
- The API rejects arbitrary object keys, unsupported purposes, spoofed content types, oversized files, unsafe dimensions, and unauthorized target IDs.
- A direct Storage upload is not visible in the product until idempotent finalization reaches `READY`.
- Image delivery does not expose original EXIF/GPS metadata, and private originals do not become public through a domain reference.
- Supporting files remain quarantined until required checks pass and are served with safe content-disposition behavior.
- Replacing an asset uses a new immutable object path; immutable Campaign content versions and Marketplace releases continue resolving the old referenced asset.
- Abandoned, rejected, detached, and account-deletion assets follow tested retention and cleanup rules without deleting still-referenced bytes.
- Web parses the asset DTOs and portable contract fixtures prove the same responses are safe for Phase 10 native consumption.
- `VTT_MAP` limits and transfer behavior are independently configurable from ordinary Campaign attachments.

## Out of scope

- General-purpose cloud drives, arbitrary file types, executable/archive uploads, collaborative document editing, OCR, video/audio hosting, public user galleries, image generation, copyright detection, and a reusable background-job platform.
- Native rendering, pickers, and upload controls; those begin in [Phase 10](10-cross-platform-foundation.md).
- VTT map calibration, tiling, token placement, fog, scene state, and map-renderer performance; those belong to [Phase 07](07-vtt.md).
- Marketplace rights, release publication, licenses, and paid delivery; those belong to [Phase 12](12-free-marketplace.md) and [Phase 13](13-paid-marketplace.md).

## Concerns and expansions

- Malware scanning may require an external provider or isolated worker if synchronous finalization cannot meet reliability and timeout budgets. Add that only from measured phase evidence; do not introduce a general queue preemptively.
- Image transformation cost and egress can exceed storage cost. The subplan must compare on-demand transforms with a small set of pre-generated variants before choosing.
- Public release assets may benefit from a public derivative bucket later, but private-by-default signed delivery is the safer initial model.
- VTT maps may eventually require pyramids/tiles, regional delivery, or separate storage quotas. Phase 07 owns those additions behind the same asset identity and authorization model.

## Questions for the phase subplan

- Which authored domains first render their retained source image and thumbnail crop after the Character Sheet header ships?
- What exact byte, dimension, pixel-count, and quota limits apply to each asset profile and subscription tier?
- Which Campaign supporting-file types are allowed initially, and must attachments link only to a Campaign or also to sessions and notes?
- Which Campaign roles may upload, replace, delete, and download each Campaign asset type?
- Which scanner and image-normalization approach fits the existing deployment and budget without exposing private originals?
- When may a derivative become public, and how do unpublishing, member removal, account deletion, moderation, and legal takedown affect access and retention?

## New-session instruction

Start with the profile policy and authorization matrix, then trace one Character portrait from upload intent through finalization, attachment, delivery, replacement, and deletion. The implementation subplan must name exact migrations, Storage policies, contracts, processing tools, domain references, web/native surfaces, and focused tests before adding a bucket or dependency.
