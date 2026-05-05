import { describe, expect, it } from 'vitest'

import type { ApplyHitPointsCommand } from '@artificer-toolkit/schema/domains/character/commands'
import type { CharacterAssemblyRegistry, CharacterBuildState } from '@artificer-toolkit/shared/core'
import { dnd5e2014RulesSystem } from '@artificer-toolkit/shared/core'

import { handleApplyHitPoints } from './index.js'

function createState(): CharacterBuildState {
  return {
    characterId: '00000000-0000-4000-8000-000000000001',
    systemId: 'system-1',
    streamVersion: 2,
    name: 'Astra Vale',
    classes: [],
    abilityScores: {},
    abilityGenerationMethod: 'STANDARD_ARRAY',
    hitpointsByLevel: [],
    featureSelections: [],
    featRefs: [],
    spellRefs: [],
    ownedEquipment: []
  }
}

function createRegistry(): CharacterAssemblyRegistry {
  return {
    features: {},
    classes: {},
    feats: {},
    races: {},
    equipment: {},
    spells: {}
  }
}

describe('character build commands', () => {
  it('uses explicit final hit point command values instead of deriving placeholders', async () => {
    const command: ApplyHitPointsCommand = {
      type: 'APPLY_HIT_POINTS',
      characterId: '00000000-0000-4000-8000-000000000001',
      actorId: 'user-1',
      commandId: '00000000-0000-4000-8000-000000000002',
      expectedVersion: 2,
      classRef: { contentId: 'wizard', systemId: 'system-1' },
      classLevel: 2,
      method: 'ROLLED',
      roll: 4,
      value: 6
    }

    const result = await handleApplyHitPoints(command, createState(), createRegistry(), dnd5e2014RulesSystem)

    expect(result.events[0]).toMatchObject({
      type: 'HITPOINTS_APPLIED',
      classLevel: 2,
      method: 'ROLLED',
      roll: 4,
      value: 6
    })
    expect(result.newState.hitpointsByLevel).toEqual([
      {
        classRef: command.classRef,
        classLevel: 2,
        value: 6
      }
    ])
  })
})
