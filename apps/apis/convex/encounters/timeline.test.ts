import { makeFunctionReference } from 'convex/server'
import migrations from '@convex-dev/migrations/test'
import { describe, expect, it, vi } from 'vitest'
import type {
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  CreateEncounterBlueprintInputDto,
  CreateEncounterInputDto,
  EncounterBlueprintDto,
  EncounterCommandResultDto,
  EncounterExecuteInput,
  EncounterGmProjectionDto,
  EncounterTimelineDto
} from '@artificer-toolkit/schema/api/encounters'
import {
  encounterCommandInputDtoSchema,
  encounterCommandResultDtoSchema
} from '@artificer-toolkit/schema/api/encounters'
import { encounterStoredRunCommandSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { encounterRunStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { fixture } from '../../tests/fixtures/characters'

const createCampaign = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)
const createBlueprint = makeFunctionReference<
  'mutation',
  CreateEncounterBlueprintInputDto,
  EncounterBlueprintDto
>('encounters/blueprints:create')
const createRun = makeFunctionReference<
  'mutation',
  CreateEncounterInputDto,
  EncounterGmProjectionDto
>('encounters/runs:create')
const execute = makeFunctionReference<'mutation', EncounterExecuteInput, EncounterCommandResultDto>(
  'encounters/commands:execute'
)
const timeline = makeFunctionReference<
  'query',
  { encounterId: string; cursor?: string; limit?: number },
  EncounterTimelineDto
>('encounters/timelineReads:timeline')
const timelineBackfill = makeFunctionReference<'mutation', { reset?: boolean }, unknown>(
  'encounters/timelineBackfill:run'
)
const timelineReceiptsBatch = makeFunctionReference<
  'mutation',
  { oneBatchOnly: boolean; dryRun: boolean; cursor: string | null; batchSize: number },
  unknown
>('encounters/timelineBackfill:receipts')

async function setup() {
  const base = await fixture()
  const campaign = await base.owner.caller.mutation(createCampaign, {
    name: 'Encounter timeline',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  const blueprint = await base.owner.caller.mutation(createBlueprint, {
    gameSystemId: campaign.gameSystemId,
    name: 'Timeline fixture',
    commandId: crypto.randomUUID(),
    enemies: [{ kind: 'CUSTOM', label: 'Dummy', maxHitPoints: 10 }]
  })
  const run = await base.owner.caller.mutation(createRun, {
    campaignId: campaign.id,
    blueprintId: blueprint.id,
    commandId: crypto.randomUUID()
  })
  await base.t.run((ctx) =>
    ctx.db.insert('campaignMemberships', {
      campaignId: campaign.id,
      userId: base.other.userId,
      role: 'PLAYER',
      status: 'ACTIVE',
      accessStartedAt: campaign.createdAt,
      joinedAt: campaign.createdAt,
      leftAt: null
    })
  )
  return { ...base, campaign, blueprint, run }
}

async function writeHistory(
  owner: Awaited<ReturnType<typeof fixture>>['owner'],
  run: EncounterGmProjectionDto
) {
  await owner.caller.mutation(execute, {
    command: {
      type: 'SET_INITIATIVE',
      encounterId: run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: 0,
      actorId: run.actors[0]!.id,
      initiative: 10,
      manualOrder: 0
    }
  })
  await owner.caller.mutation(execute, {
    command: {
      type: 'SET_INITIATIVE',
      encounterId: run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: 1,
      actorId: run.actors[0]!.id,
      initiative: 20,
      manualOrder: 0
    }
  })
}

describe('native Encounter timeline reads', () => {
  it('pages owner history by UUID cursor and concatenates without omissions', async () => {
    const { owner, other, run } = await setup()
    await writeHistory(owner, run)
    expect(await other.caller.query(timeline, { encounterId: run.id, limit: 10 })).toEqual({
      entries: [],
      nextCursor: null
    })
    const pages: EncounterTimelineDto[] = []
    let cursor: string | undefined
    do {
      const page = await owner.caller.query(timeline, {
        encounterId: run.id,
        limit: 1,
        ...(cursor ? { cursor } : {})
      })
      pages.push(page)
      cursor = page.nextCursor ?? undefined
    } while (cursor)
    expect(pages.flatMap((page) => page.entries).map((entry) => entry.id)).toHaveLength(3)
    expect(new Set(pages.flatMap((page) => page.entries).map((entry) => entry.id)).size).toBe(3)
    expect(pages.at(-1)?.nextCursor).toBeNull()
  }, 30000)

  it('isolates cursors to the requested Run and returns empty for unknown cursors', async () => {
    const first = await setup()
    const second = await first.owner.caller.mutation(createRun, {
      campaignId: first.campaign.id,
      blueprintId: first.blueprint.id,
      commandId: crypto.randomUUID()
    })
    await writeHistory(first.owner, first.run)
    const firstPage = await first.owner.caller.query(timeline, {
      encounterId: first.run.id,
      limit: 1
    })
    expect(
      await first.owner.caller.query(timeline, {
        encounterId: second.id,
        cursor: firstPage.entries[0]!.id,
        limit: 10
      })
    ).toEqual({ entries: [], nextCursor: null })
    expect(
      await first.owner.caller.query(timeline, {
        encounterId: first.run.id,
        cursor: crypto.randomUUID(),
        limit: 10
      })
    ).toEqual({ entries: [], nextCursor: null })
  }, 30000)

  it('backfills timeline metadata in resumable idempotent batches and rejects tampering', async ({
    onTestFinished
  }) => {
    vi.useFakeTimers()
    onTestFinished(() => {
      vi.useRealTimers()
    })
    const { t, owner, run } = await setup()
    await writeHistory(owner, run)
    const commands = await t.run((ctx) =>
      ctx.db
        .query('encounterRunCommands')
        .withIndex('by_encounterId', (q) => q.eq('encounterId', run.id))
        .collect()
    )
    const command = commands.find((row) => row.commandType === 'CREATE')
    if (!command) throw new Error('Missing CREATE receipt')
    await t.run(async (ctx) => {
      for (const row of commands)
        await ctx.db.patch(
          row._id,
          row.commandType === 'CREATE'
            ? { id: undefined, version: undefined, visibility: undefined }
            : { visibility: undefined }
        )
    })
    migrations.register(t)
    await expect(owner.caller.query(timeline, { encounterId: run.id })).rejects.toThrow(
      'backfill is incomplete'
    )
    await t.mutation(timelineReceiptsBatch, {
      oneBatchOnly: true,
      dryRun: false,
      cursor: null,
      batchSize: 1
    })
    await expect(owner.caller.query(timeline, { encounterId: run.id })).rejects.toThrow(
      'backfill is incomplete'
    )
    await t.mutation(timelineBackfill, { reset: true })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    const backfilled = await t.run((ctx) => ctx.db.get(command._id))
    expect(backfilled).toMatchObject({ id: command.commandId, version: 0, visibility: 'PRIVATE' })
    await t.mutation(timelineBackfill, { reset: true })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    const finalCommands = await t.run((ctx) =>
      ctx.db
        .query('encounterRunCommands')
        .withIndex('by_encounterId', (q) => q.eq('encounterId', run.id))
        .collect()
    )
    expect(finalCommands).toEqual(commands)
    expect((await owner.caller.query(timeline, { encounterId: run.id })).entries).toHaveLength(3)
    await t.run((ctx) => ctx.db.patch(commands[0]!._id, { visibility: 'TABLE' }))
    await expect(
      t.mutation(timelineReceiptsBatch, {
        oneBatchOnly: true,
        dryRun: false,
        cursor: null,
        batchSize: 1
      })
    ).rejects.toThrow('timeline metadata mismatch')
    await expect(owner.caller.query(timeline, { encounterId: run.id })).rejects.toThrow(
      'timeline metadata mismatch'
    )
  }, 30000)

  it('shortens large history pages at the byte budget without omissions', async () => {
    const { t, owner, other, run } = await setup()
    const source = await t.run((ctx) =>
      ctx.db
        .query('encounterRunCommands')
        .withIndex('by_encounterId', (q) => q.eq('encounterId', run.id))
        .first()
    )
    const actor = run.actors[0]
    if (!source || !actor) throw new Error('Missing timeline fixture')
    const entries = await t.run(async (ctx) => {
      const created: string[] = []
      // Query-only receipts exercise large historical snapshots without generating 16 Rules turns.
      for (let version = 1; version <= 16; version++) {
        const commandId = crypto.randomUUID()
        const visibility = version % 2 === 0 ? ('TABLE' as const) : ('PRIVATE' as const)
        const input = encounterCommandInputDtoSchema.parse({
          type: 'ROLL_ENEMY_ACTION',
          encounterId: run.id,
          commandId,
          expectedVersion: version - 1,
          actorId: actor.id,
          featureId: 'fixture-feature',
          rollDefinitionId: 'fixture-roll',
          visibility
        })
        const projection = {
          ...run,
          version,
          actors: run.actors.map((candidate) => ({
            ...candidate,
            resources: { secret: 'x'.repeat(600000) }
          }))
        }
        const result = encounterCommandResultDtoSchema.parse({
          projection,
          roll: null,
          resolution: null,
          occurrence: null
        })
        const document = encounterStoredRunCommandSchema.parse({
          campaignId: run.campaignId,
          encounterId: run.id,
          commandId,
          commandFingerprint: checksumCanonicalJson(input),
          actorUserId: owner.userId,
          createdAt: new Date(Date.now() + version).toISOString(),
          visibility,
          id: crypto.randomUUID(),
          version,
          commandType: 'ROLL_ENEMY_ACTION',
          commandJson: JSON.stringify(input),
          resultJson: JSON.stringify(result),
          resultChecksum: checksumCanonicalJson(result)
        })
        expect(new TextEncoder().encode(JSON.stringify(document)).byteLength).toBeLessThan(
          1024 * 1024
        )
        await ctx.db.insert('encounterRunCommands', document)
        if (document.commandType === 'CREATE') throw new Error('Expected roll fixture')
        created.push(document.id)
      }
      return created
    })
    expect(entries).toHaveLength(16)
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query('encounterRuns')
        .withIndex('by_publicId', (q) => q.eq('id', run.id))
        .unique()
      if (!row) throw new Error('Missing Run')
      const state = encounterRunStateSchema.parse({ ...JSON.parse(row.stateJson), version: 16 })
      const projection = { ...run, version: 16 }
      await ctx.db.patch(row._id, {
        version: 16,
        stateJson: JSON.stringify(state),
        stateChecksum: checksumCanonicalJson(state),
        projectionJson: JSON.stringify(projection),
        projectionChecksum: checksumCanonicalJson(projection)
      })
    })
    const ids = new Set<string>()
    const versions: number[] = []
    let cursor: string | undefined
    let pages = 0
    do {
      const page = await owner.caller.query(timeline, {
        encounterId: run.id,
        limit: 100,
        ...(cursor ? { cursor } : {})
      })
      pages++
      if (pages === 1) {
        expect(page.entries.length).toBeLessThan(17)
        expect(page.nextCursor).not.toBeNull()
      }
      page.entries.forEach((entry) => ids.add(entry.id))
      versions.push(...page.entries.map((entry) => entry.version))
      cursor = page.nextCursor ?? undefined
    } while (cursor && pages < 20)
    expect(pages).toBeGreaterThan(1)
    expect(ids.size).toBe(17)
    expect(versions).toEqual(Array.from({ length: 17 }, (_, index) => 16 - index))
    expect([...ids].filter((id) => id !== source.commandId)).toEqual([...entries].reverse())
    expect(cursor).toBeUndefined()
    expect(await owner.caller.query(timeline, { encounterId: run.id, limit: 1 })).toMatchObject({
      nextCursor: expect.any(String)
    })
    const playerPage = await (async () => {
      const visible: EncounterTimelineDto['entries'] = []
      let playerCursor: string | undefined
      let playerPages = 0
      do {
        const page = await other.caller.query(timeline, {
          encounterId: run.id,
          limit: 100,
          ...(playerCursor ? { cursor: playerCursor } : {})
        })
        playerPages++
        if (playerPages === 1) {
          expect(page.entries.length).toBeLessThan(8)
          expect(page.nextCursor).not.toBeNull()
        }
        visible.push(...page.entries)
        playerCursor = page.nextCursor ?? undefined
      } while (playerCursor && playerPages < 20)
      expect(playerCursor).toBeUndefined()
      return visible
    })()
    expect(playerPage).toHaveLength(8)
    expect(playerPage.every((entry) => entry.visibility === 'TABLE')).toBe(true)
    expect(playerPage.map((entry) => entry.version)).toEqual([16, 14, 12, 10, 8, 6, 4, 2])
    for (const entry of playerPage) {
      expect(Object.keys(entry).sort()).toEqual([
        'actorUserId',
        'commandType',
        'createdAt',
        'id',
        'resolution',
        'roll',
        'ruleOverrides',
        'version',
        'visibility'
      ])
      expect(entry.ruleOverrides).toEqual([])
    }
    const privateCursor = (await owner.caller.query(timeline, { encounterId: run.id, limit: 2 }))
      .entries[1]!.id
    expect(
      await other.caller.query(timeline, { encounterId: run.id, cursor: privateCursor, limit: 100 })
    ).toEqual({
      entries: [],
      nextCursor: null
    })
  }, 30000)

  it('rejects a corrupted result checksum before returning a timeline entry', async () => {
    const { t, owner, run } = await setup()
    await writeHistory(owner, run)
    await t.run(async (ctx) => {
      const command = await ctx.db
        .query('encounterRunCommands')
        .withIndex('by_encounterId_version', (q) => q.eq('encounterId', run.id).eq('version', 1))
        .unique()
      if (!command || command.commandType === 'CREATE') throw new Error('Missing command receipt')
      await ctx.db.patch(command._id, { resultChecksum: '0'.repeat(64) })
    })
    await expect(owner.caller.query(timeline, { encounterId: run.id })).rejects.toThrow(
      'receipt mismatch'
    )
  }, 30000)

  it('denies anonymous and departed membership timeline reads', async () => {
    const { t, other, campaign, run } = await setup()
    await expect(t.query(timeline, { encounterId: run.id })).rejects.toThrow('Unauthenticated')
    await t.run(async (ctx) => {
      const membership = await ctx.db
        .query('campaignMemberships')
        .withIndex('by_campaignId_userId', (q) =>
          q.eq('campaignId', campaign.id).eq('userId', other.userId)
        )
        .unique()
      if (!membership) throw new Error('Missing membership')
      await ctx.db.patch(membership._id, { status: 'LEFT', leftAt: campaign.createdAt })
    })
    await expect(other.caller.query(timeline, { encounterId: run.id })).rejects.toThrow(
      'Campaign not found'
    )
  }, 30000)
})
