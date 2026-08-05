# Phase 12 — Free creator Marketplace

> **Status:** deferred until the web viability gate passes and [Phase 11](11-store-release-and-continuous-validation.md) ships
> **Depends on:** the asset pipeline from [Phase 02](02-media-and-file-pipeline.md), Campaign content binding from [Phase 03](03-campaign-core.md), moderation identity from [Phase 04](04-social-hub.md), entitlement foundations from [Phase 08](08-entitlements-and-subscriptions.md), and [Phase 11](11-store-release-and-continuous-validation.md)
> **Unlocks:** paid creator content
> **Primary ADRs:** [0008](../adr/0008-ruleset-identity-and-content-binding.md), [0011](../adr/0011-active-authored-content-and-json-drafts.md)

## Goal

Prove creator publication, immutable releases, licensing, moderation, fulfillment, Library access, and source-linked consumption without a payment provider. Free acquisition must create a real license through the same domain path later used by paid orders.

## Current starting point

- Authored roots have stable ownership, normalized active content, separate drafts, and public route IDs; general authored revision history is not retained.
- Existing `MASTER | OWNED` provenance and user-scoped import references are insufficient for creator attribution, licenses, acquisition, immutable releases, updates, takedown, or sale rights.
- Copying authored content intentionally creates an independent definition without a durable source link.
- There is no creator storefront, package, release, asset, license, acquisition, fulfillment, or takedown domain.
- Phase 02 is expected to own upload/processing lifecycle and stable asset identity; Marketplace owns rights, release references, licensing, and delivery authorization.

## Requirements

- Creator profiles expose approved public identity, attribution, links, and status separately from raw auth/profile data.
- A package draft groups app-native authored content plus optional supplemental files and preview assets.
- A release is immutable and contains or references exact published content snapshots, attribution, license terms/version, release notes, previews, and supplemental-file metadata. Publishing does not restore general revision history to mutable authored roots.
- Publishing verifies ownership or explicit rights for every included item.
- Listing visibility and moderation/takedown state are separate from release immutability.
- Free acquisition is idempotent and creates an immutable license record with release, terms version, source, and timestamp.
- Acquired content is available through Library and source-linked references or approved copy/import according to the license model. Marketplace provenance remains distinct from user portability/import provenance.
- Removing a listing blocks new acquisition but does not silently delete existing licenses. Legal takedown behavior is explicit and exceptional.
- Native supports browse, detail, free acquisition, owned Library, and consumption. Package authoring/release administration remains web-first.
- Preview and supplemental files must already be `READY` Phase 02 assets before publishing. Storage access uses API-authorized object paths and RLS/signed URLs; release metadata never trusts client-declared uploads.
- Published release manifests pin exact immutable asset IDs. Replacing a package draft file creates a new asset/reference and never changes a published release.

## Design

```mermaid
flowchart LR
  Creator["Web creator tools"] --> Draft["Package draft"]
  Draft --> Publish["Release validation"]
  Publish --> Release["Immutable package release"]
  Release --> Catalog["Free Marketplace catalog"]
  User["Web/native user"] --> Acquire["Idempotent free acquisition"]
  Acquire --> License[("Owned license")]
  License --> Library["Library + source-linked consumption"]
  Moderation["Moderation/takedown"] --> Catalog
```

Marketplace package/release identity is not another mutable authored root. A release owns an immutable published snapshot and references ready assets; it does not change active/draft authoring lifecycle or create general revision history.

## Ordered workstreams

1. **Lock rights and license semantics.** Define supported license forms, creator attestation, attribution, supplemental-file rules, update behavior, unlisting, takedown, deletion, and import/reference rights.
2. **Define creator/package/release contracts.** Include exact published-snapshot manifests, release immutability, preview/assets, moderation state, and stable public identity.
3. **Add persistence and RLS.** Create creator profiles, package drafts, releases/manifests with Phase 02 asset references, listings, licenses, moderation cases, and provenance links. Do not duplicate upload lifecycle tables.
4. **Add release validation and publishing.** Verify ownership/rights, file metadata, ruleset compatibility, exact source content, terms, and the immutable snapshot without adding money.
5. **Add free acquisition and fulfillment.** Reuse entitlement concepts where appropriate but keep license terms and content provenance explicit.
6. **Add Library consumption.** Resolve licensed release snapshots for reference or approved copy/import while preserving creator/source/license attribution.
7. **Build web and native surfaces.** Web owns creator/package/release administration; both clients own catalog, detail, acquisition, Library, and consumption.
8. **Validate rights, immutability, and access.** Test draft leakage, release mutation, duplicate acquisition, unlisting, takedown, deleted accounts, file authorization, and revision stability.

## Acceptance gates

- Draft package data and unpublished authored content never appear in public or acquired responses.
- A release manifest cannot change after publication.
- A creator cannot publish another user's content without an explicit rights record.
- Acquisition retries create one license.
- Every license resolves the exact acquired release and terms version.
- Later authored activation does not silently change a prior release.
- Copies or references preserve required attribution and source identity.
- Unlisting stops new acquisition without erasing ordinary existing licenses.
- Native and web show the same catalog and Library ownership.
- Published previews and supplemental files resolve the exact ready assets in the immutable release, and unlicensed users cannot download licensed supplements.

## Out of scope

- Prices, payments, orders, refunds, payouts, carts, bundles containing multiple sellers, subscriptions, reviews, gifting, print fulfillment, and professional page-layout authoring.

## Questions for the phase subplan

- Which license types and custom-term options are permitted at launch?
- Does a license grant exact-release reference access, editable copy rights, or both?
- Are later releases separate acquisitions, optional free updates, or automatically included?
- What file types, size limits, malware scanning, preview generation, and retention rules apply?
- What happens to existing access after creator deletion, ordinary unlisting, policy removal, or legal takedown?
- Is Marketplace browsing public or authenticated-only?

## New-session instruction

Start with the immutable release snapshot and license semantics, then trace licensed content loading through Builder/Sheet consumption. Do not merge Marketplace provenance with portability import references or call game equipment cost, the Builder catalog, or generic entitlements an order system.
