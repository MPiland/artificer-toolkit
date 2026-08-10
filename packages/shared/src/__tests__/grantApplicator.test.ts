import { describe, expect, it } from 'vitest'

import type { ValueDomainCode } from '../domains/core/valueDomain.js'
import type { CharacterAssemblyRegistry } from '../domains/engine/registry.js'
import type { CharacterBuildSnapshot } from '../domains/engine/snapshot.js'
import { dnd5e2014RulesSystem } from '../domains/engine/dnd5e2014/index.js'
import { applyGrants } from '../domains/engine/resolution/grantApplicator.js'
import { resolveModifiers } from '../domains/engine/resolution/modifierResolver.js'
import type { CompiledModifierGrant } from '../domains/grants/compilers/modifier.js'
import { CLASS_CATEGORY } from '../domains/subjects/core/class.js'
import type { CompiledBackground } from '../domains/subjects/compilers/background.js'
import type { CompiledClass } from '../domains/subjects/compilers/class.js'

function makeSnapshot(overrides: Partial<CharacterBuildSnapshot> = {}): CharacterBuildSnapshot {
  return {
    characterId: 'character',
    systemId: 'dnd5e2014',
    totalLevel: 1,
    classes: [],
    abilities: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
    hitpoints: [],
    features: [],
    equipmentItems: [],
    ...overrides
  }
}

function initiativeModifier(id: string, amount: number): CompiledModifierGrant {
  return {
    id,
    grantKind: 'MODIFIER_GRANT',
    order: 0,
    selectionKind: 'GRANTED',
    valueDomainCode: 'INITIATIVE',
    domain: {},
    modifierKind: 'BONUS',
    scope: 'GLOBAL',
    payload: { valueKind: 'FIXED', amount }
  }
}

function makeClassRoot(): CompiledClass & { modifiers: CompiledModifierGrant[] } {
  return {
    id: 'fighter',
    category: CLASS_CATEGORY.BASE,
    modifiers: [initiativeModifier('class-initiative', 17)],
    startingGold: { multiplier: 1, currencyId: 'gp', dieConfig: '1d4' },
    startingEquipment: { id: 'fighter-equipment', sets: [] },
    hitpoint: { ability: 'CONSTITUTION', dieConfig: '1d10' },
    multiclass: {
      id: 'fighter-multiclass',
      requirementGroups: { id: 'fighter-requirements', groups: [] }
    }
  }
}

function makeBaseClassRoot(
  id: string,
  modifierId: string
): CompiledClass & { modifiers: CompiledModifierGrant[] } {
  return {
    id,
    category: CLASS_CATEGORY.BASE,
    modifiers: [initiativeModifier(modifierId, 1)],
    startingGold: { multiplier: 1, currencyId: 'gp', dieConfig: '1d4' },
    startingEquipment: { id: `${id}-equipment`, sets: [] },
    hitpoint: { ability: 'CONSTITUTION', dieConfig: '1d8' },
    multiclass: {
      id: `${id}-multiclass`,
      requirementGroups: { id: `${id}-requirements`, groups: [] }
    }
  }
}

function makeSubclassRoot(
  id: string,
  parentClassId: string,
  modifierId: string
): CompiledClass & { modifiers: CompiledModifierGrant[] } {
  return {
    id,
    category: CLASS_CATEGORY.SUBCLASS,
    parentClassId,
    modifiers: [initiativeModifier(modifierId, 1)]
  }
}

function makeBackgroundRoot(): CompiledBackground & { modifiers: CompiledModifierGrant[] } {
  return {
    id: 'soldier',
    modifiers: [initiativeModifier('background-initiative', 13)]
  }
}

function makeRegistry(): CharacterAssemblyRegistry {
  return {
    classes: {},
    equipment: {},
    feats: {},
    races: {},
    spells: {},
    features: {
      'race-feature': {
        modifiers: [
          {
            id: 'race-initiative',
            grantKind: 'MODIFIER_GRANT',
            order: 0,
            selectionKind: 'GRANTED',
            valueDomainCode: 'INITIATIVE',
            domain: {},
            modifierKind: 'BONUS',
            scope: 'GLOBAL',
            payload: { valueKind: 'FIXED', amount: 13 }
          }
        ]
      },
      'feat-feature': {
        modifiers: [
          {
            id: 'feat-initiative',
            grantKind: 'MODIFIER_GRANT',
            order: 0,
            selectionKind: 'GRANTED',
            valueDomainCode: 'INITIATIVE',
            domain: {},
            modifierKind: 'BONUS',
            scope: 'GLOBAL',
            payload: { valueKind: 'FIXED', amount: 17 }
          }
        ]
      }
    }
  }
}

describe('applyGrants source scheduling', () => {
  it('uses configured source order for root-source last-wins modifiers', () => {
    const snapshot = makeSnapshot({
      classes: [{ classId: 'fighter', level: 1 }],
      backgroundId: 'soldier'
    })
    const rules = {
      ...dnd5e2014RulesSystem,
      featureSourceOrder: ['BACKGROUND', 'CLASS'],
      stackingConfig: (domain: ValueDomainCode, modifierKind: string) =>
        domain === 'INITIATIVE' && modifierKind === 'BONUS'
          ? { rule: 'last' as const }
          : dnd5e2014RulesSystem.stackingConfig(domain, modifierKind)
    }

    const accumulated = applyGrants(
      snapshot,
      {
        ...makeRegistry(),
        backgrounds: { soldier: makeBackgroundRoot() },
        classes: { fighter: makeClassRoot() }
      },
      rules,
      []
    )

    expect(accumulated.modifierEntries.map((entry) => entry.grant.id)).toEqual([
      'background-initiative',
      'class-initiative'
    ])
    expect(resolveModifiers(accumulated.modifierEntries, rules)['INITIATIVE:BONUS']).toBe(17)
  })

  it('fails closed when an active source kind is not configured', () => {
    const snapshot = makeSnapshot({
      features: [
        {
          featureId: 'race-feature',
          source: { kind: 'RACE', raceId: 'race' },
          timing: { kind: 'IMMEDIATE' }
        }
      ]
    })

    expect(() =>
      applyGrants(snapshot, makeRegistry(), { ...dnd5e2014RulesSystem, featureSourceOrder: [] }, [])
    ).toThrow('RulesSystem.featureSourceOrder is missing active source kind "RACE".')
  })

  it('pairs each selected subclass with its owning class progression', () => {
    const snapshot = makeSnapshot({
      classes: [
        { classId: 'fighter', level: 1, subclassId: 'champion' },
        { classId: 'wizard', level: 1, subclassId: 'evoker' }
      ]
    })

    const accumulated = applyGrants(
      snapshot,
      {
        ...makeRegistry(),
        classes: {
          fighter: makeBaseClassRoot('fighter', 'fighter-root'),
          champion: makeSubclassRoot('champion', 'fighter', 'champion-root'),
          wizard: makeBaseClassRoot('wizard', 'wizard-root'),
          evoker: makeSubclassRoot('evoker', 'wizard', 'evoker-root')
        }
      },
      { ...dnd5e2014RulesSystem, featureSourceOrder: ['CLASS', 'SUBCLASS'] },
      []
    )

    expect(accumulated.modifierEntries.map((entry) => entry.grant.id)).toEqual([
      'fighter-root',
      'champion-root',
      'wizard-root',
      'evoker-root'
    ])
  })

  it('source-ranks acquired class and subclass feature records independently', () => {
    const snapshot = makeSnapshot({
      features: [
        {
          featureId: 'subclass-feature',
          source: { kind: 'SUBCLASS', subclassId: 'champion' },
          timing: { kind: 'IMMEDIATE' }
        },
        {
          featureId: 'class-feature',
          source: { kind: 'CLASS', classId: 'fighter' },
          timing: { kind: 'IMMEDIATE' }
        }
      ]
    })
    const rules = {
      ...dnd5e2014RulesSystem,
      featureSourceOrder: ['CLASS', 'SUBCLASS'],
      stackingConfig: (domain: ValueDomainCode, modifierKind: string) =>
        domain === 'INITIATIVE' && modifierKind === 'BONUS'
          ? { rule: 'last' as const }
          : dnd5e2014RulesSystem.stackingConfig(domain, modifierKind)
    }

    const accumulated = applyGrants(
      snapshot,
      {
        ...makeRegistry(),
        features: {
          'class-feature': { modifiers: [initiativeModifier('class-feature-root', 13)] },
          'subclass-feature': { modifiers: [initiativeModifier('subclass-feature-root', 17)] }
        }
      },
      rules,
      []
    )

    expect(accumulated.modifierEntries.map((entry) => entry.grant.id)).toEqual([
      'class-feature-root',
      'subclass-feature-root'
    ])
    expect(resolveModifiers(accumulated.modifierEntries, rules)['INITIATIVE:BONUS']).toBe(17)
  })

  it('requires adjacent class and subclass source ranks for paired progression', () => {
    const snapshot = makeSnapshot({
      classes: [{ classId: 'fighter', level: 1, subclassId: 'champion' }]
    })

    expect(() =>
      applyGrants(
        snapshot,
        {
          ...makeRegistry(),
          classes: {
            fighter: makeBaseClassRoot('fighter', 'fighter-root'),
            champion: makeSubclassRoot('champion', 'fighter', 'champion-root')
          }
        },
        {
          ...dnd5e2014RulesSystem,
          featureSourceOrder: ['CLASS', 'BACKGROUND', 'SUBCLASS']
        },
        []
      )
    ).toThrow(
      'RulesSystem.featureSourceOrder must place "SUBCLASS" immediately after "CLASS" for paired class progression.'
    )
  })
})
