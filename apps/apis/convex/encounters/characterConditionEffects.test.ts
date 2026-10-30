import { expect, it } from 'vitest'
import {
  encounterCommandResultDtoSchema,
  encounterGmProjectionDtoSchema,
  encounterPlayerProjectionDtoSchema,
  type EncounterCommandResultDto,
  type EncounterExecuteInput,
  type ResolveEncounterActionInputDto
} from '@artificer-toolkit/schema/api/encounters'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdWolf as wolf } from '../../tests/fixtures/srdCreatures'
import {
  SRD_ACTION_ALLOWANCE_DEFINITION_ID,
  SRD_RULE_STATE_DEFINITIONS
} from '@artificer-toolkit/source-data/srd/ruleState.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { setupCharacterRun } from '../../tests/fixtures/encounterCharacter'
import { createEncounterLifecyclePolicyFixture } from '../../tests/fixtures/encounterInitiative'
import { importedSubject, importSeededSubjects } from '../../tests/fixtures/publication'
import { setAutoRollDice } from '../../tests/fixtures/rollPreferences'
import { api, internal } from '../_generated/api'
import { readCharacterRecord, readCharacterRow } from '../characters/stateDocuments'
import {
  attachFixtureRoom,
  checkpointLiveRoom,
  executeInRoom,
  expectRedactedRoomRefusal,
  deliverQueuedRoomControl,
  roomErrorLogs,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'

useLocalRoomWorker()

const creatureId = '00000000-0000-4000-8000-0000000008d0'
const featureId = '00000000-0000-4000-8000-0000000008d1'
const effectId = '00000000-0000-4000-8000-0000000008d2'
const frightenedOutcomeId = '00000000-0000-4000-8000-0000000008d3'

function repeatSaveCreature() {
  const bite = wolf.features?.find((feature) => feature.label === 'Bite')
  const dexterity = srdSystemRecord.abilities?.find((ability) => ability.code === 'DEXTERITY')
  const frightened = srdSystemRecord.conditionTypes.find(
    (condition) => condition.code === 'FRIGHTENED'
  )
  if (!bite || !dexterity || !frightened)
    throw new Error('Character condition fixture requires Bite, Dexterity, and Frightened.')
  return {
    ...wolf,
    id: creatureId,
    label: 'Character condition creature',
    features: wolf.features?.map((feature) =>
      feature.id !== bite.id
        ? feature
        : {
            ...feature,
            id: featureId,
            effects: feature.effects?.slice(0, 1).map((effect) => ({
              ...effect,
              id: effectId,
              invocation: {
                ...effect.invocation,
                triggerCode: 'SAVING_THROW' as const,
                savingThrow: {
                  id: '00000000-0000-4000-8000-0000000008d4',
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
              paths: [
                {
                  id: '00000000-0000-4000-8000-0000000008d5',
                  order: 1,
                  pathCode: 'ON_SAVE_FAIL' as const,
                  groupType: 'SEQUENTIAL' as const,
                  originKind: 'SOURCE' as const,
                  selectionKind: 'FIXED' as const,
                  resultBlock: {
                    id: '00000000-0000-4000-8000-0000000008d6',
                    resultKind: 'SEQUENCE' as const,
                    duration: {
                      id: '00000000-0000-4000-8000-0000000008d7',
                      durationKind: 'ROUND' as const,
                      amount: 2
                    },
                    outcomes: [
                      {
                        id: frightenedOutcomeId,
                        effectKind: 'CONDITION' as const,
                        conditionId: frightened.id
                      },
                      {
                        id: '00000000-0000-4000-8000-0000000008d8',
                        effectKind: 'FOLLOW_UP_SAVE' as const,
                        timing: 'TARGET_TURN_END' as const,
                        savingThrow: {
                          id: '00000000-0000-4000-8000-0000000008d9',
                          dcMethod: 'FIXED_DC' as const,
                          abilityDefinitionId: dexterity.id,
                          baseDc: 10
                        },
                        attempts: { kind: 'ONCE' as const, repeatOnFailure: true },
                        onSuccess: { kind: 'END' as const },
                        onFailure: { kind: 'CONTINUE' as const },
                        onDurationComplete: { kind: 'END' as const }
                      }
                    ]
                  }
                }
              ]
            }))
          }
    )
  }
}

async function settleStart(
  base: Awaited<ReturnType<typeof setupCharacterRun>>,
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
              throw new Error('Character condition fixture requested an unsupported continuation.')
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

async function setup(options: { sameTypeSheetBaseline?: boolean } = {}) {
  const base = await setupCharacterRun()
  for (const userId of [base.owner.userId, base.player.userId])
    await setAutoRollDice(base.t, userId, false)
  const policies = createEncounterLifecyclePolicyFixture(base.owner.userId)
  const blinded = srdSystemRecord.conditionTypes.find((condition) => condition.code === 'BLINDED')
  const poisoned = srdSystemRecord.conditionTypes.find((condition) => condition.code === 'POISONED')
  const frightened = srdSystemRecord.conditionTypes.find(
    (condition) => condition.code === 'FRIGHTENED'
  )
  if (!blinded || !poisoned || !frightened)
    throw new Error('Character condition fixture requires three System conditions.')
  await base.t.mutation(internal.content.import.bootstrap, policies.bootstrap)
  await base.t.mutation(internal.content.import.importDefinitions, policies.imported)
  await base.t.mutation(internal.content.import.importDefinitions, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    definitions: SRD_RULE_STATE_DEFINITIONS.filter(
      (definition) => definition.id === SRD_ACTION_ALLOWANCE_DEFINITION_ID
    )
  })
  await base.player.caller.mutation(api.characters.sheetCommands.execute, {
    id: base.character.id,
    command: {
      type: 'ADD_CONDITION',
      commandId: crypto.randomUUID(),
      expectedVersion: base.characterStreamVersion,
      conditionTypeId: blinded.id,
      notes: 'baseline Sheet condition'
    }
  })
  if (options.sameTypeSheetBaseline)
    await base.player.caller.mutation(api.characters.sheetCommands.execute, {
      id: base.character.id,
      command: {
        type: 'ADD_CONDITION',
        commandId: crypto.randomUUID(),
        expectedVersion: base.characterStreamVersion + 1,
        conditionTypeId: frightened.id,
        notes: 'same-type Sheet condition'
      }
    })
  let campaign = await base.owner.caller.mutation(api.campaigns.update.update, {
    campaignId: base.campaign.id,
    expectedVersion: base.campaign.version,
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
  const visibleOverlay = await base.owner.caller.mutation(api.campaigns.gmWrites.saveCondition, {
    campaignId: campaign.id,
    characterId: base.character.id,
    conditionTypeId: poisoned.id,
    visibility: 'VISIBLE',
    expectedVersion: 0,
    notes: 'visible Campaign condition'
  })
  const secretOverlay = await base.owner.caller.mutation(api.campaigns.gmWrites.saveCondition, {
    campaignId: campaign.id,
    characterId: base.character.id,
    conditionTypeId: frightened.id,
    visibility: 'SECRET',
    expectedVersion: 0,
    notes: 'secret Campaign condition'
  })
  const creature = repeatSaveCreature()
  await importSeededSubjects(base.t, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [importedSubject({ ...creature, subjectKind: 'CREATURE', document: creature })]
  })
  await attachFixtureRoom(base.t, campaign.id)
  const blueprint = await base.owner.caller.mutation(api.encounters.blueprints.create, {
    gameSystemId: campaign.gameSystemId,
    name: 'Character condition action fixture',
    commandId: crypto.randomUUID(),
    enemies: Array.from({ length: 2 }, () => ({ kind: 'CREATURE' as const, sourceId: creatureId }))
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
    (candidate) => candidate.kind === 'CREATURE' && candidate.sourceId === creatureId
  )
  const actor = sources[0]
  const secondActor = sources[1]
  const target = run.actors.find((candidate) => candidate.kind === 'CHARACTER')
  if (!actor || !secondActor || !target)
    throw new Error('Character condition fixture actors are unavailable.')
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
  return {
    ...base,
    campaign,
    run,
    actor,
    secondActor,
    target,
    blinded,
    poisoned,
    frightened,
    visibleOverlay,
    secretOverlay
  }
}

/** The rows the room last published: it holds the Run and its receipts until it checkpoints (D85). */
async function stored(base: Awaited<ReturnType<typeof setup>>) {
  await checkpointLiveRoom(base.campaign.id)
  return base.t.run(async (ctx) => ({
    receiptLedgers: await ctx.db.query('receiptLedgers').collect(),
    receiptLedgerParts: await ctx.db.query('receiptLedgerParts').collect(),
    character: await readCharacterRow(ctx, base.character.id),
    effects: await ctx.db
      .query('characterActiveRuleEffects')
      .withIndex('by_characterId_createdOrdinal_id', (q) => q.eq('characterId', base.character.id))
      .take(3),
    characterReceipts: await ctx.db
      .query('characterCommandReceipts')
      .withIndex('by_characterId_commandId', (q) => q.eq('characterId', base.character.id))
      .take(10)
  }))
}

function rawConditionIds(snapshot: Awaited<ReturnType<typeof stored>>) {
  if (!snapshot.character) throw new Error('Character condition fixture record is unavailable.')
  return (readCharacterRecord(snapshot.character).state.conditions ?? []).map(
    (condition) => condition.conditionTypeId
  )
}

function action(
  base: Awaited<ReturnType<typeof setup>>,
  expectedVersion = base.run.version,
  actorId = base.actor.id
): ResolveEncounterActionInputDto {
  return {
    type: 'RESOLVE_ACTION',
    acceptedWieldConflict: null,
    acknowledgedWarnings: [],
    encounterId: base.run.id,
    commandId: crypto.randomUUID(),
    expectedVersion,
    actorId,
    target: { kind: 'ACTOR', actorId: base.target.id },
    actionId: `${actorId}:FEATURE:${featureId}:EFFECT:${effectId}`,
    optionalCombatIntent: null,
    sceneContext: null
  }
}

function diceResponse(encounterId: string, input: unknown, face: number) {
  const result = encounterCommandResultDtoSchema.parse(input)
  const pending = result.occurrence?.pending
  if (!pending || pending.kind !== 'D20_EVIDENCE')
    throw new Error('Expected Character condition d20 evidence.')
  return {
    command: {
      type: 'RESOLVE_RULE_OCCURRENCE' as const,
      encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: result.projection.version,
      correlationId: null,
      occurrenceId: result.occurrence!.occurrenceId,
      expectedOccurrenceVersion: result.occurrence!.occurrenceVersion,
      resolution: {
        kind: 'ENTER_DICE' as const,
        requestId: pending.request.requestId,
        rawFaces: pending.request.rollMode === 'NORMAL' ? [face] : [face, face],
        rollMode: pending.request.rollMode
      }
    }
  } satisfies EncounterExecuteInput
}

function projectedConditionIds(projection: unknown, actorId: string) {
  const gm = encounterGmProjectionDtoSchema.safeParse(projection)
  const result = gm.success ? gm.data : encounterPlayerProjectionDtoSchema.parse(projection)
  const actor = result.actors.find((candidate) => candidate.id === actorId)
  if (!actor || !Array.isArray(actor.conditions))
    throw new Error('Character condition projection is unavailable.')
  return actor.conditions.map((condition) => {
    if (typeof condition === 'string') return condition
    if (
      typeof condition === 'object' &&
      condition !== null &&
      !Array.isArray(condition) &&
      'conditionTypeId' in condition &&
      typeof condition.conditionTypeId === 'string'
    )
      return condition.conditionTypeId
    throw new Error('Character condition projection contains an invalid condition.')
  })
}

it('applies and expires an effect-owned Sheet condition while retaining independent Campaign overlays', async () => {
  const base = await setup()
  const input = action(base)
  const initial = await executeInRoom(base.owner.caller, {
    command: input
  })
  expect(initial.occurrence?.pending?.kind).toBe('D20_EVIDENCE')
  const initialResponse = diceResponse(base.run.id, initial, 1)
  const applied = await executeInRoom(base.owner.caller, initialResponse)
  expect(applied.occurrence?.status).toBe('COMPLETE')
  const afterApplied = await stored(base)
  expect(afterApplied.effects).toHaveLength(1)
  expect(rawConditionIds(afterApplied)).toEqual(
    expect.arrayContaining([base.blinded.id, base.frightened.id])
  )
  // The room holds the action receipt until the Run ends (D85); `nativeRoomEffectReceipts.test.ts`
  // asserts its CREATE transition. That transition is the one
  // published effect row asserted above.
  // A retried command replays its journaled original occurrence with the projection as it is now (D78).
  await expect(executeInRoom(base.owner.caller, { command: input })).resolves.toEqual({
    ...initial,
    projection: applied.projection
  })
  await expect(executeInRoom(base.owner.caller, initialResponse)).resolves.toEqual(applied)
  expect(await stored(base)).toEqual(afterApplied)

  await base.owner.caller.mutation(api.campaigns.gmWrites.deleteCondition, {
    campaignId: base.campaign.id,
    characterId: base.character.id,
    conditionId: base.secretOverlay.id,
    expectedVersion: base.secretOverlay.version
  })
  await deliverQueuedRoomControl(base.t)
  await checkpointLiveRoom(base.campaign.id)
  const ownerAfterDmRemoval = await base.owner.caller.query(api.encounters.projectionReads.get, {
    encounterId: base.run.id
  })
  const playerAfterDmRemoval = await base.player.caller.query(api.encounters.projectionReads.get, {
    encounterId: base.run.id
  })
  expect(projectedConditionIds(ownerAfterDmRemoval, base.target.id)).toEqual(
    expect.arrayContaining([base.blinded.id, base.poisoned.id, base.frightened.id])
  )
  expect(projectedConditionIds(playerAfterDmRemoval, base.target.id)).toEqual(
    expect.arrayContaining([base.blinded.id, base.poisoned.id, base.frightened.id])
  )
  expect(JSON.stringify(playerAfterDmRemoval)).not.toContain('secret Campaign condition')

  await base.owner.caller.mutation(api.campaigns.gmWrites.saveCondition, {
    campaignId: base.campaign.id,
    characterId: base.character.id,
    conditionTypeId: base.frightened.id,
    visibility: 'SECRET',
    expectedVersion: 0,
    notes: 'secret Campaign condition restored'
  })
  await deliverQueuedRoomControl(base.t)
  const setSecondActor = await executeInRoom(base.owner.caller, {
    command: {
      type: 'SET_CURRENT_ACTOR',
      encounterId: base.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: applied.projection.version,
      actorId: base.secondActor.id
    }
  })
  const secondInput = action(base, setSecondActor.projection.version, base.secondActor.id)
  const secondPending = await executeInRoom(base.owner.caller, {
    command: secondInput
  })
  expect(secondPending.occurrence?.pending?.kind).toBe('D20_EVIDENCE')
  const secondResponse = diceResponse(base.run.id, secondPending, 1)
  const withTwoEffects = await executeInRoom(base.owner.caller, secondResponse)
  expect((await stored(base)).effects).toHaveLength(2)

  const setCharacterTurn = await executeInRoom(base.owner.caller, {
    command: {
      type: 'SET_CURRENT_ACTOR',
      encounterId: base.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: withTwoEffects.projection.version,
      actorId: base.target.id
    }
  })
  const advance: EncounterExecuteInput = {
    command: {
      type: 'ADVANCE_TURN',
      encounterId: base.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: setCharacterTurn.projection.version
    }
  }
  const pendingFirstEffect = await executeInRoom(base.owner.caller, advance)
  expect(pendingFirstEffect.occurrence?.pending?.kind).toBe('D20_EVIDENCE')
  const firstEffectResponse = diceResponse(base.run.id, pendingFirstEffect, 1)
  const pendingSecondEffect = await executeInRoom(base.owner.caller, firstEffectResponse)
  expect(pendingSecondEffect.occurrence?.pending?.kind).toBe('D20_EVIDENCE')
  await expect(executeInRoom(base.owner.caller, firstEffectResponse)).resolves.toEqual(
    pendingSecondEffect
  )
  const secondEffectResponse = diceResponse(base.run.id, pendingSecondEffect, 20)
  const oneEffectRemaining = await executeInRoom(base.owner.caller, secondEffectResponse)
  expect((await stored(base)).effects).toHaveLength(1)
  expect(rawConditionIds(await stored(base))).toEqual(
    expect.arrayContaining([base.blinded.id, base.frightened.id])
  )
  await expect(executeInRoom(base.owner.caller, secondEffectResponse)).resolves.toEqual(
    oneEffectRemaining
  )
  await expect(executeInRoom(base.owner.caller, advance)).resolves.toEqual({
    ...pendingFirstEffect,
    projection: oneEffectRemaining.projection
  })

  const setFinalCharacterTurn = await executeInRoom(base.owner.caller, {
    command: {
      type: 'SET_CURRENT_ACTOR',
      encounterId: base.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: oneEffectRemaining.projection.version,
      actorId: base.target.id
    }
  })
  const finalAdvance: EncounterExecuteInput = {
    command: {
      type: 'ADVANCE_TURN',
      encounterId: base.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: setFinalCharacterTurn.projection.version
    }
  }
  const pendingFinalEffect = await executeInRoom(base.owner.caller, finalAdvance)
  expect(pendingFinalEffect.occurrence?.pending?.kind).toBe('D20_EVIDENCE')
  const finalEffectResponse = diceResponse(base.run.id, pendingFinalEffect, 20)
  const expired = await executeInRoom(base.owner.caller, finalEffectResponse)
  expect((await stored(base)).effects).toEqual([])
  expect(rawConditionIds(await stored(base))).toEqual([base.blinded.id])
  await expect(executeInRoom(base.owner.caller, finalEffectResponse)).resolves.toEqual(expired)
  await expect(executeInRoom(base.owner.caller, finalAdvance)).resolves.toEqual({
    ...pendingFinalEffect,
    projection: expired.projection
  })
  await checkpointLiveRoom(base.campaign.id)
  const ownerAfterExpiry = await base.owner.caller.query(api.encounters.projectionReads.get, {
    encounterId: base.run.id
  })
  const playerAfterExpiry = await base.player.caller.query(api.encounters.projectionReads.get, {
    encounterId: base.run.id
  })
  expect(projectedConditionIds(ownerAfterExpiry, base.target.id)).toEqual(
    expect.arrayContaining([base.blinded.id, base.poisoned.id, base.frightened.id])
  )
  expect(projectedConditionIds(playerAfterExpiry, base.target.id)).toEqual(
    expect.arrayContaining([base.blinded.id, base.poisoned.id])
  )
  expect(projectedConditionIds(playerAfterExpiry, base.target.id)).not.toContain(base.frightened.id)
  expect(JSON.stringify(playerAfterExpiry)).not.toContain('secret Campaign condition')
}, 30000)

it('retains a same-type Sheet condition after its real rule effect expires', async () => {
  const base = await setup({ sameTypeSheetBaseline: true })
  await base.owner.caller.mutation(api.campaigns.gmWrites.deleteCondition, {
    campaignId: base.campaign.id,
    characterId: base.character.id,
    conditionId: base.secretOverlay.id,
    expectedVersion: base.secretOverlay.version
  })
  await deliverQueuedRoomControl(base.t)
  const input = action(base)
  const pending = await executeInRoom(base.owner.caller, {
    command: input
  })
  expect(pending.occurrence?.pending?.kind).toBe('D20_EVIDENCE')
  const applied = await executeInRoom(base.owner.caller, diceResponse(base.run.id, pending, 1))
  expect((await stored(base)).effects).toHaveLength(1)
  expect(rawConditionIds(await stored(base))).toEqual(
    expect.arrayContaining([base.blinded.id, base.frightened.id])
  )
  const setCharacterTurn = await executeInRoom(base.owner.caller, {
    command: {
      type: 'SET_CURRENT_ACTOR',
      encounterId: base.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: applied.projection.version,
      actorId: base.target.id
    }
  })
  const advance: EncounterExecuteInput = {
    command: {
      type: 'ADVANCE_TURN',
      encounterId: base.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: setCharacterTurn.projection.version
    }
  }
  const pendingExpiry = await executeInRoom(base.owner.caller, advance)
  expect(pendingExpiry.occurrence?.pending?.kind).toBe('D20_EVIDENCE')
  const response = diceResponse(base.run.id, pendingExpiry, 20)
  const expired = await executeInRoom(base.owner.caller, response)
  expect((await stored(base)).effects).toEqual([])
  expect(rawConditionIds(await stored(base))).toEqual(
    expect.arrayContaining([base.blinded.id, base.frightened.id])
  )
  await expect(executeInRoom(base.owner.caller, advance)).resolves.toEqual({
    ...pendingExpiry,
    projection: expired.projection
  })
  await expect(executeInRoom(base.owner.caller, response)).resolves.toEqual(expired)
}, 30000)

it('rejects a pending condition action after its Campaign overlay changes without terminal writes', async () => {
  const base = await setup()
  const initial = await executeInRoom(base.owner.caller, {
    command: action(base)
  })
  expect(initial.occurrence?.pending?.kind).toBe('D20_EVIDENCE')
  await base.owner.caller.mutation(api.campaigns.gmWrites.saveCondition, {
    campaignId: base.campaign.id,
    characterId: base.character.id,
    conditionTypeId: base.frightened.id,
    visibility: 'SECRET',
    expectedVersion: base.secretOverlay.version,
    notes: 'changed while condition action was pending'
  })
  await deliverQueuedRoomControl(base.t)
  const beforeResponse = await stored(base)
  await expectRedactedRoomRefusal(
    executeInRoom(base.owner.caller, diceResponse(base.run.id, initial, 1)),
    'The Encounter command could not be completed.'
  )
  // The room tells a member nothing of the cause; its error log carries it.
  expect(roomErrorLogs().join('\n')).toMatch(
    /Campaign condition changed|pending action source or target changed/
  )
  expect(await stored(base)).toEqual(beforeResponse)
}, 30000)
