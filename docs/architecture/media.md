# Media lifecycle and delivery

> Status: canonical current Phase 8.2 boundary
>
> Scope: private media identity, upload, processing, references, quota, delivery, retention, and deletion
>
> Update when: profiles, storage configuration, signed upload/delivery, ownership, processing, or cleanup changes
>
> Verification: `apps/apis/convex/media`, media schemas/tests, `@convex-dev/r2`, and the shared web media adapters

Convex owns media authorization, metadata, quota, lifecycle state, domain references and cleanup.
Private R2 stores bytes through the official component. Browser clients receive only short-lived signed
URLs for an already-authorized object operation.

```mermaid
stateDiagram-v2
  [*] --> PENDING_UPLOAD: reserve quota (owner-scoped, no target)
  PENDING_UPLOAD --> PROCESSING: signed single PUT completed
  PROCESSING --> READY: validate/process + hash + transactional settlement
  PROCESSING --> DELETED: identical READY content reused, reservation released
  PROCESSING --> PENDING_UPLOAD: retry after operational failure
  PENDING_UPLOAD --> DELETED: expiry/rejection cleanup
  READY --> DELETED: last reference detached + grace + reference recheck
  DELETED --> [*]: provider object + component metadata removed
```

The signed upload binds the object key, declared byte length and MIME type. Account avatar, Character
portrait, authored artwork and VTT map uploads keep their domain-specific upload
authorization and references; there is no public bucket/key API. Processing actions recheck identity,
slot revision, current references and quota before their internal mutation commits metadata.

Delivery queries/actions reauthorize the current viewer, expose no object key, and return a short-lived
signed URL. Cleanup uses fenced, idempotent scheduler continuations and does not drop its obligation
until provider deletion and component metadata deletion succeed.

### Owner-scoped assets and "My images" — current (ADR 0012 amendment, Q17)

Stored assets belong to their uploader and name no target. The slot binding lives only on the domain
reference: `userProfiles.avatarAssetId`, `characters.portraitAssetId`, `authoredImageSlots.assetId`, and Scene definition/live Scene `map.assetId`.

- **Profile classes.** Each asset records a `profileClass`: `CONTENT_ART` (avatar, portrait and authored
  artwork, all normalized to at most 2048 px) or `VTT_MAP` (full size with tiles). Campaign Files and
  handouts were removed (D87): Campaign content reaches players by GM reveal, not file attachment. An asset serves any slot of its class.
- **Reads** follow the slot's own rules: a portrait read authorizes the Character (or its Campaign
  scope), a map read authorizes its uploader, the owner
  of a Campaign that references it, or a player while an open Session presents it.
- **Attaching** requires the slot's write rules and that the caller owns a READY asset of a compatible
  class. `media/library:attachImage` attaches content art to an avatar, portrait or authored draft slot
  through each domain's bind helper; Scene
  definitions accept the writer's own map or one the Campaign already references.
- **Framing belongs to the reference.** Each cropped slot stores its own crop. SOURCE, DISPLAY and an
  uncropped THUMBNAIL are shared; a slot's THUMBNAIL is derived from SOURCE per crop hash the first
  time any reader needs it (`media/cropThumbnails`), fenced like other new keys, and pruned when no
  reference uses that crop. Recropping one slot never changes another slot's framing. Derived
  thumbnails are not charged.
- **De-duplication.** Processing hashes the normalized bytes (`contentHash`). Settling an upload whose
  hash matches a READY asset of the same owner and class binds that asset instead, deletes the new
  outputs and releases the reservation; a retried finalize of the discarded upload answers with the
  reused asset. Matching never crosses owners or classes.
- **Quota** is charged once per asset, however many references it has. Every reference change schedules
  `media/assets:cleanup`, which prunes unused framing while the asset is referenced and starts the
  24-hour grace once the last reference detaches.
- **"My images".** `media/library:list` pages the caller's READY assets of one class, newest first;
  `media/libraryActions:getImage` signs an owner-only preview. The web image dialog and the Campaign
  file uploader offer "Choose from my images".
- **Account deletion** retains per reference: each Campaign that references a departing user's asset
  gets a copy owned by its current owner (one per owner, charged once, sharing the stored objects via
  `storageAssetId`), and its attachments, Scene definitions, live Scenes and presentations move to that
  copy. The departing user's asset is never transferred; account purge retires it and deletes stored
  objects only once no live row shares them. An in-progress Scene save that still names the original map
  must be saved again.
- **Migration.** `media/migrations:run` (widen → migrate → narrow) moves each legacy asset crop onto its
  references, rewrites assets to their class without target, Campaign or crop fields, and fails
  in-flight legacy processing closed. Legacy content art keeps its stored (cropped) thumbnail as its
  picker preview; slot framing regenerates from SOURCE. Legacy assets have no content hash, so they
  never de-duplicate.

Local correctness uses `MEDIA_STORAGE_MODE=local`, loopback `CONVEX_SITE_URL` and
`LOCAL_R2_ENDPOINT`. Managed deployments use `MEDIA_STORAGE_MODE=r2`, HTTPS `R2_ENDPOINT`, private
`R2_BUCKET`, `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY`. The browser receives only
`VITE_MEDIA_STORAGE_ORIGIN` for CSP. See the [R2 runbook](../runbooks/vtt-map-r2.md).

### Content snapshot delivery (ADR 0036 S3) — local implementation

Published content snapshots are not media: they are immutable objects in their own private bucket,
built by Convex ([persistence](persistence.md#content-snapshot-heads-and-objects-adr-0036-s2))
and served by the session Worker, the one exception to ADR 0028's "no Worker proxy" rule.

- **Route.** `GET /content/{key}` (`apps/session-worker/src/contentSnapshots.ts`), where `{key}` is a
  canonical object key, `v2/{scope}/{scopeId}/{kind}/{part}/{sha256}.json`. The Worker reads the
  `CONTENT_SNAPSHOTS` R2 binding and serves the stored gzip body unchanged with
  `Content-Encoding: gzip`.
- **Public or private.** The build writes R2 custom metadata `access: public` on PLATFORM source
  objects only. A source's kind never changes and the key names its scope, so a key's marker stays
  true. Any object without the marker is private, and a token grants only `SOURCE` and `CAMPAIGN` scopes.
- **Content token.** `contentSnapshots/access:issueAccess` signs an HS256 JWT with
  `CONTENT_SNAPSHOT_TOKEN_SECRET` (never the live-session secret): audience `artificer-content`,
  a 10-minute TTL, `sub`, the caller's own USER source ids and the Campaigns of their active
  memberships, excluding Campaigns being deleted. More than 100 of either fails closed. Revoked
  access stays readable for at most one token lifetime.

| Request                                                                              | Result                                      |
| ------------------------------------------------------------------------------------ | ------------------------------------------- |
| PLATFORM object, no token or a valid one                                             | 200, `public, max-age=31536000, immutable`  |
| Private object, token naming its USER source or Campaign                             | 200, `private, max-age=31536000, immutable` |
| Private object, no token                                                             | 401                                         |
| Private object, token without its scope (another user's source, a departed Campaign) | 403                                         |
| Expired, wrongly signed, wrong-audience or non-Bearer token, on any object           | 401                                         |
| Any query string, such as a token in the URL                                         | 400                                         |
| Origin outside `LIVE_SESSION_ALLOWED_ORIGINS`                                        | 403, no CORS headers                        |
| Non-canonical key or missing object                                                  | 404                                         |

Allowed origins get `Access-Control-Allow-Origin` with `Vary: Origin`, and a preflight admits only
`GET` with the `Authorization` header. The Worker never writes to the edge cache; `private` keeps
private objects out of shared caches. Refusals are `no-store`.

The authored-content list pages (ADR 0036 S11) fetch the `list` part of each visible source through
this route, with the same matrix: PLATFORM objects without a token, the caller's own Homebrew with
the content token (`useContentSnapshotToken`). Sign-out drops the token and deletes the snapshot
Cache Storage (`clearPrivateContentSnapshots`); see
[persistence](persistence.md#authored-content-list-snapshots-adr-0036-s11).

## Historical implementation record

The remainder of this file preserves the transitional storage and multipart implementation record. It
is not current deployment guidance or acceptance status.

### Original media guide

> **Status:** historical (retired Supabase/`packages/functions`/`packages/db` media implementation; paths below no longer exist)
> **Scope:** image and restricted Campaign-file asset identity, processing, domain references, and private delivery
> **Update when:** asset profiles, lifecycle states, variants, storage provider, or attachment ownership changes
> **Verification:** `packages/schema/src/api/media.ts`, `packages/functions/src/services/media`, `packages/db/src/domains/subjects/repositories/media.ts`, and the Phase 02 media tests

### Boundary

#### Phase 8.2 target and current cutover boundary

Convex will own asset metadata and domain references; all media bytes move to private R2 via
`@convex-dev/r2`. The approved transport is a signed single PUT, including VTT maps; custom
multipart support below describes the transitional implementation, not the target. Account,
Character, authored-content, and Campaign permissions remain domain-owned. No generic bucket
listing, client-selected key, or unauthenticated media mutation is exposed by the component.

Account avatars, Character portraits, and all eight authored artwork domains now use
`apps/apis/convex/media` and the shared web media adapter. VTT media remains transitional. Convex
`userProfiles.avatarAssetId` owns the current avatar;
`mediaAssets` retains its upload intent, immutable variants, processing operation, and quota charge.
Upload permission signs the exact declared byte length and MIME type, not just the object key.
The Node save action normalizes/crops, then rechecks current identity and avatar revision before
attaching. A failed replacement keeps the prior avatar. Signed delivery is owner-only and expires
after five minutes; reactive metadata contains only the public asset UUID and revision.

Character portraits use `characters.portraitAssetId` and `portraitRevision`; Builder commits
preserve both. Upload/save/remove require the Character owner, and the upload intent binds the
exact Character UUID. Direct foreign or missing Character reads return no portrait. A Campaign-scoped
lookup (CHARACTER_PORTRAIT with campaignId, ADR 0034 D36) lets any active member of that Campaign
read the portrait of a Character assigned in it, through the same indingForCharacter query and
getImage action; a non-member, a departed member, or a Character not assigned in that Campaign is
refused. The roster and VTT tokens use this scope. Uploads, crops and removal stay owner-only.
Settlement rechecks ownership and portrait revision, so concurrent replacement or removal rejects
stale processing. Failed replacements preserve the current binding. Removal schedules the existing
24-hour grace; cleanup rechecks Character references. Account purge clears matching owned portrait
bindings before retiring keys, and isolated fixture deletion schedules its bound portrait for cleanup.

Authored artwork uses domain-owned `authoredImageSlots`, indexed by subject UUID/scope and asset
UUID. The first saved draft inherits ACTIVE once; an explicit null DRAFT never falls back to
ACTIVE. Publication promotes the slot atomically, discard drops only DRAFT, and active deletion
preserves an existing draft slot. Read permission comes from current authored source/owner access;
write permission requires a saved owned draft. Master content remains locked. The asset's upload
intent is bound to the exact authored subject, so an avatar or another subject's asset cannot attach.

Authored target, lookup and slot identities share the existing PostgreSQL-shaped UUID validator,
including deterministic SRD IDs without RFC version bits, and normalize case before lookup.
Asset, Character and Campaign runtime identities retain their strict UUID validation.

The Node action shares the avatar's byte-processing helper but keeps authored authority separate.
Settlement rechecks the draft instance and slot revision, preventing a discarded/recreated draft,
removal, or another attachment from accepting stale processing. Authored recrops create a new asset,
copy verified SOURCE/DISPLAY bytes exactly, and generate only a new thumbnail; neither published
artwork nor image quality changes while editing its draft. Cleanup checks every current slot before
deleting bytes and preserves the existing grace/fence. Artwork is decorative; delivery URLs expire
after five minutes. Other authored frontend adapters migrate only with their own draft persistence.

Deletion uses native scheduled mutations/actions, not another queue table. A mutation atomically
schedules the provider-delete action and a follow-up mutation carrying the exact keys and action
ID. The follow-up stops only after provider-confirmed success; failed/missing attempts retry every
15 minutes. Keys survive account metadata deletion in those durable scheduler arguments. Cleanup
waits until issued PUTs expire plus the 15-minute settling fence; failed processing does not shorten
that fence. Recropping uses new immutable thumbnail keys and retires the prior key through the same
path. Detached assets keep the existing 24-hour recovery grace.

Configuration and proof boundaries are documented in
[the API workspace](../../apps/apis/README.md#convex-media-foundation--in-progress).
The existing implementation below remains authoritative for profiles not yet replaced.

#### Native VTT map upload — partial implementation

```mermaid
flowchart LR
  Owner["Active Campaign owner"] --> Intent["createUpload: reserve 25 MiB"]
  Intent --> PUT["R2: exact size and MIME signed PUT"]
  PUT --> Claim["beginFinalize: claim 66 output keys"]
  Claim --> Node["processMedia: normalize and tile"]
  Node --> Finish["finishFinalize: current authority, exact tiles and quota"]
  Finish --> Ready["mediaAssets: immutable map variants"]
  Ready --> Cleanup["Reference checks and fenced seven-key deletion batches"]
```

`media/vttMapAssets` and `media/vttMapActions` implement upload/finalization using the existing VTT
processor. `schema/projections/vttMapPersistence` adds a discriminated VTT_MAP member to mediaAssets;
image and Campaign-file profiles retain their contracts. Upload intent replay is scoped to the same
owner, Campaign and exact metadata, and reserves 25 MiB once. Every upload/finalization transaction
requires the current active Campaign owner and an active Campaign.

The Node operation claims display, thumbnail and all 64 possible tile keys before writing. Existing
25 MiB, 8192-pixel-side and 64 MP limits remain. Processing writes sequentially; settlement verifies
complete tile coverage and edge dimensions, replaces the reservation with actual stored bytes, and
retires unused keys. The 15-minute operation fence covers late writes; operational failures retain the
original upload for retry after that fence. Rejection and abandoned uploads release quota through the
existing cleanup lifecycle. Larger key sets fan out into existing retry-safe seven-key deletion jobs.

Normal grace cleanup checks both native Scene definitions and initial live Scene map references.
Campaign transfer changes delivery authority; the uploader retains asset ownership and storage charge.
The auth deletion transaction rejects before any account writes while an uploader's map has either
reference kind. `hasSceneReferences` is an indexed derived flag maintained by publication, replacement,
removal and fixture cleanup. Missing flags fail closed until the internal eight-row paginated backfill
recomputes them; backfill reports referenced maps whose uploader profile is missing and never invents
replacement ownership. Account media purge retains its actual-reference guard as well. This preserves
the original cascading-account-delete rollback contract; F12 still owns the complete product deletion
flow and all-domain reconciliation. Publication and delivery also require the uploader profile, fencing
new references against deletion before asynchronous media purge.
Native `getDelivery` issues the existing five-minute signed overview/tile URLs after current Campaign
membership authorization. Owners can read any READY map in their Campaign; players require an open
Session presenting that exact map. The indexed `activeMapAssetId` is server-derived when selecting a
Scene and cleared atomically when finishing its Session; multiple open Sessions may present the same
Scene. Delivery also verifies the selected live Scene and open Session before signing.

Definition begin/publication require a READY map in the same Campaign with matching verified
dimensions; native maps embed their tiles and require `tileManifestAssetId: null`. Map UUIDs are
canonicalized for reference indexes. Replacing/removing the last definition reference starts a fresh
24-hour recovery grace; surviving live Scene references still protect the bytes.

Owner Scene preparation now uses native upload, finalization and delivery. The browser sends the
whole file in one signed PUT and retains its successful upload asset ID so an interrupted finalization
can retry without uploading again. Clearing or replacing the file explicitly starts a new attempt.
The personal-development owner browser proof now exercises the signed PUT, finalization, decoded
overview/tile reads, Scene save/reload and private-read denials. Fixture cleanup removes Scene
references before Campaign/account cleanup and invokes existing account media purge. Physical object
absence must be proved after the existing deletion fence using unexpired provider authority;
successful purge invocation alone is insufficient. Evidence:
`.codex/validation/phase82-scene-owner-live/integration.md`.
The two earlier owner fixtures are now physically absent after the unchanged provider fence; see
`.codex/validation/phase82-scene-provider/integration.md`. The final V04 retention packet is
`.codex/validation/phase82-v04-retention/acceptance-checklist.md`. All 152 native tests and the actual
transfer/trigger/cleanup proof pass, including unchanged uploader charge and live-only protection.
The final fixture's exact provider prefixes were empty at 2026-09-11T04:01:44.707Z, after the unchanged
fence. V04 is accepted at LOCAL_INTEGRATION; ordered evidence is
`.codex/validation/phase82-v04-retention/acceptance.md`. Remaining live Scene and product account
deletion work retain their own cases.

#### Transitional implementation

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

### Current profiles

Phase 02 enables `ACCOUNT_AVATAR`, `CHARACTER_PORTRAIT`, and `AUTHORED_IMAGE`. Each accepted upload is normalized once and produces immutable source, display, and thumbnail variants. Account avatars, Character portraits, and authored artwork store normalized square thumbnail framing; authored detail pages and Character Sheet inspectors use the uncropped display variant. Originals are temporary and are removed after successful normalization. Clients cannot choose a bucket, object key, visibility, or output variant path.

Phase 06 briefly added `CAMPAIGN_FILE` and `CAMPAIGN_HANDOUT_MAP`; D87 removed them with the `campaignAttachments` table, so only image profiles remain. PDF, office, archive, executable, SVG/HTML, resumable upload, and external malware-scanning support are not accepted formats.

Phase 08 adds `VTT_MAP` for Campaign owners. Maps are JPEG, PNG, or WebP up to 25 MiB, 8,192 px per side, and 64 MP. New maps use private R2 multipart upload with exact 6 MiB parts (at most five); the browser receives only part-specific two-hour URLs and returns exact ETags to the completion command. Finalization verifies the source dimensions, produces immutable display and thumbnail variants, and generates 1,024 px renderer tiles (at most 64) in the same persisted provider. Delivery returns five-minute signed overview and tile URLs only after current Campaign authorization. Existing Supabase-backed map rows remain readable through their persisted `storage_provider`; they are not copied during this cutover. A scene definition continues to reference the stable asset ID, and database triggers prevent deleting or changing an asset while any scene definition or Encounter snapshot references it.

The retired `yarn test:vtt-map:integration` script was the local proof for this seam. It creates disposable local Supabase Auth/Campaign fixtures and an in-process loopback R2 substitute, then exercises interrupted/resumed multipart upload, idempotent completion, finalization, signed delivery, scene reference protection, oversized-map rejection, and exact cleanup. It refuses non-loopback Supabase URLs and is never a managed-data operation.

### Lifecycle

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

### Domain ownership

- `profiles.avatar_asset_id` owns the current account avatar reference.
- `characters.portrait_asset_id` owns Character presentation independently of Builder aggregate replacement.
- `authored_image_slots` owns one `DRAFT` and one `ACTIVE` artwork slot per authored route identity.

Saving an authored draft initializes its draft slot from active artwork once. Editing artwork changes only the draft slot. Activation promotes that slot in the same transaction that replaces the active aggregate and removes the draft. Discarding a draft removes only its draft slot. This follows [ADR 0011](../adr/0011-active-authored-content-and-json-drafts.md); media does not recreate authored revision history.

### Security and portability

Declared filename, MIME type, and size are hints. Finalization verifies decoded type, byte size, dimensions, pixel count, animation state, and actual processed quota under the account lock before creating variants. Normalization applies orientation and removes metadata including EXIF/GPS. Private delivery reuses the owning domain's read authorization.

The transport contract contains verified dimensions, accessibility metadata, expiry, and a signed delivery URL without browser-specific types. Image purpose owns that accessibility metadata: current domain artwork is decorative, while future mechanical diagrams and maps require descriptions through their own purpose-specific controls. Native clients reuse the same control plane with platform-native pickers and progress UI.

R2 credentials are server-only: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and `R2_VTT_MAP_BUCKET`. `R2_S3_ENDPOINT` is used only by the local substitute or another explicitly selected S3-compatible endpoint. Browser uploads require bucket CORS to allow the application origins and `PUT`/`GET`, and to expose `ETag`. See the [VTT map R2 runbook](../runbooks/vtt-map-r2.md).

#### Account deletion and retained Campaign assets — historical, superseded by per-reference copies

> Superseded by the ADR 0012 amendment (Q17): Campaign references now move to Campaign-owner copies
> and the uploader's asset is never transferred; see "Owner-scoped assets and My images" above. The
> transfer design below, including `retainedFromUserId`, is historical.

[ADR 0030](../adr/0030-owner-deletion-and-retained-dependencies.md) replaces uploader-deletion vetoes.
The native account transaction enumerates all owned assets and actual indexed Scene
references. Referenced READY VTT maps move to the current canonical
Campaign owner, preserving variants, keys and public UUID. The recipient's
charge increases atomically; existing shared media retention does not use the new-upload quota to veto
deletion. New uploads/finalization keep their existing quota checks. A fresh server upload idempotency
key avoids a collision in the destination owner's namespace.

The optional stored `retainedFromUserId` provenance is server-created and never accepted by upload or
attachment public inputs. Delivery still requires current Campaign authority, asset profile/status and
an exact original-uploader or retained-uploader link. Unreferenced and private media remains under the
existing deferred account purge and provider write fence. The earlier purge description applies only
after this retention transaction has detached the deleting user from surviving shared media. A failed
parent transaction preserves all media, attachment attribution, recipient charges and scheduled work.
