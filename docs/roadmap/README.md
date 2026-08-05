# Future platform roadmap

> **Status:** transitional plan
> **Scope:** completed Sheet and dice foundations, media/files, Campaigns, Social Hub, live play, Encounters, web VTT, launch plans, paid tables, web viability, native clients, deferred creator Marketplace, and release operations
> **Update when:** priorities, product assumptions, client boundaries, payment strategy, or a phase exit gate changes
> **Verification:** current workspace manifests, canonical architecture guides, ADRs 0001 and 0005–0011, and the phase documents linked below

This roadmap turns the alpha and post-alpha product direction into bounded implementation phases. It is planning guidance, not current product behavior. Current code, tests, canonical architecture guides, and accepted ADRs take precedence when a phase begins.

## Goal

Evolve Artificer Toolkit from its current web-first character and authored-content platform into a connected tabletop play platform. First complete and validate the web loop from creation and table formation through Campaign, Encounter, and VTT play. Add paid plans and professional-GM tables to test sustainable demand. Native clients follow demonstrated web viability, and creator Marketplace work remains last.

The delivery order is:

- **Phase 00:** Character Sheet play depth and overrides — complete.
- **Phase 01:** Dice and roll infrastructure — complete.
- **Phase 02:** Media and supporting-file pipeline.
- **Phase 03:** Campaign Core.
- **Phase 04:** Social Hub and free table formation.
- **Phase 05:** Live Campaign play.
- **Phase 06:** Campaign and standalone Encounters.
- **Phase 07:** Web VTT.
- **Phase 08:** Plans, entitlements, and subscriptions.
- **Phase 09:** Paid tables and Pro GM economics.
- **Web launch gate:** portability hardening, public release, and viability measurement.
- **Phase 10:** Native foundation and play parity after web viability.
- **Phase 11:** Store release and continuous validation.
- **Phase 12:** Free creator Marketplace after native delivery.
- **Phase 13:** Paid creator Marketplace.

No phase should be implemented as one repository-wide branch. Start a new session and branch for one phase, verify the current repository state, and produce a smaller implementation subplan before changing code.

## Assumptions

- Initial commerce and social availability is US-only and 18+.
- D&D 5e 2014 is the first playable ruleset. Every Campaign, Encounter, roll, and replayable event records explicit system and ruleset identity.
- Character Sheet adjustments are per-character, mechanically authoritative, and owner-editable. Future authorized GMs may inspect adjustment provenance without receiving edit authority.
- One character may have one active Campaign initially. Standalone Encounters remain allowed.
- Native work begins only after the connected web product passes the viability gate. Native v1 is play-first; complex authoring, seller administration, and professional layout tools remain web-first.
- Native clients may read a visibly stale cached Sheet or Campaign projection during temporary connectivity loss. Offline writes, chat, dice, and VTT are not supported initially.
- Player-only chat excludes Campaign GMs but is not end-to-end encrypted. Access by authorized staff occurs only through an audited safety or report workflow.
- Alpha and early beta may remain free while the web loop is built. Free, Player, GM, and Pro GM pricing, limits, and paid-table platform fees use the launch-planning matrix below; evidence may change them before public launch.
- Beta sizing targets ordinary tabletop use: approximately 20 connected users and 100 actors in one scope.
- Roll retention starts at 5,000 Campaign rolls and 2,000 Encounter rolls, then changes only from observed beta usage.
- Character portraits are distinct from account avatars. Characters and user-authored content use one source image plus normalized user-selected thumbnail crop metadata; initially only the Character Sheet header renders the generated thumbnail.
- User uploads are private by default. Exact file limits, dimensions, quotas, retention, and supporting-file allowlists remain per-profile product decisions for the media phase.
- Ordinary Campaign supporting files and handout maps are size-limited separately from larger VTT maps.
- The existing modular monolith remains the deployment model. This roadmap does not introduce microservices, general queues, or speculative infrastructure.

## Delivered and paused baseline

- Phase 00 Character Sheet play depth and overrides is complete and final-validated.
- Phase 01 authoritative dice and web roll presentation is complete.
- Guided Authoring is delivered for newer creators alongside the full Advanced Authoring experience.
- Character and authored-content import/export is implemented behind a disabled feature flag. It is unavailable to users and is not the next implementation priority.
- Portability returns during launch hardening only after ownership and authorization checks, malformed and duplicate-file tests, provenance retention, and an approved mechanism for rejecting known official content are complete. Automated rejection is a compliance control, not proof of legal clearance.

## Product scope

### Character Sheet play depth

The Sheet owns play-state commands and per-character adjustment intent without rewriting Builder structure or reusable authored content. The backend resolves effective values, calculation breakdowns, valid actions, and semantic panels; web and future native clients own accessible platform presentation. Ability, save, skill, passive, sense, movement, defense, proficiency, HP, rest, condition, spell, feature, item, background, and companion interactions use the same authoritative engine and Sheet command seams.

### Dice and rolls

One restricted backend service owns expression validation, cryptographic randomness, and exact per-die evidence. Web may animate that known result with a lazy viewport-sized 3D presentation, but browser physics never chooses the outcome. Campaign and Encounter scopes add their own visibility, persistence, and retention by consuming the same service rather than creating another roller.

### Native applications

After web viability, native iOS and Android clients become first-class play clients for Character Sheets, Campaigns, chat, notes, Encounters, Social Hub participation, and VTT. They use Expo Router and React Native components for navigation and ordinary product surfaces. A specialized canvas such as the VTT renderer may use an Expo DOM component; the app as a whole must not become a WebView wrapper. Marketplace consumption is added only after its later phases ship.

### Media and supporting files

One private-by-default asset pipeline serves Character and authored-content source images, crop-derived variants, Campaign logos, size-limited Campaign attachments and handout maps, Marketplace previews/supplements, and larger VTT maps. Character and authored-content thumbnails derive from one source plus normalized crop metadata rather than separate uploads. Each purpose has a centrally configured profile for authorization, verified file types, size/dimension limits, variants, quotas, processing, and delivery. The API approves every object key and domain reference; clients transfer bytes directly to Storage only through short-lived permissions.

### Campaigns and live play

Campaigns own invitations, membership, roles, character assignment, content access, typed rules, shared inventories, vehicles, sessions, notes, clocks, chat, rolls, and audited GM authority. Campaign rules modify engine assembly without rewriting character-authored intent. Campaign content references grant members read/use access to immutable Campaign content versions while relevant to the Campaign; they do not grant ownership, editing, personal export, or marketplace sale rights.

### Encounters and VTT

Encounters are authoritative, versioned play aggregates that may belong to a Campaign or stand alone. The VTT renders and commands an Encounter; it does not create another combat model. Character state remains coordinated with Sheet ownership, while creature state remains Encounter-local.

### Social and commerce

Social Hub launches with private and public free tables so table formation, moderation, and Campaign conversion can be validated before payments. Plans and paid-table commerce then establish Player, GM, and Pro GM economics on web. The creator Marketplace is a separate post-viability, post-native track; it begins with free licensing before paid creator commerce.

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
  P0["Phase 00 complete<br/>Sheet play depth + overrides"] --> P1["Phase 01 complete<br/>Dice + roll infrastructure"]
  P0 --> P3["Phase 03<br/>Campaign Core"]
  P2["Phase 02<br/>Media + files"] --> P3
  P3 --> P4["Phase 04<br/>Social Hub"]
  P1 --> P5["Phase 05<br/>Live Campaign play"]
  P2 --> P5
  P3 --> P5
  P1 --> P6["Phase 06<br/>Encounters"]
  P3 --> P6
  P5 --> P6
  P1 --> P7["Phase 07<br/>Web VTT"]
  P2 --> P7
  P5 --> P7
  P6 --> P7
  P4 --> P8["Phase 08<br/>Plans + entitlements"]
  P6 --> P8
  P8 --> P9["Phase 09<br/>Paid tables"]
  P4 --> P9
  P9 --> Launch["Launch hardening<br/>+ web viability gate"]
  P7 --> Launch
  Launch -->|viable| P10["Phase 10<br/>Native parity"]
  P10 --> P11["Phase 11<br/>Store release"]
  P11 --> P12["Phase 12<br/>Free creator Marketplace"]
  P12 --> P13["Phase 13<br/>Paid creator Marketplace"]
```

The numbered order is the default product sequence. Hard dependencies are shown above. Phase 01 provides authoritative roll evidence; Phase 05 and Phase 06 add owning Campaign and Encounter persistence. Phase 07 delivers the required web VTT without waiting for native or Marketplace work. Phase 10 begins only after the public web loop demonstrates viability.

## Architecture guardrails

- Keep the modular monolith. Add domains, contracts, services, repositories, and client surfaces inside the existing workspaces.
- Put transport DTOs and validation in `packages/schema`; pure rules, dice contracts, and platform-neutral scene state in `packages/shared`; orchestration and authorization in `packages/functions`; persistence in `packages/db`; and thin procedures in `apps/apis`.
- Add `packages/api-client` only with `apps/mobile`. It owns typed tRPC construction, shared API errors, query-key factories, and token injection. It must not own product rules or platform navigation.
- Maintain the Builder/Sheet boundary. Structural character changes use Builder preview/commit; play-state changes use Sheet commands.
- Keep Character Sheet adjustments typed, per-character, engine-resolved, and transparent. Do not persist final derived totals or encode Sheet workflows as Authoring Schema node maps.
- Share semantic Sheet panel contracts and calculation breakdowns across clients while keeping web/native overlay geometry and component choice platform-owned.
- Preserve canonical authored root identity from ADR 0011. Campaign content and Marketplace releases introduce explicit immutable version/snapshot contracts only where stable shared or licensed history is required; they do not restore general authored revision history.
- Model authorization as centralized capabilities derived from an explicit authority context. Do not scatter `role === 'GM'` checks through routes and components.
- Persist commands before broadcasting them. Realtime is delivery and invalidation infrastructure, not the source of truth.
- Use idempotency keys, expected versions, row locks, and one Postgres transaction for multi-aggregate operations that must succeed or fail together.
- Keep player-only chat cryptographically and operationally separate from GM-visible channels at authorization, RLS, fetch, subscription, notification, and moderation boundaries.
- Record exact inputs and results required for replay. Never re-run an old Encounter event against newly active content.
- Keep entitlements provider-neutral. Stripe, App Store, Play Store, beta, and administrator grants project into one internal authorization model.
- Keep originals private and asset references stable. Store asset IDs/object keys as truth, never signed URLs; domain records own visibility and references.
- Use purpose-specific upload profiles. Clients cannot select arbitrary buckets/paths, and ordinary attachments cannot inherit the larger limits intended for VTT maps.
- Bind authored artwork to its owned root or draft and Marketplace artwork to exact immutable releases. Builder replacement writes cannot delete Character portraits or Campaign-owned assets.

## Technology direction

| Area                 | Direction                                                                                                                                                          |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Shared language      | TypeScript for clients, transport, orchestration, and pure domain logic                                                                                            |
| Persistence          | PostgreSQL, Supabase migrations/RLS, and Kysely repositories                                                                                                       |
| Web                  | Existing TanStack Start, React, Mantine, Vanilla Extract, TanStack Query                                                                                           |
| Native               | Expo, React Native, Expo Router, TanStack Query, Reanimated, Gesture Handler                                                                                       |
| Contracts            | Zod DTOs in `packages/schema`; typed tRPC through `packages/api-client`                                                                                            |
| Identity             | One Supabase user identity across web, iOS, and Android                                                                                                            |
| Native secrets/cache | `expo-secure-store` for session secrets; `expo-sqlite` for non-authoritative read-only projections                                                                 |
| Realtime             | Private Supabase Broadcast; Presence only for slow-changing connection state                                                                                       |
| Notifications        | `expo-notifications` and Expo Push Service, with API-authorized deep links                                                                                         |
| Media and files      | Private Supabase Storage, API-issued upload intents, signed/authenticated delivery, verified profile limits, image normalization, and quarantined supporting files |
| Dice                 | Restricted server-authoritative evaluation with injected cryptographic randomness and exact per-die evidence; lazy Three/Fiber/Rapier presentation on web          |
| VTT                  | Platform-neutral scene model; PixiJS on web and initially in an Expo DOM host; React Native Skia only if the benchmark gate fails                                  |
| Web payments         | Stripe Billing for Artificer subscriptions; Stripe Connect for creator and professional-GM money movement                                                          |
| Native subscriptions | StoreKit and Google Play Billing through RevenueCat after plan and store-policy approval                                                                           |
| Tests                | Vitest for shared/packages, existing web tests and Playwright, `jest-expo`/React Native Testing Library, Maestro on EAS                                            |

Expo's current guidance supports workspace monorepos, Router-based native navigation, SecureStore, development builds, and EAS profiles. Supabase's React Native guidance requires platform storage and foreground-aware session refresh. Re-check these external contracts when Phase 10 begins because SDK behavior changes: [Expo monorepos](https://docs.expo.dev/guides/monorepos/), [Expo Router](https://docs.expo.dev/router/introduction/), [Supabase React Native Auth](https://supabase.com/docs/guides/auth/quickstarts/react-native).

Supabase currently supports private buckets with RLS or time-limited signed delivery, per-bucket file-size and MIME restrictions, resumable transfers for larger files, and optional image transformations. Re-check limits, pricing, security guidance, and transformation behavior when Phase 02 begins: [Storage access control](https://supabase.com/docs/guides/storage/security/access-control), [bucket fundamentals](https://supabase.com/docs/guides/storage/buckets/fundamentals), [upload limits](https://supabase.com/docs/guides/storage/uploads/file-limits), [standard and resumable upload guidance](https://supabase.com/docs/guides/storage/uploads/standard-uploads), and [image transformations](https://supabase.com/docs/guides/storage/serving/image-transformations).

## Payment-channel strategy

| Product                | Web                              | Native initial state                                     | Native paid state                                                  |
| ---------------------- | -------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------ |
| Artificer subscription | Stripe Billing                   | Consume the existing entitlement; no purchase CTA        | StoreKit/Play Billing through RevenueCat                           |
| Marketplace content    | Deferred until Phases 12–13      | Not part of the initial native release                    | Enable only after free licensing and creator-payout design         |
| Paid table/session     | Stripe Connect                   | Join or manage an existing booking                       | Enable checkout only after service-payment policy review           |
| GM onboarding          | Stripe Connect hosted onboarding | Open an authorized web flow                              | Remain web-hosted unless provider constraints require otherwise    |

Apple Pay and Google Pay are wallet methods inside an allowed payment path; they do not override app-store billing rules. Venmo remains outside the initial design because it adds a second processor and reconciliation model. Before paid native controls are designed, re-check [Apple's review guidelines](https://developer.apple.com/app-store/review/guidelines/), [Google Play's payments policy](https://support.google.com/googleplay/android-developer/answer/9858738), [Stripe's React Native SDK](https://docs.stripe.com/sdks/react-native), and [RevenueCat's Expo integration](https://www.revenuecat.com/docs/getting-started/installation/expo).

## Initial launch plans

| Plan | Price | Owned capacity and hosted scale | Paid tables |
| ---- | ----- | ------------------------------- | ----------- |
| Free | $0 | 6 personal Characters, 20 owned homebrew roots, 250 MB, 1 active hosted Campaign, 5 player seats, 1 public free listing, and 3 saved Encounters | Not available |
| Player | $4.99/month or $49.99/year | Unlimited personal Characters and homebrew, 1 GB, and the same Campaign-hosting limits as Free | Not available |
| GM | $9.99/month or $99.99/year | Player benefits, 5 GB, 5 active Campaigns, 12 seats each, 5 public listings, and unlimited Encounters | 10% Artificer platform fee |
| Pro GM | $49.99/month or $499.99/year | GM benefits, 25 GB, unlimited Campaigns and listings under fair use, and 12 seats per Campaign | 0% Artificer platform fee |

All plans may join unlimited Campaigns, use Campaign-scoped content, contribute owned content when permitted, participate in party inventory, and use Encounters and VTT. Processing charges and applicable taxes are separate from the Artificer platform fee. These prices and limits are the planning baseline and may change from evidence before public launch. Creator and Ultimate plans are intentionally not specified while the creator Marketplace is deferred.

## Web launch and viability gate

After Phase 09, launch hardening restores portability only if its safety and policy gates pass, completes moderation and operational policy, and prepares the connected web product for public use. Marketplace investment requires evidence that:

1. Social Hub listings produce accepted tables.
2. Accepted groups create Campaigns and begin play.
3. Campaigns return for later sessions.
4. Users convert to Player or GM plans or use paid tables.
5. Moderation, payment support, and infrastructure costs remain manageable.

Exact numeric thresholds are a pre-launch business decision. The behaviors above define what must be measured; finishing Phase 09 alone does not authorize native or Marketplace investment.

## Phase documents

| Phase | Document                                                                                   | Exit result                                                                                                                         |
| ----- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| 00    | [Character Sheet play depth and overrides](00-character-sheet-play-depth-and-overrides.md) | **Complete:** authoritative Sheet play, adjustments, explanations, and portable semantic panels                                     |
| 01    | [Dice and roll infrastructure](01-dice-and-roll-infrastructure.md)                         | **Complete:** authoritative rolls, private history, accessible results, and optional lazy 3D presentation                           |
| 02    | [Media and supporting-file pipeline](02-media-and-file-pipeline.md)                        | Authorized private assets support portraits, authored imagery, Campaign files, and VTT maps                                         |
| 03    | [Campaign Core](03-campaign-core.md)                                                       | Campaign membership, roles, characters, content access, rules, and audited GM authority work on web                                |
| 04    | [Social Hub](04-social-hub.md)                                                             | Adults can privately invite or publicly discover, apply to, moderate, and form free tables                                          |
| 05    | [Live Campaign play](05-live-campaign-play.md)                                             | Party inventory, sessions, notes/files, chat, persisted rolls, and Realtime collaboration work on web                              |
| 06    | [Encounters](06-encounters.md)                                                             | Campaign and standalone Encounters provide authoritative manual play on web                                                         |
| 07    | [Web VTT](07-vtt.md)                                                                        | One Encounter-backed VTT provides maps, tokens, fog, measurement, initiative, and accessible controls on web                       |
| 08    | [Plans and entitlements](08-entitlements-and-subscriptions.md)                             | Free, Player, GM, and Pro GM limits and Stripe web subscriptions are enforced server-side                                           |
| 09    | [Paid tables](09-paid-tables.md)                                                           | Approved paid-table checkout, capacity, payouts, refunds, and plan-based fees work on web                                           |
| 10    | [Native foundation and parity](10-cross-platform-foundation.md)                            | After web viability, iOS and Android provide first-class play journeys against the proven contracts                                |
| 11    | [Store release and continuous validation](11-store-release-and-continuous-validation.md)   | Store-ready binaries and repeatable cross-platform release gates exist                                                              |
| 12    | [Free creator Marketplace](12-free-marketplace.md)                                         | Immutable releases, licenses, free acquisition, and attributed consumption work                                                     |
| 13    | [Paid creator Marketplace](13-paid-marketplace.md)                                         | Approved creator checkout, payouts, refunds, disputes, and immutable order economics work                                           |

## Cross-phase acceptance gates

- Web and native parse the same API contracts and produce the same rules results.
- Character adjustments change the same authoritative engine results used by display, rolls, passive checks, HP/rest, spell mechanics, and command validation; clearing an adjustment restores current authored behavior.
- Roll consumers use the Phase 01 authoritative semantic evidence; browser physics never selects or alters a result, and static fallback remains fully usable.
- Effective Character values expose source and adjustment breakdowns to the owner and to future authorized GM readers without granting GM adjustment-edit actions.
- OWNER, GM, PLAYER, removed member, standalone invitee, and non-member matrices pass at API and RLS boundaries.
- Campaign content references grant immutable-version read/use access without transferring ownership, editing, personal export, or Marketplace sale rights.
- Player-only chat tests prove a GM cannot subscribe, fetch, receive notifications for, or infer message content.
- Switching progression mode retains experience and does not rewrite character intent.
- Inventory transfers and correlated Encounter/Sheet changes remain atomic under conflicts and retries.
- Realtime reconnect resumes from an authoritative cursor without duplicate application.
- Native cached data is visibly stale and cannot accept offline mutation.
- Deep links open the correct authorized destination after a cold start and fail closed when access is absent.
- Upload intent, finalize, reference, delivery, replacement, and deletion tests enforce the same asset authorization on web, native, API, and Storage RLS.
- Spoofed, oversized, unsafe, or disallowed uploads never become ready; image delivery strips private metadata; removed members cannot download private Campaign assets.
- Immutable Campaign content versions, Marketplace releases, and Encounter/VTT history retain exact asset references, while VTT map limits remain independent from ordinary Campaign files.
- Duplicate, delayed, and out-of-order provider webhooks converge on the same entitlement state.
- Free, Player, GM, and Pro GM creation, storage, hosted-Campaign, seat, listing, Encounter, and paid-table capabilities are enforced by owning server operations.
- GM and Pro GM paid-table orders snapshot the applicable 10% or 0% Artificer platform fee; processing charges and taxes remain separately represented.
- Web and later native VTT clients reconstruct the same scene from the same Encounter projection.
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
- Expo DOM is the fastest native VTT parity route but has bridge, battery, accessibility, and binary-update constraints. Phase 10 must benchmark it against the shipped web VTT before selecting a fallback.
- Marketplace payments combine app-store collection, creator licensing, tax, refunds, fee calculation, and payouts. They are not an ordinary single-merchant checkout.
- Supporting minors requires a separate age-assurance, guardian, moderation, safety, and retention program.
- Professional page-layout/book authoring is separate from app-native content packages and supplemental files.
- Supporting-file uploads require an allowlist, scanning/quarantine, safe download behavior, quotas, retention, takedown, and cost controls; Phase 02 keeps this bounded rather than becoming a general cloud drive.
- VTT maps may require resumable transfer, optimization, or tiling beyond ordinary Campaign attachments. Those expansions remain in Phase 07 behind the shared asset identity.
- Combat automation, voice/video, multi-seller carts, reviews, gifting, organizations, non-US commerce, and additional payment processors remain later expansions.

## Roadmap-level open questions

- Which legal entity and commercial model will be merchant of record for subscriptions, creator content, and paid tables?
- What public production origin and final iOS/Android application identifiers should own universal links and store records?
- What moderation access, retention, export, deletion, and appeal policy applies to chat, notes, listings, creator releases, and reported content?
- What per-purpose file limits, storage/egress quotas, allowed Campaign attachment types, and public-asset policy should apply to free and paid tiers?
- What numeric table-formation, repeat-play, conversion, cost, and moderation thresholds constitute a passing web viability decision?
- What approved policy and detection evidence is sufficient to reject known official content before portability is enabled?
