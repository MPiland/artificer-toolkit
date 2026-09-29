import { makeFunctionReference } from 'convex/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
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
import {
  liveSessionEncounterRulesInputSchema,
  type LiveSessionEncounterRulesInput
} from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import {
  liveSessionEncounterTurnCommitInputSchema,
  liveSessionEncounterTurnPendingInputSchema
} from '@artificer-toolkit/schema/api/liveSessionEncounterTurn'
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
import {
  createPlatformRulesRuntime,
  deriveRulesContinuationKey
} from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import { projectPlayerEncounterProjection } from '@artificer-toolkit/rules-runtime/encounterProjection'
import { writeRunActor } from '@artificer-toolkit/encounter-persistence/documents'
import { fixture } from '../../tests/fixtures/characters'
import {
  automaticChargedBiteFeatureId,
  automaticChargedCreature,
  automaticChargedCreatureId
} from '../../tests/fixtures/encounterAction'
import { createEncounterInitiativeDefinitions } from '../../tests/fixtures/encounterInitiative'
import { importedSubject } from '../../tests/fixtures/publication'
import { setAutoRollDice, type FixtureRolls } from '../../tests/fixtures/rollPreferences'
import { api, components, internal } from '../_generated/api'
import { planNativeLiveEncounterTurn } from '../../../session-worker/src/nativeEncounterTurn'
import { callLiveSessionRoute } from '../../../session-worker/src/liveSessionRoutes'
import {
  insertActiveLiveAuthority,
  stubLiveSessionFetch,
  workerEnvironment,
  executeInRoom,
  replayInRoom
} from '../../tests/fixtures/liveSessionWorker'

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

async function stored(base: Awaited<ReturnType<typeof fixture>>['t'], encounterId: string) {
  return base.run(async (ctx) => ({
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
    ),
    receipts: (await ctx.db.query('encounterRuleReceipts').collect()).filter(
      (row) => row.encounterId === encounterId
    ),
    commands: (await ctx.db.query('encounterRunCommands').collect()).filter(
      (row) => row.encounterId === encounterId
    )
  }))
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
  await base.t.mutation(internal.content.import.importSubjects, {
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
    manualReminderMode: 'OFF',
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
  let expectedVersion = run.version
  for (const actor of run.actors)
    for (const featureId of featureIds) {
      await executeInRoom(base.owner.caller, {
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
      expectedVersion += 1
    }
  const current = await base.owner.caller.query(api.encounters.projectionReads.get, {
    encounterId: run.id
  })
  return { ...base, campaign, run: current, graph, lifecycle, featureIds }
}

describe('native Encounter turn Recharge', () => {
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
    const entropy = vi.spyOn(crypto, 'getRandomValues').mockImplementation((values) => {
      ;(values as Uint32Array)[0] = 5
      return values
    })
    try {
      const settled = await executeInRoom(base.owner.caller, start)
      expect(settled).toMatchObject({
        projection: { status: 'ACTIVE', round: 1, version: base.run.version + 1 },
        occurrence: { status: 'COMPLETE', pending: null }
      })
      await expect(replayInRoom(base.owner.caller, start)).resolves.toEqual(settled)
      const snapshot = await stored(base.t, base.run.id)
      expect(snapshot.actors).toHaveLength(1)
      expect(JSON.parse(snapshot.actors[0]!.stateJson)).toMatchObject({
        resources: { featureCharges: { [automaticChargedBiteFeatureId]: 0 } }
      })
      expect(snapshot.receipts).toHaveLength(1)
      expect(snapshot.occurrences).toHaveLength(1)
      expect(snapshot.commands).toHaveLength(3)
    } finally {
      entropy.mockRestore()
    }
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
    const before = await stored(base.t, base.run.id)
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
    expect(await stored(base.t, base.run.id)).toEqual({
      ...before,
      occurrences: [
        expect.objectContaining({
          state: 'PENDING',
          version: result.occurrence.occurrenceVersion + 1
        })
      ]
    })
    await expect(replayInRoom(base.owner.caller, first)).resolves.toEqual(retained)
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
    const terminal = await stored(base.t, base.run.id)
    expect(JSON.parse(terminal.actors[0]!.stateJson)).toMatchObject({
      resources: {
        featureCharges: {
          [automaticChargedBiteFeatureId]: 1,
          [secondRechargeFeatureId]: 0
        }
      }
    })
    expect(JSON.parse(terminal.receipts[0]!.resultJson).rechargeExecutions).toEqual([
      expect.objectContaining({ rawDie: 4, recharged: false, afterUsed: 1 }),
      expect.objectContaining({ rawDie: 5, recharged: true, afterUsed: 0 })
    ])
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
    await expect(replayInRoom(base.owner.caller, orderReplay)).resolves.toEqual(result)
    expect(
      await base.other.caller.query(api.encounters.pendingReads.pendingRuleOccurrence, {
        encounterId: base.run.id
      })
    ).toBeNull()
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
    const beforeAdvance = await stored(base.t, base.run.id)
    const pendingAdvance = await executeInRoom(base.owner.caller, advance)
    if (
      !pendingAdvance.occurrence?.pending ||
      pendingAdvance.occurrence.pending.kind !== 'RECHARGE_EVIDENCE'
    )
      throw new Error('Expected Recharge evidence for the next Creature turn.')
    const beforeFailure = await stored(base.t, base.run.id)
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
    await expect(replayInRoom(base.owner.caller, failed)).resolves.toEqual(settled)
    const terminal = await stored(base.t, base.run.id)
    expect(terminal.receipts).toHaveLength(2)
    expect(terminal.occurrences).toHaveLength(2)
    expect(
      terminal.receipts.map((receipt) => JSON.parse(receipt.resultJson).rechargeExecutions)
    ).toEqual(
      expect.arrayContaining([
        [expect.objectContaining({ rawDie: 5, recharged: true, afterUsed: 0 })],
        [expect.objectContaining({ rawDie: 4, recharged: false, afterUsed: 1 })]
      ])
    )
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
    const beforeRefusal = await stored(base.t, base.run.id)
    await expect(
      executeInRoom(base.other.caller, advanceBy(started.projection.version))
    ).rejects.toThrow('NOT_ACTOR_CONTROLLER')
    expect(await stored(base.t, base.run.id)).toEqual(beforeRefusal)
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
    expect(
      await base.other.caller.query(api.encounters.pendingReads.pendingRuleOccurrence, {
        encounterId: base.run.id
      })
    ).toBeNull()
    const pending = await base.owner.caller.query(
      api.encounters.pendingReads.pendingRuleOccurrence,
      { encounterId: base.run.id }
    )
    if (!pending || pending.kind !== 'RECHARGE_EVIDENCE')
      throw new Error('Expected the GM to answer the entering Recharge.')
    const pausedRoot = (await stored(base.t, base.run.id)).occurrences.find(
      (row) => row.state === 'PENDING'
    )
    expect(JSON.parse(pausedRoot?.pendingSnapshotJson ?? 'null')).toMatchObject({
      applicationContext: {
        root: {
          rootCommandId: advance.command.commandId,
          initiatorUserId: base.owner.userId,
          requestedByUserId: base.other.userId
        }
      }
    })
    const answer = rechargeResolution({ encounterId: base.run.id, pending, value: 5 })
    const beforeAnswer = await stored(base.t, base.run.id)
    await expect(executeInRoom(base.other.caller, answer)).rejects.toThrow()
    expect(await stored(base.t, base.run.id)).toEqual(beforeAnswer)
    const settled = await executeInRoom(base.owner.caller, answer)
    expect(settled).toMatchObject({
      projection: { status: 'ACTIVE', version: granted.projection.version + 1 },
      occurrence: { status: 'COMPLETE', pending: null }
    })
    expect(settled.projection.currentActorId).not.toBe(currentActorId)
    const terminal = await stored(base.t, base.run.id)
    expect(
      terminal.commands.find((row) => row.commandId === advance.command.commandId)
    ).toMatchObject({ commandType: 'ADVANCE_TURN', actorUserId: base.other.userId })
    expect(
      terminal.receipts.find((row) => row.commandId === advance.command.commandId)
    ).toMatchObject({ actorUserId: base.other.userId })
    // A replay returns only to the player who ended the turn, as the player projection.
    const replay = await executeInRoom(base.other.caller, advance)
    expect(replay).toMatchObject({ occurrence: { status: 'COMPLETE', pending: null } })
    expect(replay.projection).toEqual(
      projectPlayerEncounterProjection(
        encounterGmProjectionDtoSchema.parse(
          await base.owner.caller.query(api.encounters.projectionReads.get, {
            encounterId: base.run.id
          })
        ),
        { userId: base.other.userId, characters: new Map() }
      )
    )
    for (const hidden of ['healthBand', 'gmNotes', 'statBlock'])
      expect(JSON.stringify(replay)).not.toContain(hidden)
    await expect(executeInRoom(base.owner.caller, advance)).rejects.toThrow('COMMAND_ID_REUSED')
    expect(await stored(base.t, base.run.id)).toEqual(terminal)
  }, 30000)

  it('sends a granted Creature Recharge to its controller by their roll preference', async () => {
    for (const variant of ['PLAYER_ANSWERS', 'GM_ANSWERS', 'PLAYER_AUTO_ROLL'] as const) {
      // The GM prompts, so only the controller's preference can auto-roll this Recharge.
      const base = await setup('PROMPT')
      await setAutoRollDice(base.t, base.other.userId, variant === 'PLAYER_AUTO_ROLL')
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
        await expect(
          member.caller.query(api.encounters.pendingReads.pendingRuleOccurrence, {
            encounterId: base.run.id
          })
        ).resolves.toEqual(pending)
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
    const before = await stored(base.t, base.run.id)
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
    expect(await stored(base.t, base.run.id)).toEqual(before)
    await base.t.run(async (ctx) => {
      const actor = await ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) =>
          q.eq('encounterId', base.run.id).eq('id', base.run.actors[0]!.id)
        )
        .unique()
      if (!actor) throw new Error('Missing Recharge actor.')
      const state = JSON.parse(actor.stateJson) as {
        snapshot: { payload: { features: unknown[] } }
      }
      state.snapshot.payload.features = []
      await writeRunActor(ctx, actor._id, state)
    })
    const staleBefore = await stored(base.t, base.run.id)
    await expect(executeInRoom(base.owner.caller, invalid)).rejects.toThrow(
      'Recharge evidence has no current candidate.'
    )
    expect(await stored(base.t, base.run.id)).toEqual(staleBefore)
  }, 30000)
})

describe('private DO turn Recharge terminal', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('commits an automatic entering-actor Recharge through private HTTP and exactly replays', async () => {
    const base = await setup('AUTO_ROLL', 2)
    const entropy = vi.spyOn(crypto, 'getRandomValues').mockImplementation((values) => {
      ;(values as Uint32Array)[0] = 5
      return values
    })
    try {
      let started = await executeInRoom(base.owner.caller, {
        command: {
          type: 'START',
          encounterId: base.run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: base.run.version
        }
      })
      while (started.occurrence?.pending?.kind === 'INITIATIVE_ORDER') {
        const pending = started.occurrence.pending
        started = await executeInRoom(base.owner.caller, {
          command: {
            type: 'RESOLVE_RULE_OCCURRENCE',
            encounterId: base.run.id,
            commandId: crypto.randomUUID(),
            expectedVersion: base.run.version,
            occurrenceId: started.occurrence.occurrenceId,
            expectedOccurrenceVersion: started.occurrence.occurrenceVersion,
            correlationId: null,
            resolution: {
              kind: 'INITIATIVE_ENTITY',
              requestId: pending.requestId,
              entityId: pending.optionIds[0]!
            }
          }
        })
      }
      if (started.projection.status !== 'ACTIVE')
        throw new Error(
          `Expected an active Run; pending ${started.occurrence?.pending?.kind ?? 'none'}.`
        )
      const epoch = crypto.randomUUID()
      await base.t.run((ctx) =>
        insertActiveLiveAuthority(ctx, {
          campaignId: base.campaign.id,
          epoch,
          createdAt: base.campaign.createdAt
        })
      )
      const secret = 'private-recharge-turn-test-secret-at-least-32-bytes'
      const environment = workerEnvironment(secret)
      vi.stubEnv('LIVE_SESSION_WORKER_SECRET', secret)
      stubLiveSessionFetch((pathname, init) => {
        if (
          pathname !== '/live-sessions/encounter-rules' &&
          pathname !== '/live-sessions/encounter-turn'
        )
          throw new Error(`Unexpected private turn request: ${pathname}`)
        if (new Headers(init?.headers).get('authorization') !== 'Bearer fixture-access-token')
          throw new Error('Missing private turn bearer token.')
        if (new Headers(init?.headers).get('x-artificer-live-session-secret') !== secret)
          throw new Error('Missing private turn secret.')
        if (typeof init?.body !== 'string') throw new Error('Missing private turn body.')
        if (pathname === '/live-sessions/encounter-rules')
          liveSessionEncounterRulesInputSchema.parse(JSON.parse(init.body))
        else liveSessionEncounterTurnCommitInputSchema.parse(JSON.parse(init.body))
        return base.owner.caller.fetch(pathname, init)
      })
      const runtimeSecret = process.env.BETTER_AUTH_SECRET
      if (!runtimeSecret) throw new Error('Missing fixture rule continuation secret.')
      const runtime = createPlatformRulesRuntime({
        continuationIntegrityKey: await deriveRulesContinuationKey(
          process.env.RULES_CONTINUATION_SECRET
        ),
        definitions: {
          async requireCurrent() {
            throw new Error('Turn graphs must use captured definitions.')
          }
        }
      })
      const scope: Omit<LiveSessionEncounterRulesInput, 'request'> = {
        campaignId: base.campaign.id,
        authorityEpoch: epoch,
        expectedUserId: base.owner.userId,
        expectedRole: 'OWNER',
        encounterId: base.run.id,
        expectedVersion: started.projection.version
      }
      const command = {
        type: 'ADVANCE_TURN' as const,
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: started.projection.version
      }
      const before = await stored(base.t, base.run.id)
      const planned = await planNativeLiveEncounterTurn(
        environment,
        'fixture-access-token',
        scope,
        command,
        { runtime, random: () => 5 }
      )
      if (planned.kind !== 'PLANNED' || planned.prepared.kind !== 'COMPLETE' || !planned.terminal)
        throw new Error('Expected completed automatic Recharge turn plan.')
      const enteringActorId = planned.prepared.root.proposedTerminalTransition.currentActorId
      if (!enteringActorId || enteringActorId === started.projection.currentActorId)
        throw new Error('Expected the next Creature to enter.')
      expect(planned.prepared.root.completedRechargePlan?.executions).toHaveLength(1)
      expect(planned.prepared.root.completedRechargePlan?.executions[0]).toMatchObject({
        candidate: { actorId: enteringActorId },
        recharged: true,
        afterUsed: 0
      })
      expect(await stored(base.t, base.run.id)).toEqual(before)
      const result = await callLiveSessionRoute(
        environment,
        'fixture-access-token',
        'encounterTurnCommit',
        planned.terminal
      )
      expect(result.projection).toMatchObject({
        ...planned.prepared.root.proposedTerminalTransition,
        version: before.run!.version + 1
      })
      const incoming = encounterGmProjectionDtoSchema
        .parse(result.projection)
        .actors.find((actor) => actor.id === enteringActorId)
      expect(incoming?.resources).toMatchObject({
        featureCharges: { [automaticChargedBiteFeatureId]: 0 }
      })
      const after = await stored(base.t, base.run.id)
      const receipt = after.receipts.find((entry) => entry.commandId === command.commandId)
      if (!receipt) throw new Error('Expected terminal turn receipt.')
      expect(JSON.parse(receipt.resultJson).rechargeExecutions).toEqual([
        expect.objectContaining({
          candidate: expect.objectContaining({ actorId: enteringActorId }),
          recharged: true,
          afterUsed: 0
        })
      ])
      expect(
        await callLiveSessionRoute(
          environment,
          'fixture-access-token',
          'encounterTurnCommit',
          planned.terminal
        )
      ).toEqual(result)
      expect(await stored(base.t, base.run.id)).toEqual(after)
    } finally {
      entropy.mockRestore()
    }
  }, 60_000)

  it.each(['START', 'ADVANCE_TURN'] as const)(
    'retains two Assisted %s Recharge responses privately until the second commits both',
    async (turnType) => {
      const base = await setup('PROMPT', 2, 2)
      const startCommand = {
        type: 'START' as const,
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: base.run.version
      }
      let started = await executeInRoom(base.owner.caller, {
        command: startCommand
      })
      while (
        started.occurrence?.pending?.kind === 'INITIATIVE_EVIDENCE' ||
        started.occurrence?.pending?.kind === 'INITIATIVE_ORDER'
      ) {
        const pending = started.occurrence.pending
        started = await executeInRoom(base.owner.caller, {
          command: {
            type: 'RESOLVE_RULE_OCCURRENCE',
            encounterId: base.run.id,
            commandId: crypto.randomUUID(),
            expectedVersion: base.run.version,
            occurrenceId: started.occurrence.occurrenceId,
            expectedOccurrenceVersion: started.occurrence.occurrenceVersion,
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
      if (turnType === 'ADVANCE_TURN') {
        for (const value of [5, 5]) {
          const evidence = started.occurrence?.pending
          if (!evidence || evidence.kind !== 'RECHARGE_EVIDENCE')
            throw new Error('Expected native START Recharge evidence.')
          started = await executeInRoom(
            base.owner.caller,
            rechargeResolution({ encounterId: base.run.id, pending: evidence, value })
          )
        }
        if (started.projection.status !== 'ACTIVE') throw new Error('Expected active Recharge Run.')
      } else if (
        started.projection.status !== 'PREPARED' ||
        started.occurrence?.pending?.kind !== 'RECHARGE_EVIDENCE'
      )
        throw new Error('Expected native pending START Recharge.')
      const epoch = crypto.randomUUID()
      await base.t.run((ctx) =>
        insertActiveLiveAuthority(ctx, {
          campaignId: base.campaign.id,
          epoch,
          createdAt: base.campaign.createdAt
        })
      )
      const secret = 'private-assisted-recharge-test-secret-at-least-32-bytes'
      const environment = workerEnvironment(secret)
      vi.stubEnv('LIVE_SESSION_WORKER_SECRET', secret)
      stubLiveSessionFetch((pathname, init) => {
        if (
          pathname !== '/live-sessions/encounter-rules' &&
          pathname !== '/live-sessions/encounter-turn-pending' &&
          pathname !== '/live-sessions/encounter-turn'
        )
          throw new Error(`Unexpected private turn request: ${pathname}`)
        if (new Headers(init?.headers).get('authorization') !== 'Bearer fixture-access-token')
          throw new Error('Missing private turn bearer token.')
        if (new Headers(init?.headers).get('x-artificer-live-session-secret') !== secret)
          throw new Error('Missing private turn secret.')
        if (typeof init?.body !== 'string') throw new Error('Missing private turn body.')
        if (pathname === '/live-sessions/encounter-rules')
          liveSessionEncounterRulesInputSchema.parse(JSON.parse(init.body))
        else if (pathname === '/live-sessions/encounter-turn-pending')
          liveSessionEncounterTurnPendingInputSchema.parse(JSON.parse(init.body))
        else liveSessionEncounterTurnCommitInputSchema.parse(JSON.parse(init.body))
        return base.owner.caller.fetch(pathname, init)
      })
      const runtimeSecret = process.env.BETTER_AUTH_SECRET
      if (!runtimeSecret) throw new Error('Missing fixture rule continuation secret.')
      const runtime = createPlatformRulesRuntime({
        continuationIntegrityKey: await deriveRulesContinuationKey(
          process.env.RULES_CONTINUATION_SECRET
        ),
        definitions: {
          async requireCurrent() {
            throw new Error('Recharge graphs must use captured definitions.')
          }
        }
      })
      const scope: Omit<LiveSessionEncounterRulesInput, 'request'> = {
        campaignId: base.campaign.id,
        authorityEpoch: epoch,
        expectedUserId: base.owner.userId,
        expectedRole: 'OWNER',
        encounterId: base.run.id,
        expectedVersion: started.projection.version
      }
      const advance = {
        type: 'ADVANCE_TURN' as const,
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: started.projection.version
      }
      const turnCommand = turnType === 'START' ? startCommand : advance
      const before = await stored(base.t, base.run.id)
      const firstPlan =
        turnType === 'ADVANCE_TURN'
          ? await planNativeLiveEncounterTurn(environment, 'fixture-access-token', scope, advance, {
              runtime,
              random: () => {
                throw new Error('Assisted Recharge must request dice.')
              }
            })
          : null
      let firstInput: ReturnType<typeof liveSessionEncounterTurnPendingInputSchema.parse> | null =
        null
      if (firstPlan) {
        if (firstPlan.kind !== 'PLANNED' || firstPlan.prepared.kind !== 'PENDING')
          throw new Error('Expected first private Recharge request.')
        firstInput = liveSessionEncounterTurnPendingInputSchema.parse({
          ...scope,
          command: firstPlan.command,
          revisions: firstPlan.revisions,
          scenes: firstPlan.scenes,
          snapshot: firstPlan.prepared.snapshot
        })
      }
      const firstPending = firstInput
        ? await callLiveSessionRoute(
            environment,
            'fixture-access-token',
            'encounterTurnPending',
            firstInput
          )
        : started
      if (
        !firstPending.occurrence?.pending ||
        firstPending.occurrence.pending.kind !== 'RECHARGE_EVIDENCE'
      )
        throw new Error('Expected first retained Recharge request.')
      expect(firstPending.projection.version).toBe(before.run!.version)
      const afterFirstPending = await stored(base.t, base.run.id)
      expect(afterFirstPending).toMatchObject({
        run: before.run,
        actors: before.actors,
        rounds: before.rounds,
        participants: before.participants,
        receipts: before.receipts,
        commands: before.commands
      })
      expect(afterFirstPending.occurrences).toHaveLength(
        before.occurrences.length + (firstInput ? 1 : 0)
      )
      if (firstInput)
        expect(
          await callLiveSessionRoute(
            environment,
            'fixture-access-token',
            'encounterTurnPending',
            firstInput
          )
        ).toEqual(firstPending)
      expect(await stored(base.t, base.run.id)).toEqual(afterFirstPending)
      const firstReplay = await planNativeLiveEncounterTurn(
        environment,
        'fixture-access-token',
        scope,
        turnCommand,
        {
          runtime,
          random: () => {
            throw new Error('Pending retry must not roll.')
          }
        }
      )
      expect(firstReplay).toEqual({ kind: 'REPLAY', result: firstPending })

      const firstResponse = rechargeResolution({
        encounterId: base.run.id,
        pending: firstPending.occurrence.pending,
        value: 4
      }).command
      const secondPlan = await planNativeLiveEncounterTurn(
        environment,
        'fixture-access-token',
        scope,
        firstResponse,
        {
          runtime,
          random: () => {
            throw new Error('Entered Recharge die must not reroll.')
          }
        }
      )
      if (secondPlan.kind !== 'PLANNED' || secondPlan.prepared.kind !== 'PENDING')
        throw new Error('Expected second private Recharge request.')
      const secondInput = liveSessionEncounterTurnPendingInputSchema.parse({
        ...scope,
        command: secondPlan.command,
        revisions: secondPlan.revisions,
        scenes: secondPlan.scenes,
        snapshot: secondPlan.prepared.snapshot
      })
      const secondPending = await callLiveSessionRoute(
        environment,
        'fixture-access-token',
        'encounterTurnPending',
        secondInput
      )
      if (
        !secondPending.occurrence?.pending ||
        secondPending.occurrence.pending.kind !== 'RECHARGE_EVIDENCE'
      )
        throw new Error('Expected second retained Recharge request.')
      expect(secondPending.occurrence.occurrenceVersion).toBe(
        firstPending.occurrence.occurrenceVersion + 1
      )
      const afterSecondPending = await stored(base.t, base.run.id)
      expect(afterSecondPending).toMatchObject({
        run: before.run,
        actors: before.actors,
        rounds: before.rounds,
        participants: before.participants,
        receipts: before.receipts,
        commands: before.commands
      })
      expect(afterSecondPending.occurrences).toHaveLength(
        before.occurrences.length + (firstInput ? 1 : 0)
      )
      expect(
        afterSecondPending.occurrences.find(
          (row) => row.id === firstPending.occurrence!.occurrenceId
        )
      ).toMatchObject({
        state: 'PENDING',
        version: secondPending.occurrence.occurrenceVersion
      })
      expect(
        await callLiveSessionRoute(
          environment,
          'fixture-access-token',
          'encounterTurnPending',
          secondInput
        )
      ).toEqual(secondPending)
      expect(await stored(base.t, base.run.id)).toEqual(afterSecondPending)
      const wrongUser = await base.other.caller.fetch('/live-sessions/encounter-turn-pending', {
        method: 'POST',
        headers: { 'x-artificer-live-session-secret': secret },
        body: JSON.stringify(secondInput)
      })
      expect(wrongUser.status).not.toBe(200)

      const finalResponse = rechargeResolution({
        encounterId: base.run.id,
        pending: secondPending.occurrence.pending,
        value: 5
      }).command
      await expect(
        planNativeLiveEncounterTurn(
          environment,
          'fixture-access-token',
          scope,
          {
            ...finalResponse,
            resolution: { ...finalResponse.resolution, requestId: crypto.randomUUID() }
          },
          {
            runtime,
            random: () => {
              throw new Error('Invalid request must not roll.')
            }
          }
        )
      ).rejects.toThrow()
      await expect(
        planNativeLiveEncounterTurn(
          environment,
          'fixture-access-token',
          scope,
          {
            ...finalResponse,
            expectedOccurrenceVersion: firstPending.occurrence.occurrenceVersion
          },
          {
            runtime,
            random: () => {
              throw new Error('Stale occurrence must not roll.')
            }
          }
        )
      ).rejects.toThrow()
      expect(await stored(base.t, base.run.id)).toEqual(afterSecondPending)

      const finalPlan = await planNativeLiveEncounterTurn(
        environment,
        'fixture-access-token',
        scope,
        finalResponse,
        {
          runtime,
          random: () => {
            throw new Error('Entered Recharge die must not reroll.')
          }
        }
      )
      if (
        finalPlan.kind !== 'PLANNED' ||
        finalPlan.prepared.kind !== 'COMPLETE' ||
        !finalPlan.terminal
      )
        throw new Error('Expected complete private Recharge turn.')
      expect(finalPlan.prepared.root.completedRechargePlan?.executions).toMatchObject([
        { rawDie: 4, recharged: false, afterUsed: 1 },
        { rawDie: 5, recharged: true, afterUsed: 0 }
      ])
      const result = await callLiveSessionRoute(
        environment,
        'fixture-access-token',
        'encounterTurnCommit',
        finalPlan.terminal
      )
      expect(result).toMatchObject({
        projection: { status: 'ACTIVE', version: before.run!.version + 1 },
        occurrence: {
          status: 'COMPLETE',
          pending: null,
          occurrenceVersion: secondPending.occurrence.occurrenceVersion + 1
        }
      })
      const enteringId = finalPlan.prepared.root.proposedTerminalTransition.currentActorId
      const entering = encounterGmProjectionDtoSchema
        .parse(result.projection)
        .actors.find((actor) => actor.id === enteringId)
      expect(entering?.resources).toMatchObject({
        featureCharges: {
          [automaticChargedBiteFeatureId]: 1,
          [secondRechargeFeatureId]: 0
        }
      })
      const terminal = await stored(base.t, base.run.id)
      const receipt = terminal.receipts.find((row) => row.commandId === turnCommand.commandId)
      if (!receipt) throw new Error('Expected terminal Recharge receipt.')
      expect(JSON.parse(receipt.resultJson).rechargeExecutions).toEqual([
        expect.objectContaining({ rawDie: 4, recharged: false, afterUsed: 1 }),
        expect.objectContaining({ rawDie: 5, recharged: true, afterUsed: 0 })
      ])
      expect(
        await callLiveSessionRoute(
          environment,
          'fixture-access-token',
          'encounterTurnCommit',
          finalPlan.terminal
        )
      ).toEqual(result)
      expect(await stored(base.t, base.run.id)).toEqual(terminal)
    },
    60_000
  )
})
