import { describe, expect, it } from 'vitest'

import {
  abilityScoreCapabilityRegistry,
  actionEconomyCapabilityRegistry,
  characterActionCapabilityRegistry,
  creatureConditionCapabilityRegistry
} from '../platformPolicyModules.js'
import {
  armorClassCapabilityRegistry,
  attackProfileCapabilityRegistry,
  characterRuleActionSystemAdapterRegistry,
  contestCheckCapabilityRegistry,
  d20TestDefinitionCapabilityRegistry,
  encounterFeatureActionCapabilityRegistry,
  initiativeCapabilityRegistry,
  legendaryActionEligibilityCapabilityRegistry,
  modifierScopeCapabilityRegistry,
  movementReactionEligibilityCapabilityRegistry,
  optionalCombatPolicyCapabilityRegistry,
  sceneGridPolicyCapabilityRegistry
} from '../platformEncounterPolicy.js'
import { createSystemCapabilityRegistry } from '../systemCapabilityRegistry.js'
import {
  DND5E_ABILITY_DEFINITION_ID_BY_CODE,
  DND5E_ACTION_ALLOWANCE_DEFINITION_ID,
  DND5E_BONUS_ACTION_ALLOWANCE_DEFINITION_ID,
  DND5E_EXHAUSTION_CONDITION_DEFINITION_ID,
  DND5E_REACTION_ALLOWANCE_DEFINITION_ID,
  DND5E_SYSTEM_ID,
  DND5E_UNCONSCIOUS_CONDITION_DEFINITION_ID
} from '../systems/dnd5e/identity.js'
import {
  createDnd5eBasicActionCheckDefinition,
  createDnd5eDeathSaveDefinition
} from '../systems/dnd5e/encounterLifecyclePolicy.js'
import { dnd5eInitiativeFactAdapter } from '../systems/dnd5e/initiativeFactAdapter.js'
import {
  DND5E_OPTIONAL_COMBAT_CONTEST_INITIATOR_MODIFIER_FACT_KEY,
  DND5E_OPTIONAL_COMBAT_CONTEST_TARGET_MODIFIER_FACT_KEY,
  createDnd5eContestGraph
} from '../systems/dnd5e/optionalCombatContestGraph.js'

const UNKNOWN_SYSTEM_ID = '00000000-0000-4000-8000-0000000000ff'
const adapter = { gameSystemId: DND5E_SYSTEM_ID, value: 1 }

describe('System capability registry', () => {
  it('resolves the installed adapter by UUID-canonical gameSystemId', () => {
    const registry = createSystemCapabilityRegistry('sample', [adapter])
    expect(registry.require(DND5E_SYSTEM_ID)).toBe(adapter)
    expect(registry.require(DND5E_SYSTEM_ID.toUpperCase())).toBe(adapter)
  })

  it('fails closed on a System that does not provide the capability', () => {
    const registry = createSystemCapabilityRegistry('sample', [adapter])
    expect(() => registry.require(UNKNOWN_SYSTEM_ID)).toThrow(
      'The Game System does not provide sample policy.'
    )
  })

  it('finds an optional capability and returns nothing for a System that does not provide it', () => {
    const registry = createSystemCapabilityRegistry('sample', [adapter])
    expect(registry.find(DND5E_SYSTEM_ID.toUpperCase())).toBe(adapter)
    expect(registry.find(UNKNOWN_SYSTEM_ID)).toBeUndefined()
    expect(() => registry.find('dnd5e')).toThrow(
      'Sample System identity must be a PostgreSQL UUID.'
    )
  })

  it('refuses a duplicate System adapter', () => {
    expect(() => createSystemCapabilityRegistry('sample', [adapter, { ...adapter }])).toThrow(
      `Duplicate sample System adapter: ${DND5E_SYSTEM_ID}.`
    )
  })

  it('refuses a System identity that is not a UUID', () => {
    expect(() =>
      createSystemCapabilityRegistry('sample', [{ ...adapter, gameSystemId: 'dnd5e' }])
    ).toThrow('Sample System identity must be a PostgreSQL UUID.')
    expect(() => createSystemCapabilityRegistry('sample', [adapter]).require('dnd5e')).toThrow(
      'Sample System identity must be a PostgreSQL UUID.'
    )
  })
})

describe('installed D&D capability adapters', () => {
  it('action economy refreshes the three allowances, distinct and sorted', () => {
    expect(
      actionEconomyCapabilityRegistry.require(DND5E_SYSTEM_ID).refreshCapabilityDefinitionIds()
    ).toEqual(
      [
        DND5E_REACTION_ALLOWANCE_DEFINITION_ID,
        DND5E_ACTION_ALLOWANCE_DEFINITION_ID,
        DND5E_BONUS_ACTION_ALLOWANCE_DEFINITION_ID
      ].sort()
    )
  })

  it('ability scores give the 5e modifier and keep the mental abilities in a Creature form', () => {
    const abilities = abilityScoreCapabilityRegistry.require(DND5E_SYSTEM_ID)
    expect([1, 8, 9, 10, 11, 15, 20, 30].map(abilities.abilityModifier)).toEqual([
      -5, -1, -1, 0, 0, 2, 5, 10
    ])
    expect(abilities.formRetainedAbilityIds).toEqual({
      INTELLIGENCE: DND5E_ABILITY_DEFINITION_ID_BY_CODE.INTELLIGENCE,
      WISDOM: DND5E_ABILITY_DEFINITION_ID_BY_CODE.WISDOM,
      CHARISMA: DND5E_ABILITY_DEFINITION_ID_BY_CODE.CHARISMA
    })
  })

  it('creature conditions are Unconscious at 0 hit points and Exhaustion for exhaustion levels', () => {
    expect(creatureConditionCapabilityRegistry.require(DND5E_SYSTEM_ID)).toMatchObject({
      zeroHitPointsConditionDefinitionId: DND5E_UNCONSCIOUS_CONDITION_DEFINITION_ID,
      exhaustionConditionDefinitionId: DND5E_EXHAUSTION_CONDITION_DEFINITION_ID
    })
  })

  it('initiative resolves the D&D initiative fact adapter', () => {
    expect(initiativeCapabilityRegistry.require(DND5E_SYSTEM_ID)).toBe(dnd5eInitiativeFactAdapter)
  })

  it('armor class reads Dexterity for a Creature and has no shield to count without one', () => {
    const armorClass = armorClassCapabilityRegistry.require(DND5E_SYSTEM_ID)
    expect(
      armorClass.creatureArmorClass({
        abilityScores: { DEXTERITY: 14 },
        naturalArmorBonus: 1,
        equipment: []
      })
    ).toEqual({ ok: true, armorClass: 13 })
    expect(
      armorClass.creatureArmorClass({ abilityScores: {}, naturalArmorBonus: 0, equipment: [] })
    ).toBeNull()
    expect(
      armorClass.countedShield({
        equipment: [],
        activeEquipmentInstanceIds: [],
        armorClass: { contributions: [] }
      })
    ).toBeNull()
  })

  it('d20 test definitions give the D&D basic action check and death save graphs', () => {
    const d20Tests = d20TestDefinitionCapabilityRegistry.require(DND5E_SYSTEM_ID)
    expect(d20Tests.basicActionCheckDefinition()).toEqual(createDnd5eBasicActionCheckDefinition())
    expect(d20Tests.deathSaveDefinition?.()).toEqual(createDnd5eDeathSaveDefinition())
  })

  it('contest checks give the D&D two-d20 graph and its modifier facts', () => {
    const contest = contestCheckCapabilityRegistry.require(DND5E_SYSTEM_ID)
    const definitionId = '00000000-0000-4000-8000-000000000701'
    expect(contest.contestGraph(definitionId)).toEqual(createDnd5eContestGraph(definitionId))
    expect(contest.initiatorModifierFactKey).toBe(
      DND5E_OPTIONAL_COMBAT_CONTEST_INITIATOR_MODIFIER_FACT_KEY
    )
    expect(contest.targetModifierFactKey).toBe(
      DND5E_OPTIONAL_COMBAT_CONTEST_TARGET_MODIFIER_FACT_KEY
    )
  })

  it('optional combat is inert without an enabled policy and offers no Cleaving for another System', () => {
    const policy = optionalCombatPolicyCapabilityRegistry.require(DND5E_SYSTEM_ID)
    expect(
      policy.prepareTumbleContest({
        automationMode: 'MANUAL',
        gameSystemId: DND5E_SYSTEM_ID,
        optionalCombatSnapshot: null,
        optionalCombatSnapshotChecksum: null,
        actionEconomy: 'ACTION',
        actionEconomyAvailable: true,
        blockerActorId: '00000000-0000-4000-8000-000000000702',
        initiatorActorId: '00000000-0000-4000-8000-000000000703',
        passageAlreadyUsedThisTurn: false
      })
    ).toEqual({ kind: 'INERT' })
    expect(
      policy.prepareDisarmContest({
        automationMode: 'MANUAL',
        gameSystemId: DND5E_SYSTEM_ID,
        optionalCombatSnapshot: null,
        optionalCombatSnapshotChecksum: null,
        attackerActorId: '00000000-0000-4000-8000-000000000703',
        attackerSize: null,
        heldItemId: null,
        targetActorId: '00000000-0000-4000-8000-000000000702',
        targetCheckDefinitionId: null,
        targetEquipment: null,
        targetItemOwnerState: null,
        targetSize: null,
        triggerCode: null,
        sourceEquipment: null,
        attack: null
      })
    ).toEqual({ kind: 'INERT' })
    expect(optionalCombatPolicyCapabilityRegistry.find(UNKNOWN_SYSTEM_ID)).toBeUndefined()
  })

  it('installs the D&D attack profile: kinds, domains and the traits a feature attack carries', () => {
    const profile = attackProfileCapabilityRegistry.require(DND5E_SYSTEM_ID)
    expect(profile.attackKind('MELEE_SPELL_ATTACK')).toBe('MELEE_SPELL')
    expect(profile.attackKind('SAVING_THROW')).toBeNull()
    expect(profile.attackDomain('RANGED_SPELL')).toBe('SPELL')
    expect(profile.attackDomain('UNARMED')).toBe('UNARMED')
    expect(profile.featureAttackTraits('RANGED_SPELL', [])).toEqual({
      magical: true,
      silvered: false,
      adamantine: false
    })
    expect(profile.featureAttackTraits('MELEE', ['SILVERED'])).toEqual({
      magical: false,
      silvered: true,
      adamantine: false
    })
  })

  it('installs the D&D modifier scope', () => {
    expect(modifierScopeCapabilityRegistry.require(DND5E_SYSTEM_ID).gameSystemId).toBe(
      DND5E_SYSTEM_ID
    )
  })

  it.each([
    ['initiative', initiativeCapabilityRegistry],
    ['armor-class', armorClassCapabilityRegistry],
    ['d20-test-definition', d20TestDefinitionCapabilityRegistry],
    ['contest-check', contestCheckCapabilityRegistry],
    ['optional-combat', optionalCombatPolicyCapabilityRegistry],
    ['attack-profile', attackProfileCapabilityRegistry],
    ['modifier-scope', modifierScopeCapabilityRegistry],
    ['character-action', characterActionCapabilityRegistry],
    ['character-rule-action', characterRuleActionSystemAdapterRegistry],
    ['encounter-feature-action', encounterFeatureActionCapabilityRegistry],
    ['legendary-action', legendaryActionEligibilityCapabilityRegistry],
    ['movement-reaction', movementReactionEligibilityCapabilityRegistry],
    ['scene-grid', sceneGridPolicyCapabilityRegistry]
  ] as const)('%s fails closed on a System that does not install it', (capability, registry) => {
    expect(() => registry.require(UNKNOWN_SYSTEM_ID)).toThrow(
      `The Game System does not provide ${capability} policy.`
    )
  })

  it.each([
    ['character-action', characterActionCapabilityRegistry],
    ['character-rule-action', characterRuleActionSystemAdapterRegistry],
    ['encounter-feature-action', encounterFeatureActionCapabilityRegistry],
    ['legendary-action', legendaryActionEligibilityCapabilityRegistry],
    ['movement-reaction', movementReactionEligibilityCapabilityRegistry],
    ['scene-grid', sceneGridPolicyCapabilityRegistry]
  ] as const)('installs the D&D %s capability', (_capability, registry) => {
    expect(registry.require(DND5E_SYSTEM_ID).gameSystemId).toBe(DND5E_SYSTEM_ID)
  })

  it('leaves the optional scene grid policy absent for a System that does not install it', () => {
    expect(sceneGridPolicyCapabilityRegistry.find(UNKNOWN_SYSTEM_ID)).toBeUndefined()
  })
})
