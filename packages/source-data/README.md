# Canonical source data

This workspace owns the complete canonical corpus, independent of the database implementation.
`src/srd` retains authored definitions, stable UUIDs, semantic ledgers, the original SRD PDF/text,
and supporting assets. These files survived the retirement of `packages/db` and remain canonical.

Consumers import `@artificer-toolkit/source-data`, `/content`, `/srd`, or an exact `/srd/*.js`
subpath. The Convex importer owns persistence and owner assignment; this package performs
no database, filesystem, network, or environment lookup while loading the corpus.

The Phase 8.2 extraction preserved 1,083 files and 1,051 unique root UUIDs. Only the semantic-ledger
loader (static JSON instead of filesystem access) and canonical owner constant changed. Importer
owner substitution remains explicit through `assignBaselineContentOwner`.

Build with `yarn turbo run build --filter=@artificer-toolkit/source-data`.
Run its focused checks with `yarn workspace @artificer-toolkit/source-data test`.

`/srd/catalogue.js` owns the existing catalogue/content-source UUIDs and the complete collection
of 50 reusable sense, capability, condition, optional-combat, lifecycle, and concentration definitions.
The Convex seed uses this same collection; do not maintain a second list in an importer.
`/srd/import.js` prepares a deterministic JSON manifest, validates all 1,051 authored documents and
the System against their existing schemas, rejects silent field removal, and checks duplicate UUIDs,
definition checksums, and typed parent/class/equipment references. `/srd/audit.js` retains the existing
pure SRD semantic checks independently of SQL. These are preflight checks, not proof of persistence
or the complete rules execution corpus.

Every attack-triggered Creature Feature or option authors exactly one `ATTACK` roll definition
(D53). Most come from `src/srd/creatures/attack-bonuses.ts`, the printed "+N to hit" of each stat
block keyed by source ID; attacks that print none take their named base attack's bonus. Regenerate
it with `yarn workspace @artificer-toolkit/source-data generate:creature-attack-bonuses` after adding
attack-triggered actions, and review the diff. Runtime code never parses the prose. Creature publication
(`creaturePublicationDtoSchema`, used by the SRD import and `publishDraft`) refuses an attack
without exactly one `ATTACK` roll, for SRD and homebrew alike.

`src/srd/creatures/attack-damage.ts` records each attack Effect's printed hit damage (D54), one
`XdY±Z` or flat amount per damage part, generated with
`yarn workspace @artificer-toolkit/source-data generate:creature-attack-damage`. The rules-runtime SRD
attack sweep holds every attack's resolved damage (dice plus the Creature's authored ability
modifiers) to it; a printed bonus no ability explains is authored as a flat modifier in `diceConfig`.

The local Convex importer now preserves all 1,051 roots and 50 reusable definitions. Repeat seeding
is a no-op; read-back verifies complete-record hashes against this package. Authored version payloads
use lossless canonical JSON text to accommodate deeply composed mechanics, with metadata kept
indexed. The source models and original assets are unchanged. See the
[API import contract](../../apps/apis/README.md#canonical-source-import) for commands and boundaries.

Convex import/audit acceptance is tracked by `F15` in the
[cutover ledger](../../docs/roadmap/08-2-convex-cutover-acceptance.md).
