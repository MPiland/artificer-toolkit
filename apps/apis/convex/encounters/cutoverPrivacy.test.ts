// @vitest-environment node
import { makeFunctionReference } from 'convex/server'
import { expect, it } from 'vitest'
import type {
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  CreateEncounterBlueprintInputDto,
  CreateEncounterInputDto,
  EncounterBlueprintDto,
  EncounterGmProjectionDto
} from '@artificer-toolkit/schema/api/encounters'
import { encounterGmProjectionDtoSchema } from '@artificer-toolkit/schema/api/encounters'
import { encounterRunStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { activateFixtureRun, updateFixtureRunActors } from '../../tests/fixtures/activeInitiative'
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
  const run = await prepareRun(base.owner, campaign.id)
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
    Promise.all([
      caller.query(get, { encounterId }),
      caller.query(pending, { encounterId })
    ])
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

  // ACTIVE: both read it, with the existing player redaction.
  await base.t.run((ctx) => activateFixtureRun(ctx, run.id))
  await expect(readAll(base.owner.caller, run.id)).resolves.toHaveLength(2)
  await expect(readAll(base.other.caller, run.id)).resolves.toHaveLength(2)

  // COMPLETED: only the GM reads it.
  await base.t.run(async (ctx) => {
    const row = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', run.id))
      .unique()
    if (!row) throw new Error('Missing Encounter Run.')
    const state = encounterRunStateSchema.parse({ ...readRunState(row), status: 'COMPLETED' })
    await ctx.db.patch(row._id, {
      status: 'COMPLETED',
      stateJson: JSON.stringify(state),
      stateChecksum: checksumCanonicalJson(state)
    })
  })
  await expect(readAll(base.owner.caller, run.id)).resolves.toHaveLength(2)
  await expect(base.other.caller.query(get, { encounterId: run.id })).rejects.toThrow(unavailable)

  // Another Campaign's Run is not readable by a GM who is not its member.
  await expect(base.owner.caller.query(get, { encounterId: foreign.id })).rejects.toThrow(
    'Campaign not found'
  )
}, 30000)
