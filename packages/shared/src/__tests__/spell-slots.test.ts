import { describe, expect, it } from 'vitest'
import type { CharacterAssemblyRegistry } from '../domains/engine/registry.js'
import type { CharacterBuildSnapshot } from '../domains/engine/snapshot.js'
import { resolveSpellSlots } from '../domains/engine/resolution/spellSlotResolver.js'
import { CHARGE_RESET_KIND } from '../domains/shared/core/charge.js'
import { SCALING } from '../domains/shared/core/scaling.js'
import { CLASS_CATEGORY } from '../domains/subjects/core/class.js'
import type { CompiledClass } from '../domains/subjects/compilers/class.js'

function createSnapshot(classes: CharacterBuildSnapshot['classes']): CharacterBuildSnapshot {
  return {
    characterId: 'character-1',
    systemId: 'system-1',
    totalLevel: classes.reduce((total, entry) => total + entry.level, 0),
    classes,
    abilities: {},
    hitpoints: [],
    features: [],
    equipmentItems: []
  }
}

function createRegistry(classes: CompiledClass[]): CharacterAssemblyRegistry {
  return {
    classes: Object.fromEntries(classes.map((record) => [record.id, record])),
    features: {},
    feats: {},
    races: {},
    equipment: {},
    spells: {}
  }
}

function createCasterClass(params: {
  id: string
  resetKind: typeof CHARGE_RESET_KIND.LONG_REST | typeof CHARGE_RESET_KIND.SHORT_REST
  spellLimits: NonNullable<CompiledClass['spellcasting']>['spellLimits']
  maxSpellLevel?: number
}): CompiledClass {
  return {
    id: params.id,
    category: CLASS_CATEGORY.BASE,
    spellcasting: {
      spellLimits: params.spellLimits,
      maxSpellLevel: params.maxSpellLevel ?? 9,
      charges: {
        id: `${params.id}-spellcasting-charge`,
        resetKind: params.resetKind,
        limitKind: 'FIXED_AMOUNT',
        scalingKind: SCALING.NONE,
        amount: 1
      }
    },
    startingGold: {
      multiplier: 1,
      currencyId: 'gp',
      dieConfig: '1d4'
    },
    startingEquipment: {
      id: `${params.id}-equipment`,
      sets: []
    },
    hitpoint: {
      ability: 'CONSTITUTION',
      dieConfig: '1d8'
    },
    multiclass: {
      id: `${params.id}-multiclass`,
      requirementGroups: {
        id: `${params.id}-requirements`,
        groups: []
      }
    }
  }
}

function createFullCasterSpellLimits(): NonNullable<CompiledClass['spellcasting']>['spellLimits'] {
  return [
    { classLevel: 1, slots: [{ spellLevel: 1, slotCount: 2 }] },
    { classLevel: 17, slots: [{ spellLevel: 9, slotCount: 1 }] }
  ]
}

describe('spell slot resolver', () => {
  it('fuses standard multiclass spell slots instead of summing class rows', () => {
    const registry = createRegistry([
      createCasterClass({
        id: 'wizard',
        resetKind: CHARGE_RESET_KIND.LONG_REST,
        spellLimits: createFullCasterSpellLimits()
      }),
      createCasterClass({
        id: 'cleric',
        resetKind: CHARGE_RESET_KIND.LONG_REST,
        spellLimits: createFullCasterSpellLimits()
      })
    ])

    const slots = resolveSpellSlots(createSnapshot([
      { classId: 'wizard', level: 1 },
      { classId: 'cleric', level: 1 }
    ]), registry)

    expect(slots.fusionStrategy).toBe('MULTICLASS_FUSED')
    expect(slots.maxByLevel).toEqual({ 1: 3 })
    expect(slots.pactMagic).toBeUndefined()
  })

  it('keeps short-rest pact magic separate from standard slots', () => {
    const registry = createRegistry([
      createCasterClass({
        id: 'warlock',
        resetKind: CHARGE_RESET_KIND.SHORT_REST,
        spellLimits: [{ classLevel: 1, slots: [{ spellLevel: 1, slotCount: 1 }] }]
      })
    ])

    const slots = resolveSpellSlots(createSnapshot([{ classId: 'warlock', level: 1 }]), registry)

    expect(slots.maxByLevel).toEqual({})
    expect(slots.pactMagic).toEqual({ slots: 1, level: 1 })
  })
})
