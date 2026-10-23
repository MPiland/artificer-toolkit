import {
  createConvexEncounterStoreReader,
  createConvexEncounterStore
} from '../lib/convexEncounterStore'
import { readTestActor } from '../../tests/fixtures/storedActors'
import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type {
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  CampaignPlaySettingsDto,
  SaveCampaignPlaySettingsInput
} from '@artificer-toolkit/schema/api/campaignSettings'
import {
  encounterGmProjectionDtoSchema,
  type CreateEncounterBlueprintInputDto,
  type CreateEncounterInputDto,
  type EncounterBlueprintDto,
  type EncounterExecuteInput,
  type EncounterGmProjectionDto,
  type PendingEncounterRuleOccurrenceSummaryDto
} from '@artificer-toolkit/schema/api/encounters'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import {
  createDnd5eRechargeDefinition,
  createDnd5eRechargeLifecycleDefinition
} from '@artificer-toolkit/rules-runtime/systems/dnd5e/encounterLifecyclePolicy'
import { projectPlayerEncounterProjection } from '@artificer-toolkit/rules-runtime/encounterProjection'
import { readPendingSnapshot } from '@artificer-toolkit/encounter-persistence/pendingSnapshots'
import { writeRunActor } from '@artificer-toolkit/encounter-persistence/documents'
import { fixture } from '../../tests/fixtures/characters'
import {
  automaticChargedBiteFeatureId,
  automaticChargedCreature,
  automaticChargedCreatureId
} from '../../tests/fixtures/encounterAction'
import { createEncounterInitiativeDefinitions } from '../../tests/fixtures/encounterInitiative'
import { importedSubject, importSeededSubjects } from '../../tests/fixtures/publication'
import { setAutoRollDice, type FixtureRolls } from '../../tests/fixtures/rollPreferences'
import { api, components, internal } from '../_generated/api'
import {
  attachFixtureRoom,
  checkpointLiveRoom,
  closeRoom,
  executeInRoom,
  expectRedactedRoomRefusal,
  invalidateRoomInputs,
  queueRoomRolls,
  type RoomCaller,
  roomErrorLogs,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'

const secondRechargeFeatureId = '00000000-0000-4000-8000-0000000008a4'
const secondRechargeChargeId = '00000000-0000-4000-8000-0000000008a5'

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
const getSettings = makeFunctionReference<'query', { campaignId: string }, CampaignPlaySettingsDto>(
  'campaigns/playSettings:get'
)
const saveSettings = makeFunctionReference<
  'mutation',
  SaveCampaignPlaySettingsInput,
  CampaignPlaySettingsDto
>('campaigns/playSettings:save')

function rechargeResolution(input: {
  encounterId: string
  pending: Pick<
    Extract<PendingEncounterRuleOccurrenceSummaryDto, { kind: 'RECHARGE_EVIDENCE' }>,
    'encounterVersion' | 'occurrenceId' | 'occurrenceVersion' | 'request'
  >
  commandId?: string
  value: number
}) {
  return {
    command: {
      type: 'RESOLVE_RULE_OCCURRENCE',
      encounterId: input.encounterId,
      commandId: input.commandId ?? crypto.randomUUID(),
      expectedVersion: input.pending.encounterVersion,
      occurrenceId: input.pending.occurrenceId,
      expectedOccurrenceVersion: input.pending.occurrenceVersion,
      correlationId: null,
      resolution: {
        kind: 'ENTER_INTEGER',
        requestId: input.pending.request.requestId,
        value: input.value
      }
    }
  } satisfies EncounterExecuteInput
}

/** What the room last published: it holds the Run's receipts and commands until it checkpoints (D85). */
async function stored(base: Awaited<ReturnType<typeof setup>>, encounterId: string) {
  await checkpointLiveRoom(base.campaign.id)
  return base.t.run(async (ctx) => ({
    receiptLedgers: await ctx.db.query('receiptLedgers').collect(),
    receiptLedgerParts: await ctx.db.query('receiptLedgerParts').collect(),
    run: await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', encounterId))
      .unique(),
    actors: await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (q) => q.eq('encounterId', encounterId))
      .collect(),
    rounds: await ctx.db
      .query('encounterInitiativeRounds')
      .withIndex('by_encounterId_round', (q) => q.eq('encounterId', encounterId))
      .collect(),
    participants: await ctx.db
      .query('encounterInitiativeParticipants')
      .withIndex('by_encounterId_round_actorId', (q) => q.eq('encounterId', encounterId))
      .collect(),
    occurrences: (await ctx.db.query('encounterRuleOccurrences').collect()).filter(
      (row) => row.encounterId === encounterId
    )
  }))
}

/** The Convex reads a member makes after the room's checkpoint. */
async function pendingFor(base: Awaited<ReturnType<typeof setup>>, caller: RoomCaller) {
  await checkpointLiveRoom(base.campaign.id)
  return caller.query(api.encounters.pendingReads.pendingRuleOccurrence, {
    encounterId: base.run.id
  })
}

async function projectionFor(base: Awaited<ReturnType<typeof setup>>, caller: RoomCaller) {
  await checkpointLiveRoom(base.campaign.id)
  return caller.query(api.encounters.projectionReads.get, { encounterId: base.run.id })
}

async function setup(rolls: FixtureRolls, creatures = 1, rechargeFeatures = 1) {
  const base = await fixture()
  await setAutoRollDice(base.t, base.owner.userId, rolls === 'AUTO_ROLL')
  await base.t.run(async (ctx) => {
    for (const [index, userId] of [base.owner.userId, base.other.userId].entries()) {
      const profile = await ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', userId))
        .unique()
      if (!profile) throw new Error('Missing Recharge fixture profile.')
      await ctx.runMutation(components.betterAuth.adapter.updateOne, {
        input: {
          model: 'user',
          where: [{ field: '_id', value: profile.authUserId }],
          update: { email: `draft_123456abcde${index}@example.invalid` }
        }
      })
    }
  })
  const graph = createDnd5eRechargeDefinition(5)
  const lifecycle = createDnd5eRechargeLifecycleDefinition(5)
  const originalFeature = automaticChargedCreature.features?.find(
    (feature) => feature.id === automaticChargedBiteFeatureId
  )
  if (!originalFeature?.charges) throw new Error('Missing charged Recharge Feature fixture.')
  const featureIds =
    rechargeFeatures === 2
      ? [automaticChargedBiteFeatureId, secondRechargeFeatureId]
      : [automaticChargedBiteFeatureId]
  const rechargeFeature = { ...originalFeature, ruleDefinitionIds: [lifecycle.id] }
  const initiative = createEncounterInitiativeDefinitions([
    { procedure: 'ACTOR_ROLL', cadence: 'ENCOUNTER_START' }
  ])
  await base.t.mutation(internal.content.import.importDefinitions, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    definitions: [
      ...initiative.definitions,
      {
        id: graph.id,
        definitionFamilyKey: graph.definitionFamilyKey,
        label: 'Recharge d6 fixture',
        description: 'Recharge d6 fixture',
        document: graph.definition,
        checksum: graph.checksum
      },
      {
        id: lifecycle.id,
        definitionFamilyKey: 'dnd5e-encounter-lifecycle',
        label: 'Recharge lifecycle fixture',
        description: 'Recharge lifecycle fixture',
        document: lifecycle,
        checksum: checksumRuleDocument(lifecycle)
      }
    ]
  })
  await importSeededSubjects(base.t, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [
      importedSubject({
        ...automaticChargedCreature,
        subjectKind: 'CREATURE',
        document: {
          ...automaticChargedCreature,
          features: [
            ...(automaticChargedCreature.features?.map((feature) =>
              feature.id === automaticChargedBiteFeatureId ? rechargeFeature : feature
            ) ?? []),
            ...(rechargeFeatures === 2
              ? [
                  {
                    ...rechargeFeature,
                    id: secondRechargeFeatureId,
                    charges: { ...rechargeFeature.charges, id: secondRechargeChargeId },
                    effects: []
                  }
                ]
              : [])
          ]
        }
      })
    ]
  })
  const campaign = await base.owner.caller.mutation(createCampaign, {
    name: 'Encounter execution fixture',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  const settings = await base.owner.caller.query(getSettings, { campaignId: campaign.id })
  const { version, updatedAt: _updatedAt, ...settingFields } = settings
  await base.owner.caller.mutation(saveSettings, {
    ...settingFields,
    expectedVersion: version,
    automationMode: 'ASSISTED',
    initiativePolicyDefinitionId: initiative.policyIds[0]!,
    initiativeTieDefinitionId: null
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
  const blueprint = await base.owner.caller.mutation(createBlueprint, {
    gameSystemId: campaign.gameSystemId,
    name: 'Recharge turn fixture',
    commandId: crypto.randomUUID(),
    enemies: Array.from({ length: creatures }, () => ({
      kind: 'CREATURE' as const,
      sourceId: automaticChargedCreatureId
    }))
  })
  const run = await base.owner.caller.mutation(createRun, {
    campaignId: campaign.id,
    blueprintId: blueprint.id,
    commandId: crypto.randomUUID()
  })
  await attachFixtureRoom(base.t, campaign.id)
  let expectedVersion = run.version
  for (const actor of run.actors)
    for (const featureId of featureIds) {
      const adjusted = await executeInRoom(base.owner.caller, {
        command: {
          type: 'ADJUST_FEATURE_RESOURCE',
          encounterId: run.id,
          commandId: crypto.randomUUID(),
          expectedVersion,
          actorId: actor.id,
          featureId,
          direction: 'USE',
          amount: 1
        }
      })
      expectedVersion = adjusted.projection.version
    }
  await checkpointLiveRoom(campaign.id)
  const current = await base.owner.caller.query(api.encounters.projectionReads.get, {
    encounterId: run.id
  })
  return { ...base, campaign, run: current, graph, lifecycle, featureIds }
}

describe('native Encounter turn Recharge', () => {
  useLocalRoomWorker()

  it('automatically rolls a Recharge when START enters a depleted Creature and replays the root', async () => {
    const base = await setup('AUTO_ROLL')
    const start: EncounterExecuteInput = {
      command: {
        type: 'START',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: base.run.version
      }
    }
    await queueRoomRolls(base.campaign.id, { rolls: [], repeat: 5 })
    const settled = await executeInRoom(base.owner.caller, start)
    expect(settled).toMatchObject({
      projection: { status: 'ACTIVE', round: 1, version: base.run.version + 1 },
      occurrence: { status: 'COMPLETE', pending: null }
    })
    await expect(executeInRoom(base.owner.caller, start)).resolves.toEqual({
      ...settled,
      projection: await projectionFor(base, base.owner.caller)
    })
    // The room holds the root's receipt and commands; the occurrence and the recharged Feature
    // charge are what it published (receipt shape: encounterRecharge.test.ts).
    const snapshot = await stored(base, base.run.id)
    expect(snapshot.actors).toHaveLength(1)
    expect(JSON.parse(snapshot.actors[0]!.stateJson)).toMatchObject({
      resources: { featureCharges: { [automaticChargedBiteFeatureId]: 0 } }
    })
    expect(snapshot.occurrences).toHaveLength(1)
  }, 30000)

  it('retains the first of two Recharge candidates until the second response atomically settles both', async () => {
    const base = await setup('PROMPT', 1, 2)
    let result = await executeInRoom(base.owner.caller, {
      command: {
        type: 'START',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: base.run.version
      }
    })
    while (result.occurrence?.pending?.kind === 'INITIATIVE_EVIDENCE') {
      result = await executeInRoom(base.owner.caller, {
        command: {
          type: 'RESOLVE_RULE_OCCURRENCE',
          encounterId: base.run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: base.run.version,
          occurrenceId: result.occurrence.occurrenceId,
          expectedOccurrenceVersion: result.occurrence.occurrenceVersion,
          correlationId: null,
          resolution: {
            kind: 'ENTER_INTEGER',
            requestId: result.occurrence.pending.request.requestId,
            value: 20
          }
        }
      })
    }
    if (!result.occurrence?.pending || result.occurrence.pending.kind !== 'RECHARGE_EVIDENCE')
      throw new Error('Expected first Recharge evidence.')
    const before = await stored(base, base.run.id)
    const first = rechargeResolution({
      encounterId: base.run.id,
      pending: result.occurrence.pending,
      commandId: crypto.randomUUID(),
      value: 4
    })
    const retained = await executeInRoom(base.owner.caller, first)
    expect(retained).toMatchObject({
      projection: { version: base.run.version, status: 'PREPARED' },
      occurrence: {
        status: 'PENDING',
        occurrenceVersion: result.occurrence.occurrenceVersion + 1
      }
    })
    expect(await stored(base, base.run.id)).toEqual({
      ...before,
      occurrences: [
        expect.objectContaining({
          state: 'PENDING',
          version: result.occurrence.occurrenceVersion + 1
        })
      ]
    })
    await expect(executeInRoom(base.owner.caller, first)).resolves.toEqual({
      ...retained,
      projection: await projectionFor(base, base.owner.caller)
    })
    if (!retained.occurrence?.pending || retained.occurrence.pending.kind !== 'RECHARGE_EVIDENCE')
      throw new Error('Expected second Recharge evidence.')
    const second = rechargeResolution({
      encounterId: base.run.id,
      pending: retained.occurrence.pending,
      commandId: crypto.randomUUID(),
      value: 5
    })
    const settled = await executeInRoom(base.owner.caller, second)
    expect(settled).toMatchObject({
      projection: { status: 'ACTIVE', version: base.run.version + 1 },
      occurrence: { status: 'COMPLETE', pending: null }
    })
    // The receipt's rechargeExecutions (rawDie 4 failed, afterUsed 1; rawDie 5 recharged,
    // afterUsed 0) stay in the room: the published Feature charges show both outcomes
    // (execution shape: encounterRecharge.test.ts).
    const terminal = await stored(base, base.run.id)
    expect(JSON.parse(terminal.actors[0]!.stateJson)).toMatchObject({
      resources: {
        featureCharges: {
          [automaticChargedBiteFeatureId]: 1,
          [secondRechargeFeatureId]: 0
        }
      }
    })
  }, 30000)

  it('issues owner-only Assisted Recharge evidence for each entering Creature and keeps a failed die spent', async () => {
    const base = await setup('PROMPT', 2)
    const start: EncounterExecuteInput = {
      command: {
        type: 'START',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: base.run.version
      }
    }
    let result = await executeInRoom(base.owner.caller, start)
    let orderReplay: EncounterExecuteInput | null = null
    while (
      result.occurrence?.pending?.kind === 'INITIATIVE_EVIDENCE' ||
      result.occurrence?.pending?.kind === 'INITIATIVE_ORDER'
    ) {
      const pending = result.occurrence.pending
      const response: EncounterExecuteInput = {
        command: {
          type: 'RESOLVE_RULE_OCCURRENCE',
          encounterId: base.run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: base.run.version,
          occurrenceId: result.occurrence.occurrenceId,
          expectedOccurrenceVersion: result.occurrence.occurrenceVersion,
          correlationId: null,
          resolution:
            pending.kind === 'INITIATIVE_EVIDENCE'
              ? { kind: 'ENTER_INTEGER', requestId: pending.request.requestId, value: 20 }
              : {
                  kind: 'INITIATIVE_ENTITY',
                  requestId: pending.requestId,
                  entityId: pending.optionIds[0]!
                }
        }
      }
      result = await executeInRoom(base.owner.caller, response)
      if (pending.kind === 'INITIATIVE_ORDER') orderReplay = response
    }
    if (!result.occurrence?.pending || result.occurrence.pending.kind !== 'RECHARGE_EVIDENCE')
      throw new Error('Expected owner Recharge evidence after initiative settles.')
    if (!orderReplay) throw new Error('Expected tied initiative order evidence.')
    await expect(executeInRoom(base.owner.caller, orderReplay)).resolves.toEqual({
      ...result,
      projection: await projectionFor(base, base.owner.caller)
    })
    await expect(pendingFor(base, base.other.caller)).rejects.toThrow('Encounter is unavailable.')
    const firstRecharge = rechargeResolution({
      encounterId: base.run.id,
      pending: result.occurrence.pending,
      commandId: crypto.randomUUID(),
      value: 5
    })
    const started = await executeInRoom(base.owner.caller, firstRecharge)
    expect(started).toMatchObject({
      projection: { status: 'ACTIVE', round: 1, version: base.run.version + 1 },
      occurrence: { status: 'COMPLETE', pending: null }
    })
    const advance: EncounterExecuteInput = {
      command: {
        type: 'ADVANCE_TURN',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: started.projection.version
      }
    }
    const beforeAdvance = await stored(base, base.run.id)
    const pendingAdvance = await executeInRoom(base.owner.caller, advance)
    if (
      !pendingAdvance.occurrence?.pending ||
      pendingAdvance.occurrence.pending.kind !== 'RECHARGE_EVIDENCE'
    )
      throw new Error('Expected Recharge evidence for the next Creature turn.')
    const beforeFailure = await stored(base, base.run.id)
    expect(beforeFailure.run).toEqual(beforeAdvance.run)
    expect(beforeFailure.actors).toEqual(beforeAdvance.actors)
    expect(beforeFailure.rounds).toEqual(beforeAdvance.rounds)
    expect(beforeFailure.participants).toEqual(beforeAdvance.participants)
    const failed = rechargeResolution({
      encounterId: base.run.id,
      pending: pendingAdvance.occurrence.pending,
      commandId: crypto.randomUUID(),
      value: 4
    })
    const settled = await executeInRoom(base.owner.caller, failed)
    expect(settled).toMatchObject({
      projection: { status: 'ACTIVE', round: 1, version: base.run.version + 2 },
      occurrence: { status: 'COMPLETE', pending: null }
    })
    await expect(executeInRoom(base.owner.caller, failed)).resolves.toEqual({
      ...settled,
      projection: await projectionFor(base, base.owner.caller)
    })
    // The two receipts' rechargeExecutions (rawDie 5 recharged, rawDie 4 failed) stay in the room:
    // the published Feature charges below show both outcomes (encounterRecharge.test.ts).
    const terminal = await stored(base, base.run.id)
    expect(terminal.occurrences).toHaveLength(2)
    expect(
      terminal.actors.map((row) => JSON.parse(row.stateJson).resources.featureCharges)
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ [automaticChargedBiteFeatureId]: 1 }),
        expect.objectContaining({ [automaticChargedBiteFeatureId]: 0 })
      ])
    )
  }, 30000)

  it('lets a controller end their actor turn while the GM answers the entering Recharge', async () => {
    const base = await setup('PROMPT', 2)
    let result = await executeInRoom(base.owner.caller, {
      command: {
        type: 'START',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: base.run.version
      }
    })
    while (
      result.occurrence?.pending?.kind === 'INITIATIVE_EVIDENCE' ||
      result.occurrence?.pending?.kind === 'INITIATIVE_ORDER'
    ) {
      const pending = result.occurrence.pending
      result = await executeInRoom(base.owner.caller, {
        command: {
          type: 'RESOLVE_RULE_OCCURRENCE',
          encounterId: base.run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: base.run.version,
          occurrenceId: result.occurrence.occurrenceId,
          expectedOccurrenceVersion: result.occurrence.occurrenceVersion,
          correlationId: null,
          resolution:
            pending.kind === 'INITIATIVE_EVIDENCE'
              ? { kind: 'ENTER_INTEGER', requestId: pending.request.requestId, value: 20 }
              : {
                  kind: 'INITIATIVE_ENTITY',
                  requestId: pending.requestId,
                  entityId: pending.optionIds[0]!
                }
        }
      })
    }
    if (!result.occurrence?.pending || result.occurrence.pending.kind !== 'RECHARGE_EVIDENCE')
      throw new Error('Expected Recharge evidence for the first Creature.')
    const started = await executeInRoom(
      base.owner.caller,
      rechargeResolution({ encounterId: base.run.id, pending: result.occurrence.pending, value: 5 })
    )
    const currentActorId = started.projection.currentActorId
    if (started.projection.status !== 'ACTIVE' || !currentActorId)
      throw new Error('Expected an active Run with a current Creature.')
    const advanceBy = (expectedVersion: number): EncounterExecuteInput => ({
      command: {
        type: 'ADVANCE_TURN',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion
      }
    })
    const beforeRefusal = await stored(base, base.run.id)
    await expect(
      executeInRoom(base.other.caller, advanceBy(started.projection.version))
    ).rejects.toMatchObject({ data: { code: 'DOMAIN_REJECTED', reason: 'NOT_ACTOR_CONTROLLER' } })
    expect(await stored(base, base.run.id)).toEqual(beforeRefusal)
    const granted = await executeInRoom(base.owner.caller, {
      command: {
        type: 'UPDATE_ACTOR',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: started.projection.version,
        actorId: currentActorId,
        controllerUserIds: [base.other.userId]
      }
    })
    const advance = advanceBy(granted.projection.version)
    const paused = await executeInRoom(base.other.caller, advance)
    // The player sees the pause but not the GM's Recharge decision or GM-only actor data.
    expect(paused.occurrence).toMatchObject({ status: 'PENDING', pending: null })
    expect(JSON.stringify(paused.projection)).not.toContain('healthBand')
    expect(await pendingFor(base, base.other.caller)).toBeNull()
    const pending = await pendingFor(base, base.owner.caller)
    if (!pending || pending.kind !== 'RECHARGE_EVIDENCE')
      throw new Error('Expected the GM to answer the entering Recharge.')
    const pausedRoot = (await stored(base, base.run.id)).occurrences.find(
      (row) => row.state === 'PENDING'
    )
    if (!pausedRoot) throw new Error('Expected the paused Recharge root.')
    expect(
      await base.t.run((ctx) =>
        readPendingSnapshot({ db: createConvexEncounterStoreReader(ctx) }, pausedRoot)
      )
    ).toMatchObject({
      applicationContext: {
        root: {
          rootCommandId: advance.command.commandId,
          initiatorUserId: base.owner.userId,
          requestedByUserId: base.other.userId
        }
      }
    })
    const answer = rechargeResolution({ encounterId: base.run.id, pending, value: 5 })
    const beforeAnswer = await stored(base, base.run.id)
    await expect(executeInRoom(base.other.caller, answer)).rejects.toThrow()
    expect(await stored(base, base.run.id)).toEqual(beforeAnswer)
    const settled = await executeInRoom(base.owner.caller, answer)
    expect(settled).toMatchObject({
      projection: { status: 'ACTIVE', version: granted.projection.version + 1 },
      occurrence: { status: 'COMPLETE', pending: null }
    })
    expect(settled.projection.currentActorId).not.toBe(currentActorId)
    // The command and receipt actorUserId (the player who requested the advance) stay in the
    // room; the paused root's requestedByUserId above is the published record of it.
    const terminal = await stored(base, base.run.id)
    // A replay returns the player's own original result over the current player projection.
    const replay = await executeInRoom(base.other.caller, advance)
    expect(replay.occurrence).toEqual(paused.occurrence)
    expect(replay.projection).toEqual(
      projectPlayerEncounterProjection(
        encounterGmProjectionDtoSchema.parse(await projectionFor(base, base.owner.caller)),
        {
          userId: base.other.userId,
          characters: new Map(),
          unseenActorIds: new Set<string>(),
          unseenConditionTypeIds: new Set<string>()
        }
      )
    )
    for (const hidden of ['healthBand', 'gmNotes', 'statBlock'])
      expect(JSON.stringify(replay)).not.toContain(hidden)
    await expectRedactedRoomRefusal(
      executeInRoom(base.owner.caller, advance),
      'The command ID was already used for different input.',
      'INVALID_COMMAND'
    )
    expect(await stored(base, base.run.id)).toEqual(terminal)
  }, 30000)

  it('sends a granted Creature Recharge to its controller by their roll preference', async () => {
    for (const variant of ['PLAYER_ANSWERS', 'GM_ANSWERS', 'PLAYER_AUTO_ROLL'] as const) {
      // The GM prompts, so only the controller's preference can auto-roll this Recharge.
      const base = await setup('PROMPT')
      await setAutoRollDice(base.t, base.other.userId, variant === 'PLAYER_AUTO_ROLL')
      await invalidateRoomInputs(base.campaign.id, ['PREFERENCES'])
      const creatureId = base.run.actors[0]!.id
      const granted = await executeInRoom(base.owner.caller, {
        command: {
          type: 'UPDATE_ACTOR',
          encounterId: base.run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: base.run.version,
          actorId: creatureId,
          controllerUserIds: [base.other.userId]
        }
      })
      let result = await executeInRoom(base.owner.caller, {
        command: {
          type: 'START',
          encounterId: base.run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: granted.projection.version
        }
      })
      while (
        result.occurrence?.pending?.kind === 'INITIATIVE_EVIDENCE' ||
        result.occurrence?.pending?.kind === 'INITIATIVE_ORDER'
      ) {
        const pending = result.occurrence.pending
        result = await executeInRoom(base.owner.caller, {
          command: {
            type: 'RESOLVE_RULE_OCCURRENCE',
            encounterId: base.run.id,
            commandId: crypto.randomUUID(),
            expectedVersion: granted.projection.version,
            occurrenceId: result.occurrence.occurrenceId,
            expectedOccurrenceVersion: result.occurrence.occurrenceVersion,
            correlationId: null,
            resolution:
              pending.kind === 'INITIATIVE_EVIDENCE'
                ? { kind: 'ENTER_INTEGER', requestId: pending.request.requestId, value: 20 }
                : {
                    kind: 'INITIATIVE_ENTITY',
                    requestId: pending.requestId,
                    entityId: pending.optionIds[0]!
                  }
          }
        })
      }
      if (variant === 'PLAYER_AUTO_ROLL') {
        expect(result).toMatchObject({
          projection: { status: 'ACTIVE' },
          occurrence: { status: 'COMPLETE', pending: null }
        })
        continue
      }
      const pending = result.occurrence?.pending
      if (!pending || pending.kind !== 'RECHARGE_EVIDENCE')
        throw new Error('Expected the granted Creature Recharge prompt.')
      expect(pending.rollerActorId).toBe(creatureId)
      for (const member of [base.owner, base.other])
        await expect(pendingFor(base, member.caller)).resolves.toEqual(pending)
      const answerer = variant === 'PLAYER_ANSWERS' ? base.other : base.owner
      const settled = await executeInRoom(
        answerer.caller,
        rechargeResolution({ encounterId: base.run.id, pending, value: 5 })
      )
      expect(settled).toMatchObject({
        projection: { status: 'ACTIVE' },
        occurrence: { status: 'COMPLETE', pending: null }
      })
    }
  }, 60000)

  it('rejects wrong evidence, authority, and stale Feature source without changing a pending Recharge', async () => {
    const base = await setup('PROMPT')
    let result = await executeInRoom(base.owner.caller, {
      command: {
        type: 'START',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: base.run.version
      }
    })
    while (
      result.occurrence?.pending?.kind === 'INITIATIVE_EVIDENCE' ||
      result.occurrence?.pending?.kind === 'INITIATIVE_ORDER'
    ) {
      const pending = result.occurrence.pending
      result = await executeInRoom(base.owner.caller, {
        command: {
          type: 'RESOLVE_RULE_OCCURRENCE',
          encounterId: base.run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: base.run.version,
          occurrenceId: result.occurrence.occurrenceId,
          expectedOccurrenceVersion: result.occurrence.occurrenceVersion,
          correlationId: null,
          resolution:
            pending.kind === 'INITIATIVE_EVIDENCE'
              ? { kind: 'ENTER_INTEGER', requestId: pending.request.requestId, value: 20 }
              : {
                  kind: 'INITIATIVE_ENTITY',
                  requestId: pending.requestId,
                  entityId: pending.optionIds[0]!
                }
        }
      })
    }
    if (!result.occurrence?.pending || result.occurrence.pending.kind !== 'RECHARGE_EVIDENCE')
      throw new Error('Expected Recharge evidence.')
    const pending = result.occurrence.pending
    const invalid = rechargeResolution({ encounterId: base.run.id, pending, value: 5 })
    const before = await stored(base, base.run.id)
    await expect(executeInRoom(base.other.caller, invalid)).rejects.toThrow()
    await expect(
      executeInRoom(base.owner.caller, {
        command: {
          ...invalid.command,
          commandId: crypto.randomUUID(),
          resolution: { ...invalid.command.resolution, requestId: crypto.randomUUID() }
        }
      })
    ).rejects.toThrow()
    expect(await stored(base, base.run.id)).toEqual(before)
    // The room holds the Run: release it before editing the stored actor beneath it.
    await closeRoom(base.campaign.id)
    await base.t.run(async (ctx) => {
      const actor = await ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) =>
          q.eq('encounterId', base.run.id).eq('id', base.run.actors[0]!.id)
        )
        .unique()
      if (!actor) throw new Error('Missing Recharge actor.')
      const state = structuredClone(await readTestActor(ctx, actor))
      const snapshot = state.snapshot as { payload: { features: unknown[] } }
      snapshot.payload.features = []
      await writeRunActor({ db: createConvexEncounterStore(ctx) }, actor._id, state)
    })
    const staleBefore = await stored(base, base.run.id)
    await expectRedactedRoomRefusal(
      executeInRoom(base.owner.caller, invalid),
      'The Encounter command could not be completed.'
    )
    expect(roomErrorLogs().join('\n')).toContain('Recharge evidence has no current candidate.')
    expect(await stored(base, base.run.id)).toEqual(staleBefore)
  }, 30000)
})
