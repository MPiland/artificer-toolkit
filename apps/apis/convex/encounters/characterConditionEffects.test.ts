import { expect, it } from 'vitest'
import {
  encounterCommandResultDtoSchema,
  encounterGmProjectionDtoSchema,
  encounterPlayerProjectionDtoSchema,
  type EncounterCommandResultDto,
  type EncounterExecuteInput,
  type ResolveEncounterActionInputDto
} from '@artificer-toolkit/schema/api/encounters'
import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { wolf } from '@artificer-toolkit/source-data/srd/creatures/wolf.js'
import {
  SRD_ACTION_ALLOWANCE_DEFINITION_ID,
  SRD_RULE_STATE_DEFINITIONS
} from '@artificer-toolkit/source-data/srd/ruleState.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { setupCharacterRun } from '../../tests/fixtures/encounterCharacter'
import { createEncounterLifecyclePolicyFixture } from '../../tests/fixtures/encounterInitiative'
import { importedSubject } from '../../tests/fixtures/publication'
import { setAutoRollDice } from '../../tests/fixtures/rollPreferences'
import { api, internal } from '../_generated/api'

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
      await base.owner.caller.mutation(internal.encounters.commands.execute, {
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
  await base.t.mutation(internal.content.import.importSubjects, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [importedSubject({ ...creature, subjectKind: 'CREATURE', document: creature })]
  })
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
          await base.owner.caller.mutation(internal.encounters.commands.execute, {
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
        await base.owner.caller.mutation(internal.encounters.commands.execute, {
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

async function stored(base: Awaited<ReturnType<typeof setup>>) {
  return base.t.run(async (ctx) => ({
    character: await ctx.db
      .query('characters')
      .withIndex('by_publicId', (q) => q.eq('id', base.character.id))
      .unique(),
    effects: await ctx.db
      .query('characterActiveRuleEffects')
      .withIndex('by_characterId_createdOrdinal_id', (q) => q.eq('characterId', base.character.id))
      .take(3),
    receipts: await ctx.db
      .query('encounterRuleReceipts')
      .withIndex('by_encounterId_commandId', (q) => q.eq('encounterId', base.run.id))
      .take(10),
    characterReceipts: await ctx.db
      .query('characterCommandReceipts')
      .withIndex('by_characterId_commandId', (q) => q.eq('characterId', base.character.id))
      .take(10)
  }))
}

function rawConditionIds(snapshot: Awaited<ReturnType<typeof stored>>) {
  if (!snapshot.character) throw new Error('Character condition fixture record is unavailable.')
  return (
    characterAuthoredDtoSchema.parse(JSON.parse(snapshot.character.documentJson)).state
      .conditions ?? []
  ).map((condition) => condition.conditionTypeId)
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
    targetActorId: base.target.id,
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
  const initial = await base.owner.caller.mutation(internal.encounters.commands.execute, {
    command: input
  })
  expect(initial.occurrence?.pending?.kind).toBe('D20_EVIDENCE')
  const initialResponse = diceResponse(base.run.id, initial, 1)
  const applied = await base.owner.caller.action(
    internal.encounters.commandActions.execute,
    initialResponse
  )
  expect(applied.occurrence?.status).toBe('COMPLETE')
  const afterApplied = await stored(base)
  expect(afterApplied.effects).toHaveLength(1)
  expect(rawConditionIds(afterApplied)).toEqual(
    expect.arrayContaining([base.blinded.id, base.frightened.id])
  )
  const actionReceipt = afterApplied.receipts.find(
    (receipt) => receipt.commandId === input.commandId
  )
  if (!actionReceipt) throw new Error('Character condition action receipt is missing.')
  expect(
    storedRuleExecutionResultDtoSchema.parse(JSON.parse(actionReceipt.resultJson))
  ).toMatchObject({
    applicationOutputs: {
      kind: 'CHARACTER_MECHANICS_BATCH',
      activeEffectTransitions: [expect.objectContaining({ kind: 'CREATE' })]
    }
  })
  await expect(
    base.owner.caller.mutation(internal.encounters.commands.execute, { command: input })
  ).resolves.toEqual(applied)
  await expect(
    base.owner.caller.action(internal.encounters.commandActions.execute, initialResponse)
  ).resolves.toEqual(applied)
  expect(await stored(base)).toEqual(afterApplied)

  await base.owner.caller.mutation(api.campaigns.gmWrites.deleteCondition, {
    campaignId: base.campaign.id,
    characterId: base.character.id,
    conditionId: base.secretOverlay.id,
    expectedVersion: base.secretOverlay.version
  })
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
  const setSecondActor = await base.owner.caller.mutation(internal.encounters.commands.execute, {
    command: {
      type: 'SET_CURRENT_ACTOR',
      encounterId: base.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: applied.projection.version,
      actorId: base.secondActor.id
    }
  })
  const secondInput = action(base, setSecondActor.projection.version, base.secondActor.id)
  const secondPending = await base.owner.caller.mutation(internal.encounters.commands.execute, {
    command: secondInput
  })
  expect(secondPending.occurrence?.pending?.kind).toBe('D20_EVIDENCE')
  const secondResponse = diceResponse(base.run.id, secondPending, 1)
  const withTwoEffects = await base.owner.caller.action(
    internal.encounters.commandActions.execute,
    secondResponse
  )
  expect((await stored(base)).effects).toHaveLength(2)

  const setCharacterTurn = await base.owner.caller.mutation(internal.encounters.commands.execute, {
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
  const pendingFirstEffect = await base.owner.caller.mutation(
    internal.encounters.commands.execute,
    advance
  )
  expect(pendingFirstEffect.occurrence?.pending?.kind).toBe('D20_EVIDENCE')
  const firstEffectResponse = diceResponse(base.run.id, pendingFirstEffect, 1)
  const pendingSecondEffect = await base.owner.caller.action(
    internal.encounters.commandActions.execute,
    firstEffectResponse
  )
  expect(pendingSecondEffect.occurrence?.pending?.kind).toBe('D20_EVIDENCE')
  await expect(
    base.owner.caller.action(internal.encounters.commandActions.execute, firstEffectResponse)
  ).resolves.toEqual(pendingSecondEffect)
  const secondEffectResponse = diceResponse(base.run.id, pendingSecondEffect, 20)
  const oneEffectRemaining = await base.owner.caller.action(
    internal.encounters.commandActions.execute,
    secondEffectResponse
  )
  expect((await stored(base)).effects).toHaveLength(1)
  expect(rawConditionIds(await stored(base))).toEqual(
    expect.arrayContaining([base.blinded.id, base.frightened.id])
  )
  await expect(
    base.owner.caller.action(internal.encounters.commandActions.execute, secondEffectResponse)
  ).resolves.toEqual(oneEffectRemaining)
  await expect(
    base.owner.caller.mutation(internal.encounters.commands.execute, advance)
  ).resolves.toEqual(oneEffectRemaining)

  const setFinalCharacterTurn = await base.owner.caller.mutation(
    internal.encounters.commands.execute,
    {
      command: {
        type: 'SET_CURRENT_ACTOR',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: oneEffectRemaining.projection.version,
        actorId: base.target.id
      }
    }
  )
  const finalAdvance: EncounterExecuteInput = {
    command: {
      type: 'ADVANCE_TURN',
      encounterId: base.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: setFinalCharacterTurn.projection.version
    }
  }
  const pendingFinalEffect = await base.owner.caller.mutation(
    internal.encounters.commands.execute,
    finalAdvance
  )
  expect(pendingFinalEffect.occurrence?.pending?.kind).toBe('D20_EVIDENCE')
  const finalEffectResponse = diceResponse(base.run.id, pendingFinalEffect, 20)
  const expired = await base.owner.caller.action(
    internal.encounters.commandActions.execute,
    finalEffectResponse
  )
  expect((await stored(base)).effects).toEqual([])
  expect(rawConditionIds(await stored(base))).toEqual([base.blinded.id])
  await expect(
    base.owner.caller.action(internal.encounters.commandActions.execute, finalEffectResponse)
  ).resolves.toEqual(expired)
  await expect(
    base.owner.caller.mutation(internal.encounters.commands.execute, finalAdvance)
  ).resolves.toEqual(expired)
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
  const input = action(base)
  const pending = await base.owner.caller.mutation(internal.encounters.commands.execute, {
    command: input
  })
  expect(pending.occurrence?.pending?.kind).toBe('D20_EVIDENCE')
  const applied = await base.owner.caller.action(
    internal.encounters.commandActions.execute,
    diceResponse(base.run.id, pending, 1)
  )
  expect((await stored(base)).effects).toHaveLength(1)
  expect(rawConditionIds(await stored(base))).toEqual(
    expect.arrayContaining([base.blinded.id, base.frightened.id])
  )
  const setCharacterTurn = await base.owner.caller.mutation(internal.encounters.commands.execute, {
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
  const pendingExpiry = await base.owner.caller.mutation(
    internal.encounters.commands.execute,
    advance
  )
  expect(pendingExpiry.occurrence?.pending?.kind).toBe('D20_EVIDENCE')
  const response = diceResponse(base.run.id, pendingExpiry, 20)
  const expired = await base.owner.caller.action(
    internal.encounters.commandActions.execute,
    response
  )
  expect((await stored(base)).effects).toEqual([])
  expect(rawConditionIds(await stored(base))).toEqual(
    expect.arrayContaining([base.blinded.id, base.frightened.id])
  )
  await expect(
    base.owner.caller.mutation(internal.encounters.commands.execute, advance)
  ).resolves.toEqual(expired)
  await expect(
    base.owner.caller.action(internal.encounters.commandActions.execute, response)
  ).resolves.toEqual(expired)
}, 30000)

it('rejects a pending condition action after its Campaign overlay changes without terminal writes', async () => {
  const base = await setup()
  const initial = await base.owner.caller.mutation(internal.encounters.commands.execute, {
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
  const beforeResponse = await stored(base)
  await expect(
    base.owner.caller.action(
      internal.encounters.commandActions.execute,
      diceResponse(base.run.id, initial, 1)
    )
  ).rejects.toThrow(/Campaign condition changed|pending action source or target changed/)
  expect(await stored(base)).toEqual(beforeResponse)
}, 30000)
