import { describe, expect, it } from 'vitest'

import {
  requireEncounterActorConditionLevels,
  systemConditionMaximumLevel
} from '../conditionLevels.js'
import { EncounterValidationError } from '../encounterErrors.js'
import { creatureConditionCapabilityRegistry } from '../platformPolicyModules.js'
import {
  prepareFixtureBuilder,
  prepareFixtureSheet,
  readyFighterFixture,
  system
} from '../testing/characterContextFixtures.js'

const exhaustionId = creatureConditionCapabilityRegistry.require(
  system.id
).exhaustionConditionDefinitionId!
const prone = system.conditionTypes.find((condition) => condition.code === 'PRONE')!

/** The System with its Exhaustion condition authored up to `maximumLevel`. */
function withExhaustionMaximum(maximumLevel: number) {
  return {
    ...system,
    conditionTypes: system.conditionTypes.map((condition) =>
      condition.id === exhaustionId ? { ...condition, maximumLevel } : condition
    )
  }
}

describe('System condition levels', () => {
  it('reads a condition’s maximum level from the System, and 0 for one without levels', () => {
    expect(systemConditionMaximumLevel(system.conditionTypes, exhaustionId)).toBe(6)
    expect(systemConditionMaximumLevel(system.conditionTypes, prone.id)).toBe(0)
    expect(systemConditionMaximumLevel(system.conditionTypes, null)).toBe(0)
  })

  it('accepts a Creature condition row at any authored level and rows without a level', () => {
    expect(() =>
      requireEncounterActorConditionLevels(
        [{ conditionTypeId: exhaustionId, level: 1 }, { conditionTypeId: prone.id }],
        system.conditionTypes
      )
    ).not.toThrow()
    expect(() =>
      requireEncounterActorConditionLevels(
        [{ conditionTypeId: exhaustionId, level: 6 }],
        system.conditionTypes
      )
    ).not.toThrow()
  })

  it('refuses a level outside the authored range or on a condition without levels', () => {
    for (const rows of [
      [{ conditionTypeId: exhaustionId, level: 7 }],
      [{ conditionTypeId: exhaustionId, level: 0 }],
      [{ conditionTypeId: exhaustionId, level: 2.5 }],
      [{ conditionTypeId: prone.id, level: 1 }]
    ])
      expect(() => requireEncounterActorConditionLevels(rows, system.conditionTypes)).toThrow(
        EncounterValidationError
      )
  })

  it('a homebrew maximum bounds Creature rows with no condition-specific code', () => {
    const conditionTypes = withExhaustionMaximum(4).conditionTypes
    expect(() =>
      requireEncounterActorConditionLevels(
        [{ conditionTypeId: exhaustionId, level: 5 }],
        conditionTypes
      )
    ).toThrow(EncounterValidationError)
  })

  // The Character Sheet and Creature rows share one authored maximum: a Character-side constant
  // would let the two diverge.
  it('a Character’s Exhaustion maximum is the one that bounds Creature rows', async () => {
    const fixture = readyFighterFixture()
    const { character } = await prepareFixtureBuilder(fixture)
    for (const maximumLevel of [6, 4]) {
      const gameSystem = withExhaustionMaximum(maximumLevel)
      const { sheet } = await prepareFixtureSheet({ ...fixture, character, gameSystem })

      expect(sheet.overview.exhaustion.maximumLevel).toBe(
        systemConditionMaximumLevel(gameSystem.conditionTypes, exhaustionId)
      )
    }
  })
})
