// @vitest-environment node
import { makeFunctionReference } from 'convex/server'
import { expect, it } from 'vitest'
import type {
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  CampaignPlaySettingsDto,
  SaveCampaignPlaySettingsInput
} from '@artificer-toolkit/schema/api/campaignSettings'
import type {
  CreateEncounterBlueprintInputDto,
  CreateEncounterInputDto,
  EncounterBlueprintDto,
  EncounterGmProjectionDto
} from '@artificer-toolkit/schema/api/encounters'
import { encounterGmProjectionDtoSchema } from '@artificer-toolkit/schema/api/encounters'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { activateFixtureRun, updateFixtureRunActors } from '../../tests/fixtures/activeInitiative'
import { fixture } from '../../tests/fixtures/characters'
import {
  attachFixtureRoom,
  checkpointLiveRoom,
  executeInRoom,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'

useLocalRoomWorker()

const createCampaign = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)
const getPlaySettings = makeFunctionReference<
  'query',
  { campaignId: string },
  CampaignPlaySettingsDto
>('campaigns/playSettings:get')
const savePlaySettings = makeFunctionReference<
  'mutation',
  SaveCampaignPlaySettingsInput,
  CampaignPlaySettingsDto
>('campaigns/playSettings:save')
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
const get = makeFunctionReference<'query', { encounterId: string }, unknown>(
  'encounters/projectionReads:get'
)
const pending = makeFunctionReference<'query', { encounterId: string }, unknown>(
  'encounters/pendingReads:pendingRuleOccurrence'
)
const decisionSettlement = makeFunctionReference<
  'query',
  { encounterId: string; occurrenceId: string; occurrenceVersion: number },
  unknown
>('encounters/activeReads:decisionSettlement')

it('V12 current native reads redact hidden actors and deny outsider or departed viewers', async () => {
  const base = await fixture()
  const campaign = await base.owner.caller.mutation(createCampaign, {
    name: 'V12 privacy',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  const blueprint = await base.owner.caller.mutation(createBlueprint, {
    gameSystemId: campaign.gameSystemId,
    name: 'V12 hidden actor',
    commandId: crypto.randomUUID(),
    enemies: [
      { kind: 'CUSTOM', label: 'Visible', maxHitPoints: 10 },
      { kind: 'CUSTOM', label: 'Hidden', maxHitPoints: 10 }
    ]
  })
  const run = await base.owner.caller.mutation(createRun, {
    campaignId: campaign.id,
    blueprintId: blueprint.id,
    commandId: crypto.randomUUID()
  })
  await base.t.run(async (ctx) => {
    await ctx.db.insert('campaignMemberships', {
      campaignId: campaign.id,
      userId: base.other.userId,
      role: 'PLAYER',
      status: 'ACTIVE',
      accessStartedAt: campaign.createdAt,
      joinedAt: campaign.createdAt,
      leftAt: null
    })
    const hidden = run.actors[1]
    if (!hidden) throw new Error('Missing hidden actor.')
    await activateFixtureRun(ctx, run.id, { currentActorId: hidden.id })
    await updateFixtureRunActors(ctx, run.id, (actor) =>
      actor.id === hidden.id && actor.kind === 'CUSTOM'
        ? { ...actor, public: false, gmNotes: 'V12 secret', currentHitPoints: 1, tempHitPoints: 3 }
        : actor
    )
  })
  const owner = encounterGmProjectionDtoSchema.parse(
    await base.owner.caller.query(get, { encounterId: run.id })
  )
  const player = await base.other.caller.query(get, { encounterId: run.id })
  expect(owner.actors).toHaveLength(2)
  expect(JSON.stringify(player)).not.toContain('V12 secret')
  expect(JSON.stringify(player)).not.toContain(run.actors[1]!.id)
  await expect(base.other.caller.query(pending, { encounterId: run.id })).resolves.toBeNull()
  await expect(base.t.query(get, { encounterId: run.id })).rejects.toThrow('Unauthenticated')
  await base.t.run(async (ctx) => {
    const membership = await ctx.db
      .query('campaignMemberships')
      .withIndex('by_campaignId_userId', (q) =>
        q.eq('campaignId', campaign.id).eq('userId', base.other.userId)
      )
      .unique()
    if (!membership) throw new Error('Missing membership.')
    await ctx.db.patch(membership._id, { status: 'LEFT', leftAt: campaign.createdAt })
  })
  await expect(base.other.caller.query(get, { encounterId: run.id })).rejects.toThrow(
    'Campaign not found'
  )
}, 30000)

it('D87 a player reads only the active Encounter; prepared, completed and foreign Runs are unavailable', async () => {
  const base = await fixture()
  const createdCampaign = (host: typeof base.owner, name: string) =>
    host.caller.mutation(createCampaign, {
      name,
      format: 'ONGOING',
      toneTags: ['HEROIC'],
      contentMaturity: 'STANDARD',
      gameSystemId: srdSystemRecord.id,
      primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
    })
  const prepareRun = async (host: typeof base.owner, campaignId: string) => {
    const blueprint = await host.caller.mutation(createBlueprint, {
      gameSystemId: srdSystemRecord.id,
      name: 'D87 gate',
      commandId: crypto.randomUUID(),
      enemies: [{ kind: 'CUSTOM', label: 'Gated', maxHitPoints: 10 }]
    })
    return host.caller.mutation(createRun, {
      campaignId,
      blueprintId: blueprint.id,
      commandId: crypto.randomUUID()
    })
  }
  const campaign = await createdCampaign(base.owner, 'D87 table')
  // MANUAL initiative: this fixture seeds no initiative policy, and the gate is about visibility.
  const { version, updatedAt: _updatedAt, ...settings } = await base.owner.caller.query(
    getPlaySettings,
    { campaignId: campaign.id }
  )
  await base.owner.caller.mutation(savePlaySettings, {
    ...settings,
    expectedVersion: version,
    automationMode: 'MANUAL'
  })
  const run =await prepareRun(base.owner, campaign.id)
  const foreign = await prepareRun(
    base.other,
    (await createdCampaign(base.other, 'D87 elsewhere')).id
  )
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
  const readAll = (caller: typeof base.owner.caller, encounterId: string) =>
    Promise.all([caller.query(get, { encounterId }), caller.query(pending, { encounterId })])
  const unavailable = 'Encounter is unavailable.'

  // PREPARED: the GM reads it; a player cannot, through any read.
  await expect(readAll(base.owner.caller, run.id)).resolves.toHaveLength(2)
  for (const read of [get, pending])
    await expect(base.other.caller.query(read, { encounterId: run.id })).rejects.toThrow(
      unavailable
    )
  await expect(
    base.other.caller.query(decisionSettlement, {
      encounterId: run.id,
      occurrenceId: crypto.randomUUID(),
      occurrenceVersion: 1
    })
  ).rejects.toThrow(unavailable)

  // ACTIVE: the GM reveals it by starting it in the room; both read it, with player redaction.
  await attachFixtureRoom(base.t, campaign.id)
  const started = await executeInRoom(base.owner.caller, {
    command: {
      type: 'START',
      encounterId: run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: 0
    }
  })
  expect(started.projection.status).toBe('ACTIVE')
  await checkpointLiveRoom(campaign.id)
  await expect(readAll(base.owner.caller, run.id)).resolves.toHaveLength(2)
  await expect(base.other.caller.query(get, { encounterId: run.id })).resolves.toMatchObject({
    id: run.id,
    status: 'ACTIVE'
  })
  await expect(base.other.caller.query(pending, { encounterId: run.id })).resolves.toBeNull()

  // COMPLETED: the GM ends it in the room; only the GM reads it.
  const completed = await executeInRoom(base.owner.caller, {
    command: {
      type: 'COMPLETE',
      encounterId: run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: started.projection.version
    }
  })
  expect(completed.projection.status).toBe('COMPLETED')
  await expect(readAll(base.owner.caller, run.id)).resolves.toHaveLength(2)
  await expect(base.other.caller.query(get, { encounterId: run.id })).rejects.toThrow(unavailable)

  // Another Campaign's Run is not readable by a GM who is not its member.
  await expect(base.owner.caller.query(get, { encounterId: foreign.id })).rejects.toThrow(
    'Campaign not found'
  )
}, 30000)
