import { describe, expect, it } from 'vitest'
import { activeRuleEffectDefinitionDtoSchema } from '@artificer-toolkit/schema/shared/activeRuleEffects'
import type { EquipmentAuthored } from '@artificer-toolkit/shared/subjects/authored'
import {
  conditionTypeId,
  equipId,
  meleeWeaponAbilityModifiers
} from '@artificer-toolkit/source-data/srd/equipment/shared.js'
import { signetRing } from '@artificer-toolkit/source-data/srd/equipment/signet-ring.js'
import {
  SRD_ABILITY_DEFINITION_IDS,
  SRD_DAMAGE_TYPES
} from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { resolveCharacterRulePolicyRollModes } from '../character/characterRuleRollProjection.js'
import {
  encounterGrantsEnabledDomain,
  withCharacterActiveGrants
} from '../encounterActiveGrants.js'
import { evaluateDnd5e2014CharacterActions } from '../systems/dnd5e/characterActions.js'
import { evaluateDnd5e2014CharacterPolicy } from '../systems/dnd5e/characterPolicy.js'
import { rageEffect } from './antitoxinEffectFixture.js'
import {
  damageExpression,
  evaluateSrdCharacter,
  itemAction,
  vocabulary,
  type SrdCharacter
} from '../testing/dnd5eSrdCharacter.js'

const HOLDER_ID = '00000000-0000-4000-8000-00000000b901'
const EFFECT_ID = '00000000-0000-4000-8000-00000000b902'
const rage = () => rageEffect({ id: EFFECT_ID, holderActorId: HOLDER_ID })
const damageTypeId = (code: string) => SRD_DAMAGE_TYPES.find((type) => type.code === code)?.id

/** A worn charm whose Character-wide Charisma bonus on melee attack rolls is not a weapon's own. */
const charismaCharm: EquipmentAuthored = {
  ...signetRing,
  id: equipId(900),
  label: 'Charisma Charm',
  modifiers: meleeWeaponAbilityModifiers(equipId(900))
    .slice(0, 1)
    .map((modifier) => ({
      ...modifier,
      scope: 'GLOBAL' as const,
      payload: { ability: 'CHARISMA' as const }
    }))
}

const barbarian = (input: {
  level: number
  abilities?: Parameters<typeof evaluateSrdCharacter>[0]['abilities']
  items?: Parameters<typeof evaluateSrdCharacter>[0]['items']
}) =>
  evaluateSrdCharacter({
    classes: [{ label: 'Barbarian', level: input.level }],
    abilities: { STRENGTH: 16, ...input.abilities },
    items: input.items ?? []
  })

/** The Character's policy with the Rage grant held (or not), rolls projected as the Sheet reads them. */
const policy = (character: SrdCharacter, raging: boolean) =>
  resolveCharacterRulePolicyRollModes(
    evaluateDnd5e2014CharacterPolicy(
      raging ? withCharacterActiveGrants(character.facts, [rage()]) : character.facts
    ),
    vocabulary
  )

/** The damage expression of one item attack under the policy. */
function attackDamage(character: SrdCharacter, label: string, attackKind: string, raging: boolean) {
  const { candidate } = itemAction(character, label, { attackKind })
  const decision = policy(character, raging).actionDecisions.find(
    (entry) => entry.actionId === candidate.actionId
  )
  if (!decision) throw new Error(`No decision for ${label}.`)
  return damageExpression(decision)
}

describe('the Rage active effect', () => {
  it('is a valid persisted grant that ends on an idle turn, while Unconscious, or by its holder', () => {
    const { definition } = rage()
    expect(activeRuleEffectDefinitionDtoSchema.parse(definition)).toEqual(definition)
    expect(definition.recurrence.endTriggers).toEqual([
      { event: 'LIFECYCLE', timing: 'END', code: 'ON_IDLE_TURN' }
    ])
    expect(definition.recurrence.endOnConditionIds).toEqual([conditionTypeId('UNCONSCIOUS')])
    expect(definition.recurrence.holderEnd).toEqual({ activation: 'BONUS_ACTION' })
  })

  it('locks spellcasting while held, and only while held', () => {
    expect(encounterGrantsEnabledDomain([rage()], 'SPELLCASTING_LOCK')).toBe(true)
    expect(encounterGrantsEnabledDomain([], 'SPELLCASTING_LOCK')).toBe(false)
  })
})

describe('the spellcasting lock on spell casts', () => {
  const SPELL_ID = '00000000-0000-4000-8000-00000000b903'
  const SOURCE_ID = '00000000-0000-4000-8000-00000000b904'
  const castDecisions = (spellcastingLocked: boolean) =>
    evaluateDnd5e2014CharacterActions({
      candidates: [],
      abilityDefinitions: [],
      spellCandidates: [
        {
          sequence: 0,
          candidateId: 'cantrip',
          spellId: SPELL_ID,
          source: { spellId: SPELL_ID, sourceKind: 'CLASS', sourceInstanceId: SOURCE_ID },
          spellLevel: 0,
          castMode: 'AT_WILL',
          castLevel: 0,
          baseEntry: false,
          resourceOwnerKey: null,
          slotPoolCode: null
        }
      ],
      spellSlots: [],
      spellEffects: [],
      spellMechanics: [],
      spellcastingLocked,
      proficiencies: [],
      itemAdjustments: [],
      activeSourceIds: [],
      activeEquipmentInstanceIds: [],
      resources: [],
      modifierGroups: [],
      totalLevel: 1,
      classLevels: [],
      proficiencyBonus: 2,
      abilities: [],
      skills: [],
      spellcasting: null
    }).spellCastDecisions.map(({ status, reasonCode }) => ({ status, reasonCode }))

  it('refuses even a cantrip while the lock is held, and allows it otherwise', () => {
    expect(castDecisions(false)).toEqual([{ status: 'AVAILABLE', reasonCode: 'CANTRIP' }])
    expect(castDecisions(true)).toEqual([
      { status: 'UNAVAILABLE', reasonCode: 'SPELLCASTING_LOCKED' }
    ])
  })
})

describe('the Rage damage bonus', () => {
  it.each([
    { level: 1, bonus: 2 },
    { level: 8, bonus: 2 },
    { level: 9, bonus: 3 },
    { level: 15, bonus: 3 },
    { level: 16, bonus: 4 },
    { level: 20, bonus: 4 }
  ])(
    'adds +$bonus to a Strength melee weapon hit at Barbarian level $level',
    ({ level, bonus }) => {
      const character = barbarian({ level, items: [{ label: 'Greataxe' }] })
      expect(attackDamage(character, 'Greataxe', 'MELEE', false)).toBe('1d12 + 3')
      expect(attackDamage(character, 'Greataxe', 'MELEE', true)).toBe(`1d12 + ${3 + bonus}`)
    }
  )

  it('adds nothing to a Dexterity finesse attack', () => {
    const character = barbarian({
      level: 9,
      abilities: { STRENGTH: 10, DEXTERITY: 16 },
      items: [{ label: 'Rapier' }]
    })
    const calm = attackDamage(character, 'Rapier', 'MELEE', false)
    expect(calm).toBe('1d8 + 3')
    expect(attackDamage(character, 'Rapier', 'MELEE', true)).toBe(calm)
  })

  it.each([
    { order: 'Strength first', abilities: { STRENGTH: 16, DEXTERITY: 16 } },
    { order: 'Dexterity first', abilities: { DEXTERITY: 16, STRENGTH: 16 } }
  ])(
    'counts a finesse attack as Strength when both scores tie, whichever is listed ($order)',
    ({ abilities }) => {
      const character = barbarian({ level: 9, abilities, items: [{ label: 'Rapier' }] })
      expect(attackDamage(character, 'Rapier', 'MELEE', false)).toBe('1d8 + 3')
      expect(attackDamage(character, 'Rapier', 'MELEE', true)).toBe('1d8 + 6')
    }
  )

  it('keys on the weapon’s own ability, not a larger ability bonus another source adds', () => {
    const calm = barbarian({
      level: 9,
      abilities: { CHARISMA: 20 },
      items: [{ label: 'Greataxe' }]
    })
    const withCharm = evaluateSrdCharacter({
      classes: [{ label: 'Barbarian', level: 9 }],
      abilities: { STRENGTH: 16, CHARISMA: 20 },
      items: [{ label: 'Greataxe' }, { label: charismaCharm.label, equipped: true }],
      extraEquipment: [charismaCharm]
    })
    const attackBonus = (character: SrdCharacter) =>
      itemAction(character, 'Greataxe', { attackKind: 'MELEE' }).decision.mechanic.attackBonus
    // The charm's Charisma modifier (+5) outweighs Strength (+3) and adds to the attack roll.
    expect(attackBonus(withCharm)).toBe(attackBonus(calm)! + 5)
    expect(attackDamage(withCharm, 'Greataxe', 'MELEE', true)).toBe('1d12 + 6')
  })

  it('adds nothing to a ranged weapon attack, even with a high Strength', () => {
    const character = barbarian({ level: 9, items: [{ label: 'Shortbow' }] })
    const calm = attackDamage(character, 'Shortbow', 'RANGED', false)
    expect(attackDamage(character, 'Shortbow', 'RANGED', true)).toBe(calm)
  })
})

describe('the Rage defenses and Strength advantage', () => {
  const character = barbarian({ level: 9 })
  const { STRENGTH, DEXTERITY } = SRD_ABILITY_DEFINITION_IDS

  it('resists bludgeoning, piercing and slashing damage and no other type', () => {
    const resisted = policy(character, true)
      .defenses.filter((defense) => defense.kind === 'RESISTANCE')
      .map((defense) => defense.damageTypeId)
    expect(resisted).toEqual(
      expect.arrayContaining(['BLUDGEONING', 'PIERCING', 'SLASHING'].map(damageTypeId))
    )
    expect(resisted).not.toContain(damageTypeId('FIRE'))
    expect(policy(character, false).defenses).toEqual([])
  })

  it('rolls Strength saving throws with advantage and Dexterity saves normally', () => {
    const saves = policy(character, true).savingThrowDefinitions
    const rollMode = (abilityDefinitionId: string) =>
      saves.find(
        (save) => save.abilityDefinitionId === abilityDefinitionId && !('conditionTypeId' in save)
      )?.rollMode
    expect(rollMode(STRENGTH)).toBe('ADVANTAGE')
    expect(rollMode(DEXTERITY)).toBe('NORMAL')
  })

  it('rolls Strength ability checks with advantage and Dexterity checks normally', () => {
    const { abilityChecks } = policy(character, true).rollModes
    expect(abilityChecks.STRENGTH).toBe('ADVANTAGE')
    expect(abilityChecks.DEXTERITY).toBe('NORMAL')
    expect(policy(character, false).rollModes.abilityChecks.STRENGTH).toBe('NORMAL')
  })
})

describe('Rage in heavy armor', () => {
  const { STRENGTH } = SRD_ABILITY_DEFINITION_IDS
  const armored = (armor: string) =>
    barbarian({
      level: 9,
      items: [{ label: 'Greataxe' }, { label: armor, equipped: true }]
    })

  it('gives no defense, Strength advantage or damage bonus while heavy armor is worn', () => {
    const character = armored('Chain Mail')
    const raging = policy(character, true)
    expect(raging.defenses.filter((defense) => defense.kind === 'RESISTANCE')).toEqual([])
    expect(
      raging.savingThrowDefinitions.find(
        (save) => save.abilityDefinitionId === STRENGTH && !('conditionTypeId' in save)
      )?.rollMode
    ).toBe('NORMAL')
    expect(raging.rollModes.abilityChecks.STRENGTH).toBe('NORMAL')
    expect(attackDamage(character, 'Greataxe', 'MELEE', true)).toBe('1d12 + 3')
  })

  it('keeps every benefit in medium armor', () => {
    const character = armored('Breastplate')
    const raging = policy(character, true)
    expect(raging.defenses.filter((defense) => defense.kind === 'RESISTANCE')).not.toEqual([])
    expect(raging.rollModes.abilityChecks.STRENGTH).toBe('ADVANTAGE')
    expect(attackDamage(character, 'Greataxe', 'MELEE', true)).toBe('1d12 + 6')
  })
})
