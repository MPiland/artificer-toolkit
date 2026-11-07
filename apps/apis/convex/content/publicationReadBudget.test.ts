import { getFunctionName, makeFunctionReference, type FunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type { AuthoredPublishDraftInput } from '@artificer-toolkit/schema/api/authoredPublication'
import { srdBaselineContent } from '@artificer-toolkit/source-data/srd/index.js'
import { countDatabaseIo, createDatabaseIoTotals } from '../../tests/fixtures/databaseIo'
import { publicationFixture } from '../../tests/fixtures/publication'
import { api, internal } from '../_generated/api'
import type { ActionCtx, MutationCtx } from '../_generated/server'
import { commitDraft, prepareDraft, readSourceRows } from './classPublication'
import { publishDraft as publishClassDraft } from './classPublicationActions'
import { publishDraft } from './publication'

// PERF-5.T1: publication normalizes a draft against only the roots it references, so its reads do
// not grow with unrelated Homebrew. Before, every publish read each referenced kind's whole
// catalogue (743 to 1,487 documents and 0.8 to 2.2 MB under the SRD).
const HOMEBREW_PER_KIND = 3
const setTier = makeFunctionReference<'mutation', { userId: string; tier: 'GM' }, null>(
  'accountEntitlements:setTier'
)
const { subjects } = srdBaselineContent

type Handler = (ctx: unknown, args: unknown) => Promise<unknown>
type Reads = ReturnType<typeof createDatabaseIoTotals>['reads']
type MeasuredKind = Exclude<AuthoredPublishDraftInput['subjectKind'], 'CLASS'>

function handlerOf(registered: object): Handler {
  if (!('_handler' in registered) || typeof registered._handler !== 'function')
    throw new Error('Missing registered function handler.')
  return registered._handler as Handler
}

async function seed() {
  const fixture = await publicationFixture(
    import.meta.glob('/apps/apis/convex/**/*.*s'),
    import.meta.glob('../betterAuth/**/*.*s'),
    []
  )
  await fixture.t.action(internal.content.seed.seed, {})
  // The measured and unrelated drafts exceed the Free Homebrew allowance.
  await fixture.t.mutation(setTier, { userId: fixture.first.userId, tier: 'GM' })
  return fixture
}

type Caller = Awaited<ReturnType<typeof seed>>['first']['caller']

async function draft<Kind extends AuthoredPublishDraftInput['subjectKind']>(
  caller: Caller,
  subjectKind: Kind,
  subjectId: string,
  label: string
): Promise<AuthoredPublishDraftInput & { subjectKind: Kind }> {
  const copy = await caller.mutation(api.content.drafts.duplicate, { subjectKind, subjectId })
  const saved = await caller.mutation(api.content.drafts.save, {
    subjectKind,
    subjectId: copy.subjectId,
    systemId: copy.systemId,
    label,
    payload: copy.payload
  })
  if (!saved.updatedAt) throw new Error('Missing draft revision')
  return { subjectKind, subjectId: saved.subjectId, expectedDraftUpdatedAt: saved.updatedAt }
}

// Runs one registered function in its own transaction, counting what it reads.
function measuredRun(caller: Caller, registered: object, reads: Reads, args: unknown) {
  return caller.run((ctx) =>
    handlerOf(registered)(
      { ...ctx, db: countDatabaseIo(ctx.db, { reads, writes: createDatabaseIoTotals().writes }) },
      args
    )
  )
}

async function measurePublish(caller: Caller, input: AuthoredPublishDraftInput) {
  const reads = createDatabaseIoTotals().reads
  await measuredRun(caller, publishDraft, reads, input)
  return reads
}

// The Class action's queries and its commit mutation are separate transactions; each is counted.
async function measureClassPublish(caller: Caller, input: AuthoredPublishDraftInput) {
  const action = createDatabaseIoTotals().reads
  const commit = createDatabaseIoTotals().reads
  const functions = new Map<string, [object, Reads]>([
    [getFunctionName(internal.content.classPublication.prepareDraft), [prepareDraft, action]],
    [getFunctionName(internal.content.classPublication.readSourceRows), [readSourceRows, action]],
    [getFunctionName(internal.content.classPublication.commitDraft), [commitDraft, commit]]
  ])
  const run = (reference: FunctionReference<'query' | 'mutation', 'internal'>, args: unknown) => {
    const target = functions.get(getFunctionName(reference))
    if (!target) throw new Error(`Unexpected Class publication call: ${getFunctionName(reference)}`)
    return measuredRun(caller, target[0], target[1], args)
  }
  const ctx: Pick<ActionCtx, 'runQuery'> & Pick<MutationCtx, 'runMutation'> = {
    runQuery: run as ActionCtx['runQuery'],
    runMutation: run as MutationCtx['runMutation']
  }
  await handlerOf(publishClassDraft)(ctx, input)
  return { action, commit }
}

// The SRD Class that names the most other records, such as a full spell list.
const referenceHeavyClass = subjects.classes
  .map((subject) => ({
    subject,
    references: new Set(
      JSON.stringify(subject).match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g)
    ).size
  }))
  .reduce((heaviest, entry) => (entry.references > heaviest.references ? entry : heaviest))

const measuredSubjects: Readonly<Record<MeasuredKind, string>> = {
  BACKGROUND: subjects.backgrounds[0]!.id,
  CREATURE: subjects.creatures[0]!.id,
  EQUIPMENT: subjects.equipment[0]!.id,
  FEAT: subjects.feats[0]!.id,
  // A Subrace's publish counts its parent's Subraces, so a base Race keeps the measured copies apart.
  RACE: subjects.races.find((race) => race.category === 'BASE')!.id,
  SPELL: subjects.spells[0]!.id,
  VEHICLE: subjects.vehicles[0]!.id
}

// Measured with the SRD seed plus two Homebrew rounds; a publish that reads more has regressed.
const publishDocumentCeiling: Readonly<Record<MeasuredKind, number>> = {
  BACKGROUND: 38,
  CREATURE: 31,
  EQUIPMENT: 29,
  FEAT: 29,
  RACE: 41,
  SPELL: 33,
  VEHICLE: 29
}
// The Bard names 763 records; most of its reads are the referenced spell roots and their facts.
const classDocumentCeiling = { action: 1_804, commit: 1_213 } as const

// One round of unrelated Homebrew in every kind a measured draft can name.
async function publishUnrelatedHomebrew(caller: Caller, round: number) {
  const batch = <T>(records: readonly T[]) =>
    records.slice(HOMEBREW_PER_KIND * round, HOMEBREW_PER_KIND * (round + 1))
  const homebrew: [MeasuredKind, readonly { id: string }[]][] = [
    ['SPELL', subjects.spells],
    ['FEAT', subjects.feats],
    ['CREATURE', subjects.creatures],
    ['EQUIPMENT', subjects.equipment],
    ['BACKGROUND', subjects.backgrounds],
    ['RACE', subjects.races],
    ['VEHICLE', subjects.vehicles]
  ]
  for (const [subjectKind, records] of homebrew)
    for (const record of batch(records))
      await caller.mutation(
        api.content.publication.publishDraft,
        await draft(
          caller,
          subjectKind,
          record.id,
          `Unrelated ${subjectKind} ${round} ${record.id}`
        )
      )
  for (const record of batch(subjects.classes))
    await caller.action(
      api.content.classPublicationActions.publishDraft,
      await draft(caller, 'CLASS', record.id, `Unrelated CLASS ${round} ${record.id}`)
    )
}

describe('publication read budget', () => {
  it('reads only the referenced roots, so publication stays flat as unrelated Homebrew grows', async () => {
    const { first } = await seed()
    const caller = first.caller
    // The first round also creates the account's one-off catalogue counters and Homebrew source.
    await publishUnrelatedHomebrew(caller, 0)
    const kinds = Object.keys(measuredSubjects) as MeasuredKind[]
    const before: Partial<Record<MeasuredKind, Reads>> = {}
    for (const kind of kinds)
      before[kind] = await measurePublish(
        caller,
        await draft(caller, kind, measuredSubjects[kind], `Measured ${kind} before`)
      )
    const classBefore = await measureClassPublish(
      caller,
      await draft(caller, 'CLASS', referenceHeavyClass.subject.id, 'Measured CLASS before')
    )

    await publishUnrelatedHomebrew(caller, 1)

    const after: Partial<Record<MeasuredKind, Reads>> = {}
    for (const kind of kinds)
      after[kind] = await measurePublish(
        caller,
        await draft(caller, kind, measuredSubjects[kind], `Measured ${kind} after`)
      )
    const classAfter = await measureClassPublish(
      caller,
      await draft(caller, 'CLASS', referenceHeavyClass.subject.id, 'Measured CLASS after')
    )

    for (const kind of kinds) {
      expect(after[kind]?.documents, `${kind} publish documents`).toBe(before[kind]?.documents)
      expect(after[kind]?.documents, `${kind} publish ceiling`).toBeLessThanOrEqual(
        publishDocumentCeiling[kind]
      )
    }
    // A Class publish keeps two per-kind scans whose predicates name no root: Equipment narrowed
    // by property (`equipment_properties`, which reads each Equipment root twice) and the RESOURCE
    // facet's `class_resources` ids. Between the two Class measurements, round 1 and the measured
    // drafts add 4 Equipment and 4 Class roots, so roots grow by 2 * 4 + 4. The commit mutation
    // reads each root's facts once; the action's queries are separate transactions, so its facts
    // grow with its root reads.
    const addedEquipment = HOMEBREW_PER_KIND + 1
    const addedClasses = HOMEBREW_PER_KIND + 1
    const addedRootReads = 2 * addedEquipment + addedClasses
    for (const [read, measuredBefore, measuredAfter, factsGrowth] of [
      ['action', classBefore.action, classAfter.action, addedRootReads],
      ['commit', classBefore.commit, classAfter.commit, addedEquipment + addedClasses]
    ] as const) {
      const growth = (table: string) =>
        (measuredAfter.byTable[table]?.documents ?? 0) -
        (measuredBefore.byTable[table]?.documents ?? 0)
      const tables = new Set([
        ...Object.keys(measuredBefore.byTable),
        ...Object.keys(measuredAfter.byTable)
      ])
      for (const table of tables)
        if (table !== 'authoredRoots' && table !== 'authoredSourceFacts')
          expect(growth(table), `CLASS ${read} ${table}`).toBe(0)
      expect(growth('authoredRoots'), `CLASS ${read} roots`).toBe(addedRootReads)
      expect(growth('authoredSourceFacts'), `CLASS ${read} facts`).toBe(factsGrowth)
      expect(measuredAfter.documents, `CLASS ${read} ceiling`).toBeLessThanOrEqual(
        classDocumentCeiling[read]
      )
    }
  }, 900_000)
})
