# ADR 0012: Private media assets with domain-owned references

- **Status:** decision — stable asset identity and domain references retained; Supabase persistence and storage topology superseded by [ADR 0029](0029-convex-backend-cutover.md); target-bound assets superseded by the 2026-09-27 amendment below
- **Date:** 2026-08-05

> Stable asset identity and domain-owned references remain unchanged. ADR 0029 makes Convex authoritative for metadata and R2 authoritative for media bytes; the former Supabase and `packages/functions`/`packages/db` implementation is historical.

## Context

Account avatars, Character portraits, authored artwork, future Campaign files, Marketplace releases, and VTT maps need shared upload and delivery mechanics. Their authorization and lifecycle semantics belong to different product domains. Temporary signed URLs cannot serve as durable identity, and a generic polymorphic attachment row cannot enforce those domain relationships.

## Decision

Store stable asset and immutable variant metadata in Convex and bytes in private R2 storage. Convex media functions authorize exact signed transfer permissions and verify, normalize, attach, and delete asset metadata under the owning domain policy.

Domain tables own real references: profiles own avatars, Characters own portraits, and authored route identities own explicit active/draft image slots. Authored activation promotes draft artwork transactionally under [ADR 0011](0011-active-authored-content-and-json-drafts.md). No authored revision or generic `owner_type + owner_id` model is introduced.

Phase 02 enables only image profiles required by current product surfaces. Campaign supporting files, public Marketplace derivatives, and resumable VTT maps extend the same identity later without prebuilding their scanners, permissions, or processing outputs.

## Consequences

- Direct byte transfer does not bypass product authorization because the API issues one short-lived permission for one generated key.
- Replacements and recrops create immutable objects, avoiding CDN and stale-reader ambiguity.
- Private delivery requires authorized URL refresh rather than storing public URLs.
- Object storage and database transactions cannot commit atomically, so every new key stays in a durable deletion queue until metadata commits or Storage confirms removal.
- The last detached reference starts a 24-hour recovery grace period. Auth-user deletion cascades owned media metadata and queues object deletion transactionally; scheduled cleanup retries unavailable Storage.
- Moving object storage later requires copying objects and updating stored keys, not changing Character or authored-content identities.

## Amendment: reusable assets and de-duplication (2026-09-27, Q17)

Approved by the user in Q17 ("My images" picker, each asset counted once).

1. **Assets belong to their uploader, not to a target.** `authoredTarget`, `characterTarget` and the Campaign `campaignId` binding are removed from stored assets. The slot binding lives only on the domain reference.
   - **Reading** an asset through a slot follows that slot's own read rules.
   - **Attaching** an asset to a slot requires the slot's write rules, and the asset's owner must be the caller.
2. **Crop belongs to the reference.** The SOURCE and DISPLAY objects are shared.
   - A cropped thumbnail is derived per asset and crop, keyed by a hash of the crop, and generated when first needed.
   - It is removed when no reference uses that crop.
   - Recropping one slot never changes another slot's framing.
3. **De-duplication within an owner.**
   - Stored assets carry the `contentHash` of their normalized bytes, and are indexed by owner, profile class and hash.
   - Finishing an upload whose hash matches an existing asset of the same owner and class binds the existing asset, and the new bytes are discarded. Matching never crosses owners.
   - **Profile classes:** content art (avatar, Character portrait, authored artwork, Campaign file image) is interchangeable. Handout maps and VTT maps are each their own class.
4. **Quota** is charged per asset, once, however many references it has. Cleanup stays reference-scanned: the last detached reference starts the 24-hour grace period.
5. **Account deletion retention is per reference.**
   - References in Campaign records (files, handouts, maps) to a departing user's asset get a copy owned by the Campaign owner, so the Campaign keeps what it was given.
   - Personal references (avatar, portrait, the user's own authored content) follow the existing deletion rules.
   - A personal asset is never transferred to a GM.
6. **Migration:** pre-launch, the same slice runs widen → migrate development data → narrow.
