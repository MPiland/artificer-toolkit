import { conditionMechanicDtoSchema } from '@artificer-toolkit/schema/shared/ruleState'
import { SRD_CONDITION_RULE_STATE_DEFINITIONS } from '@artificer-toolkit/source-data/srd/ruleState.js'
import {
  SRD_CONDITION_TYPES,
  SRD_SYSTEM_ID
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { describe, expect, it } from 'vitest'

import {
  creatureConditionEditReachesDeath,
  sheetCommandReachesConditionDeath
} from '../conditionLevelDeath.js'
import { DND5E_SYSTEM_ID } from '../systems/dnd5e/identity.js'
import { currentConditionDefinition } from './srdConditionDefinitions.js'

function conditionId(code: string) {
  const condition = SRD_CONDITION_TYPES.find((entry) => entry.code === code)
  if (!condition) throw new Error(`Unknown SRD condition ${code}.`)
  return condition.id
}
const EXHAUSTION = conditionId('EXHAUSTION')
const PRONE = conditionId('PRONE')
const HOMEBREW_WITHERED_ID = '77777777-7777-4777-8777-777777777773'

function homebrewCondition(id: string, minimumLevel: number) {
  return currentConditionDefinition({
    id,
    definitionFamilyKey: 'condition-rule-state',
    label: 'Homebrew rule policy',
    document: {
      schemaVersion: 1,
      kind: 'CONDITION_RULE_STATE',
      id,
      gameSystemId: SRD_SYSTEM_ID,
      capabilitySuppressions: [],
      perceptionContributions: [],
      mechanics: [
        { id: '77777777-7777-4777-8777-777777777772', order: 0, kind: 'DEATH', minimumLevel }
      ]
    }
  })
}
/** Homebrew conditions authored as data alone: no code of their own. */
const homebrew = [homebrewCondition(HOMEBREW_WITHERED_ID, 2)]

async function readCurrentDefinition(id: string) {
  const authored = homebrew.find((definition) => definition.id === id)
  if (authored) return authored
  const seed = SRD_CONDITION_RULE_STATE_DEFINITIONS.find((entry) => entry.id === id)
  return seed ? currentConditionDefinition(seed) : null
}

function character(exhaustionLevel: number) {
  return {
    systemId: DND5E_SYSTEM_ID,
    state: exhaustionLevel ? { exhaustion: { level: exhaustionLevel } } : {}
  }
}

describe('the DEATH condition mechanic', () => {
  const death = (minimumLevel: number | null) => ({
    id: '77777777-7777-4777-8777-777777777772',
    order: 0,
    kind: 'DEATH',
    minimumLevel
  })

  it('is a contract mechanic any level from 2 may carry', () => {
    expect(conditionMechanicDtoSchema.parse(death(2))).toMatchObject({ minimumLevel: 2 })
    expect(conditionMechanicDtoSchema.parse(death(6))).toMatchObject({ minimumLevel: 6 })
  })

  it('refuses level 1 and no level, which no raise can reach', () => {
    expect(conditionMechanicDtoSchema.safeParse(death(1)).success).toBe(false)
    expect(conditionMechanicDtoSchema.safeParse(death(null)).success).toBe(false)
  })

  it('is seeded on Exhaustion at its last level and on no other SRD condition', () => {
    const seeded = SRD_CONDITION_RULE_STATE_DEFINITIONS.flatMap((definition) =>
      definition.document.kind === 'CONDITION_RULE_STATE'
        ? definition.document.mechanics
            .filter(({ kind }) => kind === 'DEATH')
            .map(({ minimumLevel }) => ({ id: definition.id, minimumLevel }))
        : []
    )
    expect(seeded).toEqual([{ id: EXHAUSTION, minimumLevel: 6 }])
  })
})

describe('sheetCommandReachesConditionDeath', () => {
  const reaches = (before: number, level: number) =>
    sheetCommandReachesConditionDeath({
      character: character(before),
      command: { type: 'SET_EXHAUSTION', level },
      readCurrentDefinition
    })

  it('kills when Exhaustion reaches its authored level, from any level below', async () => {
    expect(await reaches(5, 6)).toBe(true)
    expect(await reaches(0, 6)).toBe(true)
  })

  it('does not kill below the authored level', async () => {
    expect(await reaches(4, 5)).toBe(false)
  })

  it('does not kill again at a level already held, so a revived Character can edit its notes', async () => {
    expect(await reaches(6, 6)).toBe(false)
  })

  it('does not kill on the way down', async () => {
    expect(await reaches(6, 5)).toBe(false)
  })

  it('follows the authored level with no condition-specific code', async () => {
    const authoredAtFour = homebrewCondition(EXHAUSTION, 4)
    const reachesAuthored = (level: number) =>
      sheetCommandReachesConditionDeath({
        character: character(0),
        command: { type: 'SET_EXHAUSTION', level },
        readCurrentDefinition: async () => authoredAtFour
      })
    expect(await reachesAuthored(3)).toBe(false)
    expect(await reachesAuthored(4)).toBe(true)
  })

  it('leaves Exhaustion with no rule-state definition alone', async () => {
    expect(
      await sheetCommandReachesConditionDeath({
        character: character(0),
        command: { type: 'SET_EXHAUSTION', level: 6 },
        readCurrentDefinition: async () => null
      })
    ).toBe(false)
  })

  it('reads no definition for any other command', async () => {
    const reads: string[] = []
    await sheetCommandReachesConditionDeath({
      character: character(0),
      command: { type: 'ADD_CONDITION' },
      readCurrentDefinition: async (id) => {
        reads.push(id)
        return null
      }
    })
    expect(reads).toEqual([])
  })
})

describe('creatureConditionEditReachesDeath', () => {
  const reaches = (beforeRows: unknown[], afterRows: unknown[]) =>
    creatureConditionEditReachesDeath({
      beforeRows,
      afterRows,
      gameSystemId: DND5E_SYSTEM_ID,
      readCurrentDefinition
    })
  const exhaustion = (level: number) => ({ conditionTypeId: EXHAUSTION, level })

  it('kills when a row’s level reaches the authored level, and not below it', async () => {
    expect(await reaches([exhaustion(5)], [exhaustion(6)])).toBe(true)
    expect(await reaches([], [exhaustion(6)])).toBe(true)
    expect(await reaches([], [exhaustion(5)])).toBe(false)
  })

  it('does not kill again at a level already held, or on the way down', async () => {
    expect(await reaches([exhaustion(6)], [exhaustion(6)])).toBe(false)
    expect(await reaches([exhaustion(6)], [exhaustion(5)])).toBe(false)
  })

  it('applies a homebrew level’s authored DEATH with no condition-specific code', async () => {
    const withered = (level: number) => ({ conditionTypeId: HOMEBREW_WITHERED_ID, level })
    expect(await reaches([withered(1)], [withered(2)])).toBe(true)
    expect(await reaches([], [withered(1)])).toBe(false)
  })

  it('leaves a condition with no DEATH mechanic, or with no rule-state definition, alone', async () => {
    expect(await reaches([], [{ conditionTypeId: PRONE }])).toBe(false)
    expect(await reaches([], [{ conditionTypeId: '77777777-7777-4777-8777-777777777779' }])).toBe(
      false
    )
  })
})
