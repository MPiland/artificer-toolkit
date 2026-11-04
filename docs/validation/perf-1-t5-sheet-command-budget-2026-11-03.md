# PERF-1.T5 Sheet command time budget (2026-11-03)

Closes AC PERF-1.4: `characters/sheetCommands:execute` runs well under the Convex 1 s limit,
guarded by a deterministic read budget.

## Evidence before the fix

CI Browser journeys run 41767872164 (`native-executions.jsonl`, `userExecutionTime`):

| Function                                       | Kind              | n   | p50    | p90    | max    | Notes                                                               |
| ---------------------------------------------- | ----------------- | --- | ------ | ------ | ------ | ------------------------------------------------------------------- |
| `characters/sheetCommands:execute`             | mutation          | 63  | 0.41 s | 0.58 s | 1.00 s | one timeout at 1.005 s, 132 docs / 308 KB; typical 92 docs / 258 KB |
| `characters/sheetSectionDerivation:store`      | internal mutation |     | 0.42 s | 0.71 s | 1.07 s | same store path as the command                                      |
| `campaigns/characterSheet:execute`             | mutation          |     | 0.52 s |        | 0.63 s | GM-side Sheet command, same path                                    |
| `campaigns/characterSheet:basics`              | query             |     | 0.60 s | 1.10 s | 1.39 s | near/over limit: follow-up                                          |
| `characters/sheet:get`                         | query             |     | 0.36 s |        | 0.74 s |                                                                     |
| `campaigns/assignments:assign`                 | mutation          |     | 0.38 s |        | 0.63 s | 485 docs / 811 KB                                                   |
| `scenes/presentations:setLive`                 | mutation          |     | 0.82 s |        | 1.18 s | near/over limit: follow-up                                          |
| `content/classPublicationActions:publishDraft` | action            |     |        |        | 2.42 s | action (10 min limit), not at risk                                  |
| `equipmentOptions:list`                        | query             |     |        |        | 0.54 s |                                                                     |

Trivial queries in the same run show p50 of 0.01–0.02 s, so the runner adds little fixed cost.
Shard stalls in that run belong to PERF-1.T6.

## Root cause

Each Sheet command loads the Character's facts, writes the play record and re-derives the stored
Sheet sections (ADR 0041). Work counted per command (convex-test, Campaign Character whose GM is
another user) showed the same inputs read repeatedly in one transaction:

- The 34 KB System document was read **four times**, and each `requireSystem` canonicalized and
  sha256-checksummed it again:
  1. the rule context (`loadCharacterRuleContext` → `requireSystem`, needed);
  2. the Character sources (`readCampaignCharacterSources` → `requireRulesCatalogueBinding` →
     `requireSystem`), which used only the catalogue's sources;
  3. the stored Sheet's fingerprint (raw read, needed for its checksum input);
  4. the fingerprint's own `readCharacterSources`, again through the binding.
- The Character sources (assignment, Campaign, membership, catalogue, content sources) and the
  Character's active and carried rule effects were read twice: once for the facts and again for the
  fingerprint.

## Fix

- `readCampaignCharacterSources` reads only the catalogue's sources
  (`requireRulesCatalogueSources`), not the full binding with its System verification.
- `readCharacterSheetFingerprint` takes the reads the transaction already holds (sources, active
  and carried effects) and reads only what is missing. `storeCharacterSheetSections` passes the
  ones its facts were derived from, so the fingerprint and the sections it guards come from the
  same reads.

No limit, retry or command split was changed.

## Budget

`apps/apis/convex/characters/sheetCommandBudget.test.ts`, one `ADJUST_HIT_POINTS` after a warm-up
command:

| Measure                                         | Before  | After   | Budget   |
| ----------------------------------------------- | ------- | ------- | -------- |
| `systems` reads                                 | 4       | 2       | ≤ 2      |
| `campaignMemberships` / `rulesCatalogues` reads | 2 / 2   | 1 / 1   | 1 / 1    |
| documents read                                  | 55      | 43      |          |
| bytes read                                      | ~230 KB | ~158 KB | < 180 KB |

Local convex-test wall time per command (informational, not asserted) fell from about 80 ms to about
68 ms on this fixture; the SRD Life Domain Cleric case was about 160 ms before. The red proof is CI Tests run 41850701586, job "Red proof against the phase branch": against the phase-branch code the test fails with `expected 4 to be less than or equal to 2` System reads.

## Remaining near the limit

- Post-write Builder preparation reruns on every play-state change because
  `prepareCharacterSheetFromContext` reuses it only when the Character row is unchanged (about 30%
  of command CPU locally). Reusing it across play-state-only changes needs a rules-runtime contract
  for which state the Builder preparation reads; not taken here.
- `campaigns/characterSheet:basics` (max 1.39 s) and `scenes/presentations:setLive` (max 1.18 s)
  exceeded the limit in the same run and need their own budget slices.
