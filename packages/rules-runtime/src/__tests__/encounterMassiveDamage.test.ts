import { describe, expect, it } from 'vitest'
import { encounterOptionalCombatSnapshotDtoSchema } from '@artificer-toolkit/schema/shared/optionalCombat'
import type { ConcentrationDamageApplicationDto } from '@artificer-toolkit/schema/shared/ruleExecutionConcentration'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import {
  SRD_ABILITY_DEFINITION_IDS,
  SRD_DAMAGE_TYPES
} from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { concentrationOccurrenceId } from '../encounterConcentrationIdentity.js'
import {
  completeMassiveDamageSaveResult,
  createMassiveDamageSaveContext,
  encounterMassiveDamageRule,
  evaluateMassiveDamageSaveEvidence,
  massiveDamageSaveApplications
} from '../encounterMassiveDamage.js'
import { SRD, srdByLabel } from '../testing/dnd5eSrdCharacter.js'
import {
  SRD_SYSTEM_ID,
  SRD_VOCABULARY,
  createSrdRulesRuntime,
  srdCreatureActor,
  srdCreatureTarget,
  srdOptionalCombat
} from '../testing/dnd5eSrdEncounter.js'

const HOLDER_ID = '00000000-0000-4000-8000-00000000d001'
const OTHER_ID = '00000000-0000-4000-8000-00000000d002'
const PARENT_OCCURRENCE_ID = '00000000-0000-4000-8000-00000000f101'
const FIRE = SRD_DAMAGE_TYPES.find((damageType) => damageType.code === 'FIRE')!
const goblin = srdByLabel(SRD.creatures, 'Goblin')

const massiveRules = srdOptionalCombat(['MASSIVE_DAMAGE'])
const policy = (rules = massiveRules, automationMode: 'ASSISTED' | 'MANUAL' = 'ASSISTED') => ({
  automationMode,
  gameSystemId: SRD_SYSTEM_ID,
  optionalCombatSnapshot: rules.snapshot,
  optionalCombatSnapshotChecksum: rules.checksum
})
const srdRule = encounterMassiveDamageRule(policy())!

function damage(input: {
  ordinal: number
  appliedAmount: number
  targetActorId?: string
}): ConcentrationDamageApplicationDto {
  return {
    ordinal: input.ordinal,
    sourceNodeId: `damage-${input.ordinal}`,
    sourceOperationKey: 'dnd5e.damage',
    targetActorId: input.targetActorId ?? HOLDER_ID,
    appliedAmount: input.appliedAmount,
    damageTypeId: FIRE.id
  }
}

function owed(
  applications: readonly ConcentrationDamageApplicationDto[],
  holders: Record<string, { defeated?: boolean; maximumHitPoints: number }>
) {
  return massiveDamageSaveApplications({
    rule: srdRule,
    applications,
    holders: new Map(
      Object.entries(holders).map(([id, holder]) => [id, { defeated: false, ...holder }])
    )
  })
}

/** The SRD rule's document with homebrew parameters, pinned in a fresh snapshot. */
function homebrewRules(parameters: Record<string, unknown>) {
  const [definition] = massiveRules.snapshot.definitions
  const document = {
    ...definition!.document,
    parameters: { ...definition!.document.parameters, ...parameters }
  }
  const snapshot = encounterOptionalCombatSnapshotDtoSchema.parse({
    ...massiveRules.snapshot,
    definitions: [{ ...definition, document, definitionChecksum: checksumRuleDocument(document) }]
  })
  return { snapshot, checksum: checksumRuleDocument(snapshot) }
}

describe('massive-damage save derivation', () => {
  it('owes a save when one source deals exactly half the maximum and none one below', () => {
    expect(
      owed([damage({ ordinal: 0, appliedAmount: 10 })], { [HOLDER_ID]: { maximumHitPoints: 20 } })
    ).toEqual([
      {
        ...damage({ ordinal: 0, appliedAmount: 10 }),
        optionalCombatDefinitionId: srdRule.pin.definitionId
      }
    ])
    expect(
      owed([damage({ ordinal: 0, appliedAmount: 9 })], { [HOLDER_ID]: { maximumHitPoints: 20 } })
    ).toEqual([])
  })

  it('rounds an odd maximum up: half of 21 needs 11', () => {
    const holders = { [HOLDER_ID]: { maximumHitPoints: 21 } }
    expect(owed([damage({ ordinal: 0, appliedAmount: 11 })], holders)).toHaveLength(1)
    expect(owed([damage({ ordinal: 0, appliedAmount: 10 })], holders)).toEqual([])
  })

  it('measures each damage source alone and owes one save per qualifying source', () => {
    const holders = { [HOLDER_ID]: { maximumHitPoints: 20 } }
    expect(
      owed(
        [damage({ ordinal: 0, appliedAmount: 6 }), damage({ ordinal: 1, appliedAmount: 6 })],
        holders
      )
    ).toEqual([])
    expect(
      owed(
        [
          damage({ ordinal: 0, appliedAmount: 6 }),
          damage({ ordinal: 1, appliedAmount: 12 }),
          damage({ ordinal: 2, appliedAmount: 10 })
        ],
        holders
      ).map(({ ordinal }) => ordinal)
    ).toEqual([1, 2])
  })

  it('skips a defeated holder, a holder it cannot measure and a holder with no maximum', () => {
    expect(
      owed(
        [
          damage({ ordinal: 0, appliedAmount: 30 }),
          damage({ ordinal: 1, appliedAmount: 30, targetActorId: OTHER_ID })
        ],
        { [HOLDER_ID]: { defeated: true, maximumHitPoints: 20 } }
      )
    ).toEqual([])
    expect(
      owed([damage({ ordinal: 0, appliedAmount: 30 })], { [HOLDER_ID]: { maximumHitPoints: 0 } })
    ).toEqual([])
  })

  it('owes nothing without a rule', () => {
    expect(
      massiveDamageSaveApplications({
        rule: null,
        applications: [damage({ ordinal: 0, appliedAmount: 30 })],
        holders: new Map([[HOLDER_ID, { defeated: false, maximumHitPoints: 20 }]])
      })
    ).toEqual([])
  })
})

describe('massive-damage rule', () => {
  it('reads the SRD threshold, Constitution save and DC from the pinned definition', () => {
    const [definition] = massiveRules.snapshot.definitions
    expect(srdRule).toMatchObject({
      pin: {
        definitionId: definition!.definitionId,
        definitionVersion: definition!.definitionVersion,
        definitionChecksum: definition!.definitionChecksum
      },
      threshold: { numerator: 1, denominator: 2 },
      savingThrowAbilityDefinitionId: SRD_ABILITY_DEFINITION_IDS.CONSTITUTION,
      difficultyClass: 15
    })
    expect(srdRule.published.id).toBe(definition!.definitionId)
  })

  it('is inert in a MANUAL Run and when the Encounter has the rule off', () => {
    expect(encounterMassiveDamageRule(policy(massiveRules, 'MANUAL'))).toBeNull()
    expect(encounterMassiveDamageRule(policy(srdOptionalCombat([])))).toBeNull()
  })

  it('takes a homebrew threshold, DC and ability, and its save graph moves with the definition', () => {
    const rule = encounterMassiveDamageRule(
      policy(
        homebrewRules({
          threshold: { numerator: 1, denominator: 3 },
          savingThrowDifficultyClass: 12,
          savingThrowAbilityDefinitionId: SRD_ABILITY_DEFINITION_IDS.DEXTERITY
        })
      )
    )!
    expect(rule).toMatchObject({
      threshold: { numerator: 1, denominator: 3 },
      difficultyClass: 12,
      savingThrowAbilityDefinitionId: SRD_ABILITY_DEFINITION_IDS.DEXTERITY
    })
    expect(rule.published.checksum).not.toBe(srdRule.published.checksum)
    expect(
      massiveDamageSaveApplications({
        rule,
        applications: [damage({ ordinal: 0, appliedAmount: 7 })],
        holders: new Map([[HOLDER_ID, { defeated: false, maximumHitPoints: 21 }]])
      })
    ).toHaveLength(1)
  })
})

describe('massive-damage save', () => {
  const holder = srdCreatureTarget(srdCreatureActor({ id: HOLDER_ID, creature: goblin }))
  const checked = damage({ ordinal: 0, appliedAmount: 4 })

  async function startSave() {
    const runtime = createSrdRulesRuntime()
    const { context, facts } = createMassiveDamageSaveContext({
      gameSystemId: SRD_SYSTEM_ID,
      rule: srdRule,
      target: holder,
      maximumHitPoints: holder.effectiveMaximumHitPoints,
      systemVocabularySnapshot: {
        id: SRD_VOCABULARY.snapshotId,
        version: SRD_VOCABULARY.snapshotVersion,
        checksum: SRD_VOCABULARY.checksum
      },
      damageTypes: SRD_DAMAGE_TYPES,
      parentOccurrenceId: PARENT_OCCURRENCE_ID,
      parentCommandFingerprint: 'f'.repeat(64),
      application: checked,
      remaining: [],
      finalizedDamageEnvelopeChecksum: 'e'.repeat(64),
      sourceLabels: [
        {
          ordinal: 0,
          sourceNodeId: 'damage-0',
          sourceOperationKey: 'dnd5e.damage',
          label: 'Fire Bolt'
        }
      ],
      damagerActorId: null
    })
    const occurrenceId = concentrationOccurrenceId(PARENT_OCCURRENCE_ID, {
      ...checked,
      optionalCombatDefinitionId: srdRule.pin.definitionId
    })
    const started = await runtime.executeResolved({
      command: { definitionId: srdRule.published.id, occurrenceId, facts },
      published: srdRule.published
    })
    if (started.status !== 'PAUSED') throw new Error('The massive-damage save must ask for a d20.')
    const settle = async (face: number) => {
      const evidence = await evaluateMassiveDamageSaveEvidence({
        gameSystemId: SRD_SYSTEM_ID,
        runtime,
        random: (maximum) => {
          expect(maximum).toBe(20)
          return face - 1
        },
        context,
        rule: srdRule,
        continuation: started.continuation,
        resolution: { kind: 'AUTO_ROLL', requestId: started.continuation.request.requestId },
        expectedOccurrenceId: occurrenceId
      })
      return completeMassiveDamageSaveResult({
        context,
        continuation: started.continuation,
        evidence,
        occurrenceVersion: 1,
        initialFactsChecksum: checksumRuleDocument(facts)
      })
    }
    return { context, started, occurrenceId, settle }
  }

  it('offers the rule Constitution save at its DC, named for the damage that prompted it', async () => {
    const { context, started } = await startSave()
    expect(context.trigger).toEqual({ sourceLabel: 'Fire Bolt', damageTypeLabel: 'Fire', dc: 15 })
    expect(context.save.savingThrowAbilityDefinitionId).toBe(
      SRD_ABILITY_DEFINITION_IDS.CONSTITUTION
    )
    expect(context.maximumHitPoints).toBe(holder.effectiveMaximumHitPoints)
    expect(started.continuation.request).toMatchObject({ kind: 'INTEGER_RANGE', min: 1, max: 20 })
  })

  it('records a failed save below the DC and a made save at it, changing nothing else', async () => {
    const { settle, occurrenceId, context } = await startSave()
    const failed = await settle(2)
    const made = await settle(20)
    if (failed.applicationOutputs.kind !== 'DAMAGE_SAVE_CHECK') throw new Error('Expected a save.')
    if (made.applicationOutputs.kind !== 'DAMAGE_SAVE_CHECK') throw new Error('Expected a save.')
    expect(failed.applicationOutputs).toMatchObject({
      source: 'MASSIVE_DAMAGE',
      occurrenceId,
      outcome: 'SAVE_FAILURE',
      optionalCombatDefinition: context.optionalCombatDefinition,
      application: { ...checked, optionalCombatDefinitionId: srdRule.pin.definitionId },
      d20: { selectedNatural: 2, dc: 15 },
      nextOccurrenceId: null
    })
    expect(made.applicationOutputs).toMatchObject({ outcome: 'SAVE_SUCCESS', d20: { dc: 15 } })
  })

  it('refuses an answer once the Encounter rule changed since the save was offered', async () => {
    const { context, started, occurrenceId } = await startSave()
    const changed = encounterMassiveDamageRule(
      policy(homebrewRules({ savingThrowDifficultyClass: 12 }))
    )
    await expect(
      evaluateMassiveDamageSaveEvidence({
        gameSystemId: SRD_SYSTEM_ID,
        runtime: createSrdRulesRuntime(),
        random: () => 0,
        context,
        rule: changed,
        continuation: started.continuation,
        resolution: { kind: 'AUTO_ROLL', requestId: started.continuation.request.requestId },
        expectedOccurrenceId: occurrenceId
      })
    ).rejects.toThrow('The massive-damage rule changed since the save was offered.')
  })
})
