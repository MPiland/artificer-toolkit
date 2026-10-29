import { describe, expect, it } from 'vitest'
import type {
  FacetAuthored,
  FacetConditionAuthored,
  FacetContextAuthored,
  FeatureAuthored,
  PredicateNodeAuthored
} from '@artificer-toolkit/shared/authored'
import type { CharacterGrantFoldSource } from '@artificer-toolkit/schema/api/characterGrantFoldRules'
import {
  SRD_ABILITIES,
  SRD_CONDITION_TYPES,
  SRD_DAMAGE_TYPES,
  SRD_STEALTH_SKILL_ID
} from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeCharacterGrantRestrictions } from '../character/characterGrantFoldRestrictionFacts.js'
import { buildEncounterActorRuleFacts } from '../encounterActorRuleFacts.js'
import {
  encounterFeatureSkillCheckContributors,
  encounterSourceSightSaveGrants,
  holderStateRestrictionsHold
} from '../encounterActiveGrants.js'
import { evaluateEncounterCharacterActionWieldConflict } from '../encounterWieldConflict.js'
import {
  dnd5eAttackDamageDefenses,
  dnd5eCharacterAttackTraits
} from '../systems/dnd5e/attackDamageDefenses.js'
import {
  dnd5eAttackKind,
  dnd5eAttackModifierDomain,
  isDnd5eMeleeAttackKind
} from '../systems/dnd5e/attackKind.js'
import { evaluateDnd5e2014CharacterActions } from '../systems/dnd5e/characterActions.js'
import { evaluateDnd5e2014CharacterPolicy } from '../systems/dnd5e/characterPolicy.js'
import { dnd5eAttackRollContributors } from '../systems/dnd5e/characterRollModes.js'
import { resolveDnd5eActiveShield } from '../systems/dnd5e/characterVitals.js'
import { selectDnd5eTargetSavingThrow } from '../systems/dnd5e/effectActionCompiler.js'
import {
  DND5E_CHARACTER_WIDE_TARGET,
  dnd5eCharacterActionTarget,
  dnd5eModifierApplies
} from '../systems/dnd5e/modifierApplicability.js'
import {
  SRD,
  damageExpression,
  evaluateSrdCharacter,
  itemAction,
  srdByLabel,
  srdFeature
} from '../testing/dnd5eSrdCharacter.js'
import { testUuid } from '../testing/dnd5eSrdEncounter.js'
import { DND5E_SYSTEM_ID } from '../systems/dnd5e/identity.js'

const EB_EFFECT = '0b7e4c6a-1f2d-4e3b-9a8c-7d6e5f4a3b2c'
const FB_EFFECT = '1c8f5d7b-2a3e-4f4c-8b9d-8e7f6a5b4c3d'
/** The action-model inputs these spell-only cases leave empty. */
const noActionSources = {
  candidates: [],
  abilityDefinitions: [],
  spellCandidates: [],
  spellSlots: [],
  spellMechanics: [],
  proficiencies: [],
  itemAdjustments: [],
  spellcastingLocked: false
}

const fighter = (level = 1) => ({ label: 'Fighter', level })
const fightingStyle = (option: string) =>
  srdFeature({
    owner: 'CLASS',
    classLabel: 'Fighter',
    featureLabel: 'Fighting Style',
    level: 1,
    optionLabels: [option]
  })

describe('D&D 5e weapon attacks', () => {
  it('a STR 16 fighter hits with a Longsword +1 at +6 for 1d8 + 4 (STR +3, magic +1)', () => {
    const character = evaluateSrdCharacter({
      abilities: { STRENGTH: 16 },
      classes: [fighter()],
      items: [{ label: 'Longsword +1' }]
    })
    const oneHanded = itemAction(character, 'Longsword +1', {
      attackKind: 'MELEE',
      grip: 'ONE_HANDED'
    })
    expect(oneHanded.decision.mechanic.attackBonus).toBe(6)
    expect(damageExpression(oneHanded.decision)).toBe('1d8 + 4')
    expect(
      damageExpression(
        itemAction(character, 'Longsword +1', { attackKind: 'MELEE', grip: 'TWO_HANDED' }).decision
      )
    ).toBe('1d10 + 4')
  })

  it('corrosion lowers the damage rolls of the corroded weapon only', () => {
    const character = evaluateSrdCharacter({
      abilities: { STRENGTH: 16 },
      classes: [fighter()],
      items: [{ label: 'Longsword', degradation: 2 }, { label: 'Mace' }]
    })
    const damage = (label: string) =>
      damageExpression(
        itemAction(character, label, { attackKind: 'MELEE', grip: 'ONE_HANDED' }).decision
      )
    expect(damage('Longsword')).toBe('1d8 + 1')
    expect(damage('Mace')).toBe('1d6 + 3')
  })

  it('Dueling adds +2 only to a one-handed melee weapon', () => {
    const character = evaluateSrdCharacter({
      abilities: { STRENGTH: 16 },
      classes: [fighter()],
      features: [fightingStyle('Dueling')],
      items: [{ label: 'Longsword' }, { label: 'Greatsword' }]
    })
    const longsword = (grip: 'ONE_HANDED' | 'TWO_HANDED') =>
      damageExpression(itemAction(character, 'Longsword', { attackKind: 'MELEE', grip }).decision)
    expect(longsword('ONE_HANDED')).toBe('1d8 + 5')
    expect(longsword('TWO_HANDED')).toBe('1d10 + 3')
    expect(
      damageExpression(itemAction(character, 'Greatsword', { attackKind: 'MELEE' }).decision)
    ).toBe('2d6 + 3')
    // Dueling is a damage bonus: the attack roll is unchanged (+3 STR, +2 proficiency).
    expect(
      itemAction(character, 'Longsword', { attackKind: 'MELEE', grip: 'ONE_HANDED' }).decision
        .mechanic.attackBonus
    ).toBe(5)
  })

  it('Dueling needs no other weapon wielded; a shield is not a weapon', () => {
    const longsword = (items: { label: string; equipped: boolean }[]) =>
      damageExpression(
        itemAction(
          evaluateSrdCharacter({
            abilities: { STRENGTH: 16 },
            classes: [fighter()],
            features: [fightingStyle('Dueling')],
            items: [{ label: 'Longsword', equipped: true }, ...items]
          }),
          'Longsword',
          { attackKind: 'MELEE', grip: 'ONE_HANDED' }
        ).decision
      )
    expect(longsword([{ label: 'Shield', equipped: true }])).toBe('1d8 + 5')
    // A carried, unequipped dagger is not wielded; an equipped one is.
    expect(longsword([{ label: 'Dagger', equipped: false }])).toBe('1d8 + 5')
    expect(longsword([{ label: 'Dagger', equipped: true }])).toBe('1d8 + 3')
  })

  it('Archery adds +2 to ranged weapons but not to a thrown dagger', () => {
    const character = evaluateSrdCharacter({
      abilities: { DEXTERITY: 16 },
      classes: [fighter()],
      features: [fightingStyle('Archery')],
      items: [{ label: 'Longbow' }, { label: 'Dagger' }]
    })
    expect(
      itemAction(character, 'Longbow', { attackKind: 'RANGED' }).decision.mechanic.attackBonus
    ).toBe(7)
    expect(
      itemAction(character, 'Dagger', { attackKind: 'RANGED' }).decision.mechanic.attackBonus
    ).toBe(5)
  })

  it('a Small halfling has disadvantage with a greatsword but not with a dagger (Heavy)', () => {
    const character = evaluateSrdCharacter({
      abilities: { STRENGTH: 14, DEXTERITY: 14 },
      race: 'Halfling',
      subrace: 'Lightfoot',
      classes: [fighter()],
      items: [{ label: 'Greatsword' }, { label: 'Dagger' }, { label: 'Longbow' }]
    })
    expect(
      itemAction(character, 'Greatsword', { attackKind: 'MELEE' }).decision.mechanic.attackRollMode
    ).toBe('DISADVANTAGE')
    expect(
      itemAction(character, 'Dagger', { attackKind: 'MELEE', activation: 'ACTION' }).decision
        .mechanic.attackRollMode
    ).toBe('NORMAL')
    const longbow = itemAction(character, 'Longbow', { attackKind: 'RANGED' })
    expect(longbow.decision.mechanic.attackRollMode).toBe('DISADVANTAGE')
    // Heavy is the weapon's own modifier: Character-wide attack evidence does not carry it.
    expect(character.output.rollContributorEvidence.attacks.MELEE).toEqual([])
    expect(character.output.rollContributorEvidence.attacks.RANGED).toEqual([])
  })

  it('a Medium human has no Heavy disadvantage', () => {
    const character = evaluateSrdCharacter({
      abilities: { STRENGTH: 14 },
      race: 'Human',
      classes: [fighter()],
      items: [{ label: 'Greatsword' }]
    })
    expect(
      itemAction(character, 'Greatsword', { attackKind: 'MELEE' }).decision.mechanic.attackRollMode
    ).toBe('NORMAL')
  })

  it('a ranged attack reads ranged roll modes and only melee attacks flank', () => {
    const character = evaluateSrdCharacter({
      race: 'Halfling',
      subrace: 'Lightfoot',
      classes: [fighter()],
      items: [{ label: 'Longbow' }]
    })
    const { candidate } = itemAction(character, 'Longbow', { attackKind: 'RANGED' })
    const target = dnd5eCharacterActionTarget(candidate)
    expect(
      dnd5eAttackRollContributors(character.output, 'RANGED', target).map(
        (contributor) => contributor.influence
      )
    ).toEqual(['DISADVANTAGE'])
    expect(dnd5eAttackRollContributors(character.output, 'MELEE', target)).toEqual([])
    expect(dnd5eAttackKind('RANGED_WEAPON_ATTACK')).toBe('RANGED')
    expect(dnd5eAttackKind('UNARMED_ATTACK')).toBe('UNARMED')
    expect(dnd5eAttackKind('ACTIVATED')).toBeNull()
    expect(isDnd5eMeleeAttackKind('MELEE')).toBe(true)
    expect(isDnd5eMeleeAttackKind('UNARMED')).toBe(true)
    expect(isDnd5eMeleeAttackKind('RANGED')).toBe(false)
  })

  it('a melee spell attack is melee (flanking, Cleaving) and reads spell modifiers', () => {
    expect(dnd5eAttackKind('MELEE_SPELL_ATTACK')).toBe('MELEE_SPELL')
    expect(dnd5eAttackKind('RANGED_SPELL_ATTACK')).toBe('RANGED_SPELL')
    expect(isDnd5eMeleeAttackKind('MELEE_SPELL')).toBe(true)
    expect(isDnd5eMeleeAttackKind('RANGED_SPELL')).toBe(false)
    expect(dnd5eAttackModifierDomain('MELEE_SPELL')).toBe('SPELL')
    expect(dnd5eAttackModifierDomain('RANGED_SPELL')).toBe('SPELL')
    // SRD: Shocking Grasp and Inflict Wounds are melee spell attacks; Fire Bolt is ranged.
    const trigger = (label: string) =>
      srdByLabel(SRD.spells, label).effects?.[0]?.invocation.triggerCode
    expect(trigger('Shocking Grasp')).toBe('MELEE_SPELL_ATTACK')
    expect(trigger('Inflict Wounds')).toBe('MELEE_SPELL_ATTACK')
    expect(trigger('Fire Bolt')).toBe('RANGED_SPELL_ATTACK')
  })

  it('a High Elf is proficient with a Longsword +1 through Elf Weapon Training', () => {
    const elf = evaluateSrdCharacter({
      abilities: { STRENGTH: 14 },
      race: 'Elf',
      subrace: 'High Elf',
      classes: [{ label: 'Wizard', level: 1 }],
      items: [{ label: 'Longsword +1' }]
    })
    const human = evaluateSrdCharacter({
      abilities: { STRENGTH: 14 },
      race: 'Human',
      classes: [{ label: 'Wizard', level: 1 }],
      items: [{ label: 'Longsword +1' }]
    })
    const attack = (character: typeof elf) =>
      itemAction(character, 'Longsword +1', { attackKind: 'MELEE', grip: 'ONE_HANDED' }).decision
        .mechanic.attackBonus
    // STR +2 for both (the human's 15), proficiency +2 only for the elf, magic +1 for both.
    expect(attack(elf)).toBe(5)
    expect(attack(human)).toBe(3)
  })

  it('a rogue is proficient with a rapier', () => {
    const character = evaluateSrdCharacter({
      abilities: { DEXTERITY: 16 },
      classes: [{ label: 'Rogue', level: 1 }],
      items: [{ label: 'Rapier' }]
    })
    expect(
      itemAction(character, 'Rapier', { attackKind: 'MELEE' }).decision.mechanic.attackBonus
    ).toBe(5)
  })
})

describe('D&D 5e armor class', () => {
  it('Draconic Resilience sets unarmored AC to 13 + DEX; a shield still adds', () => {
    const resilience = srdFeature({
      owner: 'SUBCLASS',
      classLabel: 'Sorcerer',
      subclassLabel: 'Draconic Bloodline',
      featureLabel: 'Draconic Resilience',
      level: 1
    })
    const evaluate = (items: { label: string; equipped: boolean }[]) =>
      evaluateSrdCharacter({
        abilities: { DEXTERITY: 14 },
        classes: [{ label: 'Sorcerer', level: 1, subclass: 'Draconic Bloodline' }],
        features: [resilience],
        items
      }).output.derivedStats.armorClass.effective
    expect(evaluate([])).toBe(15)
    expect(evaluate([{ label: 'Shield', equipped: true }])).toBe(17)
    expect(evaluate([{ label: 'Leather Armor', equipped: true }])).toBe(13)
  })

  it('Barbarian Unarmored Defense adds CON only without armor', () => {
    const unarmoredDefense = srdFeature({
      owner: 'CLASS',
      classLabel: 'Barbarian',
      featureLabel: 'Unarmored Defense',
      level: 1
    })
    const evaluate = (items: { label: string; equipped: boolean }[]) =>
      evaluateSrdCharacter({
        abilities: { STRENGTH: 15, DEXTERITY: 14, CONSTITUTION: 16 },
        classes: [{ label: 'Barbarian', level: 1 }],
        features: [unarmoredDefense],
        items
      }).output.derivedStats.armorClass.effective
    expect(evaluate([])).toBe(15)
    expect(evaluate([{ label: 'Shield', equipped: true }])).toBe(17)
    // Chain mail replaces 10 + DEX with 16 and Unarmored Defense stops applying.
    expect(evaluate([{ label: 'Chain Mail', equipped: true }])).toBe(16)
  })

  it('Monk Unarmored Defense is 10 + DEX + WIS without armor or shield', () => {
    const unarmoredDefense = srdFeature({
      owner: 'CLASS',
      classLabel: 'Monk',
      featureLabel: 'Unarmored Defense',
      level: 1
    })
    const evaluate = (items: { label: string; equipped: boolean }[]) =>
      evaluateSrdCharacter({
        abilities: { DEXTERITY: 16, WISDOM: 14 },
        classes: [{ label: 'Monk', level: 1 }],
        features: [unarmoredDefense],
        items
      }).output.derivedStats.armorClass.effective
    expect(evaluate([])).toBe(15)
    expect(evaluate([{ label: 'Shield', equipped: true }])).toBe(15)
    expect(evaluate([{ label: 'Leather Armor', equipped: true }])).toBe(14)
  })

  it('a Barbarian / Draconic Sorcerer uses the better unarmored formula; they never stack', () => {
    // PHB: with several ways to calculate armor class you use only one.
    const features = [
      srdFeature({
        owner: 'CLASS',
        classLabel: 'Barbarian',
        featureLabel: 'Unarmored Defense',
        level: 1
      }),
      srdFeature({
        owner: 'SUBCLASS',
        classLabel: 'Sorcerer',
        subclassLabel: 'Draconic Bloodline',
        featureLabel: 'Draconic Resilience',
        level: 1
      })
    ]
    const evaluate = (constitution: number, items: { label: string; equipped: boolean }[] = []) =>
      evaluateSrdCharacter({
        abilities: { STRENGTH: 13, DEXTERITY: 14, CONSTITUTION: constitution, CHARISMA: 13 },
        classes: [
          { label: 'Barbarian', level: 1 },
          { label: 'Sorcerer', level: 1, subclass: 'Draconic Bloodline' }
        ],
        features,
        items
      }).output.derivedStats.armorClass
    // CON 12: 13 + DEX (15) beats 10 + DEX + CON (13).
    expect(evaluate(12).effective).toBe(15)
    // CON 18: 10 + DEX + CON (16) beats 13 + DEX (15); stacking would give 19.
    expect(evaluate(18).effective).toBe(16)
    expect(evaluate(18, [{ label: 'Shield', equipped: true }]).effective).toBe(18)
    // Armor ends both formulas: studded leather is 12 + DEX.
    expect(evaluate(18, [{ label: 'Studded Leather Armor', equipped: true }]).effective).toBe(14)
    expect(evaluate(18).contributions).toEqual([])
  })

  it('Fighter Defense adds +1 only while wearing armor', () => {
    const evaluate = (items: { label: string; equipped: boolean }[]) =>
      evaluateSrdCharacter({
        abilities: { DEXTERITY: 12 },
        classes: [fighter()],
        features: [fightingStyle('Defense')],
        items
      }).output.derivedStats.armorClass.effective
    expect(evaluate([])).toBe(11)
    expect(evaluate([{ label: 'Chain Mail', equipped: true }])).toBe(17)
  })

  it('light armor keeps its DEX bonus without armor proficiency', () => {
    const character = evaluateSrdCharacter({
      abilities: { DEXTERITY: 14 },
      classes: [{ label: 'Wizard', level: 1 }],
      items: [{ label: 'Leather Armor', equipped: true }]
    })
    expect(character.output.derivedStats.armorClass.effective).toBe(13)
  })

  it('corrosion lowers the armor class an armor and a shield offer, never below 0', () => {
    const armorClass = (degradation?: number) =>
      evaluateSrdCharacter({
        abilities: { DEXTERITY: 10 },
        classes: [fighter()],
        items: [
          { label: 'Chain Mail', equipped: true, degradation },
          { label: 'Shield', equipped: true, degradation }
        ]
      }).output.derivedStats.armorClass.effective
    expect(armorClass(1)).toBe(armorClass() - 2)
    expect(armorClass(40)).toBe(0)
  })

  it('a PENALTY of 2 lowers AC by 2', () => {
    const character = evaluateSrdCharacter({ abilities: { DEXTERITY: 10 }, classes: [fighter()] })
    const penalty: CharacterGrantFoldSource = {
      sourceId: 'penalty-source',
      mechanicSource: { kind: 'SYSTEM', systemId: character.facts.grantFoldFacts.base.systemId },
      sourceState: null,
      restrictions: [],
      proficiencies: [],
      senses: [],
      modifiers: [
        {
          grantId: 'penalty-grant',
          valueDomainCode: 'ARMOR_CLASS',
          modifierKind: 'PENALTY',
          scope: 'GLOBAL',
          domain: {},
          payload: { valueKind: 'FIXED', amount: 2 },
          restrictions: [],
          scopeResourceIds: []
        }
      ],
      feats: [],
      spells: []
    }
    const output = evaluateDnd5e2014CharacterPolicy({
      ...character.facts,
      grantFoldFacts: { ...character.facts.grantFoldFacts, background: penalty }
    })
    expect(character.output.derivedStats.armorClass.effective).toBe(10)
    expect(output.derivedStats.armorClass.effective).toBe(8)
  })

  it('stowing a Shield +1 for a two-handed attack costs 3 AC, its magic bonus included', () => {
    const character = evaluateSrdCharacter({
      abilities: { STRENGTH: 16 },
      classes: [fighter()],
      items: [
        { label: 'Chain Mail', equipped: true },
        { label: 'Shield +1', equipped: true },
        { label: 'Greatsword' }
      ]
    })
    expect(character.output.derivedStats.armorClass.effective).toBe(19)
    const { candidate } = itemAction(character, 'Greatsword', { attackKind: 'MELEE' })
    expect(
      evaluateEncounterCharacterActionWieldConflict({
        gameSystemId: DND5E_SYSTEM_ID,
        candidate,
        ruleFacts: character.facts,
        policyOutput: character.output
      })
    ).toEqual({
      kind: 'STOW_SHIELD',
      shieldItemInstanceId: character.itemInstanceId('Shield +1'),
      armorClassDelta: -3
    })
  })

  describe('held shields (D107)', () => {
    const armorClass = (items: { label: string; equipped: boolean }[]) =>
      evaluateSrdCharacter({
        abilities: { DEXTERITY: 10 },
        classes: [fighter()],
        items
      }).output.derivedStats.armorClass.effective

    it('counts a shield held in the off hand', () => {
      expect(armorClass([{ label: 'Longsword', equipped: true }])).toBe(10)
      expect(
        armorClass([
          { label: 'Longsword', equipped: true },
          { label: 'Shield', equipped: true }
        ])
      ).toBe(12)
    })

    it('counts only the shield that adds the most when both hands hold one', () => {
      const both = [
        { label: 'Shield', equipped: true },
        { label: 'Shield +1', equipped: true }
      ]
      expect(armorClass(both)).toBe(13)
      expect(armorClass([...both].reverse())).toBe(13)
      expect(
        armorClass([
          { label: 'Shield', equipped: true },
          { label: 'Shield', equipped: true }
        ])
      ).toBe(12)
    })

    it('picks the shield that adds the most whichever hand or fact order it comes in', () => {
      const character = evaluateSrdCharacter({
        classes: [fighter()],
        items: [
          { label: 'Shield', equipped: true },
          { label: 'Shield +1', equipped: true }
        ]
      })
      const { equipment } = character.facts.armorClassFacts!
      const plusOne = character.itemInstanceId('Shield +1')
      const active = equipment.map((item) => item.itemInstanceId)
      const armorClassOf = (shield: { itemInstanceId: string }) =>
        shield.itemInstanceId === plusOne ? 3 : 2
      expect(resolveDnd5eActiveShield(equipment, active, armorClassOf)?.itemInstanceId).toBe(
        plusOne
      )
      expect(
        resolveDnd5eActiveShield([...equipment].reverse(), active, armorClassOf)?.itemInstanceId
      ).toBe(plusOne)
    })

    it('gives a tie to the main hand and ignores a shield that is not held', () => {
      const character = evaluateSrdCharacter({
        classes: [fighter()],
        items: [
          { label: 'Shield', equipped: true },
          { label: 'Shield', equipped: true }
        ]
      })
      const { equipment } = character.facts.armorClassFacts!
      const mainHand = equipment.find((item) => item.equippedSlot === 'MAIN_HAND')!
      const active = equipment.map((item) => item.itemInstanceId)
      const chosen = (items: typeof equipment) =>
        resolveDnd5eActiveShield(items, active, () => 2)?.itemInstanceId
      expect(chosen(equipment)).toBe(mainHand.itemInstanceId)
      expect(chosen([...equipment].reverse())).toBe(mainHand.itemInstanceId)
      expect(chosen(equipment.map((item) => ({ ...item, equippedSlot: 'WORN' })))).toBeUndefined()
    })
  })
})

describe('D&D 5e movement', () => {
  it('heavy armor slows a wearer below its Strength requirement, except a dwarf', () => {
    const walk = (race: string, strength: number, subrace?: string) =>
      evaluateSrdCharacter({
        abilities: { STRENGTH: strength },
        race,
        ...(subrace ? { subrace } : {}),
        classes: [fighter()],
        items: [{ label: 'Chain Mail', equipped: true }]
      }).output.movement.speeds[0]!.amount
    // Chain Mail needs Strength 13; a human's +1 counts (11 -> 12 is slowed, 12 -> 13 is not).
    expect(walk('Human', 11)).toBe(20)
    expect(walk('Human', 12)).toBe(30)
    expect(walk('Dwarf', 10, 'Hill Dwarf')).toBe(25)
  })

  it('Monk Unarmored Movement follows the Monk table without armor or a shield', () => {
    const walk = (level: number, items: { label: string; equipped: boolean }[] = []) =>
      evaluateSrdCharacter({
        race: 'Human',
        classes: [{ label: 'Monk', level }],
        features: [
          srdFeature({
            owner: 'CLASS',
            classLabel: 'Monk',
            featureLabel: 'Unarmored Movement',
            level: 2
          })
        ],
        items
      }).output.movement.speeds[0]!.amount
    // Monk table: +10 ft. at 2nd level, +15 at 6th, +20 at 10th, +25 at 14th, +30 at 18th.
    expect([2, 5, 6, 10, 14, 18, 20].map((level) => walk(level))).toEqual([
      40, 40, 45, 50, 55, 60, 60
    ])
    expect(walk(6, [{ label: 'Shield', equipped: true }])).toBe(30)
    expect(walk(6, [{ label: 'Leather Armor', equipped: true }])).toBe(30)
  })

  it('Barbarian Fast Movement adds 10 ft. of walking speed unless heavy armor is worn (SPELLS-31.T3a)', () => {
    const walk = (level: number, items: { label: string; equipped: boolean }[] = []) =>
      evaluateSrdCharacter({
        abilities: { STRENGTH: 15 },
        race: 'Human',
        classes: [{ label: 'Barbarian', level }],
        features: [
          srdFeature({
            owner: 'CLASS',
            classLabel: 'Barbarian',
            featureLabel: 'Fast Movement',
            level: 5
          })
        ],
        items
      }).output.movement.speeds[0]!.amount
    expect(walk(5)).toBe(40)
    expect(walk(5, [{ label: 'Hide Armor', equipped: true }])).toBe(40)
    expect(walk(5, [{ label: 'Chain Mail', equipped: true }])).toBe(30)
  })
})

describe('D&D 5e saving throws and defenses', () => {
  const frightened = SRD_CONDITION_TYPES.find((condition) => condition.code === 'FRIGHTENED')!.id
  const poisoned = SRD_CONDITION_TYPES.find((condition) => condition.code === 'POISONED')!.id

  it('Monk Purity of Body grants poison damage and poisoned condition immunity (SPELLS-31.T3a)', () => {
    const poison = SRD_DAMAGE_TYPES.find((damageType) => damageType.code === 'POISON')!.id
    const monk = (level: number) =>
      evaluateSrdCharacter({
        classes: [{ label: 'Monk', level }],
        features:
          level < 10
            ? []
            : [
                srdFeature({
                  owner: 'CLASS',
                  classLabel: 'Monk',
                  featureLabel: 'Purity of Body',
                  level: 10
                })
              ]
      }).output
    expect(monk(10).defenses).toContainEqual(
      expect.objectContaining({ kind: 'IMMUNITY', damageTypeId: poison })
    )
    expect(monk(10).conditionImmunityIds).toEqual([poisoned])
    expect(monk(9).defenses).toEqual([])
    expect(monk(9).conditionImmunityIds).toEqual([])
  })

  it('Steel Will grants advantage on saves against being frightened only', () => {
    const character = evaluateSrdCharacter({
      abilities: { WISDOM: 12 },
      classes: [{ label: 'Ranger', level: 7, subclass: 'Hunter' }],
      features: [
        srdFeature({
          owner: 'SUBCLASS',
          classLabel: 'Ranger',
          subclassLabel: 'Hunter',
          featureLabel: 'Defensive Tactics',
          level: 7,
          optionLabels: ['Steel Will']
        })
      ]
    })
    const wisdomId = SRD_ABILITIES.find((ability) => ability.code === 'WISDOM')!.id
    const save = (conditionIds: string[]) =>
      selectDnd5eTargetSavingThrow({
        savingThrowDefinitions: character.output.savingThrowDefinitions,
        abilityDefinitionId: wisdomId,
        conditionIds
      }).rollMode
    expect(save([frightened])).toBe('ADVANTAGE')
    expect(save([])).toBe('NORMAL')
    expect(save([poisoned])).toBe('NORMAL')
    expect(character.output.rollModes.savingThrows.WISDOM).toBe('NORMAL')
  })

  it('Halfling Brave authors the Steel Will advantage: saves of every ability against being frightened only', () => {
    const halfling = evaluateSrdCharacter({
      race: 'Halfling',
      subrace: 'Lightfoot',
      classes: [{ label: 'Fighter', level: 1 }]
    })
    const steelWill = evaluateSrdCharacter({
      classes: [{ label: 'Ranger', level: 7, subclass: 'Hunter' }],
      features: [
        srdFeature({
          owner: 'SUBCLASS',
          classLabel: 'Ranger',
          subclassLabel: 'Hunter',
          featureLabel: 'Defensive Tactics',
          level: 7,
          optionLabels: ['Steel Will']
        })
      ]
    })
    for (const ability of SRD_ABILITIES) {
      const save = (character: typeof halfling, conditionIds: string[]) =>
        selectDnd5eTargetSavingThrow({
          savingThrowDefinitions: character.output.savingThrowDefinitions,
          abilityDefinitionId: ability.id,
          conditionIds
        }).rollMode
      expect(save(halfling, [frightened])).toBe('ADVANTAGE')
      expect(save(halfling, [])).toBe('NORMAL')
      expect(save(halfling, [poisoned])).toBe('NORMAL')
      expect(save(halfling, [frightened])).toBe(save(steelWill, [frightened]))
    }
  })

  it('Supreme Sneak keeps its Stealth advantage out of the Sheet and grants it only while the turn’s movement stays within half the speed', () => {
    const character = evaluateSrdCharacter({
      abilities: { DEXTERITY: 16 },
      classes: [{ label: 'Rogue', level: 9 }],
      features: [
        srdFeature({
          owner: 'SUBCLASS',
          classLabel: 'Rogue',
          subclassLabel: 'Thief',
          featureLabel: 'Supreme Sneak',
          level: 9
        })
      ]
    })
    const { grantFold } = character.output
    const stealth = (usedFeet: number) =>
      encounterFeatureSkillCheckContributors({
        holderActorId: 'rogue',
        grantFold,
        skillAliases: [SRD_STEALTH_SKILL_ID],
        holderState: {
          kind: 'CHARACTER',
          creatureTypeIds: [],
          canAct: true,
          speedAboveZero: true,
          freeHand: true,
          stowableHeldItemInstanceId: null,
          turnMovement: { usedFeet, speedFeet: 30 },
          activeAuthoredEffectIds: []
        }
      }).map(({ influence }) => influence)
    expect(stealth(0)).toEqual(['ADVANTAGE'])
    expect(stealth(15)).toEqual(['ADVANTAGE'])
    expect(stealth(16)).toEqual([])
    expect(
      encounterFeatureSkillCheckContributors({
        holderActorId: 'rogue',
        grantFold,
        skillAliases: [testUuid(0xd5f1)],
        holderState: {
          kind: 'CHARACTER',
          creatureTypeIds: [],
          canAct: true,
          speedAboveZero: true,
          freeHand: true,
          stowableHeldItemInstanceId: null,
          turnMovement: { usedFeet: 0, speedFeet: 30 },
          activeAuthoredEffectIds: []
        }
      })
    ).toEqual([])
  })

  it('Danger Sense keeps its Dexterity advantage out of the Sheet and hands the Encounter the source-sight grant', () => {
    const character = evaluateSrdCharacter({
      abilities: { DEXTERITY: 14 },
      classes: [{ label: 'Barbarian', level: 2 }],
      features: [
        srdFeature({
          owner: 'CLASS',
          classLabel: 'Barbarian',
          featureLabel: 'Danger Sense',
          level: 2
        })
      ]
    })
    const dexterityId = SRD_ABILITIES.find((ability) => ability.code === 'DEXTERITY')!.id
    // The Sheet cannot decide sight, so neither the roll modes nor the saving-throw rows show it.
    expect(character.output.rollModes.savingThrows.DEXTERITY).toBe('NORMAL')
    expect(
      selectDnd5eTargetSavingThrow({
        savingThrowDefinitions: character.output.savingThrowDefinitions,
        abilityDefinitionId: dexterityId,
        conditionIds: []
      })
    ).toMatchObject({ rollMode: 'NORMAL', contributors: [] })

    const [dangerSense, ...others] = encounterSourceSightSaveGrants({
      gameSystemId: DND5E_SYSTEM_ID,
      holderActorId: 'barbarian',
      effects: [],
      grantFold: character.output.grantFold
    })
    expect(others).toEqual([])
    expect(dangerSense).toMatchObject({
      abilityDefinitionId: dexterityId,
      contributor: { influence: 'ADVANTAGE' }
    })
    // The authored "can act" is decided from the holder's state; sight is left to the Scene.
    const holderState = (canAct: boolean) => ({
      kind: 'CHARACTER' as const,
      creatureTypeIds: [],
      canAct,
      speedAboveZero: true,
      freeHand: true,
      stowableHeldItemInstanceId: null,
      turnMovement: { usedFeet: 0, speedFeet: 30 },
      activeAuthoredEffectIds: []
    })
    expect(holderStateRestrictionsHold(dangerSense!.restrictions, holderState(true))).toBe(true)
    expect(holderStateRestrictionsHold(dangerSense!.restrictions, holderState(false))).toBe(false)
  })

  it('a homebrew Feature authored from the same core options folds to Danger Sense’s source-sight grant', () => {
    const FIGHTER = srdByLabel(SRD.classes, 'Fighter')
    const homebrew: FeatureAuthored = {
      id: testUuid(0xd51),
      label: 'Watchful Reflexes',
      description: 'You have advantage on Dexterity saving throws against effects you can see.',
      availableAtLevel: 1,
      order: 1,
      grants: {
        modifiers: [
          {
            id: testUuid(0xd52),
            grantKind: 'MODIFIER_GRANT',
            valueDomainCode: 'SAVING_THROW_MODIFIER',
            domain: { ability: 'DEXTERITY', requiresHolderSeesSource: true },
            modifierKind: 'ROLL_INFLUENCE',
            payload: { influence: 'ADVANTAGE' },
            scope: 'GLOBAL',
            selectionKind: 'GRANTED',
            order: 0,
            restrictions: {
              id: testUuid(0xd53),
              groups: [
                {
                  id: testUuid(0xd54),
                  order: 0,
                  contexts: [
                    {
                      id: testUuid(0xd55),
                      order: 0,
                      subject: 'CHARACTER',
                      conditions: [
                        {
                          id: testUuid(0xd56),
                          order: 0,
                          kind: 'PREDICATE',
                          constraint: 'INCLUDE',
                          predicateCode: 'CAN_ACT'
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          }
        ]
      }
    }
    const sourceSightGrants = (character: ReturnType<typeof evaluateSrdCharacter>) =>
      encounterSourceSightSaveGrants({
        gameSystemId: DND5E_SYSTEM_ID,
        holderActorId: 'holder',
        effects: [],
        grantFold: character.output.grantFold
      }).map(({ abilityDefinitionId, restrictions, contributor }) => ({
        abilityDefinitionId,
        influence: contributor.influence,
        conditions: restrictions.map((group) =>
          group.conditions.map(({ kind, constraint }) => [kind, constraint])
        )
      }))
    const dangerSense = evaluateSrdCharacter({
      classes: [{ label: 'Barbarian', level: 2 }],
      features: [
        srdFeature({
          owner: 'CLASS',
          classLabel: 'Barbarian',
          featureLabel: 'Danger Sense',
          level: 2
        })
      ]
    })
    const authored = evaluateSrdCharacter({
      classes: [{ label: 'Fighter', level: 1 }],
      extraFeatures: [homebrew],
      features: [
        {
          acquisitionId: 'acquired:watchful-reflexes',
          featureId: homebrew.id,
          source: { kind: 'CLASS', classId: FIGHTER.id, classLevel: 1 },
          timing: { kind: 'CLASS_LEVEL', classId: FIGHTER.id, classLevel: 1 }
        }
      ]
    })
    expect(sourceSightGrants(authored)).toHaveLength(1)
    expect(sourceSightGrants(authored)).toEqual(sourceSightGrants(dangerSense))
    expect(authored.output.rollModes.savingThrows.DEXTERITY).toBe('NORMAL')
  })

  it('an immunity limited to authored content protects only against that content (REACTION-4.1)', () => {
    const defenses = [
      {
        kind: 'IMMUNITY' as const,
        damageTypeId: 'force',
        sourceEffectIds: ['spell:magic-missile']
      },
      { kind: 'RESISTANCE' as const, damageTypeId: 'fire', sourceEffectIds: [] },
      { kind: 'IMMUNITY' as const, damageTypeId: 'cold' }
    ]
    const met = (sourceId: string | null) =>
      dnd5eAttackDamageDefenses(defenses, [], null, sourceId).map(
        (defense) => `${defense.kind}:${defense.damageTypeId}`
      )
    // Filtered: only the listed spell's damage is met.
    expect(met('spell:magic-missile')).toEqual([
      'IMMUNITY:force',
      'RESISTANCE:fire',
      'IMMUNITY:cold'
    ])
    expect(met('spell:fireball')).toEqual(['RESISTANCE:fire', 'IMMUNITY:cold'])
    expect(met(null)).toEqual(['RESISTANCE:fire', 'IMMUNITY:cold'])
  })

  it('a Couatl is immune to nonmagical weapons but takes damage from a magic weapon', () => {
    const couatl = srdByLabel(SRD.creatures, 'Couatl')
    expect(couatl.qualifiedDamageDefenses?.length).toBeGreaterThan(0)
    const protection = buildEncounterActorRuleFacts({
      actors: [
        {
          id: '6f1c2d3e-4b5a-4c6d-8e7f-9a0b1c2d3e4f',
          kind: 'CREATURE',
          systemId: couatl.systemId,
          snapshot: {
            payload: {
              ...couatl,
              damageVulnerabilities: couatl.damageVulnerabilities ?? [],
              damageResistances: couatl.damageResistances ?? [],
              damageImmunities: couatl.damageImmunities ?? [],
              conditionImmunities: couatl.conditionImmunities ?? []
            }
          },
          resources: null
        }
      ]
    }).actors[0]!.targetProtection
    if (protection.status !== 'NORMALIZED') throw new Error('Couatl protection is unnormalized.')
    const piercingId = protection.qualifiedDefenses.find(
      (defense) => defense.kind === 'IMMUNITY'
    )!.damageTypeId
    const immune = (traits: Parameters<typeof dnd5eAttackDamageDefenses>[2]) =>
      dnd5eAttackDamageDefenses(
        protection.defenses,
        protection.qualifiedDefenses,
        traits,
        null
      ).some((defense) => defense.kind === 'IMMUNITY' && defense.damageTypeId === piercingId)
    expect(immune({ magical: false, silvered: false, adamantine: false })).toBe(true)
    expect(immune({ magical: true, silvered: false, adamantine: false })).toBe(false)
    // A qualified defense is "from attacks": damage outside an attack is not reduced by it.
    expect(immune(null)).toBe(false)

    const character = evaluateSrdCharacter({
      abilities: { STRENGTH: 16 },
      classes: [fighter()],
      items: [{ label: 'Longsword +1' }, { label: 'Longsword' }]
    })
    const traits = (label: string) =>
      dnd5eCharacterAttackTraits({
        candidate: itemAction(character, label, { attackKind: 'MELEE', grip: 'ONE_HANDED' })
          .candidate,
        attackKind: 'MELEE',
        policy: character.output
      })
    expect(traits('Longsword +1').magical).toBe(true)
    expect(traits('Longsword').magical).toBe(false)
  })
})

describe('Monk Ki-Empowered Strikes (SPELLS-31.T4e)', () => {
  it('makes unarmed strikes magical for overcoming resistance, and no weapon attack', () => {
    const character = evaluateSrdCharacter({
      abilities: { DEXTERITY: 16, WISDOM: 14 },
      classes: [{ label: 'Monk', level: 6 }],
      features: [
        srdFeature({
          owner: 'CLASS',
          classLabel: 'Monk',
          featureLabel: 'Ki-Empowered Strikes',
          level: 6
        })
      ],
      items: [{ label: 'Quarterstaff' }]
    })
    const candidate = itemAction(character, 'Quarterstaff', {
      attackKind: 'MELEE',
      grip: 'ONE_HANDED'
    }).candidate
    const traits = (attackKind: 'MELEE' | 'UNARMED') =>
      dnd5eCharacterAttackTraits({ candidate, attackKind, policy: character.output })
    expect(traits('UNARMED').magical).toBe(true)
    expect(traits('MELEE').magical).toBe(false)
  })
})

describe('D&D 5e modifier scope', () => {
  const requirement = (constraint: 'INCLUDE' | 'EXCLUDE', property: string) => [
    {
      conditions: [
        {
          conditionId: `${constraint}:${property}`,
          constraint,
          kind: 'ITEM_PROPERTY' as const,
          mode: 'SELECTED' as const,
          abilityId: null,
          classIds: [],
          requiredIds: [],
          secondaryRequiredIds: [],
          min: null,
          max: null,
          speedFraction: null,
          proficiencyKind: null,
          minimumRank: null,
          category: null,
          requiredProperties: [property],
          sourceState: null,
          requiresDaylight: false
        }
      ]
    }
  ]
  const sword = {
    equipmentIds: ['longsword'],
    category: 'WEAPON',
    properties: ['MELEE', 'VERSATILE'],
    grip: 'ONE_HANDED' as const,
    otherWeaponEquipped: false
  }

  it('GLOBAL applies Character-wide; SOURCE applies only while its source is evaluated', () => {
    const modifier = { sourceId: 'item', deferredRequirements: [] }
    expect(
      dnd5eModifierApplies({ ...modifier, scope: 'GLOBAL' }, DND5E_CHARACTER_WIDE_TARGET)
    ).toBe(true)
    expect(
      dnd5eModifierApplies({ ...modifier, scope: 'SOURCE' }, DND5E_CHARACTER_WIDE_TARGET)
    ).toBe(false)
    expect(
      dnd5eModifierApplies(
        { ...modifier, scope: 'SOURCE' },
        { sourceIds: ['item'], item: sword, spell: null, attackAbility: null, activation: null }
      )
    ).toBe(true)
    expect(
      dnd5eModifierApplies(
        { ...modifier, scope: 'SOURCE' },
        { sourceIds: ['other'], item: sword, spell: null, attackAbility: null, activation: null }
      )
    ).toBe(false)
  })

  it('item facets need the attacking item and a two-handed grip counts as TWO_HANDED', () => {
    const dueling = {
      sourceId: 'dueling',
      scope: 'GLOBAL' as const,
      deferredRequirements: requirement('EXCLUDE', 'TWO_HANDED')
    }
    expect(dnd5eModifierApplies(dueling, DND5E_CHARACTER_WIDE_TARGET)).toBe(false)
    expect(
      dnd5eModifierApplies(dueling, {
        sourceIds: [],
        item: sword,
        spell: null,
        attackAbility: null,
        activation: null
      })
    ).toBe(true)
    expect(
      dnd5eModifierApplies(dueling, {
        sourceIds: [],
        item: { ...sword, grip: 'TWO_HANDED' },
        spell: null,
        attackAbility: null,
        activation: null
      })
    ).toBe(false)
  })

  const spellModifier = (context: FacetContextAuthored<'SPELL'>) => ({
    sourceId: 'feature',
    scope: 'GLOBAL' as const,
    deferredRequirements: normalizeCharacterGrantRestrictions({
      id: 'facet',
      groups: [{ id: 'group', order: 0, contexts: [context] }]
    })
  })
  const anySpell = (
    ...conditions: FacetConditionAuthored<'SPELL'>[]
  ): FacetContextAuthored<'SPELL'> => ({
    id: 'context',
    order: 0,
    subject: 'SPELL',
    authoringModeKind: 'ALL',
    conditions
  })
  const cast = (spell: {
    id: string
    level: number | null
    magicSchoolId: string | null
    damageTypeId: string | null
  }) => ({ sourceIds: [], item: null, spell, attackAbility: null, activation: null })
  const predicate = (
    node: PredicateNodeAuthored<'SPELL'>,
    constraint: 'INCLUDE' | 'EXCLUDE' = 'INCLUDE'
  ): FacetConditionAuthored<'SPELL'> => ({
    id: 'predicate',
    order: 0,
    kind: 'PREDICATE',
    constraint,
    ...node
  })
  const eldritchBlast = {
    id: 'eldritch-blast',
    level: 0,
    magicSchoolId: 'evocation',
    damageTypeId: null
  }
  const fireBolt = { id: 'fire-bolt', level: 0, magicSchoolId: 'evocation', damageTypeId: null }
  const fireball = { id: 'fireball', level: 3, magicSchoolId: 'evocation', damageTypeId: null }
  const sleep = { id: 'sleep', level: 1, magicSchoolId: 'enchantment', damageTypeId: null }

  it('spell facets apply only to the named spell', () => {
    const agonizing = spellModifier({
      id: 'context',
      order: 0,
      subject: 'SPELL',
      authoringModeKind: 'SELECTED',
      spellIds: ['eldritch-blast']
    })
    expect(dnd5eModifierApplies(agonizing, DND5E_CHARACTER_WIDE_TARGET)).toBe(false)
    expect(dnd5eModifierApplies(agonizing, cast(eldritchBlast))).toBe(true)
    expect(dnd5eModifierApplies(agonizing, cast(fireBolt))).toBe(false)
  })

  // Regression (SPELLS-31.T5i1): an ALL spell context with a school condition used to fold to no
  // spell ids, so it applied to every spell and Character-wide.
  it('a school condition on any spell applies only to spells of that school', () => {
    const evocation = spellModifier(
      anySpell(
        predicate({
          predicateCode: 'MAGIC_SCHOOL',
          authoringModeKind: 'SELECTED',
          magicSchoolIds: ['evocation']
        })
      )
    )
    expect(dnd5eModifierApplies(evocation, DND5E_CHARACTER_WIDE_TARGET)).toBe(false)
    expect(dnd5eModifierApplies(evocation, cast(fireball))).toBe(true)
    expect(dnd5eModifierApplies(evocation, cast(sleep))).toBe(false)
    // A spell whose school is unknown meets no school condition.
    expect(dnd5eModifierApplies(evocation, cast({ ...fireball, magicSchoolId: null }))).toBe(false)
  })

  it('level and damage type conditions read the cast spell and the damage being modified', () => {
    const cantrips = spellModifier(
      anySpell(predicate({ predicateCode: 'SPELL_LEVEL', min: 0, max: 0 }))
    )
    expect(dnd5eModifierApplies(cantrips, cast(fireBolt))).toBe(true)
    expect(dnd5eModifierApplies(cantrips, cast(fireball))).toBe(false)
    expect(dnd5eModifierApplies(cantrips, cast({ ...fireBolt, level: null }))).toBe(false)
    const fire = spellModifier(
      anySpell(
        predicate({
          predicateCode: 'DAMAGE_TYPE',
          authoringModeKind: 'SELECTED',
          damageTypeIds: ['fire']
        })
      )
    )
    expect(dnd5eModifierApplies(fire, cast({ ...fireball, damageTypeId: 'fire' }))).toBe(true)
    expect(dnd5eModifierApplies(fire, cast({ ...fireball, damageTypeId: 'cold' }))).toBe(false)
    // Before any damage is chosen, a damage type condition is not met.
    expect(dnd5eModifierApplies(fire, cast(fireball))).toBe(false)
    expect(dnd5eModifierApplies(fire, DND5E_CHARACTER_WIDE_TARGET)).toBe(false)
  })

  it('an EXCLUDE spell condition applies to every other cast spell, never Character-wide', () => {
    const notEvocation = spellModifier(
      anySpell(
        predicate(
          {
            predicateCode: 'MAGIC_SCHOOL',
            authoringModeKind: 'SELECTED',
            magicSchoolIds: ['evocation']
          },
          'EXCLUDE'
        )
      )
    )
    expect(dnd5eModifierApplies(notEvocation, cast(sleep))).toBe(true)
    expect(dnd5eModifierApplies(notEvocation, cast(fireball))).toBe(false)
  })
})

describe('D&D 5e restrictions and spell-scoped damage', () => {
  it('fails closed on a restriction it cannot evaluate, whatever its constraint', () => {
    const [group] = normalizeCharacterGrantRestrictions({
      id: 'facet',
      groups: [
        {
          id: 'group',
          order: 0,
          contexts: [
            {
              id: 'context',
              order: 0,
              subject: 'CHARACTER',
              conditions: [
                {
                  id: 'skill-score',
                  order: 0,
                  kind: 'PREDICATE',
                  constraint: 'EXCLUDE',
                  predicateCode: 'SKILL_SCORE',
                  authoringModeKind: 'ALL'
                }
              ]
            }
          ]
        }
      ]
    })
    const character = evaluateSrdCharacter({ abilities: { DEXTERITY: 10 }, classes: [fighter()] })
    const source: CharacterGrantFoldSource = {
      sourceId: 'unevaluable-source',
      mechanicSource: { kind: 'SYSTEM', systemId: character.facts.grantFoldFacts.base.systemId },
      sourceState: null,
      restrictions: [],
      proficiencies: [],
      senses: [],
      modifiers: [
        {
          grantId: 'unevaluable-grant',
          valueDomainCode: 'ARMOR_CLASS',
          modifierKind: 'BONUS',
          scope: 'GLOBAL',
          domain: {},
          payload: { valueKind: 'FIXED', amount: 5 },
          restrictions: [group!],
          scopeResourceIds: []
        }
      ],
      feats: [],
      spells: []
    }
    const output = evaluateDnd5e2014CharacterPolicy({
      ...character.facts,
      grantFoldFacts: { ...character.facts.grantFoldFacts, background: source }
    })
    expect(group!.conditions.find(({ conditionId }) => conditionId === 'skill-score')!.kind).toBe(
      'UNAVAILABLE'
    )
    expect(output.derivedStats.armorClass.effective).toBe(10)
  })

  it('decides the holder kind and creature type as constants, so the fold output is unchanged', () => {
    const predicate = (id: string, predicateCode: 'CHARACTER_LEVEL' | 'CAN_ACT') => {
      const base = { id, order: 0, kind: 'PREDICATE', constraint: 'INCLUDE' } as const
      return predicateCode === 'CHARACTER_LEVEL'
        ? { ...base, predicateCode, min: 1 }
        : { ...base, predicateCode }
    }
    const restricted = (id: string, characterPredicate: 'CHARACTER_LEVEL' | 'CAN_ACT') => {
      const facet: FacetAuthored = {
        id,
        groups: [
          {
            id: `${id}-character`,
            order: 0,
            contexts: [
              {
                id: `${id}-character-context`,
                order: 0,
                subject: 'CHARACTER',
                conditions: [predicate(`${id}-predicate`, characterPredicate)]
              }
            ]
          },
          {
            id: `${id}-creature`,
            order: 1,
            contexts: [
              {
                id: `${id}-creature-context`,
                order: 0,
                subject: 'CREATURE',
                authoringModeKind: 'ALL',
                conditions: [
                  {
                    id: `${id}-creature-type`,
                    order: 0,
                    kind: 'PREDICATE',
                    constraint: 'INCLUDE',
                    predicateCode: 'CREATURE_TYPE',
                    authoringModeKind: 'ALL'
                  }
                ]
              }
            ]
          }
        ]
      }
      return normalizeCharacterGrantRestrictions(facet)
    }
    const character = evaluateSrdCharacter({ abilities: { DEXTERITY: 10 }, classes: [fighter()] })
    const armorClassBonus = (
      grantId: string,
      restrictions: CharacterGrantFoldSource['modifiers'][number]['restrictions']
    ): CharacterGrantFoldSource['modifiers'][number] => ({
      grantId,
      valueDomainCode: 'ARMOR_CLASS',
      modifierKind: 'BONUS',
      scope: 'GLOBAL',
      domain: {},
      payload: { valueKind: 'FIXED', amount: 5 },
      restrictions,
      scopeResourceIds: []
    })
    type Restrictions = ReturnType<typeof normalizeCharacterGrantRestrictions>
    const evaluateWith = (
      only: (restrictions: Restrictions) => Restrictions
    ): ReturnType<typeof evaluateDnd5e2014CharacterPolicy> => {
      return evaluateDnd5e2014CharacterPolicy({
        ...character.facts,
        grantFoldFacts: {
          ...character.facts.grantFoldFacts,
          background: {
            sourceId: 'holder-kind-source',
            mechanicSource: {
              kind: 'SYSTEM',
              systemId: character.facts.grantFoldFacts.base.systemId
            },
            sourceState: null,
            restrictions: [],
            proficiencies: [],
            senses: [],
            modifiers: [
              armorClassBonus('levelled', only(restricted('levelled', 'CHARACTER_LEVEL'))),
              armorClassBonus('can-act', only(restricted('can-act', 'CAN_ACT')))
            ],
            feats: [],
            spells: []
          }
        }
      })
    }
    // Before D152 the normalizer emitted no holder-kind condition and left CREATURE_TYPE unsupported.
    const beforeHolderConditions = (restrictions: Restrictions): Restrictions =>
      restrictions.map(({ conditions }) => ({
        conditions: conditions.flatMap((condition) =>
          condition.kind === 'HOLDER_KIND'
            ? []
            : [
                condition.kind === 'CREATURE_TYPE'
                  ? { ...condition, kind: 'UNSUPPORTED' as const }
                  : condition
              ]
        )
      }))
    const withHolderConditions = evaluateWith((restrictions) => restrictions)

    expect(withHolderConditions).toEqual(evaluateWith(beforeHolderConditions))
    expect(withHolderConditions.derivedStats.armorClass.effective).toBe(15)
    expect(
      withHolderConditions.grantFold.modifiers.find(({ grantId }) => grantId === 'can-act')
    ).toMatchObject({
      deferredRequirements: [
        { conditions: [{ conditionId: 'can-act-predicate', kind: 'CAN_ACT' }] }
      ]
    })
  })

  it('an Equipment context becomes an attacking-item condition', () => {
    const [group] = normalizeCharacterGrantRestrictions({
      id: 'facet',
      groups: [
        {
          id: 'group',
          order: 0,
          contexts: [
            {
              id: 'context',
              order: 0,
              subject: 'EQUIPMENT',
              authoringModeKind: 'ALL',
              conditions: [
                {
                  id: 'melee',
                  order: 0,
                  kind: 'PREDICATE',
                  constraint: 'INCLUDE',
                  predicateCode: 'EQUIPMENT_PROPERTY',
                  authoringModeKind: 'SELECTED',
                  properties: ['MELEE']
                }
              ]
            }
          ]
        }
      ]
    })
    expect(group!.conditions.map((condition) => condition.kind)).toEqual(['ITEM_PROPERTY'])
  })

  it('"only weapon wielded" becomes an attacking-item condition on the other equipped weapons', () => {
    const [group] = normalizeCharacterGrantRestrictions({
      id: 'facet',
      groups: [
        {
          id: 'group',
          order: 0,
          contexts: [
            {
              id: 'context',
              order: 0,
              subject: 'EQUIPMENT',
              authoringModeKind: 'ALL',
              conditions: [
                {
                  id: 'sole',
                  order: 0,
                  kind: 'PREDICATE',
                  constraint: 'INCLUDE',
                  predicateCode: 'SOLE_WIELDED_WEAPON'
                }
              ]
            }
          ]
        }
      ]
    })
    const modifier = {
      sourceId: 'dueling',
      scope: 'GLOBAL' as const,
      deferredRequirements: [group!]
    }
    const item = {
      equipmentIds: ['longsword'],
      category: 'WEAPON',
      properties: ['MELEE'],
      grip: 'ONE_HANDED' as const
    }
    const target = (otherWeaponEquipped: boolean) => ({
      sourceIds: [],
      item: { ...item, otherWeaponEquipped },
      spell: null,
      attackAbility: null,
      activation: null
    })
    expect(group!.conditions.map((condition) => condition.kind)).toEqual(['ITEM_SOLE_WEAPON'])
    expect(dnd5eModifierApplies(modifier, target(false))).toBe(true)
    expect(dnd5eModifierApplies(modifier, target(true))).toBe(false)
    expect(dnd5eModifierApplies(modifier, DND5E_CHARACTER_WIDE_TARGET)).toBe(false)
  })

  const damageOutcome = (
    pathCode: string,
    damageTypeId: string,
    dice: string,
    amountKind: 'HALF' | null = null
  ) => ({
    kind: 'DAMAGE' as const,
    pathCode,
    label: null,
    damageTypeId,
    valueKind: 'DICE' as const,
    scalingKind: 'NONE' as const,
    scalingSource: null,
    classId: null,
    amountKind,
    amountMultiplier: null,
    values: [
      {
        level: null,
        order: 0,
        amount: null,
        dice,
        halfHitPointsDice: null,
        multiplier: null,
        minimum: null,
        maximum: null
      }
    ],
    bonuses: []
  })
  const spellEffect = (
    spellId: string,
    spell: { level: number; magicSchoolId: string; triggerCode: string },
    outcomes: ReturnType<typeof damageOutcome>[]
  ) => ({
    spellId,
    level: spell.level,
    magicSchoolId: spell.magicSchoolId,
    readsCastLevel: false,
    effects: [
      {
        effectId: spellId === 'eldritch-blast' ? EB_EFFECT : FB_EFFECT,
        mechanicFacts: {
          invocation: {
            triggerCode: spell.triggerCode,
            activation: null,
            range: { rangeKind: 'DISTANCE', amount: 120, longAmount: null, unit: 'FEET' as const },
            savingThrow: null,
            reactionTrigger: null
          },
          outcomes
        }
      }
    ]
  })
  /** A spell DAMAGE bonus restricted by one authored SPELL context, folded by the real normalizer. */
  const spellDamageBonus = (
    sourceId: string,
    value: number,
    context: Extract<FacetAuthored['groups'][number]['contexts'][number], { subject: 'SPELL' }>
  ) => ({
    sourceId,
    value,
    ability: null,
    state: 'APPLIED' as const,
    scope: 'GLOBAL' as const,
    deferredRequirements: normalizeCharacterGrantRestrictions({
      id: `${sourceId}:facet`,
      groups: [{ id: `${sourceId}:group`, order: 0, contexts: [context] }]
    })
  })
  const spellDamage = (
    spellEffects: ReturnType<typeof spellEffect>[],
    contributions: ReturnType<typeof spellDamageBonus>[]
  ) => {
    const output = evaluateDnd5e2014CharacterActions({
      ...noActionSources,
      spellEffects,
      activeSourceIds: [],
      activeEquipmentInstanceIds: [],
      resources: [],
      modifierGroups: [
        { domainKey: 'DAMAGE:ABILITY_MODIFIER_BONUS|attackDomain=SPELL', contributions }
      ],
      totalLevel: 1,
      classLevels: [],
      proficiencyBonus: 2,
      abilities: [],
      skills: [],
      spellcasting: { saveDc: 13, attackBonus: 5 }
    })
    return (spellId: string) => {
      const mechanic = output.spellReferenceMechanics.find((entry) => entry.spellId === spellId)!
        .mechanics[0]!
      return {
        attackKind: mechanic.attackKind,
        damage: mechanic.outcomes.flatMap((outcome) =>
          outcome.kind === 'DAMAGE' ? [`${outcome.pathCode} ${outcome.expression}`] : []
        )
      }
    }
  }
  const evocationOnly = {
    id: 'evocation',
    order: 0,
    subject: 'SPELL' as const,
    authoringModeKind: 'ALL' as const,
    conditions: [
      {
        id: 'school',
        order: 0,
        kind: 'PREDICATE' as const,
        constraint: 'INCLUDE' as const,
        predicateCode: 'MAGIC_SCHOOL' as const,
        authoringModeKind: 'SELECTED' as const,
        magicSchoolIds: ['evocation']
      }
    ]
  }
  const fireOnly = {
    id: 'fire',
    order: 0,
    subject: 'SPELL' as const,
    authoringModeKind: 'ALL' as const,
    conditions: [
      {
        id: 'damage-type',
        order: 0,
        kind: 'PREDICATE' as const,
        constraint: 'INCLUDE' as const,
        predicateCode: 'DAMAGE_TYPE' as const,
        authoringModeKind: 'SELECTED' as const,
        damageTypeIds: ['fire']
      }
    ]
  }
  const fireball = spellEffect(
    'fireball',
    { level: 3, magicSchoolId: 'evocation', triggerCode: 'SAVING_THROW' },
    [
      damageOutcome('ON_SAVE_FAIL', 'fire', '8d6'),
      damageOutcome('ON_SAVE_SUCCESS', 'fire', '8d6', 'HALF')
    ]
  )

  it('a spell-scoped damage modifier (Agonizing Blast) adds only to that spell', () => {
    const cantrip = (spellId: string) =>
      spellEffect(
        spellId,
        { level: 0, magicSchoolId: 'evocation', triggerCode: 'RANGED_SPELL_ATTACK' },
        [damageOutcome('ON_HIT', 'force', '1d10')]
      )
    const damage = spellDamage(
      [cantrip('eldritch-blast'), cantrip('fire-bolt')],
      [
        spellDamageBonus('agonizing-blast', 3, {
          id: 'eldritch-blast',
          order: 0,
          subject: 'SPELL',
          authoringModeKind: 'SELECTED',
          spellIds: ['eldritch-blast']
        })
      ]
    )
    expect(damage('eldritch-blast')).toEqual({
      attackKind: 'RANGED_SPELL',
      damage: ['ON_HIT 1d10 + 3']
    })
    expect(damage('fire-bolt').damage).toEqual(['ON_HIT 1d10'])
  })

  it('a school-scoped bonus (Empowered Evocation) adds to a save spell, halved with it on a success', () => {
    const sleepyBolt = spellEffect(
      'sleepy-bolt',
      { level: 1, magicSchoolId: 'enchantment', triggerCode: 'SAVING_THROW' },
      [damageOutcome('ON_SAVE_FAIL', 'psychic', '3d6')]
    )
    const damage = spellDamage(
      [fireball, sleepyBolt],
      [spellDamageBonus('empowered-evocation', 4, evocationOnly)]
    )
    expect(damage('fireball').damage).toEqual([
      'ON_SAVE_FAIL 8d6 + 4',
      'ON_SAVE_SUCCESS half of 8d6 + 4'
    ])
    expect(damage('sleepy-bolt').damage).toEqual(['ON_SAVE_FAIL 3d6'])
  })

  it('a typed bonus (Elemental Affinity) adds once to the first roll of its type on each path', () => {
    const flameArrow = spellEffect(
      'flame-arrow',
      { level: 1, magicSchoolId: 'conjuration', triggerCode: 'RANGED_SPELL_ATTACK' },
      [
        damageOutcome('ON_HIT', 'piercing', '1d10'),
        damageOutcome('ON_HIT', 'fire', '2d6'),
        damageOutcome('ON_HIT', 'fire', '1d4')
      ]
    )
    const coldSnap = spellEffect(
      'cold-snap',
      { level: 1, magicSchoolId: 'evocation', triggerCode: 'SAVING_THROW' },
      [damageOutcome('ON_SAVE_FAIL', 'cold', '2d8')]
    )
    const damage = spellDamage(
      [flameArrow, fireball, coldSnap],
      [
        spellDamageBonus('elemental-affinity', 3, fireOnly),
        { ...spellDamageBonus('untyped', 2, fireOnly), deferredRequirements: [] }
      ]
    )
    // The untyped bonus rides the path's first damage roll; the fire bonus its first fire roll.
    expect(damage('flame-arrow').damage).toEqual([
      'ON_HIT 1d10 + 2',
      'ON_HIT 2d6 + 3',
      'ON_HIT 1d4'
    ])
    expect(damage('fireball').damage).toEqual([
      'ON_SAVE_FAIL 8d6 + 5',
      'ON_SAVE_SUCCESS half of 8d6 + 5'
    ])
    expect(damage('cold-snap').damage).toEqual(['ON_SAVE_FAIL 2d8 + 2'])
  })
})

describe('D&D 5e healing', () => {
  it('rounds a per-level healing pool multiplier down, as damage multipliers are', () => {
    const output = evaluateDnd5e2014CharacterActions({
      ...noActionSources,
      spellEffects: [
        {
          spellId: 'mending-touch',
          level: 3,
          magicSchoolId: 'evocation',
          readsCastLevel: false,
          effects: [
            {
              effectId: FB_EFFECT,
              mechanicFacts: {
                invocation: {
                  triggerCode: 'ACTIVATED',
                  activation: null,
                  range: { rangeKind: 'TOUCH', amount: null, longAmount: null, unit: null },
                  savingThrow: null,
                  reactionTrigger: null
                },
                outcomes: [
                  {
                    kind: 'HEAL',
                    pathCode: 'ON_USE',
                    label: null,
                    valueKind: 'POOL',
                    scalingKind: 'PER_LEVEL',
                    scalingSource: 'CHARACTER_LEVEL',
                    classId: null,
                    temporary: false,
                    // Half the Character's level: 3.5 at level 7, rounded down to 3.
                    values: [
                      {
                        level: null,
                        order: 0,
                        amount: 0,
                        dice: null,
                        multiplier: 0.5,
                        minimum: null,
                        maximum: null
                      }
                    ],
                    bonuses: []
                  }
                ]
              }
            }
          ]
        }
      ],
      activeSourceIds: [],
      activeEquipmentInstanceIds: [],
      resources: [],
      modifierGroups: [],
      totalLevel: 7,
      classLevels: [],
      proficiencyBonus: 3,
      abilities: [],
      skills: [],
      spellcasting: null
    })
    const [heal] = output.spellReferenceMechanics[0]!.mechanics[0]!.outcomes
    expect(heal).toMatchObject({ kind: 'HEAL', expression: '3' })
  })
})

describe('D&D 5e spell save DC', () => {
  const saveDc = (input: Parameters<typeof evaluateSrdCharacter>[0]) =>
    evaluateSrdCharacter(input).output.derivedStats.spellcasting?.saveDc.effective

  it('is 8 plus the proficiency bonus plus the modifier of the class spellcasting ability', () => {
    // Intelligence +3 is the only modifier that gives 13: Constitution +2, Wisdom +1, the rest -1 or lower.
    expect(
      saveDc({
        abilities: {
          INTELLIGENCE: 16,
          CONSTITUTION: 14,
          WISDOM: 12,
          STRENGTH: 8,
          DEXTERITY: 8,
          CHARISMA: 8
        },
        classes: [{ label: 'Wizard', level: 1 }]
      })
    ).toBe(8 + 2 + 3)
    // A Cleric casts with Wisdom: the higher Intelligence does not count.
    expect(
      saveDc({
        abilities: { WISDOM: 14, INTELLIGENCE: 18 },
        classes: [{ label: 'Cleric', level: 1 }]
      })
    ).toBe(8 + 2 + 2)
  })
})
