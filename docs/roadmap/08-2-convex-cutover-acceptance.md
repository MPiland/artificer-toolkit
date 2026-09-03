# Phase 8.2 — Complete Convex cutover acceptance

- **Status:** transitional
- **Scope:** Supabase-to-Convex backend replacement and pre-launch release proof
- **Update when:** a case status or its evidence changes
- **Verification:** `08-2-convex-cutover-acceptance.json` is the machine-readable ledger

## Goal

Replace Supabase, Kysely, SQL application logic, Netlify product functions, tRPC, and GoRules with
Convex, Better Auth, and the TypeScript Rules Kernel before launch.

The denominator is fixed at **75 cases**. Defects attach to an existing case. Adding, removing, or
splitting a case requires explicit user approval. Architecture is recorded in
[ADR 0029](../adr/0029-convex-backend-cutover.md).

## Progress

| Gate      | Subject                       | Accepted |  Total |
| --------- | ----------------------------- | -------: | -----: |
| 1         | Foundation, auth, operations  |        0 |     15 |
| 2         | Content and rules             |        0 |     16 |
| 3         | Characters, Campaigns, Social |        0 |     19 |
| 4         | Scene, Encounter, VTT         |        0 |     15 |
| 5         | Cutover and release           |        0 |     10 |
| **Total** |                               |    **0** | **75** |

POC evidence does not accept production cases. A case becomes `ACCEPTED` only when its required local
proof is green on the integrated Phase 8.2 source state. Staging is reserved for packaging, managed
secrets, external integrations, authorization, and network performance after the complete local
release lifecycle passes.

## Gate 1 — Foundation, auth, operations

| Case  | Acceptance subject                                          | Required proof    |
| ----- | ----------------------------------------------------------- | ----------------- |
| `F01` | Local Convex development and code generation                | LOCAL_INTEGRATION |
| `F02` | Schema, validators, indexes, and bounded contracts          | REVIEW            |
| `F03` | Better Auth SSR and native-compatible bearer authentication | LOCAL_INTEGRATION |
| `F04` | Server-controlled signup defaults closed                    | LOCAL_INTEGRATION |
| `F05` | Verified signup                                             | LOCAL_INTEGRATION |
| `F06` | Initial account invitations                                 | LOCAL_INTEGRATION |
| `F07` | Login                                                       | LOCAL_INTEGRATION |
| `F08` | Password reset and session revocation                       | LOCAL_INTEGRATION |
| `F09` | Usernames                                                   | LOCAL_INTEGRATION |
| `F10` | Profile privacy                                             | AUTHORIZATION     |
| `F11` | Superadmin authorization                                    | AUTHORIZATION     |
| `F12` | Account deletion                                            | LOCAL_INTEGRATION |
| `F13` | React Email and Resend delivery                             | LOCAL_INTEGRATION |
| `F14` | R2 upload, authorized read, and deletion                    | LOCAL_INTEGRATION |
| `F15` | Deterministic source-data import and audit                  | LOCAL_INTEGRATION |

## Gate 2 — Content and rules

| Case  | Acceptance subject                                         | Required proof    |
| ----- | ---------------------------------------------------------- | ----------------- |
| `C01` | Game Systems and Rules Catalogues                          | LOCAL_INTEGRATION |
| `C02` | Public UUID and checksum stability                         | LOCAL_INTEGRATION |
| `C03` | Background authoring and publication                       | LOCAL_INTEGRATION |
| `C04` | Class authoring and publication                            | LOCAL_INTEGRATION |
| `C05` | Creature authoring and publication                         | LOCAL_INTEGRATION |
| `C06` | Equipment authoring and publication                        | LOCAL_INTEGRATION |
| `C07` | Feat authoring and publication                             | LOCAL_INTEGRATION |
| `C08` | Race authoring and publication                             | LOCAL_INTEGRATION |
| `C09` | Spell authoring and publication                            | LOCAL_INTEGRATION |
| `C10` | Vehicle authoring and publication                          | LOCAL_INTEGRATION |
| `C11` | Effects, grants, modifiers, and reusable definitions       | REVIEW            |
| `C12` | Draft create, save, discard, and recovery                  | LOCAL_INTEGRATION |
| `C13` | Publication validation and mechanics compilation           | REVIEW            |
| `C14` | Deep UUID-safe duplication                                 | LOCAL_INTEGRATION |
| `C15` | Owner, Campaign-share, and master-content authorization    | AUTHORIZATION     |
| `C16` | Node runtime and Rules Kernel execution, pause, and resume | REVIEW            |

## Gate 3 — Characters, Campaigns, Social

| Case  | Acceptance subject                                  | Required proof    |
| ----- | --------------------------------------------------- | ----------------- |
| `P01` | Character drafts                                    | LOCAL_INTEGRATION |
| `P02` | Character Builder choices, readiness, and commit    | LOCAL_E2E         |
| `P03` | Character reconciliation                            | LOCAL_INTEGRATION |
| `P04` | Character Sheet projection and commands             | LOCAL_E2E         |
| `P05` | Hit points, resources, and rests                    | LOCAL_INTEGRATION |
| `P06` | Authoritative rolls and evidence                    | LOCAL_INTEGRATION |
| `P07` | Equipment, inventory state, and grants              | LOCAL_INTEGRATION |
| `P08` | Character replay, concurrency, and rollback         | CONCURRENCY       |
| `P09` | Campaign lifecycle                                  | LOCAL_INTEGRATION |
| `P10` | Campaign membership and authority                   | AUTHORIZATION     |
| `P11` | Campaign content and settings                       | LOCAL_INTEGRATION |
| `P12` | Campaign inventory                                  | LOCAL_INTEGRATION |
| `P13` | Campaign vehicles                                   | LOCAL_INTEGRATION |
| `P14` | Campaign collaboration                              | LOCAL_E2E         |
| `P15` | Sessions and control                                | CONCURRENCY       |
| `P16` | Announcements                                       | LOCAL_INTEGRATION |
| `P17` | Social profiles, listings, applications, and blocks | LOCAL_E2E         |
| `P18` | Notifications and preferences                       | LOCAL_INTEGRATION |
| `P19` | Entitlements and capacity enforcement               | AUTHORIZATION     |

## Gate 4 — Scene, Encounter, VTT

| Case  | Acceptance subject                                              | Required proof    |
| ----- | --------------------------------------------------------------- | ----------------- |
| `V01` | Encounter Blueprints                                            | LOCAL_INTEGRATION |
| `V02` | Campaign Scenes independent of Encounters                       | LOCAL_E2E         |
| `V03` | Scene entities, geometry, and visibility facts                  | LOCAL_INTEGRATION |
| `V04` | R2-backed maps and Scene media lifecycle                        | LOCAL_INTEGRATION |
| `V05` | Session admission and presence                                  | AUTHORIZATION     |
| `V06` | Transient collaboration through the Durable Object              | LOCAL_E2E         |
| `V07` | Committed token movement and multi-client convergence           | LOCAL_E2E         |
| `V08` | Encounter lifecycle and optional Scene binding                  | LOCAL_INTEGRATION |
| `V09` | Encounter actors and initiative                                 | LOCAL_INTEGRATION |
| `V10` | Actions, reactions, effects, and selected optional combat rules | LOCAL_E2E         |
| `V11` | Decisions, pause, and resume                                    | LOCAL_INTEGRATION |
| `V12` | Player and GM privacy and redaction                             | AUTHORIZATION     |
| `V13` | Receipts, replay, and reconnect                                 | LOCAL_E2E         |
| `V14` | Same-aggregate contention and unrelated concurrency             | CONCURRENCY       |
| `V15` | Local and managed performance simulation                        | PERFORMANCE       |

## Gate 5 — Cutover and release

| Case  | Acceptance subject                                                                      | Required proof |
| ----- | --------------------------------------------------------------------------------------- | -------------- |
| `R01` | All product data flows through Convex                                                   | RELEASE        |
| `R02` | Zero Supabase runtime dependency                                                        | RELEASE        |
| `R03` | Zero Kysely, PostgreSQL application SQL, migrations, and generated Supabase types       | RELEASE        |
| `R04` | Zero GoRules runtime dependency                                                         | RELEASE        |
| `R05` | Zero tRPC and product Netlify functions                                                 | RELEASE        |
| `R06` | Durable Object is transient-only                                                        | REVIEW         |
| `R07` | Canonical docs, ADRs, ERDs, deployment guides, and runbooks match the final system      | REVIEW         |
| `R08` | Complete local lifecycle passes from a fresh local Convex deployment                    | RELEASE        |
| `R09` | One staging integration/performance promotion and explicit Supabase retirement decision | STAGING        |
| `R10` | Production deployment and bounded smoke verification                                    | PRODUCTION     |

## Validation cadence

- Each packet runs formatting, affected typechecks, and the smallest affected tests.
- Each acceptance case receives its required focused or integration proof once.
- Each gate receives one integrated run after its source stabilizes.
- Release receives one complete local lifecycle; later source changes rerun from the earliest affected
  stage.
- Staging is not a correctness-debugging environment.
- Existing pure domain, node-map, compiler, and kernel tests are retained. The complete rule corpus
  runs once after kernel cutover stabilizes, not once per browser journey.

## Performance contract

- Ephemeral peer preview p95 is at most 150 ms.
- Warm durable peer convergence p95 is at most 250 ms and p99 at most 500 ms.
- No normal authoritative gameplay command has p95 above one second.
- The fixed load is one GM, five players, eleven actors, eight rounds, and up to two actions plus one
  reaction per actor turn.
- Same-aggregate conflicts, unrelated concurrency, replay, rollback, and privacy are included.

## Deferred

Cryptographic commit/reveal dice, visual rules authoring, native UI and DTO generation, D&D 2024,
external/user-authored Game Systems, GraphQL, tRPC, custom queues, dual-write migration, and custom R2
multipart uploads remain out of scope.
