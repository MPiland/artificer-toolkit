import { describe, expect, it } from 'vitest'
import { movementPassageOfModifiers } from '../encounterMovementPassagePolicy.js'
import { DND5E_SYSTEM_ID } from '../systems/dnd5e/identity.js'
import type { CharacterRulePolicyInput } from '@artificer-toolkit/schema/api/characterRules'
import {
  SRD_ABILITIES,
  SRD_ABILITY_DEFINITION_IDS,
  SRD_CONDITION_TYPES,
  SRD_DAMAGE_TYPES,
  SRD_SYSTEM_ID
} from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { buildMovementTarget } from '../encounterMovementTargets.js'
import {
  applyCharacterScalarValuesToFacts,
  foldActiveScalarReductions
} from '../encounterScalarReductions.js'
import { evaluateDnd5e2014CharacterPolicy } from '../systems/dnd5e/characterPolicy.js'
import { evaluateSrdCharacter } from '../testing/dnd5eSrdCharacter.js'
import { creatureActor, creatureRuleFacts, ENCOUNTER_ID } from '../testing/dnd5eSrdEncounter.js'
import { activeEffect, scalarReduction } from './encounterActiveEffectFixtures.js'

const { STRENGTH, DEXTERITY, CONSTITUTION } = SRD_ABILITY_DEFINITION_IDS
const CREATURE_ID = '00000000-0000-4000-8000-00000000c101'
const CAMPAIGN_ID = '00000000-0000-4000-8000-00000000c102'
const owner = {
  kind: 'ENCOUNTER_ACTOR' as const,
  encounterId: ENCOUNTER_ID,
  targetActorId: CREATURE_ID
}

function drain(id: string, createdOrdinal: number, valueDefinitionId: string, amount: number) {
  return activeEffect({
    id,
    owner,
    createdOrdinal,
    stateContributions: [scalarReduction(valueDefinitionId, amount)]
  })
}

describe('active scalar reduction fold', () => {
  const base = { [STRENGTH]: 10, [DEXTERITY]: 14 }

  it('subtracts every Strength Drain additively and leaves other scalars alone', () => {
    const effects = [
      drain('00000000-0000-4000-8000-00000000c1a2', 2, STRENGTH, 3),
      drain('00000000-0000-4000-8000-00000000c1a1', 1, STRENGTH, 4)
    ]
    expect(foldActiveScalarReductions({ baseScalarValues: base, effects })).toEqual({
      [STRENGTH]: 3,
      [DEXTERITY]: 14
    })
    expect(base).toEqual({ [STRENGTH]: 10, [DEXTERITY]: 14 })
  })

  it('stops at the zero floor (SRD Shadow: a creature reduced to Strength 0 dies)', () => {
    const effects = [
      drain('00000000-0000-4000-8000-00000000c1a1', 1, STRENGTH, 6),
      drain('00000000-0000-4000-8000-00000000c1a2', 2, STRENGTH, 6)
    ]
    expect(foldActiveScalarReductions({ baseScalarValues: base, effects })).toEqual({
      [STRENGTH]: 0,
      [DEXTERITY]: 14
    })
  })

  it('ignores effects with no scalar contribution', () => {
    const maximumReduction = activeEffect({
      id: '00000000-0000-4000-8000-00000000c1a3',
      owner,
      createdOrdinal: 1,
      stateContributions: [
        {
          kind: 'HIT_POINT_MAXIMUM_REDUCTION',
          amount: 5,
          sourceDamageOutcomeId: '00000000-0000-4000-8000-00000000c1a4',
          sourceDamageNodeId: 'damage',
          sourceDamageOperationKey: 'damage',
          recoveryTags: ['RESTORE_HIT_POINT_MAXIMUM'],
          sourceLabel: 'Slam',
          sourceHidden: false
        }
      ]
    })
    expect(
      foldActiveScalarReductions({ baseScalarValues: base, effects: [maximumReduction] })
    ).toEqual(base)
  })

  it('refuses a reduction of a scalar the target does not have', () => {
    expect(() =>
      foldActiveScalarReductions({
        baseScalarValues: base,
        effects: [drain('00000000-0000-4000-8000-00000000c1a1', 1, CONSTITUTION, 1)]
      })
    ).toThrow('The scalar reduction target fact is unavailable.')
  })
})

describe('Character scalar values in policy facts', () => {
  const abilityDefinitions = SRD_ABILITIES.map(({ id, code }) => ({ id, code }))
  // A Human's +1 makes Strength 15 an effective 16.
  const fighter = evaluateSrdCharacter({
    race: 'Human',
    abilities: { STRENGTH: 15 },
    classes: [{ label: 'Fighter', level: 1 }]
  })
  const facts = { ...fighter.facts, abilityDefinitions }
  const effectiveStrength = (policyFacts: CharacterRulePolicyInput) =>
    evaluateDnd5e2014CharacterPolicy(policyFacts).derivedStats.abilities.find(
      (ability) => ability.abilityId === 'STRENGTH'
    )

  it('overrides only the reduced ability with the reduced effective score', () => {
    const base = Object.fromEntries(
      evaluateDnd5e2014CharacterPolicy(facts).derivedStats.abilities.map((ability) => [
        SRD_ABILITIES.find((entry) => entry.code === ability.abilityId)!.id,
        ability.score.effective
      ])
    )
    expect(base[STRENGTH]).toBe(16)
    const reduced = applyCharacterScalarValuesToFacts(facts, SRD_SYSTEM_ID, base, {
      ...base,
      [STRENGTH]: 12
    })
    expect(reduced.derivedBaseFacts.abilities).toEqual(
      facts.derivedBaseFacts.abilities.map((ability) =>
        ability.abilityId === 'STRENGTH'
          ? {
              ...ability,
              scoreOverride: {
                sourceId: `scalar-reduction:${STRENGTH}`,
                source: { kind: 'SYSTEM', systemId: SRD_SYSTEM_ID },
                value: 12
              }
            }
          : ability
      )
    )
    // The override replaces the racial bonus rather than stacking with it: 12, not 13.
    expect(effectiveStrength(reduced)).toMatchObject({
      score: { base: 15, effective: 12 },
      modifier: { effective: 1 }
    })
  })

  it('leaves facts unchanged for an unreduced or unknown scalar', () => {
    const base = { [STRENGTH]: 16, [DEXTERITY]: 11 }
    expect(applyCharacterScalarValuesToFacts(facts, SRD_SYSTEM_ID, base, base)).toEqual(facts)
    expect(
      applyCharacterScalarValuesToFacts(
        facts,
        SRD_SYSTEM_ID,
        { [DEXTERITY]: 11 },
        { [STRENGTH]: 12 }
      )
    ).toEqual(facts)
  })

  it('refuses a negative effective score and a stale ability vocabulary', () => {
    const base = { [STRENGTH]: 16 }
    expect(() =>
      applyCharacterScalarValuesToFacts(facts, SRD_SYSTEM_ID, base, { [STRENGTH]: -1 })
    ).toThrow('The scalar reduction target fact is unavailable.')
    expect(() =>
      applyCharacterScalarValuesToFacts(
        {
          ...facts,
          abilityDefinitions: abilityDefinitions.filter(({ code }) => code !== 'WISDOM')
        },
        SRD_SYSTEM_ID,
        base,
        { [STRENGTH]: 12 }
      )
    ).toThrow('The Character ability fact is stale.')
  })
})

describe('Creature movement target', () => {
  const poisoned = SRD_CONDITION_TYPES.find((condition) => condition.code === 'POISONED')!.id
  const prone = SRD_CONDITION_TYPES.find((condition) => condition.code === 'PRONE')!.id
  const fire = SRD_DAMAGE_TYPES.find((damageType) => damageType.code === 'FIRE')!.id
  const cold = SRD_DAMAGE_TYPES.find((damageType) => damageType.code === 'COLD')!.id
  const scores = {
    STRENGTH: 11,
    DEXTERITY: 12,
    CONSTITUTION: 12,
    INTELLIGENCE: 10,
    WISDOM: 10,
    CHARISMA: 10
  }
  const payload = {
    size: 'MEDIUM',
    naturalArmorBonus: 1,
    abilityScores: scores,
    speeds: [],
    senses: [],
    damageVulnerabilities: [],
    damageResistances: [fire, cold],
    damageImmunities: [],
    conditionImmunities: [poisoned]
  }
  const creature = creatureActor({
    id: CREATURE_ID,
    currentHitPoints: 7,
    maxHitPoints: 11,
    tempHitPoints: 2,
    conditions: [{ conditionTypeId: prone, note: 'Shoved' }],
    snapshot: { payload, ruleFacts: creatureRuleFacts(scores) }
  })
  const savingThrows = (strength: number, dexterity: number) =>
    Object.entries({
      [STRENGTH]: strength,
      [DEXTERITY]: dexterity,
      [CONSTITUTION]: 12,
      [SRD_ABILITY_DEFINITION_IDS.INTELLIGENCE]: 10,
      [SRD_ABILITY_DEFINITION_IDS.WISDOM]: 10,
      [SRD_ABILITY_DEFINITION_IDS.CHARISMA]: 10
    })
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([abilityDefinitionId, score]) => ({
        abilityDefinitionId,
        modifier: Math.floor((score - 10) / 2),
        rollMode: 'NORMAL',
        contributors: []
      }))

  it('reads Run-owned state and derives target facts from drained ability scores', () => {
    const effects = [
      drain('00000000-0000-4000-8000-00000000c1a1', 1, DEXTERITY, 5),
      drain('00000000-0000-4000-8000-00000000c1a2', 2, STRENGTH, 2)
    ]
    const target = buildMovementTarget({
      actor: creature,
      activeEffects: effects,
      gameSystemId: SRD_SYSTEM_ID,
      campaignId: CAMPAIGN_ID,
      characterFacts: null
    })
    const baseScalarValues = creatureRuleFacts(scores).abilityScores
    const targetProtection = {
      status: 'NORMALIZED',
      defenses: [
        { kind: 'RESISTANCE', damageTypeId: fire },
        { kind: 'RESISTANCE', damageTypeId: cold }
      ].sort((left, right) => left.damageTypeId.localeCompare(right.damageTypeId)),
      qualifiedDefenses: [],
      conditionImmunityIds: [poisoned],
      spellSchoolImmunityIds: []
    }
    expect(target).toEqual({
      actor: creature,
      activeEffects: effects,
      characterFacts: null,
      state: { current: 7, temporary: 2, conditions: [prone], deathSaves: null },
      initialConditionRows: [{ conditionTypeId: prone, note: 'Shoved' }],
      effectiveMaximumHitPoints: 11,
      damageInterceptions: [],
      baseScalarValues,
      effectiveScalarValues: { ...baseScalarValues, [DEXTERITY]: 7, [STRENGTH]: 9 },
      baseRulePolicyOutput: null,
      perceptionSenses: [],
      effectiveRulePolicyOutput: null,
      characterCurrentness: null,
      attackAgainstContributors: [],
      sourceSightSaves: [],
      conditionDefinitions: [],
      conditionMechanics: [],
      grantedAttackTraits: [],
      movementPassage: movementPassageOfModifiers(DND5E_SYSTEM_ID, []),
      featureModifiers: [],
      incomingDamage: { halved: false, saveForHalf: [], reductions: [] },
      innateConditionIds: [],
      targetDerivedFacts: {
        actorId: CREATURE_ID,
        creatureTypeId: null,
        // Dexterity 12 drained to 7: initiative +1 becomes -2.
        initiativeModifier: -2,
        savingThrowDefinitions: savingThrows(9, 7),
        savingThrowAddedDice: {},
        healingMaximized: false,
        featureResources: [],
        incomingDamage: { halved: false, saveForHalf: [], reductions: [] },
        targetProtection,
        statBlock: {
          armorClass: 12,
          abilityScores: scores,
          speeds: [],
          senses: [],
          damageVulnerabilities: [],
          damageResistances: [fire, cold],
          damageImmunities: [],
          qualifiedDamageDefenses: [],
          conditionImmunities: [poisoned]
        }
      },
      defenses: targetProtection.defenses,
      qualifiedDefenses: [],
      conditionImmunityIds: [poisoned],
      sourceConditionImmunities: [],
      sourceSaves: [],
      spellSchoolImmunityIds: []
    })
  })

  it('uses the pinned scores unchanged when nothing drains them', () => {
    const target = buildMovementTarget({
      actor: creature,
      activeEffects: [],
      gameSystemId: SRD_SYSTEM_ID,
      campaignId: CAMPAIGN_ID,
      characterFacts: null
    })
    expect(target.effectiveScalarValues).toEqual(target.baseScalarValues)
    expect(target.targetDerivedFacts).toMatchObject({
      initiativeModifier: 1,
      savingThrowDefinitions: savingThrows(11, 12)
    })
  })

  it('refuses scalar facts pinned for another Game System or unnormalized protections', () => {
    expect(() =>
      buildMovementTarget({
        actor: creatureActor({
          id: CREATURE_ID,
          snapshot: {
            payload,
            ruleFacts: { ...creatureRuleFacts(scores), gameSystemId: CAMPAIGN_ID }
          }
        }),
        activeEffects: [],
        gameSystemId: SRD_SYSTEM_ID,
        campaignId: CAMPAIGN_ID,
        characterFacts: null
      })
    ).toThrow('Encounter actor scalar facts are stale.')
    expect(() =>
      buildMovementTarget({
        actor: creatureActor({
          id: CREATURE_ID,
          snapshot: {
            payload: { ...payload, damageResistances: 'fire' },
            ruleFacts: creatureRuleFacts(scores)
          }
        }),
        activeEffects: [],
        gameSystemId: SRD_SYSTEM_ID,
        campaignId: CAMPAIGN_ID,
        characterFacts: null
      })
    ).toThrow('Encounter actor spatial protections are not normalized.')
  })

  it('refuses a scalar reduction on a custom actor, which has no scalar facts', () => {
    expect(() =>
      buildMovementTarget({
        actor: creatureActor({ id: CREATURE_ID, kind: 'CUSTOM', snapshot: {} }),
        activeEffects: [drain('00000000-0000-4000-8000-00000000c1a1', 1, STRENGTH, 1)],
        gameSystemId: SRD_SYSTEM_ID,
        campaignId: CAMPAIGN_ID,
        characterFacts: null
      })
    ).toThrow('The scalar reduction target fact is unavailable.')
  })
})
