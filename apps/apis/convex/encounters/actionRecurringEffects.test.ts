// @vitest-environment node
import { expect, it } from 'vitest'
import {
  encounterCommandResultDtoSchema,
  encounterGmProjectionDtoSchema,
  type EncounterCommandResultDto,
  type EncounterExecuteInput
} from '@artificer-toolkit/schema/api/encounters'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdWolf as wolf } from '../../tests/fixtures/srdCreatures'
import {
  SRD_ACTION_ALLOWANCE_DEFINITION_ID,
  SRD_RULE_STATE_DEFINITIONS
} from '@artificer-toolkit/source-data/srd/ruleState.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { fixture } from '../../tests/fixtures/characters'
import { createEncounterLifecyclePolicyFixture } from '../../tests/fixtures/encounterInitiative'
import { importedSubject, importSeededSubjects } from '../../tests/fixtures/publication'
import { setAutoRollDice, type FixtureRolls } from '../../tests/fixtures/rollPreferences'
import { api, internal } from '../_generated/api'
import {
  attachFixtureRoom,
  checkpointLiveRoom,
  executeInRoom,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'

useLocalRoomWorker()

const recurringCreatureId = '00000000-0000-4000-8000-0000000008c0'
const recurringFeatureId = '00000000-0000-4000-8000-0000000008c1'
const recurringEffectId = '00000000-0000-4000-8000-0000000008c2'

function recurringCreature(kind: 'HEAL' | 'SAVE_DAMAGE') {
  const bite = wolf.features?.find((feature) => feature.label === 'Bite')
  const dexterity = srdSystemRecord.abilities?.find((ability) => ability.code === 'DEXTERITY')
  const slashing = srdSystemRecord.damageTypes?.find((damageType) => damageType.code === 'SLASHING')
  if (!bite || !dexterity || !slashing)
    throw new Error('Recurring action fixture requires Wolf Bite, Dexterity, and Slashing.')
  return {
    ...wolf,
    id: recurringCreatureId,
    label: `Recurring ${kind} creature`,
    features: wolf.features?.map((feature) =>
      feature.id !== bite.id
        ? feature
        : {
            ...feature,
            id: recurringFeatureId,
            effects: feature.effects?.slice(0, 1).map((effect) => ({
              ...effect,
              id: recurringEffectId,
              invocation:
                kind === 'HEAL'
                  ? {
                      ...effect.invocation,
                      triggerCode: 'ACTIVATED' as const,
                      range: { id: effect.invocation.range.id, rangeKind: 'SELF' as const },
                      targeting: { selectionKind: 'SELF' as const }
                    }
                  : {
                      ...effect.invocation,
                      triggerCode: 'SAVING_THROW' as const,
                      savingThrow: {
                        id: '00000000-0000-4000-8000-0000000008c3',
                        dcMethod: 'FIXED_DC' as const,
                        abilityDefinitionId: dexterity.id,
                        baseDc: 10
                      },
                      range: { id: effect.invocation.range.id, rangeKind: 'UNLIMITED' as const },
                      targeting: {
                        selectionKind: 'SINGLE_TARGET' as const,
                        dispositionKind: 'ANY' as const
                      }
                    },
              paths: effect.paths?.slice(0, 1).map((path) =>
                !('resultBlock' in path)
                  ? path
                  : {
                      ...path,
                      pathCode: kind === 'HEAL' ? ('ON_USE' as const) : ('ON_SAVE_FAIL' as const),
                      resultBlock: {
                        ...path.resultBlock,
                        id: '00000000-0000-4000-8000-0000000008c4',
                        duration: {
                          id: '00000000-0000-4000-8000-0000000008c5',
                          durationKind: 'ROUND' as const,
                          amount: 2
                        },
                        lifecycle: { recurringKind: 'START_OF_TURN' as const },
                        outcomes:
                          kind === 'HEAL'
                            ? [
                                {
                                  id: '00000000-0000-4000-8000-0000000008c6',
                                  effectKind: 'HEAL' as const,
                                  valueKind: 'FIXED' as const,
                                  scalingKind: 'NONE' as const,
                                  amount: 1
                                }
                              ]
                            : [
                                {
                                  id: '00000000-0000-4000-8000-0000000008c7',
                                  effectKind: 'DAMAGE' as const,
                                  damageTypeId: slashing.id,
                                  valueKind: 'FIXED' as const,
                                  scalingKind: 'NONE' as const,
                                  amount: 1
                                }
                              ]
                      }
                    }
              )
            }))
          }
    )
  }
}

async function settleStart(
  base: Awaited<ReturnType<typeof fixture>>,
  result: EncounterCommandResultDto
) {
  let current = result
  for (let resolutions = 0; current.occurrence?.status === 'PENDING'; resolutions++) {
    expect(resolutions).toBeLessThan(20)
    const pending = current.occurrence.pending
    const resolution =
      pending?.kind === 'INITIATIVE_EVIDENCE'
        ? {
            kind: 'ENTER_INTEGER' as const,
            requestId: pending.request.requestId,
            value: pending.request.max
          }
        : pending?.kind === 'INITIATIVE_ORDER'
          ? {
              kind: 'INITIATIVE_ENTITY' as const,
              requestId: pending.requestId,
              entityId: pending.optionIds[0]!
            }
          : (() => {
              throw new Error(
                'Recurring action fixture requested an unsupported initiative continuation.'
              )
            })()
    current = encounterCommandResultDtoSchema.parse(
      await executeInRoom(base.owner.caller, {
        command: {
          type: 'RESOLVE_RULE_OCCURRENCE',
          encounterId: current.projection.id,
          commandId: crypto.randomUUID(),
          expectedVersion: current.projection.version,
          correlationId: null,
          occurrenceId: current.occurrence.occurrenceId,
          expectedOccurrenceVersion: current.occurrence.occurrenceVersion,
          resolution
        }
      })
    )
  }
  return current
}

async function recurringFixture(kind: 'HEAL' | 'SAVE_DAMAGE', rolls: FixtureRolls = 'AUTO_ROLL') {
  const base = await fixture()
  await setAutoRollDice(base.t, base.owner.userId, rolls === 'AUTO_ROLL')
  const policies = createEncounterLifecyclePolicyFixture(base.owner.userId)
  await base.t.mutation(internal.content.import.bootstrap, policies.bootstrap)
  await base.t.mutation(internal.content.import.importDefinitions, policies.imported)
  await base.t.mutation(internal.content.import.importDefinitions, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    definitions: SRD_RULE_STATE_DEFINITIONS.filter(
      (definition) => definition.id === SRD_ACTION_ALLOWANCE_DEFINITION_ID
    )
  })
  const creature = recurringCreature(kind)
  await importSeededSubjects(base.t, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [importedSubject({ ...creature, subjectKind: 'CREATURE', document: creature })]
  })
  let campaign = await base.owner.caller.mutation(api.campaigns.create.create, {
    name: 'Recurring action fixture',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  campaign = await base.owner.caller.mutation(api.campaigns.update.update, {
    campaignId: campaign.id,
    expectedVersion: campaign.version,
    additionalRulesCatalogueIds: [policies.bootstrap.catalogue.id]
  })
  const settings = await base.owner.caller.query(api.campaigns.playSettings.get, {
    campaignId: campaign.id
  })
  const { version, updatedAt: _updatedAt, ...fields } = settings
  await base.owner.caller.mutation(api.campaigns.playSettings.save, {
    ...fields,
    expectedVersion: version,
    automationMode: 'ASSISTED',
    initiativePolicyDefinitionId: policies.scenarios[0]!.definitionId,
    initiativeTieDefinitionId: null
  })
  await attachFixtureRoom(base.t, campaign.id)
  const blueprint = await base.owner.caller.mutation(api.encounters.blueprints.create, {
    gameSystemId: campaign.gameSystemId,
    name: 'Recurring action fixture',
    commandId: crypto.randomUUID(),
    enemies: Array.from({ length: kind === 'HEAL' ? 1 : 2 }, () => ({
      kind: 'CREATURE' as const,
      sourceId: recurringCreatureId
    }))
  })
  let run = await base.owner.caller.mutation(api.encounters.runs.create, {
    campaignId: campaign.id,
    blueprintId: blueprint.id,
    commandId: crypto.randomUUID()
  })
  run = encounterGmProjectionDtoSchema.parse(
    (
      await settleStart(
        base,
        encounterCommandResultDtoSchema.parse(
          await executeInRoom(base.owner.caller, {
            command: {
              type: 'START',
              encounterId: run.id,
              commandId: crypto.randomUUID(),
              expectedVersion: run.version
            }
          })
        )
      )
    ).projection
  )
  const sources = run.actors.filter(
    (actor) => actor.kind === 'CREATURE' && actor.sourceId === recurringCreatureId
  )
  const actor = sources[0]
  const target = kind === 'HEAL' ? actor : sources[1]
  if (!actor || !target) throw new Error('Recurring action fixture actors are unavailable.')
  if (run.currentActorId !== actor.id)
    run = encounterGmProjectionDtoSchema.parse(
      (
        await executeInRoom(base.owner.caller, {
          command: {
            type: 'SET_CURRENT_ACTOR',
            encounterId: run.id,
            commandId: crypto.randomUUID(),
            expectedVersion: run.version,
            actorId: actor.id
          }
        })
      ).projection
    )
  return { base, campaignId: campaign.id, run, actor, target }
}

/** The rows the room last published: it holds the Run and its receipts until it checkpoints (D85). */
async function stored(base: Awaited<ReturnType<typeof recurringFixture>>) {
  await checkpointLiveRoom(base.campaignId)
  return base.base.t.run(async (ctx) => ({
    receiptLedgers: await ctx.db.query('receiptLedgers').collect(),
    receiptLedgerParts: await ctx.db.query('receiptLedgerParts').collect(),
    effects: await ctx.db
      .query('encounterActiveRuleEffects')
      .withIndex('by_encounterId_targetActorId_createdOrdinal_id', (q) =>
        q.eq('encounterId', base.run.id)
      )
      .take(3)
  }))
}

function actionInput(base: Awaited<ReturnType<typeof recurringFixture>>) {
  return {
    type: 'RESOLVE_ACTION' as const,
    encounterId: base.run.id,
    commandId: crypto.randomUUID(),
    expectedVersion: base.run.version,
    actorId: base.actor.id,
    target: { kind: 'ACTOR' as const, actorId: base.target.id },
    actionId: `${base.actor.id}:FEATURE:${recurringFeatureId}:EFFECT:${recurringEffectId}`,
    optionalCombatIntent: null,
    sceneContext: null
  }
}

function diceResponse(encounterId: string, input: unknown) {
  const pendingResult = encounterCommandResultDtoSchema.parse(input)
  const pending = pendingResult.occurrence?.pending
  if (!pending || pending.kind !== 'D20_EVIDENCE')
    throw new Error('Expected recurring damage d20 evidence.')
  return {
    command: {
      type: 'RESOLVE_RULE_OCCURRENCE' as const,
      encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: pendingResult.projection.version,
      correlationId: null,
      occurrenceId: pendingResult.occurrence!.occurrenceId,
      expectedOccurrenceVersion: pendingResult.occurrence!.occurrenceVersion,
      resolution: {
        kind: 'ENTER_DICE' as const,
        requestId: pending.request.requestId,
        rawFaces: pending.request.rollMode === 'NORMAL' ? [1] : [1, 1],
        rollMode: pending.request.rollMode
      }
    }
  } satisfies EncounterExecuteInput
}

it('creates, ticks, expires, and replays a recurring heal after zero healing at maximum HP', async () => {
  const base = await recurringFixture('HEAL')
  const action = actionInput(base)
  expect(base.actor.currentHitPoints).toBe(base.actor.maxHitPoints)
  const created = await executeInRoom(base.base.owner.caller, {
    command: action
  })
  expect(created.occurrence?.status).toBe('COMPLETE')
  const afterAction = await stored(base)
  expect(afterAction.effects).toHaveLength(1)
  expect(afterAction.effects[0]).toMatchObject({
    targetActorId: base.actor.id,
    lifecycle: { remainingTicks: 2 }
  })
  // The room holds the action's receipt (D85); `nativeRoomEffectReceipts.test.ts` asserts its one
  // CREATE transition. The retry below answers from the room's held history.
  await expect(executeInRoom(base.base.owner.caller, { command: action })).resolves.toEqual(created)
  expect(await stored(base)).toEqual(afterAction)

  let projection = encounterGmProjectionDtoSchema.parse(
    (
      await executeInRoom(base.base.owner.caller, {
        command: {
          type: 'UPDATE_ACTOR',
          encounterId: base.run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: created.projection.version,
          actorId: base.actor.id,
          currentHitPoints: base.actor.maxHitPoints - 2
        }
      })
    ).projection
  )
  const firstAdvance: EncounterExecuteInput = {
    command: {
      type: 'ADVANCE_TURN',
      encounterId: base.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: projection.version
    }
  }
  const firstTick = await executeInRoom(base.base.owner.caller, firstAdvance)
  projection = encounterGmProjectionDtoSchema.parse(firstTick.projection)
  expect(projection.actors.find((actor) => actor.id === base.actor.id)?.currentHitPoints).toBe(
    base.actor.maxHitPoints - 1
  )
  expect((await stored(base)).effects[0]?.lifecycle.remainingTicks).toBe(1)
  await expect(executeInRoom(base.base.owner.caller, firstAdvance)).resolves.toEqual(firstTick)

  const secondAdvance: EncounterExecuteInput = {
    command: {
      type: 'ADVANCE_TURN',
      encounterId: base.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: projection.version
    }
  }
  const expired = await executeInRoom(base.base.owner.caller, secondAdvance)
  expect(
    encounterGmProjectionDtoSchema
      .parse(expired.projection)
      .actors.find((actor) => actor.id === base.actor.id)?.currentHitPoints
  ).toBe(base.actor.maxHitPoints)
  expect((await stored(base)).effects).toEqual([])
  await expect(executeInRoom(base.base.owner.caller, secondAdvance)).resolves.toEqual(expired)
}, 30000)

it.each([
  { face: 1, effects: 1, label: 'failed save' },
  { face: 20, effects: 0, label: 'successful save' }
])('creates recurring damage only for the selected $label branch', async ({ face, effects }) => {
  const base = await recurringFixture('SAVE_DAMAGE', 'PROMPT')
  const action = actionInput(base)
  const issued = await executeInRoom(base.base.owner.caller, {
    command: action
  })
  expect(issued.occurrence?.pending?.kind).toBe('D20_EVIDENCE')
  await checkpointLiveRoom(base.campaignId)
  const pending = await base.base.owner.caller.query(
    api.encounters.pendingReads.pendingRuleOccurrence,
    {
      encounterId: base.run.id
    }
  )
  if (!pending || pending.kind !== 'D20_EVIDENCE')
    throw new Error('Recurring save evidence is missing.')
  const response: EncounterExecuteInput = {
    command: {
      type: 'RESOLVE_RULE_OCCURRENCE',
      encounterId: base.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: pending.encounterVersion,
      correlationId: null,
      occurrenceId: pending.occurrenceId,
      expectedOccurrenceVersion: pending.occurrenceVersion,
      resolution: {
        kind: 'ENTER_DICE',
        requestId: pending.request.requestId,
        rawFaces: pending.request.rollMode === 'NORMAL' ? [face] : [face, face],
        rollMode: pending.request.rollMode
      }
    }
  }
  const settled = await executeInRoom(base.base.owner.caller, response)
  expect(settled.occurrence?.status).toBe('COMPLETE')
  expect((await stored(base)).effects).toHaveLength(effects)
  // A retried command replays its journaled original occurrence with the projection as it is now (D78).
  await expect(executeInRoom(base.base.owner.caller, { command: action })).resolves.toEqual({
    ...issued,
    projection: settled.projection
  })
  await expect(executeInRoom(base.base.owner.caller, response)).resolves.toEqual(settled)
  const afterAction = await stored(base)
  expect(afterAction.effects).toHaveLength(effects)
  if (effects === 0) return

  expect(
    encounterGmProjectionDtoSchema
      .parse(settled.projection)
      .actors.find((actor) => actor.id === base.target.id)?.currentHitPoints
  ).toBe(base.target.currentHitPoints - 1)

  let projection = encounterGmProjectionDtoSchema.parse(settled.projection)
  const firstAdvance: EncounterExecuteInput = {
    command: {
      type: 'ADVANCE_TURN',
      encounterId: base.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: projection.version
    }
  }
  const firstPending = await executeInRoom(base.base.owner.caller, firstAdvance)
  expect(firstPending.occurrence?.pending?.kind).toBe('D20_EVIDENCE')
  await expect(executeInRoom(base.base.owner.caller, firstAdvance)).resolves.toEqual(firstPending)
  const firstResponse = diceResponse(base.run.id, firstPending)
  const firstTick = await executeInRoom(base.base.owner.caller, firstResponse)
  projection = encounterGmProjectionDtoSchema.parse(firstTick.projection)
  expect(projection.actors.find((actor) => actor.id === base.target.id)?.currentHitPoints).toBe(
    base.target.currentHitPoints - 2
  )
  expect((await stored(base)).effects[0]?.lifecycle.remainingTicks).toBe(1)
  await expect(executeInRoom(base.base.owner.caller, firstResponse)).resolves.toEqual(firstTick)
  await expect(executeInRoom(base.base.owner.caller, firstAdvance)).resolves.toEqual({
    ...firstPending,
    projection: firstTick.projection
  })

  const bridgeAdvance: EncounterExecuteInput = {
    command: {
      type: 'ADVANCE_TURN',
      encounterId: base.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: projection.version
    }
  }
  const bridged = await executeInRoom(base.base.owner.caller, bridgeAdvance)
  projection = encounterGmProjectionDtoSchema.parse(bridged.projection)
  expect((await stored(base)).effects[0]?.lifecycle.remainingTicks).toBe(1)

  const finalAdvance: EncounterExecuteInput = {
    command: {
      type: 'ADVANCE_TURN',
      encounterId: base.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: projection.version
    }
  }
  const finalPending = await executeInRoom(base.base.owner.caller, finalAdvance)
  expect(finalPending.occurrence?.pending?.kind).toBe('D20_EVIDENCE')
  const finalResponse = diceResponse(base.run.id, finalPending)
  const expired = await executeInRoom(base.base.owner.caller, finalResponse)
  expect(
    encounterGmProjectionDtoSchema
      .parse(expired.projection)
      .actors.find((actor) => actor.id === base.target.id)?.currentHitPoints
  ).toBe(base.target.currentHitPoints - 3)
  expect((await stored(base)).effects).toEqual([])
  await expect(executeInRoom(base.base.owner.caller, finalResponse)).resolves.toEqual(expired)
  await expect(executeInRoom(base.base.owner.caller, finalAdvance)).resolves.toEqual({
    ...finalPending,
    projection: expired.projection
  })
})
