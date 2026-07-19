import { describe, expect, it } from 'vitest'

import type {
  CharacterAssemblyRegistry,
  CharacterEligibilityContext,
  FacetAuthored
} from '@artificer-toolkit/shared'
import { evaluateCharacterFacet, evaluateFeatPrerequisites } from '@artificer-toolkit/shared'

function makeEligibilityContext(
  overrides: Partial<CharacterEligibilityContext> = {}
): CharacterEligibilityContext {
  return {
    systemId: 'system-1',
    classes: [],
    abilityScores: {},
    featIds: [],
    spellIds: [],
    ...overrides
  }
}

function makeRegistry(): CharacterAssemblyRegistry {
  return {
    features: {},
    classes: {},
    feats: {},
    races: {},
    equipment: {},
    spells: {}
  }
}

function makeHeritagePrerequisite(heritageIds: string[]): FacetAuthored<'CHARACTER'> {
  return {
    id: 'feat-prerequisite',
    groups: [
      {
        id: 'group-1',
        order: 1,
        contexts: [
          {
            id: 'context-1',
            order: 1,
            subject: 'CHARACTER',
            conditions: [
              {
                id: 'condition-1',
                order: 1,
                kind: 'PREDICATE',
                constraint: 'INCLUDE',
                predicateCode: 'HERITAGE',
                authoringModeKind: 'SELECTED',
                heritageIds
              }
            ]
          }
        ]
      }
    ]
  }
}

describe('evaluateFeatPrerequisites', () => {
  it('keeps equipment-property proficiency category scope while preserving unscoped matching', () => {
    const makePropertyFacet = (category?: 'ARMOR' | 'WEAPON'): FacetAuthored<'CHARACTER'> => ({
      id: `heavy-${category ?? 'any'}-eligibility`,
      groups: [{
        id: `heavy-${category ?? 'any'}-group`,
        order: 1,
        contexts: [{
          id: `heavy-${category ?? 'any'}-context`,
          order: 1,
          subject: 'CHARACTER',
          conditions: [{
            id: `heavy-${category ?? 'any'}-condition`,
            order: 1,
            kind: 'PREDICATE',
            constraint: 'INCLUDE',
            predicateCode: 'EQUIPMENT_PROPERTY_PROFICIENCY',
            authoringModeKind: 'SELECTED',
            ...(category ? { category } : {}),
            properties: ['HEAVY']
          }]
        }]
      }]
    })
    const context = makeEligibilityContext({
      proficiencies: [{
        kind: 'EQUIPMENT_PROPERTY',
        subjectId: 'HEAVY',
        category: 'WEAPON',
        scaling: 'FULL'
      }]
    })

    expect(evaluateCharacterFacet(makePropertyFacet('ARMOR'), context, makeRegistry()).passed).toBe(false)
    expect(evaluateCharacterFacet(makePropertyFacet('WEAPON'), context, makeRegistry()).passed).toBe(true)
    expect(evaluateCharacterFacet(makePropertyFacet(), context, makeRegistry()).passed).toBe(true)
  })

  it('requires the authored minimum proficiency scaling for exact equipment', () => {
    const facet: FacetAuthored<'CHARACTER'> = {
      id: 'chain-mail-eligibility',
      groups: [{
        id: 'chain-mail-group',
        order: 1,
        contexts: [{
          id: 'chain-mail-context',
          order: 1,
          subject: 'CHARACTER',
          conditions: [{
            id: 'chain-mail-condition',
            order: 1,
            kind: 'PREDICATE',
            constraint: 'INCLUDE',
            predicateCode: 'EQUIPMENT_PROFICIENCY',
            authoringModeKind: 'SELECTED',
            equipmentIds: ['chain-mail'],
            level: 'FULL'
          }]
        }]
      }]
    }
    const evaluate = (scaling: 'HALF' | 'FULL' | 'DOUBLE') => evaluateCharacterFacet(
      facet,
      makeEligibilityContext({
        proficiencies: [{
          kind: 'EQUIPMENT',
          subjectId: 'chain-mail',
          scaling
        }]
      }),
      makeRegistry()
    ).passed

    expect(evaluate('HALF')).toBe(false)
    expect(evaluate('FULL')).toBe(true)
    expect(evaluate('DOUBLE')).toBe(true)
  })

  it('passes for a character whose race has the required heritage', () => {
    const registry = makeRegistry()
    registry.races['race-elf'] = {
      id: 'race-elf',
      category: 'BASE',
      selectionMode: 'REQUIRES_SUBRACE',
      size: 'MEDIUM',
      speeds: [],
      heritageIds: ['heritage-elven']
    }

    const result = evaluateFeatPrerequisites(
      makeHeritagePrerequisite(['heritage-elven']),
      makeEligibilityContext({
        raceId: 'race-elf'
      }),
      registry
    )

    expect(result).toEqual({
      passed: true,
      failedRequirements: []
    })
  })

  it('passes for a custom user race tagged with the required heritage', () => {
    const registry = makeRegistry()
    registry.races['race-homebrew-sun-elf'] = {
      id: 'race-homebrew-sun-elf',
      category: 'BASE',
      selectionMode: 'DIRECT',
      size: 'MEDIUM',
      speeds: [],
      heritageIds: ['heritage-elven']
    }

    const result = evaluateFeatPrerequisites(
      makeHeritagePrerequisite(['heritage-elven']),
      makeEligibilityContext({
        raceId: 'race-homebrew-sun-elf'
      }),
      registry
    )

    expect(result.passed).toBe(true)
  })

  it('passes when a subrace inherits the required heritage from its parent race', () => {
    const registry = makeRegistry()
    registry.races['race-elf'] = {
      id: 'race-elf',
      category: 'BASE',
      selectionMode: 'REQUIRES_SUBRACE',
      size: 'MEDIUM',
      speeds: [],
      heritageIds: ['heritage-elven']
    }
    registry.races['race-high-elf'] = {
      id: 'race-high-elf',
      category: 'SUBRACE',
      parentRaceId: 'race-elf',
      size: 'MEDIUM',
      speeds: [],
      heritageIds: ['heritage-arcane-affinity']
    }

    const result = evaluateFeatPrerequisites(
      makeHeritagePrerequisite(['heritage-elven']),
      makeEligibilityContext({
        raceId: 'race-elf',
        subraceId: 'race-high-elf'
      }),
      registry
    )

    expect(result.passed).toBe(true)
  })

  it('fails when the character does not have the required heritage', () => {
    const registry = makeRegistry()
    registry.races['race-human'] = {
      id: 'race-human',
      category: 'BASE',
      selectionMode: 'DIRECT',
      size: 'MEDIUM',
      speeds: [],
      heritageIds: ['heritage-human']
    }

    const result = evaluateFeatPrerequisites(
      makeHeritagePrerequisite(['heritage-elven']),
      makeEligibilityContext({
        raceId: 'race-human'
      }),
      registry
    )

    expect(result.passed).toBe(false)
    expect(result.failedRequirements).toEqual([
      {
        description: 'Heritage',
        required: 'heritage-elven',
        actual: 'heritage-human'
      }
    ])
  })

  it('evaluates class-level prerequisites against the selected class instead of total level', () => {
    const prerequisite: FacetAuthored<'CHARACTER'> = {
      id: 'class-level-prerequisite',
      groups: [{
        id: 'group-1',
        order: 1,
        contexts: [{
          id: 'context-1',
          order: 1,
          subject: 'CHARACTER',
          conditions: [{
            id: 'condition-1',
            order: 1,
            kind: 'PREDICATE',
            constraint: 'INCLUDE',
            predicateCode: 'CLASS_LEVEL',
            classIds: ['fighter'],
            min: 4
          }]
        }]
      }]
    }
    const context = makeEligibilityContext({
      classes: [
        { classId: 'fighter', level: 2 },
        { classId: 'wizard', level: 5 }
      ]
    })

    expect(evaluateFeatPrerequisites(prerequisite, context, makeRegistry())).toEqual({
      passed: false,
      failedRequirements: [{
        description: 'Class Level (fighter)',
        required: '>= 4',
        actual: '2'
      }]
    })
  })

  it('checks obtained features by feature id', () => {
    const prerequisite: FacetAuthored<'CHARACTER'> = {
      id: 'feature-prerequisite',
      groups: [{
        id: 'group-1',
        order: 1,
        contexts: [{
          id: 'context-1',
          order: 1,
          subject: 'CHARACTER',
          conditions: [{
            id: 'condition-1',
            order: 1,
            kind: 'PREDICATE',
            constraint: 'INCLUDE',
            predicateCode: 'FEATURE_OBTAINED',
            featureIds: ['feature-armor-training']
          }]
        }]
      }]
    }

    expect(evaluateFeatPrerequisites(
      prerequisite,
      makeEligibilityContext({ featureIds: ['feature-armor-training'] }),
      makeRegistry()
    ).passed).toBe(true)

    expect(evaluateFeatPrerequisites(
      prerequisite,
      makeEligibilityContext({ spellIds: ['feature-armor-training'] }),
      makeRegistry()
    ).passed).toBe(false)
  })

  it('treats facet groups as alternatives while requiring every condition in a group', () => {
    const prerequisite: FacetAuthored<'CHARACTER'> = {
      id: 'alternative-prerequisite',
      groups: [
        {
          id: 'fighter-group',
          order: 1,
          contexts: [{
            id: 'fighter-context',
            order: 1,
            subject: 'CHARACTER',
            conditions: [{
              id: 'fighter-condition',
              order: 1,
              kind: 'PREDICATE',
              constraint: 'INCLUDE',
              predicateCode: 'CLASS_LEVEL',
              classIds: ['fighter'],
              min: 4
            }]
          }]
        },
        {
          id: 'feature-group',
          order: 2,
          contexts: [{
            id: 'feature-context',
            order: 1,
            subject: 'CHARACTER',
            conditions: [{
              id: 'feature-condition',
              order: 1,
              kind: 'PREDICATE',
              constraint: 'INCLUDE',
              predicateCode: 'FEATURE_OBTAINED',
              featureIds: ['feature-armor-training']
            }]
          }]
        }
      ]
    }

    expect(evaluateFeatPrerequisites(
      prerequisite,
      makeEligibilityContext({
        classes: [{ classId: 'fighter', level: 1 }],
        featureIds: ['feature-armor-training']
      }),
      makeRegistry()
    ).passed).toBe(true)
  })

  it('evaluates carried, equipped, and attuned source state independently', () => {
    const sourceStateFacet = (predicateCode: 'WHILE_SOURCE_CARRIED' | 'WHILE_SOURCE_EQUIPPED' | 'WHILE_SOURCE_ATTUNED'): FacetAuthored<'CHARACTER'> => ({
      id: `${predicateCode}-facet`,
      groups: [{
        id: `${predicateCode}-group`,
        order: 1,
        contexts: [{
          id: `${predicateCode}-context`,
          order: 1,
          subject: 'CHARACTER',
          conditions: [{
            id: `${predicateCode}-condition`,
            order: 1,
            kind: 'PREDICATE',
            constraint: 'INCLUDE',
            predicateCode
          }]
        }]
      }]
    })

    const context = makeEligibilityContext({
      sourceState: { carried: true, equipped: false, attuned: true }
    })

    expect(evaluateCharacterFacet(sourceStateFacet('WHILE_SOURCE_CARRIED'), context, makeRegistry()).passed).toBe(true)
    expect(evaluateCharacterFacet(sourceStateFacet('WHILE_SOURCE_EQUIPPED'), context, makeRegistry()).passed).toBe(false)
    expect(evaluateCharacterFacet(sourceStateFacet('WHILE_SOURCE_ATTUNED'), context, makeRegistry()).passed).toBe(true)
  })
})
