import { describe, expect, it } from 'vitest'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { createEmptyCharacterAuthored, type CharacterBuilderRegistry } from './builderService.js'
import { isCharacterBuilderProvenanceStillValid } from './builderEligibility.js'

function createCharacter(overrides?: Partial<CharacterAuthored>): CharacterAuthored {
  return {
    ...createEmptyCharacterAuthored({
      id: 'character-1',
      systemId: 'dnd5e2014',
      primaryRulesCatalogueId: '00000000-0000-4000-8000-000000000301',
      userId: 'user-1'
    }),
    ...overrides
  }
}
function createRegistry(): CharacterBuilderRegistry {
  return {
    system: null,
    races: [
      {
        id: 'dragonborn',
        label: 'Dragonborn',
        category: 'BASE',
        ancestry: {
          id: 'draconic-ancestry',
          label: 'Draconic Ancestry',
          options: [
            {
              id: 'red',
              label: 'Red'
            }
          ]
        }
      } as CharacterBuilderRegistry['races'][number]
    ],
    classes: [],
    backgrounds: [],
    equipment: [],
    features: [
      {
        id: 'arcane-recovery',
        label: 'Arcane Recovery'
      } as CharacterBuilderRegistry['features'][number]
    ]
  }
}

describe('isCharacterBuilderProvenanceStillValid', () => {
  it('rejects class and subclass provenance above the current class level', () => {
    const registry = createRegistry()
    const character = createCharacter({
      intent: {
        ...createCharacter().intent,
        classes: [
          {
            classId: 'wizard',
            classLevel: 2,
            subclassId: 'evoker'
          }
        ]
      }
    })

    expect(
      isCharacterBuilderProvenanceStillValid({
        source: { kind: 'CLASS', classId: 'wizard', classLevel: 2 },
        character,
        registry
      })
    ).toBe(true)
    expect(
      isCharacterBuilderProvenanceStillValid({
        source: { kind: 'CLASS', classId: 'wizard', classLevel: 3 },
        character,
        registry
      })
    ).toBe(false)
    expect(
      isCharacterBuilderProvenanceStillValid({
        source: { kind: 'SUBCLASS', subclassId: 'evoker', classLevel: 3 },
        character,
        registry
      })
    ).toBe(false)
  })

  it('rejects ancestry provenance that is not the current ancestry option', () => {
    const registry = createRegistry()
    registry.races[0]?.ancestry?.options.push({
      id: 'blue',
      label: 'Blue',
      description: 'Blue ancestry.',
      order: 2
    })
    const character = createCharacter({
      intent: {
        ...createCharacter().intent,
        race: { raceId: 'dragonborn' },
        ancestrySelections: [
          {
            id: 'ancestry-1',
            ancestryId: 'draconic-ancestry',
            optionId: 'blue',
            source: { kind: 'RACE', raceId: 'dragonborn' },
            timing: { kind: 'IMMEDIATE' }
          }
        ]
      }
    })

    expect(
      isCharacterBuilderProvenanceStillValid({
        source: { kind: 'ANCESTRY', ancestryId: 'draconic-ancestry', optionId: 'blue' },
        character,
        registry
      })
    ).toBe(true)
    expect(
      isCharacterBuilderProvenanceStillValid({
        source: { kind: 'ANCESTRY', ancestryId: 'draconic-ancestry', optionId: 'red' },
        character,
        registry
      })
    ).toBe(false)
  })

  it('rejects ancestry provenance when the selected ancestry source is stale', () => {
    const registry = createRegistry()
    const character = createCharacter({
      intent: {
        ...createCharacter().intent,
        race: { raceId: 'dragonborn' },
        ancestrySelections: [
          {
            id: 'ancestry-1',
            ancestryId: 'draconic-ancestry',
            optionId: 'red',
            source: { kind: 'SUBRACE', subraceId: 'sea-elf' },
            timing: { kind: 'IMMEDIATE' }
          }
        ]
      }
    })

    expect(
      isCharacterBuilderProvenanceStillValid({
        source: { kind: 'ANCESTRY', ancestryId: 'draconic-ancestry', optionId: 'red' },
        character,
        registry
      })
    ).toBe(false)
  })

  it('falls back to base-race ancestry when the selected subrace has none', () => {
    const registry = createRegistry()
    registry.races.push({
      id: 'dragonborn-variant',
      label: 'Dragonborn Variant',
      category: 'SUBRACE',
      parentRaceId: 'dragonborn',
      size: 'MEDIUM',
      speeds: [],
      systemId: 'dnd5e2014',
      userId: 'user-1',
      subrace: {
        parentRaceId: 'dragonborn',
        parentLabel: 'Dragonborn',
        inherited: { size: 'MEDIUM', speeds: [] }
      }
    })
    const character = createCharacter({
      intent: {
        ...createCharacter().intent,
        race: { raceId: 'dragonborn', subraceId: 'dragonborn-variant' },
        ancestrySelections: [
          {
            id: 'ancestry-1',
            ancestryId: 'draconic-ancestry',
            optionId: 'red',
            source: { kind: 'RACE', raceId: 'dragonborn' },
            timing: { kind: 'IMMEDIATE' }
          }
        ]
      }
    })

    expect(
      isCharacterBuilderProvenanceStillValid({
        source: { kind: 'ANCESTRY', ancestryId: 'draconic-ancestry', optionId: 'red' },
        character,
        registry
      })
    ).toBe(true)
  })
})
