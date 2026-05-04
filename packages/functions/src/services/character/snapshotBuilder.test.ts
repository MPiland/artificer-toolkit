import { describe, expect, it } from 'vitest'

import type { CharacterAssemblyRegistry, CharacterBuildState } from '@artificer-toolkit/shared/core'

import { buildSnapshot } from './snapshotBuilder.js'

describe('buildSnapshot', () => {
  it('threads subclass specialization into the engine snapshot classes', () => {
    const state: CharacterBuildState = {
      characterId: 'character-1',
      systemId: 'dnd5e2014',
      streamVersion: 1,
      name: 'Druid',
      classes: [{
        classRef: { contentId: 'druid', systemId: 'dnd5e2014' },
        subclassRef: { contentId: 'circle-of-the-land', systemId: 'dnd5e2014' },
        specializationRef: { contentId: 'arctic', systemId: 'dnd5e2014' },
        level: 5
      }],
      abilityScores: {
        STR: 10,
        DEX: 12,
        CON: 14,
        INT: 10,
        WIS: 16,
        CHA: 8
      },
      abilityGenerationMethod: 'STANDARD_ARRAY',
      hitpointsByLevel: [
        { classRef: { contentId: 'druid', systemId: 'dnd5e2014' }, classLevel: 1, value: 8 }
      ],
      featureSelections: [],
      featRefs: [],
      spellRefs: [],
      ownedEquipment: []
    }

    const registry: CharacterAssemblyRegistry = {
      features: {},
      classes: {},
      feats: {},
      races: {},
      equipment: {},
      spells: {}
    }

    const snapshot = buildSnapshot(state, registry)

    expect(snapshot.classes).toEqual([{
      classId: 'druid',
      level: 5,
      subclassId: 'circle-of-the-land',
      specializationId: 'arctic'
    }])
  })
})
