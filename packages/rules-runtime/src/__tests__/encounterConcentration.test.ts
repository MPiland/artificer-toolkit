import { describe, expect, it } from 'vitest'
import { NO_DEATH_SAVES } from '@artificer-toolkit/schema/subjects/characterState'
import type { CharacterRulePolicyOutput } from '@artificer-toolkit/schema/api/characterRules'
import { encounterMaintainedEffectStateRecordSchema } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import { systemVocabularySnapshotSchema } from '@artificer-toolkit/schema/projections/systemVocabulary'
import { reusableDefinitionCurrentDtoSchema } from '@artificer-toolkit/schema/shared/reusableDefinitions'
import { ruleMaintenanceReusableDefinitionDocumentDtoSchema } from '@artificer-toolkit/schema/shared/ruleMaintenance'
import {
  MAX_CONCENTRATION_DAMAGE_APPLICATIONS,
  type ConcentrationDamageApplicationDto
} from '@artificer-toolkit/schema/shared/ruleExecutionConcentration'
import { characterMechanicsApplicationDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionMechanics'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { SRD_DAMAGE_TYPES, srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import {
  completeNativeConcentrationResult,
  createNativeConcentrationContext,
  evaluateNativeConcentrationEvidence,
  prepareEncounterConcentrationState
} from '../encounterConcentration.js'
import { withEncounterConditionMechanics } from '../encounterConditionMechanics.js'
import {
  nativeConcentrationDamageApplications,
  nativeConcentrationDamageSourceLabels,
  nativeConcentrationParentDamage
} from '../encounterConcentrationDamage.js'
import { concentrationOccurrenceId } from '../encounterConcentrationIdentity.js'
import type { EncounterEvidenceAnswer } from '../encounterEvidenceAnswer.js'
import {
  DND5E_CONCENTRATION_APPLIED_DAMAGE_FACT_KEY,
  DND5E_CONCENTRATION_CONTRIBUTOR_CHECKSUM_FACT_KEY,
  DND5E_CONCENTRATION_SAVE_MODIFIER_FACT_KEY,
  DND5E_CONCENTRATION_TARGET_ACTOR_FACT_KEY,
  DND5E_CONSTITUTION_ABILITY_DEFINITION_ID,
  createDnd5eConcentrationCheckDefinition,
  dnd5eConcentrationDamageDc,
  resolveDnd5eConcentrationSaveFacts
} from '../systems/dnd5e/concentrationPolicy.js'
import { DND5E_SYSTEM_ID } from '../systems/dnd5e/identity.js'
import { DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID } from '../systems/dnd5e/concentrationIdentity.js'
import { dnd5eAddedDiceFacts } from '../systems/dnd5e/d20AddedDiceGraph.js'
import { SRD, evaluateSrdCharacter, srdByLabel } from '../testing/dnd5eSrdCharacter.js'
import { createSrdRulesRuntime, creatureFeature } from '../testing/dnd5eSrdEncounter.js'
import {
  creatureActor,
  creatureEncounter,
  prepareCreatureAction,
  settleCreatureAction,
  srdConditionId
} from './encounterCreatureAction.js'
import { srdConditionDefinitionSource } from './srdConditionDefinitions.js'

const ENCOUNTER_ID = '00000000-0000-4000-8000-00000000e001'
const CASTER_ID = '00000000-0000-4000-8000-0000000000a1'
const OTHER_CASTER_ID = '00000000-0000-4000-8000-0000000000a2'
const PARENT_OCCURRENCE_ID = '00000000-0000-4000-8000-00000000f001'
const MAINTAINED_ID = '00000000-0000-4000-8000-00000000c101'
const OTHER_MAINTAINED_ID = '00000000-0000-4000-8000-00000000c102'
const TIMESTAMP = '2026-09-26T00:00:00.000Z'
const FIRE = SRD_DAMAGE_TYPES.find((damageType) => damageType.code === 'FIRE')!
const SLASHING = SRD_DAMAGE_TYPES.find((damageType) => damageType.code === 'SLASHING')!
const CHECKSUM = (character: string) => character.repeat(64)
const DRAGON_ID = '00000000-0000-4000-8000-0000000000a3'
import { blackDragonWyrmling } from '@artificer-toolkit/source-data/srd/creatures/black-dragon-wyrmling.js'

const ancientRedDragon = srdByLabel(SRD.creatures, 'Ancient Red Dragon')

type SaveDefinition = NonNullable<CharacterRulePolicyOutput['savingThrowDefinitions']>[number]

const sorcerer = evaluateSrdCharacter({
  abilities: { CONSTITUTION: 14 },
  classes: [{ label: 'Sorcerer', level: 1 }]
})
const wizard = evaluateSrdCharacter({
  abilities: { CONSTITUTION: 14 },
  classes: [{ label: 'Wizard', level: 1 }]
})

function constitutionSave(overrides: Partial<SaveDefinition> = {}): SaveDefinition {
  const base = sorcerer.output.savingThrowDefinitions?.find(
    (save) => save.abilityDefinitionId === DND5E_CONSTITUTION_ABILITY_DEFINITION_ID
  )
  if (!base) throw new Error('The SRD Sorcerer has no Constitution save.')
  return { ...base, ...overrides }
}

/** A policy output whose saving throws are exactly the given definitions. */
function withSaves(saves: readonly SaveDefinition[]): CharacterRulePolicyOutput {
  return { ...sorcerer.output, savingThrowDefinitions: [...saves] }
}

type PolicyContributor = SaveDefinition['contributors'][number]

function contributor(input: {
  sourceId: string
  influence: PolicyContributor['influence']
}): PolicyContributor {
  return {
    sourceId: input.sourceId,
    source: {
      kind: 'AUTHORED',
      id: '00000000-0000-4000-8000-00000000d301',
      holderActorId: null
    },
    grantId: `${input.sourceId}:grant`,
    domainKey: 'saving-throw',
    influence: input.influence
  }
}

/** The contributor evidence a Concentration check keeps: identity, influence and typed source. */
function evidence({ sourceId, grantId, domainKey, influence, source }: PolicyContributor) {
  return { sourceId, grantId, domainKey, influence, source }
}

const WAR_CASTER = contributor({
  sourceId: 'feat-war-caster',
  influence: 'ADVANTAGE'
})

describe('dnd5eConcentrationDamageDc', () => {
  it('is 10 or half the damage rounded down, whichever is higher', () => {
    expect(
      [1, 19, 20, 21, 22, 23, 45, 100].map((damage) => [damage, dnd5eConcentrationDamageDc(damage)])
    ).toEqual([
      [1, 10],
      [19, 10],
      [20, 10],
      [21, 10],
      [22, 11],
      [23, 11],
      [45, 22],
      [100, 50]
    ])
  })

  it('refuses zero, negative and fractional damage', () => {
    for (const damage of [0, -4, 2.5])
      expect(() => dnd5eConcentrationDamageDc(damage)).toThrow(
        'Applied damage must be a positive safe integer.'
      )
  })
})

describe('resolveDnd5eConcentrationSaveFacts', () => {
  it('uses the Character Constitution save: proficient Sorcerer +4, Wizard +2', () => {
    const sorcererFacts = resolveDnd5eConcentrationSaveFacts({
      addedDice: [],
      appliedDamage: 22,
      targetActorId: CASTER_ID,
      rulePolicyOutput: sorcerer.output
    })
    expect(sorcererFacts).toEqual({
      facts: {
        [DND5E_CONCENTRATION_TARGET_ACTOR_FACT_KEY]: CASTER_ID,
        [DND5E_CONCENTRATION_APPLIED_DAMAGE_FACT_KEY]: 22,
        [DND5E_CONCENTRATION_SAVE_MODIFIER_FACT_KEY]: 4,
        [DND5E_CONCENTRATION_CONTRIBUTOR_CHECKSUM_FACT_KEY]: checksumRuleDocument([]),
        ...dnd5eAddedDiceFacts([])
      },
      rollMode: 'NORMAL',
      modifier: 4,
      contributors: [],
      contributorChecksum: checksumRuleDocument([])
    })
    expect(
      resolveDnd5eConcentrationSaveFacts({
        addedDice: [],
        appliedDamage: 22,
        targetActorId: CASTER_ID,
        rulePolicyOutput: wizard.output
      }).modifier
    ).toBe(2)
  })

  it('prefers a Concentration-scoped Constitution save and its advantage over the general save', () => {
    const facts = resolveDnd5eConcentrationSaveFacts({
      addedDice: [],
      appliedDamage: 12,
      targetActorId: CASTER_ID,
      rulePolicyOutput: withSaves([
        constitutionSave(),
        constitutionSave({
          ruleDefinitionId: DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID,
          rollMode: 'ADVANTAGE',
          contributors: [WAR_CASTER]
        })
      ])
    })

    expect(facts).toMatchObject({
      rollMode: 'ADVANTAGE',
      modifier: 4,
      contributors: [evidence(WAR_CASTER)],
      contributorChecksum: checksumRuleDocument([evidence(WAR_CASTER)])
    })
  })

  it('ignores condition-scoped and other-rule Constitution saves', () => {
    const facts = resolveDnd5eConcentrationSaveFacts({
      addedDice: [],
      appliedDamage: 12,
      targetActorId: CASTER_ID,
      rulePolicyOutput: withSaves([
        constitutionSave({
          conditionTypeId: '00000000-0000-4000-8000-00000000d101',
          rollMode: 'ADVANTAGE'
        }),
        constitutionSave({
          ruleDefinitionId: '00000000-0000-4000-8000-00000000d102',
          rollMode: 'DISADVANTAGE'
        }),
        constitutionSave()
      ])
    })

    expect(facts).toMatchObject({ rollMode: 'NORMAL', modifier: 4, contributors: [] })
  })

  it('orders contributors canonically before checksumming them', () => {
    const bane = contributor({
      sourceId: 'spell-bane',
      influence: 'DISADVANTAGE'
    })
    const facts = resolveDnd5eConcentrationSaveFacts({
      addedDice: [],
      appliedDamage: 12,
      targetActorId: CASTER_ID,
      rulePolicyOutput: withSaves([constitutionSave({ contributors: [bane, WAR_CASTER] })])
    })

    expect(facts.contributors).toEqual([evidence(WAR_CASTER), evidence(bane)])
    expect(facts.contributorChecksum).toBe(
      checksumRuleDocument([evidence(WAR_CASTER), evidence(bane)])
    )
  })

  it('refuses a Character without exactly one applicable Constitution save', () => {
    const saves = sorcerer.output.savingThrowDefinitions ?? []
    for (const rulePolicyOutput of [
      withSaves(
        saves.filter(
          (save) => save.abilityDefinitionId !== DND5E_CONSTITUTION_ABILITY_DEFINITION_ID
        )
      ),
      withSaves([constitutionSave(), constitutionSave()])
    ])
      expect(() =>
        resolveDnd5eConcentrationSaveFacts({
          addedDice: [],
          appliedDamage: 12,
          targetActorId: CASTER_ID,
          rulePolicyOutput
        })
      ).toThrow('D&D concentration saving throw is unavailable.')
    expect(() =>
      resolveDnd5eConcentrationSaveFacts({
        addedDice: [],
        appliedDamage: 0,
        targetActorId: CASTER_ID,
        rulePolicyOutput: sorcerer.output
      })
    ).toThrow('Applied damage must be a positive safe integer.')
  })
})

function application(input: {
  ordinal: number
  appliedAmount: number
  targetActorId?: string
  damageTypeId?: string
}): ConcentrationDamageApplicationDto {
  return {
    ordinal: input.ordinal,
    sourceNodeId: `damage_${input.ordinal}`,
    sourceOperationKey: 'effect.damage',
    targetActorId: input.targetActorId ?? CASTER_ID,
    appliedAmount: input.appliedAmount,
    damageTypeId: input.damageTypeId ?? FIRE.id
  }
}

const maintained = encounterMaintainedEffectStateRecordSchema.parse({
  id: MAINTAINED_ID,
  encounterId: ENCOUNTER_ID,
  ownerActorId: CASTER_ID,
  maintenanceDefinitionId: DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID,
  descriptor: {
    schemaVersion: 2,
    maintenanceDefinitionId: DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID,
    definitionChecksum: CHECKSUM('1'),
    provenance: {
      kind: 'ACTION',
      sourceActionId: 'spell-bless',
      sourceOccurrenceId: '00000000-0000-4000-8000-00000000f000'
    },
    sourceActorId: CASTER_ID,
    replacementPolicy: 'REPLACE_SAME_DEFINITION',
    emptyDependentPolicy: 'TERMINATE_WHEN_EMPTY'
  },
  descriptorChecksum: CHECKSUM('2'),
  version: 3,
  createdAt: TIMESTAMP,
  updatedAt: TIMESTAMP
})
const published = createDnd5eConcentrationCheckDefinition()

async function startCheck(input: {
  checked: ConcentrationDamageApplicationDto
  remaining?: readonly (ConcentrationDamageApplicationDto & { maintainedStateId: string })[]
  rulePolicyOutput?: CharacterRulePolicyOutput
}) {
  const runtime = createSrdRulesRuntime()
  const { context, facts } = createNativeConcentrationContext({
    gameSystemId: DND5E_SYSTEM_ID,
    current: {
      maintained,
      pins: {
        concentrationDefinition: { id: published.id, checksum: published.checksum },
        systemVocabularySnapshot: {
          id: '00000000-0000-4000-8000-00000000d201',
          version: 1,
          checksum: CHECKSUM('3')
        },
        targetCharacter: {
          streamVersion: 5,
          baseProjectionChecksum: CHECKSUM('4'),
          campaignOverlayChecksum: CHECKSUM('5'),
          mechanicalContextChecksum: CHECKSUM('6')
        }
      },
      target: {
        effectiveRulePolicyOutput: input.rulePolicyOutput ?? sorcerer.output,
        targetDerivedFacts: {}
      },
      damageTypes: SRD_DAMAGE_TYPES
    },
    parentOccurrenceId: PARENT_OCCURRENCE_ID,
    parentCommandFingerprint: CHECKSUM('7'),
    application: input.checked,
    remaining: [...(input.remaining ?? [])],
    finalizedDamageEnvelopeChecksum: CHECKSUM('8'),
    sourceLabels: [
      {
        ordinal: input.checked.ordinal,
        sourceNodeId: input.checked.sourceNodeId,
        sourceOperationKey: input.checked.sourceOperationKey,
        label: 'Fire Bolt'
      }
    ]
  })
  const occurrenceId = concentrationOccurrenceId(PARENT_OCCURRENCE_ID, input.checked)
  const started = await runtime.executeResolved({
    command: { definitionId: published.id, occurrenceId, facts },
    published
  })
  if (started.status !== 'PAUSED') throw new Error('The concentration check must ask for a d20.')
  return {
    runtime,
    context,
    occurrenceId,
    continuation: started.continuation,
    evaluate: (
      resolution: Exclude<EncounterEvidenceAnswer, { kind: 'ENTER_INTEGER' }>,
      faces: readonly number[] = []
    ) => {
      const queue = [...faces]
      return evaluateNativeConcentrationEvidence({
        runtime,
        random: (maximum) => {
          expect(maximum).toBe(20)
          const face = queue.shift()
          if (face === undefined) throw new Error('The scripted d20 ran out.')
          return face - 1
        },
        context,
        continuation: started.continuation,
        resolution,
        expectedOccurrenceId: occurrenceId
      })
    }
  }
}

function autoRoll(check: Awaited<ReturnType<typeof startCheck>>) {
  if (check.continuation.request.kind !== 'INTEGER_RANGE') throw new Error('Expected a d20.')
  return { kind: 'AUTO_ROLL' as const, requestId: check.continuation.request.requestId }
}

describe('native Concentration evidence', () => {
  it('names the damage, its source and the DC the caster must meet', async () => {
    const check = await startCheck({ checked: application({ ordinal: 0, appliedAmount: 22 }) })

    expect(check.context.trigger).toEqual({
      sourceLabel: 'Fire Bolt',
      damageTypeLabel: 'Fire',
      dc: 11
    })
    expect(check.context.save).toEqual({
      savingThrowAbilityDefinitionId: DND5E_CONSTITUTION_ABILITY_DEFINITION_ID,
      modifier: 4,
      rollMode: 'NORMAL',
      contributors: [],
      contributorChecksum: checksumRuleDocument([])
    })
    expect(check.continuation.request).toMatchObject({ kind: 'INTEGER_RANGE', min: 1, max: 20 })
  })

  it('keeps Concentration when d20 + Constitution save meets the DC and loses it one below', async () => {
    const checked = application({ ordinal: 0, appliedAmount: 22 })
    const meets = await startCheck({ checked })
    const kept = await meets.evaluate(autoRoll(meets), [7])
    expect([kept.selectedNatural, kept.rawFaces, kept.rollMode, kept.failed]).toEqual([
      7,
      [7],
      'NORMAL',
      false
    ])
    expect([kept.execution.outputs.total, kept.execution.outputs.dc]).toEqual([11, 11])

    const misses = await startCheck({ checked })
    const lost = await misses.evaluate(autoRoll(misses), [6])
    expect([lost.execution.outputs.total, lost.execution.outputs.resultPath, lost.failed]).toEqual([
      10,
      'ON_SAVE_FAIL',
      true
    ])
  })

  it('treats a natural 1 and a natural 20 as ordinary saving-throw faces', async () => {
    const tough = withSaves([constitutionSave({ modifier: 9 })])
    const one = await startCheck({
      checked: application({ ordinal: 0, appliedAmount: 5 }),
      rulePolicyOutput: tough
    })
    expect((await one.evaluate(autoRoll(one), [1])).failed).toBe(false)

    const frail = withSaves([constitutionSave({ modifier: -1 })])
    const twenty = await startCheck({
      checked: application({ ordinal: 0, appliedAmount: 44 }),
      rulePolicyOutput: frail
    })
    const result = await twenty.evaluate(autoRoll(twenty), [20])
    expect([result.execution.outputs.total, result.execution.outputs.dc, result.failed]).toEqual([
      19,
      22,
      true
    ])
  })

  it('auto-rolls two d20s with advantage and keeps the higher', async () => {
    const check = await startCheck({
      checked: application({ ordinal: 0, appliedAmount: 22 }),
      rulePolicyOutput: withSaves([
        constitutionSave(),
        constitutionSave({
          ruleDefinitionId: DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID,
          rollMode: 'ADVANTAGE',
          contributors: [WAR_CASTER]
        })
      ])
    })
    const result = await check.evaluate(autoRoll(check), [3, 15])

    expect([result.rawFaces, result.rollMode, result.selectedNatural, result.failed]).toEqual([
      [3, 15],
      'ADVANTAGE',
      15,
      false
    ])
  })

  it('keeps the mode a roller chose for entered dice over the derived advantage', async () => {
    const check = await startCheck({
      checked: application({ ordinal: 0, appliedAmount: 22 }),
      rulePolicyOutput: withSaves([
        constitutionSave({
          ruleDefinitionId: DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID,
          rollMode: 'ADVANTAGE'
        })
      ])
    })
    const result = await check.evaluate({
      kind: 'ENTER_DICE',
      requestId: autoRoll(check).requestId,
      rawFaces: [6],
      rollMode: 'NORMAL'
    })

    expect([result.rawFaces, result.rollMode, result.selectedNatural, result.failed]).toEqual([
      [6],
      'NORMAL',
      6,
      true
    ])
  })

  it('refuses evidence for another request or occurrence, and a tampered context', async () => {
    const check = await startCheck({ checked: application({ ordinal: 0, appliedAmount: 22 }) })
    await expect(
      check.evaluate({ kind: 'AUTO_ROLL', requestId: 'another-request' }, [10])
    ).rejects.toThrow('The concentration evidence request is unavailable.')
    await expect(
      evaluateNativeConcentrationEvidence({
        runtime: check.runtime,
        random: () => 9,
        context: check.context,
        continuation: check.continuation,
        resolution: autoRoll(check),
        expectedOccurrenceId: PARENT_OCCURRENCE_ID
      })
    ).rejects.toThrow('The concentration evidence request is unavailable.')
    await expect(
      evaluateNativeConcentrationEvidence({
        runtime: check.runtime,
        random: () => 9,
        context: { ...check.context, save: { ...check.context.save, modifier: 5 } },
        continuation: check.continuation,
        resolution: autoRoll(check),
        expectedOccurrenceId: check.occurrenceId
      })
    ).rejects.toThrow('The concentration result does not match its frozen evidence.')
  })
})

describe('completeNativeConcentrationResult', () => {
  const checked = application({ ordinal: 0, appliedAmount: 22 })
  const sameSpell = {
    ...application({ ordinal: 1, appliedAmount: 8 }),
    maintainedStateId: MAINTAINED_ID
  }
  const otherSpell = {
    ...application({ ordinal: 2, appliedAmount: 30, targetActorId: OTHER_CASTER_ID }),
    maintainedStateId: OTHER_MAINTAINED_ID
  }

  async function complete(face: number) {
    const check = await startCheck({ checked, remaining: [sameSpell, otherSpell] })
    const evidence = await check.evaluate(autoRoll(check), [face])
    const result = completeNativeConcentrationResult({
      context: check.context,
      continuation: check.continuation,
      ...evidence,
      cleanup: evidence.failed
        ? {
            maintainedStateId: MAINTAINED_ID,
            removedDependentEffectIds: [],
            removedZoneIds: [],
            characterOwnerTransitions: []
          }
        : null,
      occurrenceVersion: 1,
      initialFactsChecksum: CHECKSUM('9')
    })
    return { result, requestId: autoRoll(check).requestId }
  }

  it('moves on to the next damage after a kept Concentration', async () => {
    const { result, requestId } = await complete(15)
    if (result.applicationOutputs.kind !== 'DAMAGE_SAVE_CHECK') throw new Error('Expected a check.')

    expect(result.applicationOutputs).toMatchObject({
      outcome: 'SAVE_SUCCESS',
      application: { ...checked, maintainedStateId: MAINTAINED_ID },
      cleanup: null,
      nextOccurrenceId: concentrationOccurrenceId(PARENT_OCCURRENCE_ID, sameSpell),
      skipped: []
    })
    expect(result.applicationOutputs.d20).toEqual({
      requestId,
      rollMode: 'NORMAL',
      derivedRollMode: 'NORMAL',
      rawFaces: [15],
      selectedNatural: 15,
      modifier: 4,
      total: 19,
      dc: 11,
      contributors: [],
      contributorChecksum: checksumRuleDocument([])
    })
    expect(nativeConcentrationParentDamage(result)).toEqual([])
  })

  it('skips the rest of the ended spell damage after a failure and moves to another spell', async () => {
    const { result } = await complete(2)
    if (result.applicationOutputs.kind !== 'DAMAGE_SAVE_CHECK') throw new Error('Expected a check.')

    expect(result.applicationOutputs).toMatchObject({
      outcome: 'SAVE_FAILURE',
      cleanup: { maintainedStateId: MAINTAINED_ID },
      nextOccurrenceId: concentrationOccurrenceId(PARENT_OCCURRENCE_ID, otherSpell),
      skipped: [{ ...sameSpell, reason: 'MAINTAINED_STATE_ENDED' }]
    })
  })
})

function damage(input: { ordinal: number; appliedAmount: number; nodeId?: string }) {
  return characterMechanicsApplicationDtoSchema.parse({
    ordinal: input.ordinal,
    kind: 'DAMAGE',
    requestedAmount: Math.max(1, input.appliedAmount),
    resolvedAmount: input.appliedAmount,
    appliedAmount: input.appliedAmount,
    beforeCurrentHitPoints: 40,
    afterCurrentHitPoints: 40 - input.appliedAmount,
    beforeTemporaryHitPoints: 0,
    afterTemporaryHitPoints: 0,
    maximumHitPoints: 40,
    damageTypeId: SLASHING.id,
    damageDisposition: input.appliedAmount === 0 ? 'IMMUNE' : 'NORMAL',
    critical: false,
    sourceNodeId: input.nodeId ?? `damage_${input.ordinal}`,
    sourceOperationKey: 'effect.damage',
    authoredPath: null,
    resolvedPath: null
  })
}

const heal = characterMechanicsApplicationDtoSchema.parse({
  ordinal: 3,
  kind: 'HEAL',
  requestedAmount: 5,
  resolvedAmount: 5,
  appliedAmount: 5,
  beforeCurrentHitPoints: 30,
  afterCurrentHitPoints: 35,
  beforeTemporaryHitPoints: 0,
  afterTemporaryHitPoints: 0,
  maximumHitPoints: 40,
  sourceNodeId: 'heal_3',
  sourceOperationKey: 'effect.heal',
  authoredPath: null,
  resolvedPath: null
})

describe('nativeConcentrationDamageApplications', () => {
  const outgoing = {
    targetActorId: CASTER_ID,
    sourceLabel: '  Moonbeam  ',
    applications: [
      damage({ ordinal: 4, appliedAmount: 9 }),
      damage({ ordinal: 5, appliedAmount: 0 }),
      heal
    ]
  }
  const incoming = {
    targetActorId: OTHER_CASTER_ID,
    sourceLabel: null,
    applications: [damage({ ordinal: 1, appliedAmount: 3 })]
  }

  it('checks only damage that was actually applied, in batch order, renumbered from 0', () => {
    expect(nativeConcentrationDamageApplications([outgoing, incoming])).toEqual([
      {
        ordinal: 0,
        sourceNodeId: 'damage_4',
        sourceOperationKey: 'effect.damage',
        targetActorId: CASTER_ID,
        appliedAmount: 9,
        damageTypeId: SLASHING.id
      },
      {
        ordinal: 1,
        sourceNodeId: 'damage_1',
        sourceOperationKey: 'effect.damage',
        targetActorId: OTHER_CASTER_ID,
        appliedAmount: 3,
        damageTypeId: SLASHING.id
      }
    ])
  })

  it('keeps graph ordinals on request and names each check by its trimmed source label', () => {
    expect(
      nativeConcentrationDamageApplications([outgoing, incoming], true).map(
        (entry) => entry.ordinal
      )
    ).toEqual([4, 1])
    expect(nativeConcentrationDamageSourceLabels([outgoing, incoming])).toEqual([
      {
        ordinal: 0,
        sourceNodeId: 'damage_4',
        sourceOperationKey: 'effect.damage',
        label: 'Moonbeam'
      }
    ])
  })

  it('makes one check per damage source, at the DC of that source’s total damage', async () => {
    // The seeded Ancient Red Dragon's Bite deals piercing and fire damage from one attack, authored
    // as sequential hit results.
    const bite = creatureFeature(ancientRedDragon, 'Bite')
    const prepared = await prepareCreatureAction({
      actor: creatureActor({ id: DRAGON_ID, label: 'Dragon', features: [bite] }),
      target: creatureActor({ id: CASTER_ID, label: 'Caster', features: [], hitPoints: 100 }),
      featureId: bite.id,
      overridable: true
    })
    // A natural 10 hits; every die rolls 1: piercing 2 + 1 (the fixture's Strength) and fire 4.
    const { mechanics } = await settleCreatureAction({ prepared, rolls: [9, 0, 0, 0, 0, 0, 0] })
    const rows = mechanics.mechanics.receiptApplications.filter(
      (application) => application.kind === 'DAMAGE'
    )
    expect(rows.map((row) => row.appliedAmount)).toEqual([3, 4])

    const [check, ...others] = nativeConcentrationDamageApplications([
      { targetActorId: CASTER_ID, applications: mechanics.mechanics.receiptApplications }
    ])
    expect(others).toEqual([])
    expect(check).toMatchObject({ targetActorId: CASTER_ID, appliedAmount: 7, damageTypeId: null })
    expect(dnd5eConcentrationDamageDc(check!.appliedAmount)).toBe(10)
  })

  it('refuses a damage envelope beyond the per-turn bound', () => {
    // Each batch is one damage source, so the envelope holds that many single-source batches.
    const within = Array.from({ length: MAX_CONCENTRATION_DAMAGE_APPLICATIONS }, () => ({
      targetActorId: CASTER_ID,
      applications: [damage({ ordinal: 0, appliedAmount: 1 })]
    }))
    expect(nativeConcentrationDamageApplications(within)).toHaveLength(
      MAX_CONCENTRATION_DAMAGE_APPLICATIONS
    )
    const flood = [
      ...within,
      { targetActorId: CASTER_ID, applications: [damage({ ordinal: 0, appliedAmount: 1 })] }
    ]
    expect(() => nativeConcentrationDamageApplications(flood)).toThrow(
      'Finalized concentration damage exceeds the turn bound.'
    )
  })
})

describe('nativeConcentrationParentDamage for Cleaving', () => {
  function cleaving(outcome: 'APPLIED' | 'DECLINED', appliedAmount: number) {
    const applied = outcome === 'APPLIED'
    return storedRuleExecutionResultDtoSchema.parse({
      status: 'AGGREGATE_CHOICE_COMPLETE',
      schemaVersion: 1,
      occurrenceId: '00000000-0000-4000-8000-00000000f002',
      occurrenceVersion: 1,
      applicationOutputs: {
        kind: 'CLEAVING_DAMAGE',
        schemaVersion: 1,
        occurrenceId: '00000000-0000-4000-8000-00000000f002',
        parentOccurrenceId: PARENT_OCCURRENCE_ID,
        sourceActorId: OTHER_CASTER_ID,
        targetActorId: applied ? CASTER_ID : null,
        selectedOptionId: applied ? CHECKSUM('a') : null,
        sealedContextChecksum: CHECKSUM('b'),
        outcome,
        damage: {
          sourceNodeId: 'cleave_damage',
          sourceOperationKey: 'effect.damage',
          damageTypeId: SLASHING.id,
          requestedAmount: 7,
          resolvedAmount: 7,
          appliedAmount
        },
        targetTransition: applied
          ? {
              checksum: CHECKSUM('c'),
              before: {
                currentHitPoints: 20,
                temporaryHitPoints: 0,
                maximumHitPoints: 20,
                conditionIds: [],
                deathSaves: NO_DEATH_SAVES
              },
              after: {
                currentHitPoints: 20 - appliedAmount,
                temporaryHitPoints: 0,
                maximumHitPoints: 20,
                conditionIds: [],
                deathSaves: null
              }
            }
          : null
      }
    })
  }

  it('checks the carried-over damage a cleave applied, and nothing for a decline or zero damage', () => {
    expect(nativeConcentrationParentDamage(cleaving('APPLIED', 7))).toEqual([
      {
        ordinal: 0,
        sourceNodeId: 'cleave_damage',
        sourceOperationKey: 'effect.damage',
        targetActorId: CASTER_ID,
        appliedAmount: 7,
        damageTypeId: SLASHING.id
      }
    ])
    expect(nativeConcentrationParentDamage(cleaving('APPLIED', 0))).toEqual([])
    expect(nativeConcentrationParentDamage(cleaving('DECLINED', 0))).toEqual([])
  })
})

describe('Concentration held by a Creature', () => {
  const WOLF_ID = '00000000-0000-4000-8000-0000000000b1'
  const WOLF_CONSTITUTION_MODIFIER = 1

  async function wolfHolder(
    conditions: { conditionTypeId: string; level: number }[] = [],
    statBlock?: Parameters<typeof creatureActor>[0]['statBlock']
  ) {
    const wolf = {
      ...creatureActor({
        id: WOLF_ID,
        label: 'Wolf',
        features: [],
        ...(statBlock ? { statBlock } : {})
      }),
      conditions
    }
    const { state, movementTargets } = creatureEncounter([wolf])
    const target = await withEncounterConditionMechanics({
      target: movementTargets.get(WOLF_ID)!,
      gameSystemId: srdSystemRecord.id,
      definitions: srdConditionDefinitionSource()
    })
    const maintenanceDocument = ruleMaintenanceReusableDefinitionDocumentDtoSchema.parse({
      schemaVersion: 1,
      kind: 'RULE_MAINTENANCE',
      id: DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID,
      gameSystemId: srdSystemRecord.id,
      replacementPolicy: 'REPLACE_SAME_DEFINITION',
      emptyDependentPolicy: 'TERMINATE_WHEN_EMPTY',
      damageCheckDefinitionId: published.id
    })
    const definitions = [maintenanceDocument, published.definition].map((document) =>
      reusableDefinitionCurrentDtoSchema.parse({
        id: document.id,
        gameSystemId: srdSystemRecord.id,
        contentSourceId: '00000000-0000-4000-8000-0000000000d8',
        definitionFamilyKey: 'kind' in document ? 'rule-maintenance' : document.definitionFamilyKey,
        label: 'kind' in document ? 'Concentration maintenance' : 'Concentration save',
        description: null,
        document,
        checksum: checksumRuleDocument(document),
        contractVersion: 1,
        version: 1,
        publishedAt: TIMESTAMP,
        publishedBy: '00000000-0000-4000-8000-0000000000d9'
      })
    )
    const vocabularyIdentity = {
      snapshotId: '00000000-0000-4000-8000-00000000d201',
      systemId: srdSystemRecord.id,
      snapshotVersion: 1,
      schemaVersion: 1,
      document: srdSystemRecord
    }
    const vocabulary = systemVocabularySnapshotSchema.parse({
      ...vocabularyIdentity,
      checksum: checksumRuleDocument(vocabularyIdentity)
    })
    const slot = encounterMaintainedEffectStateRecordSchema.parse({
      ...maintained,
      ownerActorId: WOLF_ID,
      descriptor: {
        ...maintained.descriptor,
        sourceActorId: WOLF_ID,
        definitionChecksum: definitions[0]!.checksum
      }
    })
    const current = await prepareEncounterConcentrationState({
      state,
      targetActorId: WOLF_ID,
      maintained: slot,
      loadTarget: () => target,
      readVocabulary: async () => vocabulary,
      readDefinition: async (id) => definitions.find((definition) => definition.id === id) ?? null
    })
    return { current, state }
  }

  async function startWolfCheck(
    current: NonNullable<Awaited<ReturnType<typeof wolfHolder>>['current']>,
    appliedAmount: number
  ) {
    const runtime = createSrdRulesRuntime()
    const checked = application({ ordinal: 0, appliedAmount, targetActorId: WOLF_ID })
    const { context, facts } = createNativeConcentrationContext({
      gameSystemId: DND5E_SYSTEM_ID,
      current,
      parentOccurrenceId: PARENT_OCCURRENCE_ID,
      parentCommandFingerprint: CHECKSUM('7'),
      application: checked,
      remaining: [],
      finalizedDamageEnvelopeChecksum: CHECKSUM('8'),
      sourceLabels: []
    })
    const occurrenceId = concentrationOccurrenceId(PARENT_OCCURRENCE_ID, checked)
    const started = await runtime.executeResolved({
      command: { definitionId: published.id, occurrenceId, facts },
      published: current.published
    })
    if (started.status !== 'PAUSED') throw new Error('The concentration check must ask for a d20.')
    return { runtime, context, occurrenceId, continuation: started.continuation }
  }

  it('prepares a Creature holder with no Character pins', async () => {
    const { current } = await wolfHolder()
    expect(current).not.toBeNull()
    expect(current!.pins.targetCharacter).toBeNull()
  })

  it('rolls the Creature Constitution save at the damage DC', async () => {
    const { current } = await wolfHolder()
    const check = await startWolfCheck(current!, 23)
    expect(check.context.trigger.dc).toBe(11)
    expect(check.context.save).toMatchObject({
      modifier: WOLF_CONSTITUTION_MODIFIER,
      rollMode: 'NORMAL',
      contributors: []
    })
    if (check.continuation.request.kind !== 'INTEGER_RANGE') throw new Error('Expected a d20.')
    const requestId = check.continuation.request.requestId
    const roll = (face: number) =>
      evaluateNativeConcentrationEvidence({
        runtime: check.runtime,
        random: () => face - 1,
        context: check.context,
        continuation: check.continuation,
        resolution: { kind: 'AUTO_ROLL', requestId },
        expectedOccurrenceId: check.occurrenceId
      })
    expect(await roll(10)).toMatchObject({ failed: false })
    expect(await roll(9)).toMatchObject({ failed: true })
  })

  it("adds a proficient Creature's proficiency bonus to its Concentration save", async () => {
    // The SRD Black Dragon Wyrmling: CON 13 (+1) and a proficient CON save at +2 (CR 2) is +3.
    const { current } = await wolfHolder([], blackDragonWyrmling)
    const check = await startWolfCheck(current!, 12)
    expect(check.context.save).toMatchObject({ modifier: 3, rollMode: 'NORMAL' })
  })

  it("applies the Creature's condition roll mode to its Concentration save (D94)", async () => {
    const exhaustion = srdConditionId('EXHAUSTION')
    const { current } = await wolfHolder([{ conditionTypeId: exhaustion, level: 3 }])
    const check = await startWolfCheck(current!, 12)
    expect(check.context.save.rollMode).toBe('DISADVANTAGE')
    expect(check.context.save.contributors).toEqual([
      {
        sourceId: `condition:${exhaustion}`,
        grantId: null,
        domainKey: `condition:${WOLF_ID}`,
        influence: 'DISADVANTAGE',
        source: { kind: 'CONDITION', id: exhaustion, holderActorId: WOLF_ID }
      }
    ])
  })
})
