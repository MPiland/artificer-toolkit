# Future platform roadmap

> **Status:** transitional plan
> **Scope:** native clients, media/files, Campaigns, Encounters, commerce, Social Hub, Marketplace, VTT, and release operations
> **Update when:** priorities, product assumptions, client boundaries, payment strategy, or a phase exit gate changes
> **Verification:** current workspace manifests, canonical architecture guides, ADRs 0001 and 0005–0010, and the phase documents linked below

This roadmap turns the post-beta product direction into bounded implementation phases. It is planning guidance, not current product behavior. Current code, tests, canonical architecture guides, and accepted ADRs take precedence when a phase begins.

## Goal

Evolve Artificer Toolkit from its current web-first character and authored-content platform into a multi-client tabletop play platform. The TanStack web app and native iOS/Android apps will share contracts, authorization, rules, entitlements, Realtime channels, and backend orchestration while retaining platform-owned presentation.

The delivery order is:

1. Cross-platform client foundation.
2. Media and supporting-file pipeline.
3. Campaign Core.
4. Live Campaign play.
5. Campaign and standalone Encounters.
6. Entitlements and subscriptions.
7. Free Social Hub.
8. Free Marketplace.
9. Paid Marketplace and paid tables.
10. Web and native VTT.
11. Store release and continuous validation.

No phase should be implemented as one repository-wide branch. Start a new session and branch for one phase, verify the current repository state, and produce a smaller implementation subplan before changing code.

## Assumptions

- Initial commerce and social availability is US-only and 18+.
- D&D 5e 2014 is the first playable ruleset. Every Campaign, Encounter, roll, and replayable event records explicit system and ruleset identity.
- One character may have one active Campaign initially. Standalone Encounters remain allowed.
- Native v1 is play-first. Complex authoring, seller administration, and professional layout tools remain web-first.
- Native clients may read a visibly stale cached Sheet or Campaign projection during temporary connectivity loss. Offline writes, chat, dice, and VTT are not supported initially.
- Player-only chat excludes Campaign GMs but is not end-to-end encrypted. Access by authorized staff occurs only through an audited safety or report workflow.
- Alpha and early beta remain free. Prices, plan limits, fees, and revenue shares are unresolved product decisions.
- Beta sizing targets ordinary tabletop use: approximately 20 connected users and 100 actors in one scope.
- Roll retention starts at 5,000 Campaign rolls and 2,000 Encounter rolls, then changes only from observed beta usage.
- Character portraits are distinct from account avatars. Authored content initially supports an optional thumbnail and larger display image.
- User uploads are private by default. Exact file limits, dimensions, quotas, retention, and supporting-file allowlists remain per-profile product decisions for the media phase.
- Ordinary Campaign supporting files and handout maps are size-limited separately from larger VTT maps.
- The existing modular monolith remains the deployment model. This roadmap does not introduce microservices, general queues, or speculative infrastructure.

## Product scope

### Native applications

Native iOS and Android clients are first-class play clients for Character Sheets, Campaigns, chat, notes, Encounters, Social Hub participation, Marketplace discovery and consumption, and VTT. They use Expo Router and React Native components for navigation and ordinary product surfaces. A specialized canvas such as the first VTT renderer may use an Expo DOM component; the app as a whole must not become a WebView wrapper.

### Media and supporting files

One private-by-default asset pipeline serves Character portraits, authored-content thumbnails and larger images, Campaign logos, size-limited Campaign attachments and handout maps, Marketplace previews/supplements, and larger VTT maps. Each purpose has a centrally configured profile for authorization, verified file types, size/dimension limits, variants, quotas, processing, and delivery. The API approves every object key and domain reference; clients transfer bytes directly to Storage only through short-lived permissions.

### Campaigns and live play

Campaigns own invitations, membership, roles, character assignment, content access, typed rules, shared inventories, vehicles, sessions, notes, clocks, chat, rolls, and audited GM authority. Campaign rules modify engine assembly without rewriting character-authored intent.

### Encounters and VTT

Encounters are authoritative, versioned play aggregates that may belong to a Campaign or stand alone. The VTT renders and commands an Encounter; it does not create another combat model. Character state remains coordinated with Sheet ownership, while creature state remains Encounter-local.

### Social and commerce

Social Hub and Marketplace launch free-first so moderation, licensing, fulfillment, and entitlement paths are exercised before money is added. Web owns initial seller, creator, and paid-table administration. Native initially consumes existing entitlements and free acquisitions.

## Design

```mermaid
flowchart LR
  Web["apps/web<br/>TanStack Start"] --> Client["packages/api-client<br/>typed transport and errors"]
  Mobile["apps/mobile<br/>Expo + React Native"] --> Client
  Client --> API["apps/apis<br/>tRPC boundary"]
  API --> Functions["packages/functions<br/>authorization and orchestration"]
  Functions --> Shared["packages/shared<br/>pure rules and scene models"]
  Functions --> DB["packages/db<br/>Kysely repositories"]
  DB --> PG[("Supabase Postgres + RLS")]

  PG --> RT["Private Realtime channels"]
  RT --> Web
  RT --> Mobile

  Mobile --> Secure["SecureStore<br/>session secrets"]
  Mobile --> Cache["SQLite<br/>read-only projections"]
  Mobile --> Push["Expo Push Service"]
  Functions --> Storage["Private Supabase Storage<br/>asset lifecycle"]
  Web -->|API-approved signed transfer| Storage
  Mobile -->|API-approved signed transfer| Storage
```

This extends the existing dependency direction rather than replacing it. Product reads and writes still cross `apps/apis`; direct Supabase client use is limited to Auth, authorized private Realtime channels, and API-approved Storage operations.

```mermaid
flowchart TD
  P0["Phase 0<br/>Cross-platform foundation"] --> P0A["Phase 0A<br/>Media and files"]
  P0A --> P1["Phase 1<br/>Campaign Core"]
  P1 --> P2["Phase 2<br/>Live Campaign play"]
  P1 --> P3["Phase 3<br/>Encounters"]
  P2 --> P3
  P0 --> P4["Phase 4<br/>Entitlements"]
  P1 --> P5["Phase 5<br/>Social Hub"]
  P4 --> P5
  P4 --> P6["Phase 6<br/>Free Marketplace"]
  P0A --> P6
  P6 --> P7["Phase 7<br/>Paid commerce"]
  P5 --> P7
  P3 --> P8["Phase 8<br/>VTT"]
  P0A --> P8
  P0 --> P9["Phase 9<br/>Release validation"]
  P0A --> P9
  P8 --> P9
  P7 --> P9
```

The numbered order is the default product sequence. Hard technical dependencies are shown above. In particular, VTT requires the cross-platform foundation and Encounter model, but not Marketplace commerce; changing its product priority does not require coupling those domains.

## Architecture guardrails

- Keep the modular monolith. Add domains, contracts, services, repositories, and client surfaces inside the existing workspaces.
- Put transport DTOs and validation in `packages/schema`; pure rules, dice contracts, and platform-neutral scene state in `packages/shared`; orchestration and authorization in `packages/functions`; persistence in `packages/db`; and thin procedures in `apps/apis`.
- Add `packages/api-client` only with `apps/mobile`. It owns typed tRPC construction, shared API errors, query-key factories, and token injection. It must not own product rules or platform navigation.
- Maintain the Builder/Sheet boundary. Structural character changes use Builder preview/commit; play-state changes use Sheet commands.
- Preserve authored revision identity. Campaign grants and Marketplace licenses expose exact revisions. Removing future access must not silently invalidate a revision already pinned into a character or recorded event.
- Model authorization as centralized capabilities derived from an explicit authority context. Do not scatter `role === 'GM'` checks through routes and components.
- Persist commands before broadcasting them. Realtime is delivery and invalidation infrastructure, not the source of truth.
- Use idempotency keys, expected versions, row locks, and one Postgres transaction for multi-aggregate operations that must succeed or fail together.
- Keep player-only chat cryptographically and operationally separate from GM-visible channels at authorization, RLS, fetch, subscription, notification, and moderation boundaries.
- Record exact inputs and results required for replay. Never re-run an old Encounter event against newly active content.
- Keep entitlements provider-neutral. Stripe, App Store, Play Store, beta, and administrator grants project into one internal authorization model.
- Keep originals private and asset references stable. Store asset IDs/object keys as truth, never signed URLs; domain records own visibility and references.
- Use purpose-specific upload profiles. Clients cannot select arbitrary buckets/paths, and ordinary attachments cannot inherit the larger limits intended for VTT maps.
- Bind authored artwork and Marketplace release assets to exact immutable revisions/releases. Builder replacement writes cannot delete Character portraits or Campaign-owned assets.

## Technology direction

| Area | Direction |
| --- | --- |
| Shared language | TypeScript for clients, transport, orchestration, and pure domain logic |
| Persistence | PostgreSQL, Supabase migrations/RLS, and Kysely repositories |
| Web | Existing TanStack Start, React, Mantine, Vanilla Extract, TanStack Query |
| Native | Expo, React Native, Expo Router, TanStack Query, Reanimated, Gesture Handler |
| Contracts | Zod DTOs in `packages/schema`; typed tRPC through `packages/api-client` |
| Identity | One Supabase user identity across web, iOS, and Android |
| Native secrets/cache | `expo-secure-store` for session secrets; `expo-sqlite` for non-authoritative read-only projections |
| Realtime | Private Supabase Broadcast; Presence only for slow-changing connection state |
| Notifications | `expo-notifications` and Expo Push Service, with API-authorized deep links |
| Media and files | Private Supabase Storage, API-issued upload intents, signed/authenticated delivery, verified profile limits, image normalization, and quarantined supporting files |
| Dice | A restricted server-side adapter around `@dice-roller/rpg-dice-roller`, using server cryptographic randomness |
| VTT | Platform-neutral scene model; PixiJS on web and initially in an Expo DOM host; React Native Skia only if the benchmark gate fails |
| Web payments | Stripe Billing for Artificer subscriptions; Stripe Connect for creator and professional-GM money movement |
| Native subscriptions | StoreKit and Google Play Billing through RevenueCat after plan and store-policy approval |
| Tests | Vitest for shared/packages, existing web tests and Playwright, `jest-expo`/React Native Testing Library, Maestro on EAS |

Expo's current guidance supports workspace monorepos, Router-based native navigation, SecureStore, development builds, and EAS profiles. Supabase's React Native guidance requires platform storage and foreground-aware session refresh. Re-check these external contracts when Phase 0 begins because SDK behavior changes: [Expo monorepos](https://docs.expo.dev/guides/monorepos/), [Expo Router](https://docs.expo.dev/router/introduction/), [Supabase React Native Auth](https://supabase.com/docs/guides/auth/quickstarts/react-native).

Supabase currently supports private buckets with RLS or time-limited signed delivery, per-bucket file-size and MIME restrictions, resumable transfers for larger files, and optional image transformations. Re-check limits, pricing, security guidance, and transformation behavior when Phase 0A begins: [Storage access control](https://supabase.com/docs/guides/storage/security/access-control), [bucket fundamentals](https://supabase.com/docs/guides/storage/buckets/fundamentals), [upload limits](https://supabase.com/docs/guides/storage/uploads/file-limits), [standard and resumable upload guidance](https://supabase.com/docs/guides/storage/uploads/standard-uploads), and [image transformations](https://supabase.com/docs/guides/storage/serving/image-transformations).

## Payment-channel strategy

| Product | Web | Native initial state | Native paid state |
| --- | --- | --- | --- |
| Artificer subscription | Stripe Billing | Consume the existing entitlement; no purchase CTA | StoreKit/Play Billing through RevenueCat |
| Marketplace content | Stripe Connect | Browse, acquire free releases, and consume owned content | Enable paid acquisition only after store and creator-payout design |
| Paid table/session | Stripe Connect | Join or manage an existing booking | Enable checkout only after service-payment policy review |
| Creator/GM onboarding | Stripe Connect hosted onboarding | Open an authorized web flow | Remain web-hosted unless provider constraints require otherwise |

Apple Pay and Google Pay are wallet methods inside an allowed payment path; they do not override app-store billing rules. Venmo remains outside the initial design because it adds a second processor and reconciliation model. Before paid native controls are designed, re-check [Apple's review guidelines](https://developer.apple.com/app-store/review/guidelines/), [Google Play's payments policy](https://support.google.com/googleplay/android-developer/answer/9858738), [Stripe's React Native SDK](https://docs.stripe.com/sdks/react-native), and [RevenueCat's Expo integration](https://www.revenuecat.com/docs/getting-started/installation/expo).

## Phase documents

| Phase | Document | Exit result |
| --- | --- | --- |
| 0 | [Cross-platform foundation](00-cross-platform-foundation.md) | Expo shell proves authenticated, typed, read-only Sheet access on iOS and Android |
| 0A | [Media and supporting-file pipeline](00a-media-and-file-pipeline.md) | Authorized, private-by-default assets support portraits, authored artwork, Campaign branding, and later feature-specific files |
| 1 | [Campaign Core](01-campaign-core.md) | Campaign membership, roles, rules, content grants, and audited GM authority work on web and native |
| 2 | [Live Campaign play](02-live-campaign-play.md) | Shared inventory, vehicles, sessions, notes/files, clock, chat, rolls, Realtime, and native distribution work |
| 3 | [Encounters](03-encounters.md) | Campaign and standalone Encounters provide authoritative manual play on web and native |
| 4 | [Entitlements and subscriptions](04-entitlements-and-subscriptions.md) | Provider-neutral entitlements and Stripe web subscriptions are reliable |
| 5 | [Free Social Hub](05-social-hub.md) | Adults can discover, apply to, moderate, and form free tables |
| 6 | [Free Marketplace](06-free-marketplace.md) | Immutable releases, licenses, free acquisition, and content consumption work |
| 7 | [Paid Marketplace and paid tables](07-paid-marketplace-and-tables.md) | Approved web commerce, payouts, refunds, and fee entitlements work |
| 8 | [VTT](08-vtt.md) | One Encounter-backed VTT works across web, iOS, and Android |
| 9 | [Store release and continuous validation](09-store-release-and-continuous-validation.md) | Store-ready binaries and repeatable cross-platform release gates exist |

## Cross-phase acceptance gates

- Web and native parse the same API contracts and produce the same rules results.
- OWNER, GM, PLAYER, removed member, standalone invitee, and non-member matrices pass at API and RLS boundaries.
- Player-only chat tests prove a GM cannot subscribe, fetch, receive notifications for, or infer message content.
- Switching progression mode retains experience and does not rewrite character intent.
- Inventory transfers and correlated Encounter/Sheet changes remain atomic under conflicts and retries.
- Realtime reconnect resumes from an authoritative cursor without duplicate application.
- Native cached data is visibly stale and cannot accept offline mutation.
- Deep links open the correct authorized destination after a cold start and fail closed when access is absent.
- Upload intent, finalize, reference, delivery, replacement, and deletion tests enforce the same asset authorization on web, native, API, and Storage RLS.
- Spoofed, oversized, unsafe, or disallowed uploads never become ready; image delivery strips private metadata; removed members cannot download private Campaign assets.
- Authored revisions, Marketplace releases, and Encounter/VTT history retain exact asset references, while VTT map limits remain independent from ordinary Campaign files.
- Duplicate, delayed, and out-of-order provider webhooks converge on the same entitlement state.
- Web and native VTT clients reconstruct the same scene from the same Encounter projection.
- Mobile validation covers one current and one oldest-supported physical iOS and Android device.

## Starting a phase in a new session

Use the selected phase document as context, then require the new session to:

1. Read `AGENTS.md`, `PRODUCT.md`, `DESIGN.md`, the canonical architecture guides, and every ADR linked by that phase.
2. Verify the phase's “current starting point” against the branch. Planned documents may become stale.
3. Resolve or explicitly defer the phase's open questions. Do not convert an assumption into a decision silently.
4. Produce a smaller implementation subplan with exact contracts, migrations, modules, UI surfaces, tests, rollout, and non-goals.
5. Split the work into independently reviewable branches or issues. Do not implement the whole phase as one diff.
6. Update canonical architecture docs or ADRs when an implementation changes a load-bearing boundary.

## Concerns and expansions

- Full native authoring needs a native renderer for existing platform-neutral Authoring Schema semantics; it must not port Mantine or browser CSS.
- Expo DOM is the fastest shared VTT route but has bridge, battery, accessibility, and binary-update constraints. Phase 8 contains an explicit benchmark and Skia fallback gate.
- Marketplace payments combine app-store collection, creator licensing, tax, refunds, fee calculation, and payouts. They are not an ordinary single-merchant checkout.
- Supporting minors requires a separate age-assurance, guardian, moderation, safety, and retention program.
- Professional page-layout/book authoring is separate from app-native content packages and supplemental files.
- Supporting-file uploads require an allowlist, scanning/quarantine, safe download behavior, quotas, retention, takedown, and cost controls; Phase 0A keeps this bounded rather than becoming a general cloud drive.
- VTT maps may require resumable transfer, optimization, or tiling beyond ordinary Campaign attachments. Those expansions remain in Phase 8 behind the shared asset identity.
- Combat automation, voice/video, multi-seller carts, reviews, gifting, organizations, non-US commerce, and additional payment processors remain later expansions.

## Roadmap-level open questions

- Which legal entity and commercial model will be merchant of record for subscriptions, creator content, and paid tables?
- What public production origin and final iOS/Android application identifiers should own universal links and store records?
- What moderation access, retention, export, deletion, and appeal policy applies to chat, notes, listings, creator releases, and reported content?
- What per-purpose file limits, storage/egress quotas, allowed Campaign attachment types, and public-asset policy should apply to free and paid tiers?
