import { describe, expect, it } from 'vitest'

import { buildCharacterArmorClassRuleFacts } from '../../character/characterArmorClassRuleFacts.js'
import type { ProjectableCharacterFacts } from '../../encounterActionProjection.js'
import { buildMovementTarget } from '../../encounterMovementTargets.js'
import {
  armorClassCapabilityRegistry,
  attackProfileCapabilityRegistry,
  characterRuleActionSystemAdapterRegistry,
  d20TestDefinitionCapabilityRegistry,
  legendaryActionEligibilityCapabilityRegistry,
  optionalCombatPolicyCapabilityRegistry
} from '../../platformEncounterPolicy.js'
import {
  characterActionCapabilityRegistry,
  creatureConditionCapabilityRegistry,
  savingThrowCapabilityRegistry
} from '../../platformPolicyModules.js'
import { tracerCreatureActor } from './encounter.js'
import { TRACER_SYSTEM_ID } from './system.js'

const ACTOR_ID = '00000000-0000-4000-8000-0000000fa301'
const SIDE_ID = '00000000-0000-4000-8000-0000000fc301'
const CAMPAIGN_ID = '00000000-0000-4000-8000-0000000fc302'

describe('D&D-shaped capabilities the tracer does not provide (RULES-2.T12b, D195)', () => {
  it.each([
    ['saving-throw', () => savingThrowCapabilityRegistry.require(TRACER_SYSTEM_ID)],
    ['armor-class', () => armorClassCapabilityRegistry.require(TRACER_SYSTEM_ID)],
    ['attack-profile', () => attackProfileCapabilityRegistry.require(TRACER_SYSTEM_ID)],
    [
      'legendary-action',
      () => legendaryActionEligibilityCapabilityRegistry.require(TRACER_SYSTEM_ID)
    ],
    ['character-action', () => characterActionCapabilityRegistry.require(TRACER_SYSTEM_ID)],
    ['creature-condition', () => creatureConditionCapabilityRegistry.require(TRACER_SYSTEM_ID)]
  ])('fail closed on require: %s', (capability, require) => {
    expect(require).toThrow(`The Game System does not provide ${capability} policy.`)
  })

  it('are skipped by find', () => {
    expect(optionalCombatPolicyCapabilityRegistry.find(TRACER_SYSTEM_ID)).toBeUndefined()
    expect(characterRuleActionSystemAdapterRegistry.find(TRACER_SYSTEM_ID)).toBeUndefined()
  })

  it('a tracer check graph has no death save', () => {
    expect(
      d20TestDefinitionCapabilityRegistry.require(TRACER_SYSTEM_ID).deathSaveDefinition
    ).toBeUndefined()
  })

  it('a tracer Creature target grants no attack traits rather than requiring an attack profile', () => {
    const target = buildMovementTarget<ProjectableCharacterFacts>({
      actor: tracerCreatureActor({
        id: ACTOR_ID,
        sideId: SIDE_ID,
        ratings: { CAREFUL: 0, CLEVER: 0, FLASHY: 0, FORCEFUL: 0, QUICK: 0, SNEAKY: 0 }
      }),
      activeEffects: [],
      characterFacts: null,
      campaignId: CAMPAIGN_ID,
      gameSystemId: TRACER_SYSTEM_ID
    })
    expect(target.grantedAttackTraits).toEqual([])
  })

  it("Character statistics fail closed: the tracer's approaches name no armour class ability", () => {
    expect(() =>
      buildCharacterArmorClassRuleFacts({
        characterId: 'tracer-character',
        systemId: TRACER_SYSTEM_ID,
        totalLevel: 1,
        classes: [],
        abilities: { FORCEFUL: 2 },
        hitpoints: [],
        features: [],
        equipmentItems: []
      })
    ).toThrow('The Game System does not provide character-progression policy.')
  })
})
