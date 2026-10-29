import { readReceiptHeaders } from '../lib/receiptLedgers'
import { readTestActor } from '../../tests/fixtures/storedActors'
import { readStoredRunActor } from '@artificer-toolkit/encounter-persistence/actorProjectionFacts'
import { makeFunctionReference } from 'convex/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type {
  CreateEncounterBlueprintInputDto,
  CreateEncounterInputDto,
  EncounterBlueprintDto,
  EncounterGmProjectionDto,
  ResolveEncounterActionInputDto
} from '@artificer-toolkit/schema/api/encounters'
import { encounterGmProjectionDtoSchema } from '@artificer-toolkit/schema/api/encounters'
import { featureChargeUsed } from '@artificer-toolkit/rules-runtime/encounterActorState'
import { discoverEncounterFeatureActionCapabilities } from '@artificer-toolkit/rules-runtime/encounterFeatureActionCapabilityDiscoveryRegistry'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdWolf as wolf } from '../../tests/fixtures/srdCreatures'
import {
  SRD_ACTION_ALLOWANCE_DEFINITION_ID,
  SRD_RULE_STATE_DEFINITIONS
} from '@artificer-toolkit/source-data/srd/ruleState.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { importedSubject, importSeededSubjects } from '../../tests/fixtures/publication'
import { setupCharacterRun } from '../../tests/fixtures/encounterCharacter'
import { createEncounterInitiativeDefinitions } from '../../tests/fixtures/encounterInitiative'
import type { TableNames } from '../_generated/dataModel'
import { api, internal } from '../_generated/api'
import schema from '../schema'
import { runAccountDeletionStep } from '../../tests/fixtures/accountDeletion'
import * as deletionJobs from '../accountDeletionJobs'
import { readCharacterRecord, readCharacterRow } from '../characters/stateDocuments'
import {
  attachRoomWorker,
  checkpointRoom,
  executeInRoom,
  queueRoomRolls,
  seedRoomContentSnapshots,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'

useLocalRoomWorker()
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

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

const creature = {
  ...wolf,
  features: wolf.features?.map((feature) =>
    feature.label !== 'Bite'
      ? feature
      : {
          ...feature,
          charges: {
            id: '00000000-0000-4000-8000-000000000099',
            limitKind: 'FIXED_AMOUNT' as const,
            scalingKind: 'NONE' as const,
            resetKind: 'MANUAL' as const,
            amount: 1
          },
          effects: feature.effects?.map((effect) => ({
            ...effect,
            invocation: {
              ...effect.invocation,
              triggerCode: 'ACTIVATED' as const,
              range: { id: effect.invocation.range.id, rangeKind: 'UNLIMITED' as const },
              targeting: {
                selectionKind: 'SINGLE_TARGET' as const,
                dispositionKind: 'ANY' as const
              },
              resourceUse: { chargeId: '00000000-0000-4000-8000-000000000099', cost: 1 }
            },
            paths: effect.paths?.slice(0, 1).map((path) => {
              if (!('resultBlock' in path)) return path
              return {
                ...path,
                pathCode: 'ON_USE' as const,
                resultBlock: {
                  ...path.resultBlock,
                  outcomes: path.resultBlock.outcomes.map((outcome) => {
                    if (outcome.effectKind !== 'DAMAGE')
                      throw new Error('Expected Bite damage fixture.')
                    return {
                      id: outcome.id,
                      effectKind: 'DAMAGE' as const,
                      damageTypeId: outcome.damageTypeId,
                      valueKind: 'FIXED' as const,
                      scalingKind: 'NONE' as const,
                      amount: 1
                    }
                  })
                }
              }
            })
          }))
        }
  )
}

/** Runs one step of the account's deletion job until the job moves to another step. */
async function runStepToCompletion(
  base: Awaited<ReturnType<typeof setup>>,
  step:
    | typeof internal.campaigns.accountDeparture.step
    | typeof internal.characters.accountDeletion.step
) {
  const readJob = () =>
    base.t.run((ctx) =>
      ctx.db
        .query('accountDeletionJobs')
        .withIndex('by_userId', (q) => q.eq('userId', base.player.userId))
        .unique()
    )
  const started = await readJob()
  for (;;) {
    await runAccountDeletionStep(base.t, base.player.userId, step)
    if ((await readJob())?.step !== started?.step) return
  }
}

function command(input: {
  encounterId: string
  actorId: string
  targetActorId: string
  actionId: string
  commandId?: string
  expectedVersion: number
  acknowledgedWarnings?: ResolveEncounterActionInputDto['acknowledgedWarnings']
}): ResolveEncounterActionInputDto {
  return {
    type: 'RESOLVE_ACTION',
    acceptedWieldConflict: null,
    acknowledgedWarnings: input.acknowledgedWarnings ?? [],
    encounterId: input.encounterId,
    commandId: input.commandId ?? crypto.randomUUID(),
    expectedVersion: input.expectedVersion,
    actorId: input.actorId,
    target: { kind: 'ACTOR', actorId: input.targetActorId },
    actionId: input.actionId,
    optionalCombatIntent: null,
    sceneContext: null
  }
}

async function setup(
  relationship = false,
  beforeStart?: (prepared: Awaited<ReturnType<typeof setupCharacterRun>>) => Promise<void>
) {
  const base = await setupCharacterRun()
  await attachRoomWorker(base.t)
  const sourceCreature = relationship
    ? {
        ...creature,
        features: creature.features.map((feature) =>
          feature.label !== 'Bite'
            ? feature
            : {
                ...feature,
                rollDefinitions: [
                  {
                    id: '00000000-0000-4000-8000-000000000091',
                    label: 'Binding attack',
                    kind: 'ATTACK' as const,
                    expression: { count: 1, die: 20, modifier: 10 },
                    rollMode: 'NORMAL' as const,
                    chargeCost: null,
                    order: 1
                  }
                ],
                effects: feature.effects?.map((effect) => ({
                  ...effect,
                  // A hold seals its source's reach (D152): the Bite reaches 5 feet.
                  invocation: {
                    ...effect.invocation,
                    triggerCode: 'MELEE_WEAPON_ATTACK' as const,
                    range: {
                      id: effect.invocation.range.id,
                      rangeKind: 'DISTANCE' as const,
                      amount: 5,
                      unit: 'FEET' as const
                    }
                  },
                  paths: effect.paths?.map((path) =>
                    !('resultBlock' in path)
                      ? path
                      : {
                          ...path,
                          pathCode: 'ON_HIT' as const,
                          resultBlock: {
                            ...path.resultBlock,
                            outcomes: [
                              {
                                id: '00000000-0000-4000-8000-000000000092',
                                effectKind: 'ACTOR_RELATIONSHIP' as const,
                                heldAtOnce: 1,
                                modules: [
                                  {
                                    id: '00000000-0000-4000-8000-000000000093',
                                    order: 1,
                                    kind: 'TARGET_SIZE_MAXIMUM' as const,
                                    sizeCode: 'MEDIUM' as const
                                  }
                                ],
                                conditions: []
                              }
                            ]
                          }
                        }
                  )
                }))
              }
        )
      }
    : creature
  const initiative = createEncounterInitiativeDefinitions([
    { procedure: 'ACTOR_ROLL', cadence: 'ENCOUNTER_START' }
  ])
  await base.t.mutation(internal.content.import.importDefinitions, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    definitions: [
      ...SRD_RULE_STATE_DEFINITIONS.filter(
        (definition) => definition.id === SRD_ACTION_ALLOWANCE_DEFINITION_ID
      ),
      ...initiative.definitions
    ]
  })
  await importSeededSubjects(base.t, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [
      importedSubject({ ...sourceCreature, subjectKind: 'CREATURE', document: sourceCreature })
    ]
  })
  const settings = await base.owner.caller.query(api.campaigns.playSettings.get, {
    campaignId: base.campaign.id
  })
  const { version, updatedAt: _updatedAt, ...settingFields } = settings
  await base.owner.caller.mutation(api.campaigns.playSettings.save, {
    ...settingFields,
    expectedVersion: version,
    automationMode: 'ASSISTED',
    initiativePolicyDefinitionId: initiative.policyIds[0]!,
    initiativeTieDefinitionId: null
  })
  await seedRoomContentSnapshots(base.campaign.id)
  const blueprint = await base.owner.caller.mutation(createBlueprint, {
    gameSystemId: base.campaign.gameSystemId,
    name: 'Character action target fixture',
    commandId: crypto.randomUUID(),
    enemies: [{ kind: 'CREATURE', sourceId: creature.id }]
  })
  const prepared = await base.owner.caller.mutation(createRun, {
    campaignId: base.campaign.id,
    blueprintId: blueprint.id,
    commandId: crypto.randomUUID()
  })
  const actor = prepared.actors.find((candidate) => candidate.kind === 'CREATURE')
  const target = prepared.actors.find((candidate) => candidate.kind === 'CHARACTER')
  if (!actor || !target) throw new Error('Missing Creature or Character action fixture actor.')
  await beforeStart?.(base)
  let active = await executeInRoom(base.owner.caller, {
    command: {
      type: 'START',
      encounterId: prepared.id,
      commandId: crypto.randomUUID(),
      expectedVersion: prepared.version
    }
  })
  while (active.occurrence?.status === 'PENDING') {
    const pending = active.occurrence.pending
    if (!pending || pending.kind !== 'INITIATIVE_ORDER' || !pending.optionIds[0])
      throw new Error('Unexpected Automatic initiative decision.')
    active = await executeInRoom(base.owner.caller, {
      command: {
        type: 'RESOLVE_RULE_OCCURRENCE',
        encounterId: prepared.id,
        commandId: crypto.randomUUID(),
        expectedVersion: active.projection.version,
        correlationId: null,
        occurrenceId: active.occurrence.occurrenceId,
        expectedOccurrenceVersion: active.occurrence.occurrenceVersion,
        resolution: {
          kind: 'INITIATIVE_ENTITY',
          requestId: pending.requestId,
          entityId: pending.optionIds[0]
        }
      }
    })
  }
  if (active.projection.currentActorId !== actor.id) {
    active = await executeInRoom(base.owner.caller, {
      command: {
        type: 'ADVANCE_TURN',
        encounterId: prepared.id,
        commandId: crypto.randomUUID(),
        expectedVersion: active.projection.version
      }
    })
  }
  if (active.projection.currentActorId !== actor.id)
    throw new Error('Creature did not receive the current normalized initiative turn.')
  const run = encounterGmProjectionDtoSchema.parse(active.projection)
  const actionId = await base.t.run(async (ctx) => {
    const row = await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (query) => query.eq('encounterId', run.id).eq('id', actor.id))
      .unique()
    if (!row) throw new Error('Missing Creature actor.')
    const capability = discoverEncounterFeatureActionCapabilities({
      spells: new Map(),
      actor: await readTestActor(ctx, row),
      conditionDefinitionIds: srdSystemRecord.conditionTypes.map((condition) => condition.id),
      abilityDefinitions: (srdSystemRecord.abilities ?? []).map((ability) => ({
        id: ability.id,
        code: ability.code
      }))
    }).find(
      (candidate) =>
        candidate.mechanicFacts.invocation.triggerCode ===
        (relationship ? 'MELEE_WEAPON_ATTACK' : 'ACTIVATED')
    )
    if (!capability) throw new Error('Missing Creature action capability.')
    return capability.actionId
  })
  await checkpointRoom(base.campaign.id)
  return { ...base, run, actor, target, actionId }
}

// Reads Convex after publishing the room-held Run. The room keeps command and rule-receipt
// history until the Run ends (D85), so those rows are not readable here.
async function records(base: Awaited<ReturnType<typeof setup>>) {
  await checkpointRoom(base.campaign.id)
  return base.t.run(async (ctx) => {
    const [character, target, source, run, occurrences, characterReceipts] = await Promise.all([
      readCharacterRow(ctx, base.character.id),
      ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) =>
          q.eq('encounterId', base.run.id).eq('id', base.target.id)
        )
        .unique(),
      ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) =>
          q.eq('encounterId', base.run.id).eq('id', base.actor.id)
        )
        .unique(),
      ctx.db
        .query('encounterRuns')
        .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
        .unique(),
      ctx.db
        .query('encounterRuleOccurrences')
        .withIndex('by_encounterId_state', (q) => q.eq('encounterId', base.run.id))
        .collect(),
      ctx.db
        .query('characterCommandReceipts')
        .withIndex('by_characterId_commandId', (q) => q.eq('characterId', base.character.id))
        .collect()
        .then((headers) => readReceiptHeaders(ctx, 'characterCommandReceipts', headers))
    ])
    return { character, target, source, run, occurrences, characterReceipts }
  })
}

describe('native Creature actions against Character targets', () => {
  it('records an effect-only Character mutation once with its typed receipt and exact replay', async () => {
    const base = await setup(true)
    const input = command({
      encounterId: base.run.id,
      actorId: base.actor.id,
      targetActorId: base.target.id,
      actionId: base.actionId,
      expectedVersion: base.run.version,
      // The 5-foot reach cannot be measured in a room without a Scene.
      acknowledgedWarnings: ['TARGET_RANGE_UNCHECKED']
    })
    const before = await records(base)
    await queueRoomRolls(base.campaign.id, { rolls: [], repeat: 14 })
    try {
      const result = await executeInRoom(base.owner.caller, {
        command: input
      })
      const after = await records(base)
      if (!before.character || !after.character || !before.target || !after.target)
        throw new Error('Missing Character effect records.')
      const beforeState = readCharacterRecord(before.character).state
      const afterState = readCharacterRecord(after.character).state
      expect(afterState.hitpoints.current).toBe(beforeState.hitpoints.current)
      expect(afterState.conditions ?? []).toEqual(beforeState.conditions ?? [])
      expect(after.target.stateJson).toBe(before.target.stateJson)
      expect(after.character.play.streamVersion).toBe(before.character.play.streamVersion + 1)
      const effects = () =>
        base.t.run((ctx) =>
          ctx.db
            .query('characterActiveRuleEffects')
            .withIndex('by_characterId_createdOrdinal_id', (q) =>
              q.eq('characterId', base.character.id)
            )
            .collect()
        )
      const created = await effects()
      // The room's held receipt (asserted in `nativeRoomEffectReceipts.test.ts`) is not sent to
      // members; its activeEffectTransitions are the rows
      // the room published for the Character.
      expect(created).toEqual([
        expect.objectContaining({
          characterId: base.character.id,
          sourceEncounterId: base.run.id,
          maintainedEffectStateId: null
        })
      ])
      await expect(executeInRoom(base.owner.caller, { command: input })).resolves.toEqual(result)
      expect(await records(base)).toEqual(after)
      expect(await effects()).toEqual(created)
    } finally {
      await queueRoomRolls(base.campaign.id, { rolls: [] })
    }
  }, 30000)

  it('settles Character hit points once without rewriting its Run actor, including replay and source charge', async () => {
    const base = await setup()
    const input = command({
      encounterId: base.run.id,
      actorId: base.actor.id,
      targetActorId: base.target.id,
      actionId: base.actionId,
      expectedVersion: base.run.version
    })
    const before = await records(base)
    const result = await executeInRoom(base.owner.caller, {
      command: input
    })
    const after = await records(base)
    if (
      !before.character ||
      !after.character ||
      !before.target ||
      !after.target ||
      !before.source ||
      !after.source
    )
      throw new Error('Missing settled records.')
    const afterHitPoints = readCharacterRecord(after.character).state.hitpoints.current
    expect(afterHitPoints).toBe(readCharacterRecord(before.character).state.hitpoints.current - 1)
    expect(after.target.stateJson).toBe(before.target.stateJson)
    expect(
      result.projection.actors.find((candidate) => candidate.id === base.target.id)
    ).toMatchObject({
      sourceRevision: null,
      currentHitPoints: afterHitPoints
    })
    // The source's charge consumption (0 to 1) as the room published the actor; its held receipt is
    // asserted in `nativeRoomEffectReceipts.test.ts`.
    const biteId = creature.features!.find((feature) => feature.label === 'Bite')!.id
    expect(featureChargeUsed(readStoredRunActor(before.source), biteId)).toBe(0)
    expect(featureChargeUsed(readStoredRunActor(after.source), biteId)).toBe(1)
    expect(after.character.play.streamVersion).toBe(before.character.play.streamVersion + 1)
    expect(after.characterReceipts).toEqual([])
    await expect(executeInRoom(base.owner.caller, { command: input })).resolves.toEqual(result)
    expect(await records(base)).toEqual(after)
    expect(base.owner.userId).not.toBe(base.player.userId)
    const tables = Object.keys(schema.tables) as TableNames[]
    const snapshot = () =>
      base.t.run(async (ctx) => ({
        app: Object.fromEntries(
          await Promise.all(
            tables.map(async (table) => [table, await ctx.db.query(table).collect()])
          )
        ),
        schedules: await ctx.db.system.query('_scheduled_functions').collect()
      }))
    const preservedOwner = await base.t.run(async (ctx) => ({
      profile: await ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', base.owner.userId))
        .unique(),
      campaign: await ctx.db
        .query('campaigns')
        .withIndex('by_publicId', (q) => q.eq('id', base.run.campaignId))
        .unique()
    }))
    // Fake timers keep the scheduler from running the job's steps behind the test.
    vi.useFakeTimers()
    const deletionJob = await base.t.run(async (ctx) => {
      const profile = await ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', base.player.userId))
        .unique()
      if (!profile) throw new Error('Missing deleting account profile.')
      await deletionJobs.startAccountDeletion(ctx, profile.authUserId, base.player.userId)
      const job = await ctx.db
        .query('accountDeletionJobs')
        .withIndex('by_userId', (q) => q.eq('userId', base.player.userId))
        .unique()
      if (!job) throw new Error('Missing account deletion job.')
      return job
    })
    const beforeCleanup = await snapshot()
    const abort = vi
      .spyOn(deletionJobs, 'continueAccountDeletion')
      .mockRejectedValueOnce(new Error('Injected Character receipt cleanup rollback'))
    try {
      await expect(
        runAccountDeletionStep(base.t, base.player.userId, internal.campaigns.accountDeparture.step)
      ).rejects.toThrow('Injected Character receipt cleanup rollback')
    } finally {
      abort.mockRestore()
    }
    expect(await snapshot()).toEqual(beforeCleanup)
    await runStepToCompletion(base, internal.campaigns.accountDeparture.step)
    // Held at CHARACTERS so only the Character cleanup runs, without the account commit.
    await base.t.run((ctx) => ctx.db.patch(deletionJob._id, { step: 'CHARACTERS' }))
    await runStepToCompletion(base, internal.characters.accountDeletion.step)
    await expect(
      base.t.run((ctx) =>
        ctx.db
          .query('characters')
          .withIndex('by_publicId', (q) => q.eq('id', base.character.id))
          .unique()
      )
    ).resolves.toBeNull()
    await expect(
      base.t.run((ctx) =>
        ctx.db
          .query('characterCommandReceipts')
          .withIndex('by_characterId_commandId', (q) => q.eq('characterId', base.character.id))
          .collect()
          .then((headers) => readReceiptHeaders(ctx, 'characterCommandReceipts', headers))
      )
    ).resolves.toEqual([])
    await expect(
      base.t.run((ctx) =>
        ctx.db
          .query('userProfiles')
          .withIndex('by_userId', (q) => q.eq('userId', base.owner.userId))
          .unique()
      )
    ).resolves.toEqual(preservedOwner.profile)
    const afterCampaign = await base.t.run((ctx) =>
      ctx.db
        .query('campaigns')
        .withIndex('by_publicId', (q) => q.eq('id', base.run.campaignId))
        .unique()
    )
    if (!preservedOwner.campaign || !afterCampaign) throw new Error('Missing retained Campaign.')
    expect(afterCampaign).toEqual({
      ...preservedOwner.campaign,
      version: preservedOwner.campaign.version + 1,
      updatedAt: afterCampaign.updatedAt
    })
    expect(Date.parse(afterCampaign.updatedAt)).toBeGreaterThanOrEqual(
      Date.parse(preservedOwner.campaign.updatedAt)
    )
  }, 30000)

  it('targets the current Character after a Sheet edit made after Run creation', async () => {
    // A Sheet edit is refused once the room holds the Run, so it is made before the Run starts.
    const created = { streamVersion: 0 }
    const base = await setup(false, async (prepared) => {
      const row = await prepared.t.run((ctx) => readCharacterRow(ctx, prepared.character.id))
      if (!row) throw new Error('Missing Character.')
      created.streamVersion = row.play.streamVersion
      await prepared.player.caller.mutation(api.characters.sheetCommands.execute, {
        id: prepared.character.id,
        command: {
          type: 'ADJUST_HIT_POINTS',
          mode: 'DAMAGE',
          amount: 1,
          expectedVersion: row.play.streamVersion,
          commandId: crypto.randomUUID()
        }
      })
    })
    const before = await records(base)
    if (!before.character) throw new Error('Missing edited Character.')
    expect(before.character.play.streamVersion).toBe(created.streamVersion + 1)
    await executeInRoom(base.owner.caller, {
      command: command({
        encounterId: base.run.id,
        actorId: base.actor.id,
        targetActorId: base.target.id,
        actionId: base.actionId,
        expectedVersion: base.run.version
      })
    })
    const after = await records(base)
    if (!after.character) throw new Error('Missing settled Character.')
    expect(after.character.play.streamVersion).toBe(before.character.play.streamVersion + 1)
    expect(readCharacterRecord(after.character).state.hitpoints.current).toBe(
      readCharacterRecord(before.character).state.hitpoints.current - 1
    )
  }, 30000)
})
