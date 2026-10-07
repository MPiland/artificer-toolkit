// Generator for docs/roadmap/08-phase-ledger.json. Re-runnable: node build-phase-ledger.mjs [--check]
// Reads the three Phase 8 source ledgers, applies the mapping below, writes the merged ledger, and
// exits 1 if any source id is missing from, or duplicated across, origin/retired lists.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Repo root: two levels above scripts/phase8/ when run from the repo, else the fixed checkout path (scratchpad copy).
const here = path.dirname(fileURLToPath(import.meta.url))
const REPO = fs.existsSync(path.join(here, '../../docs/roadmap'))
  ? path.resolve(here, '../..').replaceAll('\\', '/') + '/'
  : 'D:/dev/artificer-toolkit/'
const R = REPO + 'docs/roadmap/'
const OUT = R + '08-phase-ledger.json'
const a82 = JSON.parse(fs.readFileSync(R + '08-2-convex-cutover-acceptance.json', 'utf8'))
const reg = JSON.parse(fs.readFileSync(R + '08-2-work-slices.json', 'utf8'))
const v08 = JSON.parse(fs.readFileSync(R + '08-vtt-acceptance.json', 'utf8'))

// ---------------------------------------------------------------- sources
const cases82 = new Map()
const crit82 = new Map()
for (const g of a82.gates)
  for (const c of g.cases) {
    cases82.set(c.id, c)
    for (const k of c.criteria) crit82.set(k.id, k)
  }
const slices = new Map(reg.slices.map((s) => [s.id, s]))
const orig08 = [
  ...v08.gates.flatMap((g) => g.cases.map((c) => c.id)),
  ...v08.addenda.flatMap((a) => a.cases.map((c) => c.id))
]

// ---------------------------------------------------------------- features
const F = (id, title, kind, dependsOn, summary) => ({ id, title, kind, dependsOn, summary })
const features = [
  F(
    'PLATFORM',
    'Platform foundation',
    'feature',
    [],
    'Local Convex development, schemas, email, uploads, SRD import, the removal of retired runtimes, and test/dependency health shared by every feature.'
  ),
  F(
    'ACCOUNTS',
    'Accounts',
    'feature',
    ['PLATFORM'],
    'Signup, login, password reset, usernames, profile privacy, superadmin authorization and account deletion.'
  ),
  F(
    'AUTHORING',
    'Content authoring',
    'feature',
    ['PLATFORM'],
    'Game Systems, authored content per domain, drafts, publication, duplication, authorization and content snapshots.'
  ),
  F(
    'RULES',
    'Rules engine',
    'feature',
    ['AUTHORING'],
    'The node runtime and Rules Kernel that execute authored rules, pause and resume them.'
  ),
  F(
    'BUILDER',
    'Character Builder',
    'feature',
    ['AUTHORING', 'RULES'],
    'Character drafts, Builder choices and commit, and reconciliation when sources change.'
  ),
  F(
    'SHEET',
    'Character Sheet',
    'feature',
    ['BUILDER'],
    'The Character Sheet: projection, hit points, rolls, equipment, replay and the Speed fact.'
  ),
  F(
    'CAMPAIGN',
    'Campaigns',
    'feature',
    ['ACCOUNTS', 'SHEET'],
    'Campaign lifecycle, membership, content and settings, inventory, vehicles, announcements and a GM playing a Character.'
  ),
  F(
    'SOCIAL',
    'Social and notifications',
    'feature',
    ['ACCOUNTS'],
    'Social profiles, listings, applications, blocks, notifications and plan limits.'
  ),
  F(
    'ROOM',
    'Sessions and live room',
    'feature',
    ['CAMPAIGN'],
    'Joining the live table, previews, chat and notes, Sessions, and the Session room as live-command authority.'
  ),
  F(
    'SCENE',
    'Scenes and maps',
    'feature',
    ['ROOM'],
    'Campaign Scenes, entities, geometry, visibility facts and R2-backed maps.'
  ),
  F(
    'MOVE',
    'Token movement',
    'feature',
    ['SCENE'],
    'Committed token movement, forced-movement actions and spatial rules.'
  ),
  F(
    'ENCOUNTER',
    'Encounter setup',
    'feature',
    ['ROOM'],
    'Blueprints, Run lifecycle, actors, controllers, initiative and Speed Factor.'
  ),
  F(
    'ATTACK',
    'Attacks and actions',
    'feature',
    ['MOVE', 'ENCOUNTER'],
    'Action resolution, player control of actors, Assisted guidance and undo, optional combat actions and SRD monster attacks.'
  ),
  F(
    'SPELLS',
    'Saves, conditions and spells',
    'feature',
    ['ATTACK'],
    'Saves and effects, conditions, death saves, concentration, spell casting, area actions and unresolved rule kinds.'
  ),
  F(
    'REACTION',
    'Reactions and decisions',
    'feature',
    ['ATTACK'],
    'Pending decisions, pause and resume, roll prompts, auto-roll and reactions.'
  ),
  F(
    'PRIVACY',
    'Privacy and redaction',
    'feature',
    ['ENCOUNTER'],
    'What players, controllers and the GM can see in live and Campaign data.'
  ),
  F(
    'RELIABILITY',
    'Replay, reconnect and contention',
    'feature',
    ['ROOM'],
    'Receipts, replay, reconnect and same-aggregate contention.'
  ),
  F(
    'VTT_UI',
    'VTT presentation',
    'feature',
    ['SCENE', 'ENCOUNTER'],
    'Token identity, status, facing, system state, previews, perception, footprints and accessibility.'
  ),
  F(
    'PERF',
    'Performance and cost',
    'uat',
    [],
    'Latency and free-tier cost across the whole product: the local and managed workloads and the budgets behind them.'
  ),
  F(
    'RELEASE',
    'Release',
    'release',
    [],
    'Docs, the final local lifecycle on one source, staging promotion and production smoke.'
  )
]
// PERF is UAT across the whole product and RELEASE ships it: both depend on every other feature.
for (const f of features)
  if (f.id === 'PERF' || f.id === 'RELEASE')
    f.dependsOn = features
      .filter((o) => o.id !== f.id && o.id !== 'PERF' && o.id !== 'RELEASE')
      .map((o) => o.id)
      .concat(f.id === 'RELEASE' ? ['PERF'] : [])

// ---------------------------------------------------------------- PBI definitions
// cases: 8.2 case ids placed in this PBI's origin; crit: explicit criterion ids (otherwise all criteria of `cases`);
// slices: registry ids placed in the PBI origin (or as slice ACs when sliceAcs); orig: original ids at PBI level;
// journey: repo-relative test files (existence is checked); extra: new ACs for PARTIAL / STILL NEEDED / carry-over work.
const X = (text, origin = [], note, opts = {}) => ({
  text,
  status: opts.status ?? 'TODO',
  origin,
  ...(opts.proof ? { proof: opts.proof } : {}),
  ...(note ? { note } : {})
})
const AP = 'apps/apis/convex/'
const SW = 'apps/session-worker/'
const WE = 'apps/web/tests/e2e/'
const pbis = [
  // PLATFORM
  {
    f: 'PLATFORM',
    n: 1,
    title: 'Develop and generate code against local Convex',
    cases: ['F01'],
    journey: []
  },
  {
    f: 'PLATFORM',
    n: 2,
    title: 'Typed schemas, indexes and bounded contracts',
    cases: ['F02'],
    journey: [AP + 'schemaBoundary.test.ts']
  },
  {
    f: 'PLATFORM',
    n: 3,
    title: 'Account emails send reliably',
    cases: ['F13'],
    journey: [AP + 'email.test.ts']
  },
  {
    f: 'PLATFORM',
    n: 4,
    title: 'Upload, view and delete images and files',
    cases: ['F14'],
    slices: ['PLT-1'],
    journey: [AP + 'media/storage.test.ts', AP + 'media/library.test.ts']
  },
  {
    f: 'PLATFORM',
    n: 5,
    title: 'Import and audit the SRD source data',
    cases: ['F15'],
    journey: [AP + 'content/seed.test.ts', AP + 'content/import.test.ts'],
    extra: [
      X(
        'The SRD manifest freshness check is hardened: a stale or partial manifest fails the import audit explicitly.',
        ['P81-CURRENT-MANIFEST'],
        'Original PARTIAL: freshness hardening not explicit in 8.2.'
      )
    ]
  },
  {
    f: 'PLATFORM',
    n: 6,
    title: 'Convex is the only home for product data',
    cases: ['R01'],
    journey: []
  },
  { f: 'PLATFORM', n: 7, title: 'Nothing depends on Supabase', cases: ['R02'], journey: [] },
  {
    f: 'PLATFORM',
    n: 8,
    title: 'No SQL, Kysely or migrations remain',
    cases: ['R03'],
    journey: []
  },
  { f: 'PLATFORM', n: 9, title: 'Nothing depends on GoRules', cases: ['R04'], journey: [] },
  {
    f: 'PLATFORM',
    n: 10,
    title: 'No tRPC or product Netlify functions; the web app runs on Cloudflare Workers',
    cases: ['R05'],
    slices: ['PLT-5', 'VS-7'],
    journey: []
  },
  {
    f: 'PLATFORM',
    n: 11,
    title: 'Backend tests run real code',
    slices: ['REL-9'],
    sliceAcs: true,
    journey: [AP + 'liveSessions/roomInputs.test.ts']
  },
  {
    f: 'PLATFORM',
    n: 12,
    title: 'Web tests run real contracts',
    slices: ['REL-10'],
    sliceAcs: true,
    journey: []
  },
  {
    f: 'PLATFORM',
    n: 13,
    title: 'Fast, reliable backend, worker and package tests; current dependencies',
    slices: ['CP-S0', 'CP-S1', 'TST-0', 'TST-6', 'REL-8'],
    sliceAcs: true,
    journey: []
  },
  {
    f: 'PLATFORM',
    n: 14,
    title: 'Fast, reliable web tests and tooling',
    slices: ['TST-7', 'TST-8', 'A35-S11g'],
    sliceAcs: true,
    journey: []
  },
  {
    f: 'PLATFORM',
    n: 15,
    title: 'Remove the dead outcome field from the rule occurrence summary contract',
    slices: ['REL-11'],
    sliceAcs: true,
    journey: []
  },
  {
    f: 'PLATFORM',
    n: 16,
    title: 'Remove Convex-held Encounter history tables',
    journey: [],
    extra: [
      X(
        'The encounterRunCommands, encounterRuleReceipts and encounterEvidenceRolls tables are removed (no writer since D88; the contract rejects them), and the roomInputs union, runs.ts, the receiptLedgers cases, campaignDeletion and developmentLifecycle/Checkpoint no longer read them.',
        [],
        'Depends on ROOM-5 (Encounter history lives only in the room).'
      ),
      X('docs/architecture/persistence.md and the ADR 0035 note describe the tables as removed.')
    ]
  },
  {
    f: 'PLATFORM',
    n: 17,
    title: 'Test fixtures use typed parses and one shared builder',
    journey: [],
    extra: [
      X(
        'The `as CreatureAuthored` casts in the session-worker biteWolf/withBite and the apis srdCreatures fixture are replaced by typed parses, and the reason the schema parse output type is incompatible with CreatureAuthored is investigated and recorded.'
      ),
      X(
        'The spatial save-graph construction in apps/session-worker/src/testing/movementPlannerFixture.ts and apps/apis/tests/fixtures/spatialSaveEffect.ts is one shared builder.'
      ),
      X(
        'The 17 captureFake uses in apps/session-worker/test/nativeLiveCaptureReads.test.ts are audited and only true malformed-input cases remain.'
      )
    ]
  },

  // ACCOUNTS
  {
    f: 'ACCOUNTS',
    n: 1,
    title: 'Sign in works on web and native',
    cases: ['F03'],
    journey: [AP + 'auth.test.ts', AP + 'authJwks.test.ts']
  },
  {
    f: 'ACCOUNTS',
    n: 2,
    title: 'Signup stays closed unless the server opens it',
    cases: ['F04'],
    journey: [AP + 'auth.test.ts']
  },
  {
    f: 'ACCOUNTS',
    n: 3,
    title: 'Create an account with a verified email',
    cases: ['F05'],
    journey: [AP + 'auth.test.ts', WE + 'app/authConfirmation.spec.ts']
  },
  {
    f: 'ACCOUNTS',
    n: 4,
    title: 'Invite someone to create an account',
    cases: ['F06'],
    journey: [AP + 'authInvitations.test.ts']
  },
  {
    f: 'ACCOUNTS',
    n: 5,
    title: 'Log in',
    cases: ['F07'],
    journey: [AP + 'auth.test.ts', WE + 'app/authConfirmation.spec.ts']
  },
  {
    f: 'ACCOUNTS',
    n: 6,
    title: 'Reset a forgotten password',
    cases: ['F08'],
    journey: [AP + 'authRecovery.test.ts', AP + 'accountPassword.test.ts']
  },
  {
    f: 'ACCOUNTS',
    n: 7,
    title: 'Choose a username',
    cases: ['F09'],
    journey: [AP + 'auth.test.ts']
  },
  {
    f: 'ACCOUNTS',
    n: 8,
    title: 'Control who sees my profile',
    cases: ['F10'],
    journey: [AP + 'social/profiles.test.ts']
  },
  {
    f: 'ACCOUNTS',
    n: 9,
    title: 'Superadmin-only actions',
    cases: ['F11'],
    journey: [AP + 'authAdmin.test.ts']
  },
  {
    f: 'ACCOUNTS',
    n: 10,
    title: 'Delete my account',
    cases: ['F12'],
    slices: ['A35-S7b', 'VS-4'],
    journey: [
      AP + 'accountDeletion.test.ts',
      AP + 'developmentAccountDeletionRollback.test.ts',
      AP + 'liveSessions/heldAccountDeletion.test.ts',
      AP + 'campaigns/deletedMemberHistory.test.ts'
    ]
  },

  // AUTHORING
  {
    f: 'AUTHORING',
    n: 1,
    title: 'Browse Game Systems and Rules Catalogues',
    cases: ['C01'],
    slices: ['PRF-8'],
    journey: [
      AP + 'content/systems.test.ts',
      AP + 'content/systemCapability.test.ts',
      WE + 'storybook/authoringWalkthrough.spec.ts'
    ],
    extra: [
      X(
        'The shell and navigation are System-aware and capability-driven.',
        ['G3-SYSTEM-SHELL'],
        'Original PARTIAL: no explicit shell/navigation criterion; needs verification.'
      ),
      X(
        'Neutral second-System portability tracers exist, and the docs and ERDs describe the System-neutral model.',
        ['G1-PORTABILITY-DOCS'],
        'Original PARTIAL: neutral second-System tracers are not in 8.2.'
      )
    ]
  },
  {
    f: 'AUTHORING',
    n: 2,
    title: 'Content keeps stable public IDs and checksums',
    cases: ['C02'],
    journey: [AP + 'content/publicationDocument.test.ts']
  },
  {
    f: 'AUTHORING',
    n: 3,
    title: 'Author and publish a Background',
    cases: ['C03'],
    journey: [AP + 'content/publication.test.ts']
  },
  {
    f: 'AUTHORING',
    n: 4,
    title: 'Author and publish a Class',
    cases: ['C04'],
    journey: [AP + 'content/classPublication.test.ts']
  },
  {
    f: 'AUTHORING',
    n: 5,
    title: 'Author and publish a Creature',
    cases: ['C05'],
    journey: [AP + 'content/creaturePublication.test.ts']
  },
  {
    f: 'AUTHORING',
    n: 6,
    title: 'Author and publish Equipment',
    cases: ['C06'],
    journey: [AP + 'content/equipmentPublication.test.ts']
  },
  {
    f: 'AUTHORING',
    n: 7,
    title: 'Author and publish a Feat',
    cases: ['C07'],
    journey: [AP + 'content/featPublication.test.ts']
  },
  {
    f: 'AUTHORING',
    n: 8,
    title: 'Author and publish a Race',
    cases: ['C08'],
    journey: [AP + 'content/racePublication.test.ts']
  },
  {
    f: 'AUTHORING',
    n: 9,
    title: 'Author and publish a Spell',
    cases: ['C09'],
    slices: ['PRF-7'],
    journey: [AP + 'content/spellPublication.test.ts']
  },
  {
    f: 'AUTHORING',
    n: 10,
    title: 'Author and publish a Vehicle',
    cases: ['C10'],
    journey: [AP + 'content/vehiclePublication.test.ts']
  },
  {
    f: 'AUTHORING',
    n: 11,
    title: 'Author reusable effects, grants and modifiers',
    cases: ['C11'],
    journey: [AP + 'content/definitions.test.ts']
  },
  {
    f: 'AUTHORING',
    n: 12,
    title: 'Save, discard and recover drafts',
    cases: ['C12'],
    journey: [AP + 'content/drafts.test.ts'],
    extra: [
      X(
        'Override, Edit Source and Create New are separate, explicit authoring intents.',
        ['G1-AUTHORING-INTENT'],
        'Original PARTIAL: explicit "Override" intent separation not found as a criterion (C12, C14, C15 cover the pieces).'
      )
    ]
  },
  {
    f: 'AUTHORING',
    n: 13,
    title: 'Publication validates and compiles mechanics',
    cases: ['C13'],
    slices: ['A36-S1', 'A36-S2'],
    journey: [AP + 'contentSnapshots/build.test.ts', AP + 'content/publicationDocument.test.ts']
  },
  {
    f: 'AUTHORING',
    n: 14,
    title: 'Duplicate content with fresh IDs',
    cases: ['C14'],
    journey: [AP + 'content/documents.test.ts']
  },
  {
    f: 'AUTHORING',
    n: 15,
    title: 'Control who can edit and use content',
    cases: ['C15'],
    slices: ['A36-S3/S4'],
    journey: [AP + 'contentSnapshots/access.test.ts', AP + 'campaigns/contentShares.test.ts']
  },

  // RULES
  {
    f: 'RULES',
    n: 1,
    title: 'Run authored rules, pause and resume them',
    cases: ['C16'],
    slices: ['CP-S2'],
    journey: [
      AP + 'encounters/concentration.test.ts',
      SW + 'src/nativeRoomEncounterCommand.test.ts'
    ],
    extra: [
      X(
        'Mixed dice-plus-modifier healing keeps its roll identity through the kernel.',
        ['P81-CURRENT-MIXED-HEALING'],
        'Original PARTIAL: likely covered by kernel tests; add an explicit proof.'
      ),
      X(
        'Multiple damage parts on one path keep their identity through the kernel.',
        ['P81-CURRENT-MULTI-DAMAGE'],
        'Original PARTIAL: likely covered by kernel tests; add an explicit proof.'
      )
    ]
  },

  // BUILDER
  {
    f: 'BUILDER',
    n: 1,
    title: 'Save Character drafts',
    cases: ['P01'],
    slices: ['TST-4'],
    journey: [AP + 'characters/drafts.test.ts', WE + 'app/characterBuilder.spec.ts']
  },
  {
    f: 'BUILDER',
    n: 2,
    title: 'Build a Character from choices and commit it',
    cases: ['P02'],
    slices: ['A36-S5', 'A36-S6', 'A36-S7', 'A36-S8/S9', 'A36-F1', 'VS-6'],
    journey: [
      WE + 'app/characterBuilder.spec.ts',
      AP + 'characters/commit.test.ts',
      AP + 'characters/builderSnapshotParity.test.ts'
    ]
  },
  {
    f: 'BUILDER',
    n: 3,
    title: 'Characters reconcile when sources change',
    cases: ['P03'],
    journey: [
      AP + 'characters/repairState.test.ts',
      AP + 'campaigns/membershipDepartureEffects.test.ts'
    ]
  },

  // SHEET
  {
    f: 'SHEET',
    n: 1,
    title: 'View and edit a Character Sheet',
    cases: ['P04'],
    slices: ['A35-S1c', 'CP-S6d'],
    journey: [WE + 'app/characterSheet.spec.ts', WE + 'app/characterSheetSpells.spec.ts']
  },
  {
    f: 'SHEET',
    n: 2,
    title: 'Track hit points, resources and rests',
    cases: ['P05'],
    journey: [AP + 'characters/sheetPlayState.test.ts', AP + 'characters/sheetRest.test.ts']
  },
  {
    f: 'SHEET',
    n: 3,
    title: 'Roll dice with trusted results',
    cases: ['P06'],
    slices: ['CP-S6i'],
    journey: [
      AP + 'campaigns/rolls.test.ts',
      AP + 'rolls.test.ts',
      SW + 'src/roomPrivateRolls.test.ts'
    ]
  },
  {
    f: 'SHEET',
    n: 4,
    title: 'Manage equipment, inventory and grants',
    cases: ['P07'],
    journey: [AP + 'characters/sheetInventory.test.ts']
  },
  {
    f: 'SHEET',
    n: 5,
    title: 'Sheet edits replay, never collide and roll back cleanly',
    cases: ['P08'],
    slices: ['A35-S7a'],
    journey: [
      AP + 'characters/developmentConcurrencyProof.test.ts',
      AP + 'characters/playStateConcurrency.test.ts',
      AP + 'liveSessions/heldSheetPlay.test.ts'
    ]
  },
  {
    f: 'SHEET',
    n: 6,
    title: 'The Sheet shows the correct Speed',
    journey: [],
    extra: [
      X(
        "The Character Sheet overview shows the Character's walking Speed and any extra speeds from its rules evaluation.",
        [],
        'Defect: the Sheet showed no Speed. Fix is uncommitted: sheetProjection.ts adds a Speed overview fact from ruleEvaluation.output.movement via formatExtraSpeedLabel, and CharacterSheetOverviewVitals.tsx renders it.',
        {
          status: 'IN_PROGRESS',
          proof: ['packages/rules-runtime/src/__tests__/sheetProjectionSpeed.test.ts']
        }
      )
    ]
  },
  {
    f: 'SHEET',
    n: 7,
    title: 'Small Sheet edits read only what they change',
    journey: [],
    extra: [
      X(
        'A note edit reads only its notes and groups, collection counts, clocks and receipt; Character aggregate hashes are derived at assembly instead of persisted on the head, while typed records, identity, ownership, order and count checks and canonical full-capture hashes remain.',
        [],
        'User approved the Character aggregate-checksum proposal on 2026-10-06 (phase-08-2-decisions.md Resolved); proposal: local-validation/character-head-checksum-proposal.md.'
      )
    ]
  },

  // CAMPAIGN
  {
    f: 'CAMPAIGN',
    n: 1,
    title: 'Create and manage a Campaign',
    cases: ['P09'],
    journey: [AP + 'campaigns/lifecycle.test.ts', AP + 'campaigns/deletionLifecycle.test.ts']
  },
  {
    f: 'CAMPAIGN',
    n: 2,
    title: 'Invite members and control authority',
    cases: ['P10'],
    journey: [
      AP + 'campaigns/membershipDeparture.test.ts',
      AP + 'campaigns/assignments.test.ts',
      AP + 'campaigns/ownership.test.ts'
    ]
  },
  {
    f: 'CAMPAIGN',
    n: 3,
    title: 'Choose Campaign content and settings',
    cases: ['P11'],
    journey: [
      AP + 'campaigns/playSettings.test.ts',
      AP + 'campaigns/contentShares.test.ts',
      AP + 'campaigns/update.test.ts'
    ]
  },
  {
    f: 'CAMPAIGN',
    n: 4,
    title: 'Share a party inventory',
    cases: ['P12'],
    journey: [AP + 'campaigns/partyInventory.test.ts', AP + 'campaigns/inventoryTransfers.test.ts']
  },
  {
    f: 'CAMPAIGN',
    n: 5,
    title: 'Manage Campaign vehicles',
    cases: ['P13'],
    journey: [AP + 'campaigns/vehicles.test.ts', AP + 'campaigns/vehicleLifecycle.test.ts']
  },
  {
    f: 'CAMPAIGN',
    n: 6,
    title: 'Post announcements',
    cases: ['P16'],
    journey: [AP + 'campaigns/announcements.test.ts']
  },
  {
    f: 'CAMPAIGN',
    n: 7,
    title: 'The GM plays a Character like any other player',
    slices: ['PLT-9'],
    sliceAcs: true,
    journey: []
  },
  {
    f: 'CAMPAIGN',
    n: 8,
    title: 'Campaign access refusals explain themselves on deployed Convex',
    journey: [],
    extra: [
      X(
        'Every requireCampaignAuthority caller in apps/apis/convex throws a typed domain rejection (rejectDomain CAMPAIGN_NOT_FOUND) instead of a plain Error, so deployed Convex no longer redacts it to "Server Error". The join-ticket path is already done.',
        [],
        'Depends on PLATFORM and ACCOUNTS authorization contracts.'
      ),
      X(
        'The exact-message match at notifications/source.ts:20 and the apps/web/tests/live-backend regexes match the typed rejection.'
      )
    ]
  },

  // SOCIAL
  {
    f: 'SOCIAL',
    n: 1,
    title: 'Social profiles, listings, applications and blocks',
    cases: ['P17'],
    journey: [
      AP + 'social/admission.test.ts',
      AP + 'social/listings.test.ts',
      AP + 'social/blockActions.test.ts'
    ]
  },
  {
    f: 'SOCIAL',
    n: 2,
    title: 'Notifications and preferences',
    cases: ['P18'],
    journey: [
      AP + 'notifications.test.ts',
      AP + 'notifications/delivery.test.ts',
      WE + 'storybook/notifications.spec.ts'
    ]
  },
  {
    f: 'SOCIAL',
    n: 3,
    title: 'Plan limits and capacity',
    cases: ['P19'],
    slices: ['PLT-2', 'PLT-3'],
    journey: [AP + 'accountEntitlements.test.ts', AP + 'campaigns/contentLimits.test.ts']
  },

  // ROOM
  {
    f: 'ROOM',
    n: 1,
    title: 'Join the live table',
    cases: ['V05'],
    slices: ['A35-S4', 'CP-S5'],
    journey: [
      SW + 'test/nativeRoomAdmission.test.ts',
      AP + 'liveSessions/tickets.test.ts',
      SW + 'src/ticket.test.ts'
    ]
  },
  {
    f: 'ROOM',
    n: 2,
    title: 'Share previews and pings live',
    cases: ['V06'],
    slices: ['PRF-5', 'PLT-4'],
    journey: [AP + 'liveSessions/transientHttp.test.ts', SW + 'test/nativeLiveSessionRoom.test.ts']
  },
  {
    f: 'ROOM',
    n: 3,
    title: 'Chat, rolls, notes and shared maps at the table',
    cases: ['P14'],
    slices: ['A35-S8a', 'PRF-6', 'PLT-7', 'PLT-8', 'VS-5', 'VS-11'],
    journey: [
      AP + 'campaigns/chat.test.ts',
      AP + 'campaigns/notebooks.test.ts',
      AP + 'scenes/showings.test.ts',
      SW + 'src/roomRulesChat.test.ts'
    ]
  },
  {
    f: 'ROOM',
    n: 4,
    title: 'Plan and log Sessions',
    cases: ['P15'],
    slices: ['A35-S3b'],
    journey: [
      AP + 'campaigns/sessions.test.ts',
      AP + 'campaigns/sessionNotes.test.ts',
      AP + 'campaigns/clock.test.ts',
      AP + 'campaigns/campaignPlay.test.ts'
    ]
  },
  {
    f: 'ROOM',
    n: 5,
    title: 'The room runs live play and saves it to Convex',
    cases: ['R06'],
    slices: [
      'A35-S0',
      'A35-S1',
      'A35-S2',
      'A35-S3a',
      'A35-S5',
      'A35-S6c1',
      'A35-S6c2',
      'A35-S6c3',
      'A35-S10d',
      'A36-S10',
      'CP-S4A',
      'TST-5',
      'VS-3'
    ],
    journey: [
      SW + 'test/nativeRoomCheckpointBarrier.test.ts',
      SW + 'test/nativeLiveSessionRoom.test.ts',
      AP + 'liveSessions/checkpoint.test.ts',
      AP + 'liveSessions/encounterJourneys.test.ts'
    ]
  },
  {
    f: 'ROOM',
    n: 6,
    title: 'Room tests cover multi-Character and multi-controller scenarios',
    journey: [],
    extra: [
      X(
        'movementRoomFixture offers a player-socket (asPlayer) reactor, proved by a room test that a player socket drives its own Character.',
        [],
        'Depends on ROOM-5 (real Session Worker room tests).'
      ),
      X('A room-side spatial save-effect hazard execution is proved against the real room.'),
      X(
        'Maintenance has multi-Character and detached-Character variants, plus the CHARACTER-owner maintenance producer test.'
      ),
      X('encounterMovementPending receipts increase by one, asserted room-side.'),
      X('Empty-prior maintenance (RETAIN_UNTIL_TERMINAL) is proved room-side.'),
      X('Assisted maintenance pauses and stale refusals are proved, using a room seed route.'),
      X('Character-initiator Disarm is proved room-side.'),
      X('A Longsword EQUIPMENT root is used in the room fixtures (Club is used today).'),
      X('turnConcentration is proved with two Characters.'),
      X('equipmentCommands are proved with R2 content seeding in the room fixtures.'),
      X(
        'The srdLegendaryAction player-controller and GM-override cases are proved with a two-controller fixture.'
      ),
      X(
        'Movement coverage includes the concentration advantage case and a shared spatial effect across two targets.'
      ),
      X('Initiative receipt metadata echoes a non-empty resolutionCommands, asserted room-side.')
    ]
  },

  // SCENE
  {
    f: 'SCENE',
    n: 1,
    title: 'Create Scenes independent of Encounters',
    cases: ['V02'],
    journey: [AP + 'scenes/definitions.test.ts', AP + 'scenes/presentations.test.ts']
  },
  {
    f: 'SCENE',
    n: 2,
    title: 'Place tokens, walls, doors and light on a Scene',
    cases: ['V03'],
    slices: [
      'A35-S3c0',
      'A35-S3c1',
      'A35-S3c2',
      'A35-S3c3',
      'A35-S6a',
      'A35-S6b',
      'CP-S6a',
      'VS-1'
    ],
    journey: [
      AP + 'liveSessions/roomSceneCommands.test.ts',
      AP + 'scenes/fog.test.ts',
      SW + 'src/roomSceneVision.test.ts'
    ]
  },
  {
    f: 'SCENE',
    n: 3,
    title: 'Upload maps and manage Scene media',
    cases: ['V04'],
    journey: [AP + 'media/vttMap.test.ts']
  },

  // MOVE
  {
    f: 'MOVE',
    n: 1,
    title: 'Move tokens and see every client converge',
    cases: ['V07'],
    slices: ['CP-S4-c', 'CP-S4-c2', 'TST-3', 'VS-2'],
    journey: [
      AP + 'scenes/spatialCommit.test.ts',
      AP + 'liveSessions/encounterMovementAdmission.test.ts',
      AP + 'scenes/automaticCharacterMovement.test.ts',
      SW + 'test/nativeMovementPlanning.test.ts'
    ]
  },
  {
    f: 'MOVE',
    n: 2,
    title: 'Overrun, Shove Aside and Tumble',
    journey: [],
    extra: [
      X('Overrun policy and path opportunity are authored and typed.', ['P81-OVERRUN-SOURCE']),
      X('Overrun resolves as a contested move in the room.', ['P81-OVERRUN-EXECUTION']),
      X('Shove Aside policy is authored and typed.', ['P81-SHOVE-ASIDE-SOURCE']),
      X('Shove Aside chooses a legal destination and commits it.', ['P81-SHOVE-ASIDE-DESTINATION']),
      X('Tumble policy is authored and typed.', ['P81-TUMBLE-SOURCE']),
      X('Tumble resolves in the room.', ['P81-TUMBLE-EXECUTION'])
    ]
  },
  {
    f: 'MOVE',
    n: 3,
    title: 'Auras and traps',
    journey: [],
    extra: [
      X(
        'Auras and traps execute against moving tokens, with their previews and privacy.',
        ['G2-SPATIAL-PERCEPTION'],
        'Original PARTIAL: auras and traps execution is not in 8.2 criteria; movement and geometry facts are covered by V03/V07.'
      )
    ]
  },

  // ENCOUNTER
  {
    f: 'ENCOUNTER',
    n: 1,
    title: 'Prepare Encounter Blueprints',
    cases: ['V01'],
    journey: [AP + 'encounters/blueprints.test.ts', AP + 'encounters/blueprintSnapshots.test.ts']
  },
  {
    f: 'ENCOUNTER',
    n: 2,
    title: 'Start, run and finish an Encounter',
    cases: ['V08'],
    slices: ['CP-S3', 'CP-S6e', 'A35-S11h', 'A35-S11i'],
    journey: [
      AP + 'encounters/commands.test.ts',
      AP + 'encounters/sceneBindings.test.ts',
      AP + 'campaigns/campaignPlay.test.ts'
    ],
    extra: [
      X(
        'Assisted and Manual modes both work end to end, including sanitized reminders; Automatic mode is intentionally not offered (ADR 0034).',
        ['G2-AUTOMATION-MODES'],
        'Original CONFLICT: the Automatic part is retired by ADR 0034; the Assisted and Manual parts stay as this criterion. Sanitized-reminder coverage is unverified.'
      )
    ]
  },
  {
    f: 'ENCOUNTER',
    n: 3,
    title: 'Add actors, set controllers and roll initiative',
    cases: ['V09'],
    slices: ['CP-S6b', 'TST-2'],
    journey: [
      AP + 'encounters/actorCommands.test.ts',
      AP + 'encounters/initiativeDeclarations.test.ts',
      AP + 'encounters/playerControl.test.ts'
    ]
  },
  {
    f: 'ENCOUNTER',
    n: 4,
    title: 'Speed Factor initiative',
    journey: [],
    extra: [
      X('Speed Factor can be declared for an actor.', ['P81-SPEED-DECLARATION']),
      X('Speed Factor modifiers produce the correct turn order.', ['P81-SPEED-ORDERING']),
      X('Speed Factor ties are settled by the authored rule.', ['P81-SPEED-TIES']),
      X('A declared Speed Factor is enforced when the declared action resolves.', [
        'P81-SPEED-ENFORCEMENT'
      ])
    ]
  },
  {
    f: 'ENCOUNTER',
    n: 5,
    title: 'Three-user Assisted Encounter journey',
    journey: [
      AP + 'liveSessions/encounterJourneys.test.ts',
      'apps/web/tests/managed-vtt/managedRemoteVtt.spec.ts'
    ],
    extra: [
      X(
        'A three-user Encounter journey passes in Assisted mode with auto-roll on.',
        ['G5-AUTOMATIC-JOURNEY'],
        'Replaces the original three-user Automatic journey (ADR 0034); AUTOMATIC is not reinstated.'
      )
    ]
  },

  // ATTACK
  {
    f: 'ATTACK',
    n: 1,
    title: 'Resolve attacks and actions',
    cases: ['V10'],
    crit: ['V10.1', 'V10.3', 'V10.4'],
    slices: ['CP-S4B', 'CP-S6c', 'CP-S6g', 'RUL-1', 'RUL-7', 'TST-1'],
    journey: [
      AP + 'encounters/actionCommands.test.ts',
      AP + 'encounters/basicActions.test.ts',
      AP + 'encounters/actionDisarm.test.ts'
    ]
  },
  {
    f: 'ATTACK',
    n: 2,
    title: 'Players act for their own actors',
    crit: ['V10.5', 'V10.6', 'V10.7', 'V10.10'],
    journey: [
      AP + 'encounters/playerControl.test.ts',
      AP + 'scenes/automaticCharacterMovement.test.ts'
    ],
    extra: [
      X(
        'A player can do everything the GM can for their own Characters in play (player play parity, launch-gating).',
        [],
        'Carry-over from ADR 0034 (inventory section 7).'
      )
    ]
  },
  {
    f: 'ATTACK',
    n: 3,
    title: 'Assisted guidance and GM undo',
    crit: ['V10.8', 'V10.9', 'V10.11'],
    slices: ['CP-S6f'],
    journey: [AP + 'liveSessions/encounterJourneys.test.ts']
  },
  {
    f: 'ATTACK',
    n: 4,
    title: 'Cleaving',
    journey: [AP + 'encounters/cleaving.test.ts'],
    extra: [
      X(
        'Cleaving policy and target selection are authored and typed.',
        ['P81-CLEAVING-SOURCE'],
        'Decisions D31/D48; no 8.2 criterion names Cleaving.'
      ),
      X(
        'Cleaving carries excess damage down its chain.',
        ['P81-CLEAVING-EXECUTION'],
        'Decisions D31/D48; cleaving.test.ts exists but no criterion accepts it.'
      )
    ]
  },
  {
    f: 'ATTACK',
    n: 5,
    title: 'Every SRD monster attack runs',
    slices: ['RUL-2', 'RUL-3', 'RUL-4', 'RUL-5'],
    journey: [
      AP + 'encounters/srdCreatureHitRiders.test.ts',
      AP + 'encounters/srdLegendaryAction.test.ts'
    ],
    extra: [
      X(
        'Every SRD monster attack runs: the 41 allowlisted unsupported attacks (of 551) are implemented and the allowlist is empty.',
        ['G2-SRD-MANIFEST'],
        'Carry-over (closed-beta gate); also RUL-9 slices 2 and 9.'
      ),
      X(
        'Balor Whip (forced movement) runs.',
        ['P81-CREATURE-BALOR-WHIP'],
        'Verify against the 41-attack allowlist.'
      ),
      X(
        'Clay Golem Slam runs.',
        ['P81-CREATURE-CLAY-GOLEM-SLAM'],
        'Verify against the 41-attack allowlist.'
      ),
      X(
        'Cloaker Bite runs.',
        ['P81-CREATURE-CLOAKER-BITE'],
        'Verify against the 41-attack allowlist.'
      ),
      X(
        'Dryad Shillelagh runs.',
        ['P81-CREATURE-DRYAD-SHILLELAGH'],
        'Verify against the 41-attack allowlist.'
      ),
      X(
        'The enlarged Duergar war pick runs.',
        ['P81-CREATURE-DUERGAR-WAR-PICK'],
        'Verify against the 41-attack allowlist.'
      ),
      X(
        'The enlarged Duergar javelin runs.',
        ['P81-CREATURE-DUERGAR-JAVELIN'],
        'Verify against the 41-attack allowlist.'
      ),
      X(
        'Kraken Lightning Storm runs.',
        ['P81-CREATURE-KRAKEN-LIGHTNING'],
        'Verify against the 41-attack allowlist.'
      ),
      X(
        'Purple Worm Tail Stinger runs.',
        ['P81-CREATURE-PURPLE-WORM-STINGER'],
        'Verify against the 41-attack allowlist.'
      ),
      X(
        'Quasit Claws run.',
        ['P81-CREATURE-QUASIT-CLAWS'],
        'Verify against the 41-attack allowlist.'
      ),
      X(
        'Quasit Scare runs.',
        ['P81-CREATURE-QUASIT-SCARE'],
        'Verify against the 41-attack allowlist.'
      ),
      X(
        'Rug of Smothering runs.',
        ['P81-CREATURE-RUG-SMOTHER'],
        'Verify against the 41-attack allowlist.'
      ),
      X(
        'Shadow Strength Drain runs.',
        ['P81-CREATURE-SHADOW-DRAIN'],
        'Verify against the 41-attack allowlist.'
      ),
      X(
        'Spirit Naga Bite runs.',
        ['P81-CREATURE-SPIRIT-NAGA-BITE'],
        'Verify against the 41-attack allowlist.'
      ),
      X(
        'Remaining monster riders (swallow, attach, curse, drain, pull, follow-up saves) run, ordered by marquee monsters.',
        [],
        'rul-9-rules-audit.md slice 9; depends on conditions, grapple and area actions.'
      )
    ]
  },
  {
    f: 'ATTACK',
    n: 6,
    title: 'Creature gear and loadout',
    journey: [AP + 'encounters/equipmentCommands.test.ts'],
    extra: [
      X(
        'Creature equipment is a UUID-backed loadout contract shared by authoring and Encounters.',
        ['P81-CREATURE-GEAR-CONTRACT']
      ),
      X('The Creature equipment source audit names loadout-specific checks.', [
        'P81-CREATURE-GEAR-SOURCE-AUDIT'
      ]),
      X('Modular equipment mechanics derive from one shared path for Creatures and Characters.', [
        'P81-CREATURE-GEAR-DERIVATION'
      ]),
      X(
        "The GM can replace an active Creature actor's loadout.",
        ['P81-CREATURE-GEAR-ACTOR-REPLACE'],
        'REPLACE_CREATURE_EQUIPMENT and equipmentCommands.test.ts exist; verify against the original scenario before accepting.'
      ),
      X(
        'A loadout replacement and an action racing: replacement first leaves one consistent result.',
        ['P81-RACE-LOADOUT-ACTION-REPLACE-FIRST']
      ),
      X('A loadout replacement and an action racing: action first leaves one consistent result.', [
        'P81-RACE-LOADOUT-ACTION-ACTION-FIRST'
      ])
    ]
  },
  {
    f: 'ATTACK',
    n: 7,
    title: 'Grapple and shove',
    journey: [],
    extra: [
      X(
        'Grapple and shove resolve: contests, escape DC, size limits, ending on distance or incapacitation, and monster grapple riders.',
        [],
        'rul-9-rules-audit.md slice 2 (depends on conditions).'
      )
    ]
  },
  {
    f: 'ATTACK',
    n: 8,
    title: 'Multiattack and Extra Attack',
    journey: [],
    extra: [
      X(
        'Attack-count allowance and auto-sequence work for Multiattack (62 SRD Multiattacks) and Extra Attack.',
        [],
        'rul-9-rules-audit.md slice 6.'
      )
    ]
  },
  {
    f: 'ATTACK',
    n: 9,
    title: 'Class-feature resolvers',
    journey: [],
    extra: [
      X(
        'Rage, Sneak Attack, Smite, Action Surge, Second Wind and two-weapon fighting resolve.',
        [],
        'rul-9-rules-audit.md slice 7 (Extra Attack, Sneak Attack and Rage first for beta).'
      )
    ]
  },
  {
    f: 'ATTACK',
    n: 10,
    title: 'Attack-roll perception',
    journey: [],
    extra: [
      X(
        'Invisible, unseen and hidden attackers grant advantage or disadvantage in RESOLVE_ACTION, and Dodge checks sight.',
        [],
        'rul-9-rules-audit.md slice 11.'
      )
    ]
  },

  // SPELLS
  {
    f: 'SPELLS',
    n: 1,
    title: 'Saves and effects resolve with the right people rolling',
    crit: ['V10.2', 'V11.4'],
    journey: [
      AP + 'encounters/turnActiveEffects.test.ts',
      AP + 'encounters/turnConcentration.test.ts',
      AP + 'encounters/concentration.test.ts'
    ]
  },
  {
    f: 'SPELLS',
    n: 2,
    title: 'Conditions apply their mechanics',
    journey: [],
    extra: [
      X(
        'Condition effects (D63) are modeled: Poisoned, Frightened, Prone, Restrained, Paralyzed, Unconscious, Stunned and Petrified apply auto-fail, advantage-against, speed 0 and critical rules; exhaustion levels follow.',
        ['G2-OUTCOMES'],
        'Original PARTIAL: rules-runtime.md says condition effects are not modeled; rul-9-rules-audit.md slice 1.'
      )
    ]
  },
  {
    f: 'SPELLS',
    n: 3,
    title: 'Dying and death saves',
    slices: ['RUL-6'],
    sliceAcs: true,
    journey: [AP + 'encounters/defeat.test.ts'],
    extra: [
      X(
        'Characters at 0 HP are dying and make death saves: prompted saves, damage at 0, massive damage, STABILIZE and healing from 0.',
        [],
        'rul-9-rules-audit.md slice 3; 8.3 carry-over.'
      )
    ]
  },
  {
    f: 'SPELLS',
    n: 4,
    title: 'Every authored CLOSED_RULE kind has a resolver',
    journey: [],
    extra: [
      X(
        'CLOSED_RULE kinds that can be authored all have a resolver in rules-runtime.',
        [],
        'Carry-over: rules-runtime.md lists kinds authored with no resolver.'
      )
    ]
  },
  {
    f: 'SPELLS',
    n: 5,
    title: 'Grants apply through APPLY_GRANT',
    journey: [],
    extra: [
      X(
        'APPLY_GRANT executes during play.',
        [],
        'Carry-over: moved into the 8.3 scope in future-enhancements.md.'
      )
    ]
  },
  {
    f: 'SPELLS',
    n: 6,
    title: 'Pre-beta rules audit',
    slices: ['RUL-9'],
    sliceAcs: true,
    journey: []
  },
  {
    f: 'SPELLS',
    n: 7,
    title: 'Area and multi-target actions',
    journey: [],
    extra: [
      X(
        'Multi-target RESOLVE_ACTION, templates, per-target saves, cover and breath/area Legendary options work.',
        [],
        'rul-9-rules-audit.md slice 4.'
      )
    ]
  },
  {
    f: 'SPELLS',
    n: 8,
    title: 'Cast spells in an Encounter',
    journey: [],
    extra: [
      X(
        'Spell action choices, slot spend and undo, upcasting, rituals, concentration start, multi-effect spells and components work in an Encounter.',
        [],
        'rul-9-rules-audit.md slice 5 (depends on area actions).'
      )
    ]
  },
  {
    f: 'SPELLS',
    n: 9,
    title: 'Concentration and defense completions',
    journey: [],
    extra: [
      X(
        'Concentration ends on incapacitation or death, and nonmagical-weapon defenses apply.',
        [],
        'rul-9-rules-audit.md slice 10 (depends on conditions).'
      )
    ]
  },

  // REACTION
  {
    f: 'REACTION',
    n: 1,
    title: 'Decisions reach the right players and resume',
    cases: ['V11'],
    crit: ['V11.1', 'V11.2', 'V11.3', 'V11.10'],
    journey: [
      AP + 'encounters/occurrenceVoid.test.ts',
      AP + 'encounters/actionDisarm.test.ts',
      AP + 'liveSessions/encounterMovementDecisions.test.ts',
      AP + 'liveSessions/encounterMovementPending.test.ts'
    ]
  },
  {
    f: 'REACTION',
    n: 2,
    title: 'Roll prompts and auto-roll',
    crit: ['V11.5', 'V11.6', 'V11.7', 'V11.9'],
    slices: ['CP-S4-a'],
    journey: [AP + 'encounters/evidenceRolls.test.ts', SW + 'src/roomTestDice.test.ts']
  },
  {
    f: 'REACTION',
    n: 3,
    title: 'Reactions as Use or Decline choices',
    crit: ['V11.8'],
    journey: [
      AP + 'scenes/assistedAutomaticMovement.test.ts',
      AP + 'encounters/movementReactionEffects.test.ts'
    ]
  },
  {
    f: 'REACTION',
    n: 4,
    title: 'Non-movement reactions',
    journey: [],
    extra: [
      X(
        'Shield, Counterspell and Absorb Elements resolve through a trigger model.',
        [],
        'rul-9-rules-audit.md slice 8 (depends on spell casting).'
      )
    ]
  },

  // PRIVACY
  {
    f: 'PRIVACY',
    n: 1,
    title: 'Players see only redacted combat data',
    cases: ['V12'],
    crit: ['V12.1', 'V12.2', 'V12.3', 'V12.4', 'V12.5', 'V12.6'],
    slices: ['RUL-8'],
    journey: [
      AP + 'encounters/cutoverPrivacy.test.ts',
      SW + 'src/roomAuthorization.test.ts',
      AP + 'encounters/encounterProjectionParity.test.ts'
    ]
  },
  {
    f: 'PRIVACY',
    n: 2,
    title: 'Choose how health is shown',
    crit: ['V12.7'],
    slices: ['CP-S6h'],
    journey: [AP + 'encounters/healthDisplay.test.ts']
  },
  {
    f: 'PRIVACY',
    n: 3,
    title: 'Keep Sheets and Campaign content hidden until shared',
    crit: ['V12.8', 'V12.9'],
    slices: ['PLT-6'],
    journey: [
      AP + 'campaigns/partyVisibility.test.ts',
      AP + 'scenes/readGate.test.ts',
      AP + 'liveSessions/activeSceneEncounter.test.ts'
    ]
  },

  // RELIABILITY
  {
    f: 'RELIABILITY',
    n: 1,
    title: 'Retries and reconnects give the same result',
    cases: ['V13'],
    journey: [
      AP + 'liveSessions/encounterJourneys.test.ts',
      SW + 'test/nativeDurableCommandJournal.test.ts'
    ]
  },
  {
    f: 'RELIABILITY',
    n: 2,
    title: 'Simultaneous actions resolve to one winner',
    cases: ['V14'],
    journey: [
      AP + 'encounters/developmentActionContentionProof.test.ts',
      AP + 'encounters/cutoverConcurrency.test.ts'
    ]
  },

  // VTT_UI
  {
    f: 'VTT_UI',
    n: 1,
    title: 'Tokens show identity, status and facing',
    journey: [],
    extra: [
      X(
        'Token art, identity and colour precedence are presented correctly.',
        ['G4-TOKEN-IDENTITY'],
        'Implemented in vttTokenPresentation.model.ts; not accepted against any case.'
      ),
      X(
        'Conditions, halos, ordering and overflow are presented on tokens.',
        ['G4-STATUS-PRESENTATION'],
        'Implemented in vttTokenPresentation.model.ts and CampaignVttPresentation stories; not accepted.'
      ),
      X(
        'Facing, arcs and marks are presented.',
        ['G4-FACING'],
        'optional-combat.md: Facing/Mark are foundation-only; Gate 4 owns presentation.'
      )
    ]
  },
  {
    f: 'VTT_UI',
    n: 2,
    title: 'Tokens show system state',
    journey: [],
    extra: [
      X(
        'Injuries, morale and reaction state are presented on tokens.',
        ['G4-SYSTEM-STATE'],
        'Morale/Injuries are foundation-only; presentation needs a case.'
      )
    ]
  },
  {
    f: 'VTT_UI',
    n: 3,
    title: 'Previews, perception and footprints',
    journey: [],
    extra: [
      X(
        'Range, target, path, aura and trap previews are shown.',
        ['G4-PREVIEWS'],
        'Original PARTIAL: V06 covers transient previews only.'
      ),
      X(
        'Light, darkness, obscurement and senses are rendered.',
        ['G4-PERCEPTION'],
        'Original PARTIAL: V03.5 covers visibility facts, not rendering.'
      ),
      X(
        'Footprints, large tokens, dragging and rotation behave correctly.',
        ['G4-FOOTPRINTS'],
        'Original PARTIAL: presentation behaviours unspecified.'
      )
    ]
  },
  {
    f: 'VTT_UI',
    n: 4,
    title: 'Accessible VTT',
    journey: [],
    extra: [
      X(
        'The VTT works at low zoom and does not rely on colour alone.',
        ['G4-ACCESSIBILITY-PERFORMANCE'],
        'Original PARTIAL: V15 covers performance only.'
      ),
      X(
        'Evidence, conflicts, keyboard navigation, screen-reader output and selectors are covered by tests.',
        ['G3-EVIDENCE-A11Y'],
        'Original PARTIAL: keyboard, screen-reader and selector coverage has no 8.2 criterion.'
      )
    ]
  },

  // PERF
  {
    f: 'PERF',
    n: 1,
    title: 'Local workload meets latency targets',
    cases: ['V15'],
    crit: ['V15.1', 'V15.2', 'V15.3'],
    slices: ['REL-5'],
    journey: [AP + 'encounters/cutoverConcurrency.test.ts', WE + 'storybook/vttLoad.spec.ts']
  },
  {
    f: 'PERF',
    n: 2,
    title: 'Managed workload meets the same targets',
    crit: ['V15.4'],
    journey: ['apps/web/tests/managed-vtt/managedRemoteVtt.spec.ts']
  },
  {
    f: 'PERF',
    n: 3,
    title: 'Room design stays within I/O budgets',
    slices: [
      'A35-S1b',
      'A35-S6d',
      'A35-S6e',
      'A35-S9',
      'A35-S10a',
      'A35-S10b',
      'A35-S10c',
      'A35-S11a',
      'A35-S11b',
      'A35-S11c',
      'A35-S11e',
      'A35-S11j',
      'CP-S4-b',
      'VS-8'
    ],
    sliceAcs: true,
    journey: []
  },
  {
    f: 'PERF',
    n: 4,
    title: 'Faster commands and reads',
    slices: ['PRF-1', 'PRF-2', 'PRF-4'],
    sliceAcs: true,
    journey: []
  },

  // RELEASE
  {
    f: 'RELEASE',
    n: 1,
    title: 'Docs, ADRs and runbooks match the final system',
    cases: ['R07'],
    journey: []
  },
  {
    f: 'RELEASE',
    n: 2,
    title: 'Final local lifecycle passes on one source',
    cases: ['R08'],
    slices: ['REL-1', 'REL-2', 'REL-3', 'REL-4', 'REL-6', 'VS-9'],
    journey: []
  },
  {
    f: 'RELEASE',
    n: 3,
    title: 'Staging promotion',
    cases: ['R09'],
    slices: ['REL-7', 'VS-10'],
    journey: []
  },
  {
    f: 'RELEASE',
    n: 4,
    title: 'Production deployment and smoke check',
    cases: ['R10'],
    journey: []
  },
  {
    f: 'RELEASE',
    n: 5,
    title: 'Staging and production can never enable the dev-only test-rolls route',
    journey: [],
    extra: [
      X(
        'A release check proves staging and production deployments can never carry the loopback Convex URL marker that enables the dev-only test-rolls route (docs/architecture/live-sessions.md, test-dice route), and fails the release if they do.',
        [],
        'Depends on PERF and every other feature (RELEASE dependencies); registered after the real-room fixture work.'
      )
    ]
  }
]
for (const p of pbis) p.id = `${p.f}-${p.n}`

// ---------------------------------------------------------------- original-ID placement
// Covered/partial originals attach to the 8.2 criterion that covers them (resolved to its AC id later).
const coverCrit = {
  'G1-SYSTEM-CAPABILITIES': 'C01.1',
  'G1-CATALOGUE-BINDING': 'C01.2',
  'G1-UUID-INTEGRITY': 'C02.1',
  'G1-GRAPH-VALIDATION': 'C13.1',
  'G1-PUBLISH-LIFECYCLE': 'C12.1',
  'G1-CAPABILITY-DISCOVERY': 'C16.1',
  'G1-EXECUTION-LIFECYCLE': 'C16.4',
  'G1-LIVE-UPDATES': 'V08.3',
  'G1-CAMPAIGN-COMPATIBILITY': 'P03.1',
  'G1-BLUEPRINT-RUN': 'V08.1',
  'G2-RANDOM-CONTRIBUTORS': 'P06.1',
  'G2-ACTION-AUTHORITY': 'V10.6',
  'G2-TEST-RESOLUTION': 'V10.1',
  'G2-STATE-RECONCILIATION': 'P07.1',
  'G2-EFFECT-LIFECYCLE': 'C11.1',
  'G2-CONCENTRATION': 'V11.4',
  'G2-REACTIONS': 'V11.8',
  'G2-TURN-INITIATIVE': 'V09.2',
  'G2-LEGENDARY-RECHARGE': 'V10.3',
  'G2-OPTIONAL-COMBAT': 'V10.4',
  'G3-DEFINITION-AUTHORING': 'C03.1',
  'G3-DOMAIN-AUTHORING': 'C04.1',
  'G3-AUTHORING-WORKFLOWS': 'C14.1',
  'G3-CAMPAIGN-SETTINGS': 'P11.1',
  'G3-BLUEPRINT-AUTHORING': 'V01.1',
  'G3-ACTIONS-TARGETS': 'V10.8',
  'G3-MOVEMENT': 'V07.1',
  'G3-LIVE-DECISIONS': 'V11.1',
  'G5-RELEASE-MANIFEST': 'R08.2',
  'G5-CODE-LIFECYCLE': 'R08.1',
  'G5-SRD-PARITY': 'F15.1',
  'P81-CURRENT-REACTION-RESUME': 'V11.2',
  'P81-CURRENT-OPTIONAL-ADMISSION': 'V10.4',
  'P81-CREATURE-GEAR-ENCOUNTER-PIN': 'V01.2',
  'P81-DISARM-SOURCE': 'V10.1',
  'P81-DISARM-EXECUTION': 'V11.3',
  'P81-PG-REPLAY': 'V13.1',
  'P81-PG-ROLLBACK': 'V08.6',
  'P81-PG-CONCURRENCY': 'V14.3',
  'P81-PG-PRIVACY': 'V12.1',
  'P81-PG-CLEANUP': 'V08.6',
  'P81-MANAGED-RULE-LATENCY': 'V15.4',
  'P81-MANAGED-SCENE-LATENCY': 'V15.4'
}
const raceRules = [
  [/^P81-RACE-ACTION-ADVANCE-/, 'V14.3'],
  [
    /^P81-RACE-(ACTION-MEMBER|ACTION-ASSIGNMENT|EFFECT-REMOVE|CONCENTRATION-CLEANUP|INITIATIVE-|OPTIONAL-DECISION)/,
    'V14.1'
  ],
  [/^P81-RACE-(DECISION-SUPERSEDE|MOVEMENT-REACTION)-/, 'V14.4'],
  [/^P81-RACE-MOVEMENT-SCENE-/, 'V14.2'],
  [/^P81-RACE-DUPLICATE-/, 'V13.2']
]
for (const id of orig08) {
  if (coverCrit[id]) continue
  const rule = raceRules.find(([re]) => re.test(id))
  if (rule) coverCrit[id] = rule[1]
}
const uat = {
  ENCOUNTER: [
    ['G5-ASSISTED-MANUAL-JOURNEY', 'Assisted and Manual Encounter journeys pass'],
    ['G5-OPTIONAL-JOURNEY', 'Initiative and optional-combat combinations pass end to end']
  ],
  ATTACK: [
    ['G5-LIFECYCLE-JOURNEY', 'Effects, movement, reactions and the turn lifecycle pass end to end']
  ],
  RELIABILITY: [
    ['G5-RESILIENCE', 'Privacy, replay, rollback, concurrency and performance hold together']
  ],
  RELEASE: [['G5-CLEANUP-ACCEPTANCE', 'Exact cleanup and final acceptance']]
}
const retired = [
  ...[
    [
      'G5-DATABASE-LIFECYCLE',
      'ADR 0029: Convex replaced PostgreSQL; migration, generated-type, canonical-SQL, seed and audit parity are replaced by the Convex schema, codegen (F01, F02) and the F15 import audit.'
    ],
    [
      'P81-PG-LIFECYCLE',
      'ADR 0029: Convex replaced PostgreSQL; the local Convex reset/seed lifecycle (R03, R08) is the replacement.'
    ],
    [
      'P81-RACE-ACTION-LEASE-ACTION-FIRST',
      'ADR 0035: the Session Durable Object replaced the session-host lease as live authority (R06); room admission races are covered by V05 and V14.'
    ],
    [
      'P81-RACE-ACTION-LEASE-LEASE-FIRST',
      'ADR 0035: the Session Durable Object replaced the session-host lease as live authority (R06); room admission races are covered by V05 and V14.'
    ]
  ].map(([id, reason]) => ({ id, reason, decision: 'Approved by the user on 2026-10-06.' })),
  ...[...slices.values()]
    .filter((s) => s.state === 'superseded')
    .map((s) => ({
      id: s.id,
      reason: `superseded by ${s.refs.length ? s.refs.join(', ') : 'see title'}: ${s.title}`,
      decision: 'Recorded as superseded in docs/roadmap/08-2-work-slices.json.'
    }))
]
const openQuestions = []

// ---------------------------------------------------------------- build
// DONE never rests on bare state: it needs proof (criterion proof, or a commit/test path in the registry refs).
const NEEDS_PROOF = 'needs proof'
const critAc = (k) => {
  const proof = k.proof ?? []
  if (k.status === 'ACCEPTED' || k.status === 'READY_FOR_ACCEPTANCE')
    return proof.length
      ? { status: 'DONE', proof }
      : { status: 'IN_PROGRESS', proof, note: NEEDS_PROOF }
  return { status: k.status === 'IN_PROGRESS' ? 'IN_PROGRESS' : 'TODO', proof }
}
const proofRef = (r) => /\.(ts|tsx|mjs|json|md|yaml)\b/.test(r) || /^[0-9a-f]{7,40}$/.test(r)
const sliceAc = (s) => {
  if (s.state === 'done') {
    const proof = s.refs.filter(proofRef)
    return proof.length
      ? { status: 'DONE', proof }
      : { status: 'IN_PROGRESS', proof: [], note: NEEDS_PROOF }
  }
  return {
    status: s.state === 'active' || s.state === 'integrating' ? 'IN_PROGRESS' : 'TODO',
    proof: []
  }
}
const critAcId = new Map() // criterion id -> AC id

// ---------------------------------------------------------------- journey review (2026-10-06)
// Each listed file was reviewed by name and imports. verified: the real user-visible flow runs through real Convex functions
// (convex-test), the real Session room (localRoomWorker), a Playwright spec or a session-worker native test. partial: part of the
// flow only (journeyGap says what is missing). Files that touch only a fragment are dropped with a reason. Files that reach
// Specs that need managed or cloud credentials are not journey tests (development runs only against local Docker Convex).
const MANAGED = 'apps/web/tests/managed-vtt/managedRemoteVtt.spec.ts'
const V = { s: 'verified' }
const P = (gap, more = {}) => ({ s: 'partial', gap, ...more })
const review = {
  'PLATFORM-2': P(
    'Covers schema and contract isolation only; no proof of indexes, bounded reads or the one-System bootstrap admission.'
  ),
  'PLATFORM-3': V,
  'PLATFORM-4': P(
    'No upload claim, finalize, signed read and cleanup run for profile and art images; vttMap.test.ts covers that sequence for maps only.',
    {
      drop: {
        [AP + 'media/storage.test.ts']:
          'only the R2 environment and endpoint configuration boundary; no upload flow'
      }
    }
  ),
  'PLATFORM-5': V,
  'PLATFORM-11': P(
    'roomInputs.test.ts is one room-routed suite on the real Session Worker; the stand-in fixtures are deleted, but no test asserts none returns (REL-9 is still active).'
  ),
  'ACCOUNTS-1': P(
    'No browser SSR sign-in, hydration and reload, and no HTTP-level native bearer call; convex-test covers identity and key pinning only.'
  ),
  'ACCOUNTS-2': P('The closed default flag is tested; a rejected real signup attempt is not.'),
  'ACCOUNTS-3': P(
    'Verification links and the confirmation page are tested separately; there is no single signup-to-verified-session run.'
  ),
  'ACCOUNTS-4': V,
  'ACCOUNTS-5': P(
    'No successful email or username login returning to the requested path; only unverified-login feedback and session identity.'
  ),
  'ACCOUNTS-6': V,
  'ACCOUNTS-7': V,
  'ACCOUNTS-8': P(
    'Caller-only profile reads and updates plus Social eligibility are tested; no two-account journey shows what another account sees under each privacy setting.',
    { add: [AP + 'auth.test.ts'] }
  ),
  'ACCOUNTS-9': V,
  'ACCOUNTS-10': V,
  'AUTHORING-1': V,
  'AUTHORING-2': P(
    'UUID and checksum stability is proved through Background and Class publication and System reads only; the other domains are not covered.',
    {
      drop: {
        [AP + 'content/publicationDocument.test.ts']:
          'normalized Class document and error text only; no identity or publication flow'
      },
      add: [
        AP + 'content/publication.test.ts',
        AP + 'content/classPublication.test.ts',
        AP + 'content/systems.test.ts'
      ]
    }
  ),
  'AUTHORING-3': V,
  'AUTHORING-4': V,
  'AUTHORING-5': V,
  'AUTHORING-6': V,
  'AUTHORING-7': V,
  'AUTHORING-8': V,
  'AUTHORING-9': V,
  'AUTHORING-10': V,
  'AUTHORING-11': V,
  'AUTHORING-12': V,
  'AUTHORING-13': P(
    'Snapshot builds and document normalization are tested; publication-time validation and compilation are proved per domain (AUTHORING-3 to 10), not as one flow.'
  ),
  'AUTHORING-14': P(
    'Copy of SRD mechanics into an owned draft is tested; there is no all-domain duplication conformance run.',
    {
      drop: {
        [AP + 'content/documents.test.ts']:
          'document JSON fast path and chunk storage only; not the duplication flow'
      },
      add: [AP + 'content/drafts.test.ts']
    }
  ),
  'AUTHORING-15': V,
  'RULES-1': {
    s: 'verified',
    drop: {
      [SW + 'src/nativeRoomEncounterCommand.test.ts']: 'only the retry-offer refusal mapping'
    },
    add: [AP + 'encounters/actionCommands.test.ts']
  },
  'BUILDER-1': V,
  'BUILDER-2': V,
  'BUILDER-3': P(
    'Repair state and departure repair are tested; Builder preview and commit after a same-source publication replacement are not evident.'
  ),
  'SHEET-1': V,
  'SHEET-2': V,
  'SHEET-3': {
    s: 'verified',
    drop: {
      [SW + 'src/roomPrivateRolls.test.ts']: 'only private-roll retention across a room checkpoint'
    }
  },
  'SHEET-4': V,
  'SHEET-5': V,
  'CAMPAIGN-1': V,
  'CAMPAIGN-2': V,
  'CAMPAIGN-3': V,
  'CAMPAIGN-4': V,
  'CAMPAIGN-5': V,
  'CAMPAIGN-6': V,
  'SOCIAL-1': V,
  'SOCIAL-2': V,
  'SOCIAL-3': V,
  'ROOM-1': {
    s: 'verified',
    drop: { [SW + 'src/ticket.test.ts']: 'claim-verification unit test only' }
  },
  'ROOM-2': {
    s: 'verified',
    drop: {
      [AP + 'liveSessions/transientHttp.test.ts']:
        'worker-secret and input checks on the capture endpoints; not the preview exchange'
    }
  },
  'ROOM-3': V,
  'ROOM-4': V,
  'ROOM-5': V,
  'SCENE-1': V,
  'SCENE-2': V,
  'SCENE-3': V,
  'MOVE-1': V,
  'ENCOUNTER-1': V,
  'ENCOUNTER-2': V,
  'ENCOUNTER-3': V,
  'ENCOUNTER-5': P(
    'No three-user Assisted journey with auto-roll on runs locally; the only three-user journey is the managed spec (see the PERF UAT).',
    {
      drop: {
        [MANAGED]: 'needs managed credentials; development runs only against local Docker Convex'
      }
    }
  ),
  'ATTACK-1': V,
  'ATTACK-2': V,
  'ATTACK-3': P(
    'GM undo and replay are covered; disposition warnings and Assisted bendable-check warnings are not evident.'
  ),
  'ATTACK-4': V,
  'ATTACK-5': P(
    'Hell Hound, Aboleth, Swarm of Ravens and the Adult Red Dragon Tail are exercised; the 41 allowlisted unsupported attacks and the 13 listed creature attacks have no test.'
  ),
  'ATTACK-6': P(
    'Replacement success and refusals are tested; the shared loadout contract, derivation and the replacement-versus-action race are not.'
  ),
  'SPELLS-1': V,
  'SPELLS-3': P(
    'Creature 0 HP defeat, turn skip and undo only; no Character dying or death-save flow.'
  ),
  'REACTION-1': V,
  'REACTION-2': {
    s: 'verified',
    drop: { [SW + 'src/roomTestDice.test.ts']: 'queued-test-dice helper unit test only' }
  },
  'REACTION-3': V,
  'PRIVACY-1': {
    s: 'verified',
    drop: {
      [SW + 'src/roomAuthorization.test.ts']:
        'room authorization cache unit tests; not a redaction flow'
    }
  },
  'PRIVACY-2': V,
  'PRIVACY-3': P(
    'Party can-view and Scene presentation gating are tested; GM-revealed hidden Campaign content other than Scenes is not.',
    {
      drop: {
        [AP + 'liveSessions/activeSceneEncounter.test.ts']:
          'which Run plays on a Scene; not a privacy flow'
      }
    }
  ),
  'RELIABILITY-1': V,
  'RELIABILITY-2': V,
  'PERF-1': P(
    'cutoverConcurrency.test.ts validates the workload harness; vttLoad.spec.ts measures renderer load only. The frozen local workload runs in yarn validate:pre-staging:local, not in a test file.'
  ),
  'PERF-2': {
    s: 'none',
    drop: {
      [MANAGED]: 'needs managed credentials; development runs only against local Docker Convex'
    }
  }
}
const droppedJourneyFiles = []
for (const p of pbis) {
  const r = review[p.id]
  if (!p.journey.length && !r?.add?.length) continue
  if (!r) {
    console.error(`${p.id} has journey tests but no review entry`)
    process.exit(1)
  }
  for (const [file, reason] of Object.entries(r.drop ?? {})) {
    if (!p.journey.includes(file)) {
      console.error(`${p.id}: cannot drop ${file}, not listed`)
      process.exit(1)
    }
    droppedJourneyFiles.push({ pbi: p.id, file, reason })
  }
  p.journey = [...p.journey.filter((j) => !(r.drop ?? {})[j]), ...(r.add ?? [])]
}

for (const p of pbis) {
  const crits =
    p.crit ?? (p.cases ?? []).flatMap((c) => cases82.get(c)?.criteria.map((k) => k.id) ?? [])
  p.acs = []
  const add = (ac) => {
    ac.id = `${p.id}.${p.acs.length + 1}`
    p.acs.push(ac)
    return ac
  }
  for (const kid of crits) {
    const k = crit82.get(kid)
    if (!k) {
      console.error(`unknown criterion ${kid}`)
      process.exit(1)
    }
    const ac = add({ text: k.text, ...critAc(k), origin: [kid] })
    critAcId.set(kid, ac.id)
  }
  if (p.sliceAcs)
    for (const sid of p.slices)
      add({ text: slices.get(sid).title, ...sliceAc(slices.get(sid)), origin: [sid] })
  for (const e of p.extra ?? [])
    add({
      text: e.text,
      status: e.status,
      proof: e.proof ?? [],
      origin: [...e.origin],
      ...(e.note ? { note: e.note } : {})
    })
  p.origin = [...(p.cases ?? []), ...(p.sliceAcs ? [] : (p.slices ?? []))]
}
// attach covered originals to the AC of the covering criterion
for (const [oid, kid] of Object.entries(coverCrit)) {
  const acId = critAcId.get(kid)
  if (!acId) {
    console.error(`covering criterion ${kid} for ${oid} is not placed`)
    process.exit(1)
  }
  const p = pbis.find((x) => acId.startsWith(x.id + '.') && x.acs.some((a) => a.id === acId))
  p.acs.find((a) => a.id === acId).origin.push(oid)
}

// journeyStatus: none | partial | verified. DONE needs every AC DONE with proof AND a verified journey.
for (const p of pbis) {
  const r = review[p.id]
  p.journeyStatus = !p.journey.length ? 'none' : r.s
  p.journeyGap = p.journeyStatus === 'partial' ? r.gap : undefined
  const allDone = p.acs.length > 0 && p.acs.every((a) => a.status === 'DONE' && a.proof.length)
  p.status =
    allDone && p.journeyStatus === 'verified'
      ? 'DONE'
      : p.acs.some((a) => a.status !== 'TODO') || allDone
        ? 'IN_PROGRESS'
        : 'TODO'
}

// PERF UAT references the managed journey that development cannot run.
uat.PERF = [
  [
    '',
    'Managed three-user live-room journey (needs managed credentials; run only on an approved staging smoke)',
    'apps/web/tests/managed-vtt/managedRemoteVtt.spec.ts'
  ]
]

const defaultJourneyCheck = []
for (const p of pbis)
  for (const j of p.journey)
    if (!fs.existsSync(REPO + j)) defaultJourneyCheck.push(`${p.id}: missing journey test ${j}`)
if (defaultJourneyCheck.length) {
  console.error(defaultJourneyCheck.join('\n'))
  process.exit(1)
}

const ledger = {
  version: 1,
  phase: '8',
  title: 'Phase 8: Convex platform and VTT',
  rebaselined: '2026-10-06',
  definitionOfDone:
    "A PBI is done when every acceptance criterion is proved (DONE with non-empty proof) and at least one of its journey tests, verified to drive the real flow, passes. After each PBI, run that feature's regression suite plus the suites of the features that depend on it. PERF runs at feature completion and at release. The final pre-staging run (yarn validate:pre-staging:local on one source state) is the release-candidate check.",
  statusVocabulary: {
    ac: {
      TODO: 'Not started.',
      IN_PROGRESS: 'Started, or proved in part; some proof is still missing.',
      DONE: 'Proved by the listed proof.'
    },
    pbi: {
      TODO: 'No criterion started.',
      IN_PROGRESS:
        'Some criteria started or done, or all done without proof or without a verified journey test.',
      DONE: 'Every criterion DONE with proof and journeyStatus verified.'
    },
    journeyStatus: {
      verified:
        'The listed journey tests drive the whole user-visible flow through real code (convex-test, the real Session room, Playwright or session-worker native tests).',
      partial: 'The journey tests cover part of the flow; journeyGap says what is missing.',
      none: 'No journey test exists for the flow.'
    },
    uat: {
      NOT_RUN: 'Not run on the rebaselined ledger.',
      PASSED: 'Run and passed.',
      FAILED: 'Run and failed.'
    }
  },
  features: features.map((f) => ({
    ...f,
    regressionTests: [],
    uat: (uat[f.id] ?? []).map(([id, title, reference], i) => ({
      id: `${f.id}-UAT-${i + 1}`,
      title,
      status: 'NOT_RUN',
      origin: id ? [id] : [],
      ...(reference ? { reference } : {})
    })),
    pbis: pbis
      .filter((p) => p.f === f.id)
      .map((p) => ({
        id: p.id,
        title: p.title,
        status: p.status,
        journeyTests: p.journey,
        journeyStatus: p.journeyStatus,
        ...(p.journeyGap ? { journeyGap: p.journeyGap } : {}),
        origin: p.origin,
        acs: p.acs
      }))
  })),
  retired,
  openQuestions
}

// ---------------------------------------------------------------- coverage check
const seen = new Map()
const note = (id, where) => seen.set(id, [...(seen.get(id) ?? []), where])
for (const f of ledger.features) {
  for (const u of f.uat) for (const o of u.origin) note(o, u.id)
  for (const p of f.pbis) {
    for (const o of p.origin) note(o, p.id)
    for (const ac of p.acs) for (const o of ac.origin) note(o, ac.id)
  }
}
for (const r of retired) note(r.id, 'retired')
const expected = [...cases82.keys(), ...crit82.keys(), ...slices.keys(), ...orig08]
const missing = expected.filter((id) => !seen.has(id))
const dup = [...seen].filter(([, w]) => w.length > 1)
const unknown = [...seen.keys()].filter((id) => !expected.includes(id))
fs.writeFileSync(OUT, JSON.stringify(ledger, null, 2) + '\n')

// ---------------------------------------------------------------- report
const rows = ledger.features.map((f) => {
  const acs = f.pbis.flatMap((p) => p.acs)
  const c = (s) => acs.filter((a) => a.status === s).length
  return `${f.id.padEnd(12)} pbis=${String(f.pbis.length).padStart(2)} acs=${String(acs.length).padStart(3)} DONE=${String(c('DONE')).padStart(3)} IN_PROGRESS=${String(c('IN_PROGRESS')).padStart(2)} TODO=${String(c('TODO')).padStart(3)}  pbiStatus=${['DONE', 'IN_PROGRESS', 'TODO'].map((s) => f.pbis.filter((p) => p.status === s).length).join('/')}`
})
console.log(rows.join('\n'))
console.log('expected ids:', expected.length, 'placed:', seen.size, 'retired:', retired.length)
const allPbis = ledger.features.flatMap((f) => f.pbis)
console.log('journeyStatus per feature (verified/partial/none):')
for (const f of ledger.features)
  console.log(
    '  ' +
      f.id.padEnd(12) +
      ['verified', 'partial', 'none']
        .map((s) => f.pbis.filter((p) => p.journeyStatus === s).length)
        .join('/')
  )
console.log(
  'needs journey test:',
  allPbis
    .filter((p) => !p.journeyTests.length)
    .map((p) => p.id)
    .join(', ')
)
console.log(
  'partial:\n' +
    allPbis
      .filter((p) => p.journeyStatus === 'partial')
      .map((p) => `  ${p.id}: ${p.journeyGap}`)
      .join('\n')
)
console.log(
  'dropped journey files:\n' +
    droppedJourneyFiles.map((d) => `  ${d.pbi}: ${d.file} (${d.reason})`).join('\n')
)
console.log(
  'needs proof ACs:',
  allPbis.flatMap((p) => p.acs).filter((a) => a.note === NEEDS_PROOF).length,
  'of',
  allPbis.flatMap((p) => p.acs).length
)
if (missing.length || dup.length || unknown.length) {
  if (missing.length) console.error('MISSING:', missing.join(', '))
  if (dup.length)
    console.error('DUPLICATE:', dup.map(([id, w]) => `${id} -> ${w.join(' & ')}`).join('; '))
  if (unknown.length) console.error('UNKNOWN origin ids:', unknown.join(', '))
  process.exit(1)
}
console.log('coverage OK; wrote', OUT)
