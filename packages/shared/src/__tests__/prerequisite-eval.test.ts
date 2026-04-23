import { describe, expect, it } from 'vitest'

import type {
  CharacterAssemblyRegistry,
  CharacterBuildState,
  FacetAuthored
} from '@artificer-toolkit/shared'
import { evaluateFeatPrerequisites } from '@artificer-toolkit/shared'

function makeBuildState(
  overrides: Partial<CharacterBuildState> = {}
): CharacterBuildState {
  return {
    characterId: 'char-1',
    systemId: 'system-1',
    streamVersion: 1,
    name: 'Tester',
    classes: [],
    abilityScores: {},
    abilityGenerationMethod: 'STANDARD_ARRAY',
    hitpointsByLevel: [],
    featureSelections: [],
    featRefs: [],
    spellRefs: [],
    ownedEquipment: [],
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
      makeBuildState({
        raceRef: { contentId: 'race-elf', systemId: 'system-1' }
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
      makeBuildState({
        raceRef: { contentId: 'race-homebrew-sun-elf', systemId: 'system-1' }
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
      makeBuildState({
        raceRef: { contentId: 'race-elf', systemId: 'system-1' },
        subraceRef: { contentId: 'race-high-elf', systemId: 'system-1' }
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
      makeBuildState({
        raceRef: { contentId: 'race-human', systemId: 'system-1' }
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
})
