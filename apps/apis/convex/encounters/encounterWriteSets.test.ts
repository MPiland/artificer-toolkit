import { describe, expect, it } from 'vitest'
import type { EncounterCommandInputDto } from '@artificer-toolkit/schema/api/encounters'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdWolf as wolf } from '../../tests/fixtures/srdCreatures'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { api, internal } from '../_generated/api'
import schema from '../schema'
import { fixture } from '../../tests/fixtures/characters'
import { createEncounterInitiativeDefinitions } from '../../tests/fixtures/encounterInitiative'
import { importedSubject, importSeededSubjects } from '../../tests/fixtures/publication'
import { playerControlFixture, type PlayerControlFixture } from '../../tests/fixtures/playerControl'
import {
  attachFixtureRoom,
  checkpointLiveRoom,
  executeInRoom,
  queueRoomRolls,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'
import { presentEncounterRun } from '@artificer-toolkit/encounter-persistence/sessionReads'
import { encounterReadTransaction } from './encounterPorts'
import { readRunSummaries } from './projectionReads'

/**
 * What one Encounter command writes, and what building a member's projection reads, at 11 and 100
 * actors (ADR 0035 Amendment 12). A write costs the whole new document in Convex; the changed-field
 * bytes are what a checkpoint delta carries. The room holds a command's state until it checkpoints
 * (D85), so a command's write set is what the checkpoint after it publishes to Convex.
 */

useLocalRoomWorker()

const tables = Object.keys(schema.tables) as (keyof typeof schema.tables)[]
type StoredDocument = { _id: string; _creationTime: number } & Record<string, unknown>
type Snapshot = Map<string, { table: string; document: StoredDocument }>

function bytes(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength
}

// A stored document's `_creationTime` is a float whose printed length varies run to run; reads
// measure it at a fixed, typical Convex width so the read budget is deterministic.
const MEASURED_CREATION_TIME = 1761169586123.3157

function stored({ _id, _creationTime, ...fields }: StoredDocument) {
  return fields
}

async function snapshot(t: PlayerControlFixture['t'], campaignId: string): Promise<Snapshot> {
  await checkpointLiveRoom(campaignId)
  const entries = await t.run(async (ctx) => {
    const documents: { table: string; document: StoredDocument }[] = []
    for (const table of tables)
      for (const document of (await ctx.db.query(table).collect()) as StoredDocument[])
        documents.push({ table, document })
    return documents
  })
  return new Map(entries.map((entry) => [entry.document._id, entry]))
}

type WriteSet = {
  documents: number
  written: number
  changedFields: number
  byTable: Record<string, number>
}

function writeSet(before: Snapshot, after: Snapshot): WriteSet {
  const result: WriteSet = { documents: 0, written: 0, changedFields: 0, byTable: {} }
  for (const [id, { table, document }] of after) {
    const prior = before.get(id)?.document
    if (prior && JSON.stringify(prior) === JSON.stringify(document)) continue
    const size = bytes(stored(document))
    result.documents++
    result.written += size
    result.byTable[table] = (result.byTable[table] ?? 0) + size
    result.changedFields += prior
      ? Object.entries(stored(document))
          .filter(([key, value]) => JSON.stringify(prior[key]) !== JSON.stringify(value))
          .reduce((total, [key, value]) => total + bytes({ [key]: value }), 0)
      : size
  }
  for (const id of before.keys()) if (!after.has(id)) result.documents++
  return result
}

async function measure(
  base: PlayerControlFixture,
  command: () => Promise<EncounterCommandInputDto>
) {
  const input = await command()
  const before = await snapshot(base.t, base.campaign.id)
  await executeInRoom(base.owner.caller, { command: input })
  return writeSet(before, await snapshot(base.t, base.campaign.id))
}

/** Reads through `db` counting each returned document and its bytes. */
function countingReads<Database extends object>(db: Database) {
  const counter = { documents: 0, bytes: 0 }
  const count = (value: unknown) => {
    const documents = Array.isArray(value) ? value : [value]
    for (const document of documents)
      if (typeof document === 'object' && document !== null && '_id' in document) {
        counter.documents++
        counter.bytes += bytes({ ...document, _creationTime: MEASURED_CREATION_TIME })
        console.log('TMPREAD', bytes(document), Object.keys(document).slice(0, 6).join(','))
      }
  }
  const wrap = <Target extends object>(target: Target): Target =>
    new Proxy(target, {
      get(object, property) {
        const value: unknown = Reflect.get(object, property)
        if (typeof value !== 'function') return value
        if (property === Symbol.asyncIterator)
          return () => {
            const iterator = (value as () => AsyncIterator<unknown>).call(object)
            return {
              next: async () => {
                const step = await iterator.next()
                if (!step.done) count(step.value)
                return step
              }
            }
          }
        return (...args: unknown[]) => {
          const returned: unknown = (value as (...parameters: unknown[]) => unknown).apply(
            object,
            args
          )
          if (returned instanceof Promise)
            return returned.then((resolved: unknown) => {
              count(resolved)
              return resolved
            })
          return typeof returned === 'object' && returned !== null ? wrap(returned) : returned
        }
      }
    })
  return { db: wrap(db), counter }
}

async function projectionReadCost(base: PlayerControlFixture, role: 'OWNER' | 'PLAYER') {
  await checkpointLiveRoom(base.campaign.id)
  const samples: number[] = []
  let read = { documents: 0, bytes: 0 }
  for (let sample = 0; sample < 5; sample++)
    await base.t.run(async (ctx) => {
      const campaign = await ctx.db
        .query('campaigns')
        .withIndex('by_publicId', (q) => q.eq('id', base.campaign.id))
        .unique()
      if (!campaign) throw new Error('Missing write-set Campaign.')
      const { db, counter } = countingReads(ctx.db)
      const started = performance.now()
      const row = await db
        .query('encounterRuns')
        .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
        .unique()
      if (!row) throw new Error('Missing write-set Run.')
      await presentEncounterRun(encounterReadTransaction({ ...ctx, db }), row, campaign, {
        role,
        userId: role === 'OWNER' ? base.owner.userId : base.player.userId
      })
      samples.push(performance.now() - started)
      read = counter
    })
  const member = role === 'OWNER' ? base.owner : base.player
  const queries: number[] = []
  for (let sample = 0; sample < 5; sample++) {
    const started = performance.now()
    await member.caller.query(api.encounters.projectionReads.get, { encounterId: base.run.id })
    queries.push(performance.now() - started)
  }
  const median = (values: number[]) =>
    Number([...values].sort((left, right) => left - right)[2]!.toFixed(1))
  return { presentMs: median(samples), queryMs: median(queries), ...read }
}

/** What listing the Campaign's Run summaries reads, for the GM. */
async function summaryReadCost(base: PlayerControlFixture) {
  return base.t.run(async (ctx) => {
    const campaign = await ctx.db
      .query('campaigns')
      .withIndex('by_publicId', (q) => q.eq('id', base.campaign.id))
      .unique()
    if (!campaign) throw new Error('Missing write-set Campaign.')
    const { db, counter } = countingReads(ctx.db)
    const summaries = await readRunSummaries({ ...ctx, db }, campaign, 'OWNER')
    return { runs: summaries.length, ...counter }
  })
}

/** An Assisted START of identical Creatures whose tied initiatives the GM orders. */
async function tiedStart(actors: number) {
  const base = await fixture()
  const campaign = await base.owner.caller.mutation(api.campaigns.create.create, {
    name: 'Write sets',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  const { definitions, policyIds } = createEncounterInitiativeDefinitions([
    { cadence: 'ENCOUNTER_START', procedure: 'ACTOR_ROLL' }
  ])
  await base.t.mutation(internal.content.import.importDefinitions, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    definitions
  })
  await importSeededSubjects(base.t, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [importedSubject({ ...wolf, subjectKind: 'CREATURE', document: wolf })]
  })
  const {
    version,
    updatedAt: _updatedAt,
    ...settings
  } = await base.owner.caller.query(api.campaigns.playSettings.get, { campaignId: campaign.id })
  await base.owner.caller.mutation(api.campaigns.playSettings.save, {
    ...settings,
    expectedVersion: version,
    automationMode: 'ASSISTED',
    initiativePolicyDefinitionId: policyIds[0]!,
    initiativeTieDefinitionId: null
  })
  const blueprint = await base.owner.caller.mutation(api.encounters.blueprints.create, {
    gameSystemId: campaign.gameSystemId,
    name: 'Tied wolves',
    commandId: crypto.randomUUID(),
    enemies: Array.from({ length: actors }, () => ({
      kind: 'CREATURE' as const,
      sourceId: wolf.id
    }))
  })
  const run = await base.owner.caller.mutation(api.encounters.runs.create, {
    campaignId: campaign.id,
    blueprintId: blueprint.id,
    commandId: crypto.randomUUID()
  })
  await attachFixtureRoom(base.t, campaign.id)
  // Identical Creatures rolling each d20 face twice in turn tie in pairs, which the GM orders.
  await queueRoomRolls(campaign.id, {
    rolls: Array.from({ length: 1000 }, (_, draw) => Math.floor(draw / 2) % 20)
  })
  let before = await snapshot(base.t, campaign.id)
  let current = await executeInRoom(base.owner.caller, {
    command: {
      type: 'START',
      encounterId: run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: 0
    }
  })
  let after = await snapshot(base.t, campaign.id)
  const start = writeSet(before, after)
  const choices: WriteSet[] = []
  while (current.occurrence?.status === 'PENDING') {
    const pending = current.occurrence.pending
    if (pending?.kind !== 'INITIATIVE_ORDER' || choices.length > actors)
      throw new Error(`Expected an initiative tie, got ${pending?.kind ?? 'none'}.`)
    before = after
    current = await executeInRoom(base.owner.caller, {
      command: {
        type: 'RESOLVE_RULE_OCCURRENCE',
        encounterId: run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: current.projection.version,
        correlationId: null,
        occurrenceId: current.occurrence.occurrenceId,
        expectedOccurrenceVersion: current.occurrence.occurrenceVersion,
        resolution: {
          kind: 'INITIATIVE_ENTITY',
          requestId: pending.requestId,
          entityId: pending.optionIds[0]!
        }
      }
    })
    after = await snapshot(base.t, campaign.id)
    choices.push(writeSet(before, after))
  }
  // Settling the occurrence deletes its snapshot parts.
  expect(
    await base.t.run((ctx) => ctx.db.query('encounterPendingSnapshotParts').collect())
  ).toEqual([])
  const written = choices.map((choice) => choice.written).sort((left, right) => left - right)
  return {
    start,
    choices: choices.length,
    medianChoice: choices.find(
      (choice) => choice.written === written[Math.floor(written.length / 2)]
    ),
    totalWritten: start.written + written.reduce((total, bytes) => total + bytes, 0)
  }
}

describe.each([11, 100])('Tied initiative write sets at %i actors', (actors) => {
  it('measures START and each tie order choice', { timeout: 1_200_000 }, async () => {
    const measured = await tiedStart(actors)
    console.log(JSON.stringify({ actors, tiedStart: measured }, null, 2))
    expect(measured.start.documents).toBeGreaterThan(0)
    // Each order choice writes its snapshot delta, not the whole sealed snapshot (Amendment 12).
    expect(measured.totalWritten).toBeLessThanOrEqual(2 * 1024 * 1024)
  })
})

describe.each([11, 100])('Encounter write sets at %i actors', (actors) => {
  it('measures each command and the projection read', { timeout: 600_000 }, async () => {
    // The fixture has a Character, two Creatures and a custom actor.
    const base = await playerControlFixture({ additionalCreatures: actors - 4 })
    const commands = {
      UPDATE_ACTOR: await measure(base, async () => ({
        type: 'UPDATE_ACTOR',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: await base.version(),
        actorId: base.enemy.id,
        currentHitPoints: 5
      })),
      RESOLVE_ACTION: await measure(base, () => base.bite(base.companion.id, base.enemy.id)),
      ADVANCE_TURN: await measure(base, async () => ({
        type: 'ADVANCE_TURN',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: await base.version()
      }))
    }
    const reads = {
      OWNER: await projectionReadCost(base, 'OWNER'),
      PLAYER: await projectionReadCost(base, 'PLAYER')
    }
    // Projections read each actor's small projection facts, never its source snapshot, and keep a
    // tenth of the 250 KiB read budget free: an actor's identity lives in its row columns alone, not
    // again in its stored state.
    for (const read of Object.values(reads))
      expect(read.bytes).toBeLessThanOrEqual(0.9 * 250 * 1024)
    const summaries = [await summaryReadCost(base)]
    for (let run = 0; run < 2; run++) {
      await base.owner.caller.mutation(api.encounters.runs.create, {
        campaignId: base.campaign.id,
        blueprintId: base.run.blueprintId,
        commandId: crypto.randomUUID()
      })
      summaries.push(await summaryReadCost(base))
    }
    console.log(JSON.stringify({ actors, commands, reads, summaries }, null, 2))
    expect(Object.keys(commands)).toHaveLength(3)
    // The Run list reads each Run document alone, whatever its actors.
    for (const summary of summaries) expect(summary.documents).toBe(summary.runs)
    expect(summaries.map((summary) => summary.runs - summaries[0]!.runs)).toEqual([0, 1, 2])
  })
})
