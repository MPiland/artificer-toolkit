import { conditionMechanicDtoSchema } from '@artificer-toolkit/schema/shared/ruleState'
import { SRD_CONDITION_RULE_STATE_DEFINITIONS } from '@artificer-toolkit/source-data/srd/ruleState.js'
import {
  SRD_CONDITION_TYPES,
  SRD_SYSTEM_ID
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { describe, expect, it } from 'vitest'

import {
  characterHitPointMaximumFraction,
  creatureHitPointMaximumFraction
} from '../conditionHitPointMaximum.js'
import { applyHitPointMaximumFraction } from '../hitPointMaximumFraction.js'
import { effectiveHitPointMaximum } from '../character/activeEffectGrantTotals.js'
import { DND5E_SYSTEM_ID } from '../systems/dnd5e/identity.js'
import { currentConditionDefinition } from './srdConditionDefinitions.js'

const conditionId = (code: string) => SRD_CONDITION_TYPES.find((entry) => entry.code === code)!.id
const EXHAUSTION = conditionId('EXHAUSTION')
const PRONE = conditionId('PRONE')
const HOMEBREW_ID = '77777777-7777-4777-8777-777777777773'
const HOMEBREW_MECHANIC_ID = '77777777-7777-4777-8777-777777777772'

const homebrew = currentConditionDefinition({
  id: HOMEBREW_ID,
  definitionFamilyKey: 'condition-rule-state',
  label: 'Homebrew rule policy',
  document: {
    schemaVersion: 1,
    kind: 'CONDITION_RULE_STATE',
    id: HOMEBREW_ID,
    gameSystemId: SRD_SYSTEM_ID,
    capabilitySuppressions: [],
    perceptionContributions: [],
    mechanics: [
      {
        id: HOMEBREW_MECHANIC_ID,
        order: 0,
        kind: 'HIT_POINT_MAXIMUM',
        numerator: 3,
        denominator: 4,
        minimumLevel: null
      }
    ]
  }
})

async function readCurrentDefinition(id: string) {
  if (id === HOMEBREW_ID) return homebrew
  const seed = SRD_CONDITION_RULE_STATE_DEFINITIONS.find((entry) => entry.id === id)
  return seed ? currentConditionDefinition(seed) : null
}

const character = (state: object) => ({ systemId: DND5E_SYSTEM_ID, state })

describe('the HIT_POINT_MAXIMUM condition mechanic', () => {
  const mechanic = (numerator: number, denominator: number) => ({
    id: HOMEBREW_MECHANIC_ID,
    order: 0,
    kind: 'HIT_POINT_MAXIMUM',
    numerator,
    denominator,
    minimumLevel: null
  })

  it('is a contract mechanic that may only keep or lower the maximum', () => {
    expect(conditionMechanicDtoSchema.parse(mechanic(1, 2))).toMatchObject({ denominator: 2 })
    expect(conditionMechanicDtoSchema.safeParse(mechanic(3, 2)).success).toBe(false)
    expect(conditionMechanicDtoSchema.safeParse(mechanic(0, 2)).success).toBe(false)
  })

  it('is seeded on Exhaustion at level 4 and on no other SRD condition', () => {
    const seeded = SRD_CONDITION_RULE_STATE_DEFINITIONS.flatMap((definition) =>
      definition.document.kind === 'CONDITION_RULE_STATE'
        ? definition.document.mechanics
            .filter(({ kind }) => kind === 'HIT_POINT_MAXIMUM')
            .map((entry) => ({ id: definition.id, minimumLevel: entry.minimumLevel }))
        : []
    )
    expect(seeded).toEqual([{ id: EXHAUSTION, minimumLevel: 4 }])
  })
})

describe('characterHitPointMaximumFraction', () => {
  const fractionAt = (level: number) =>
    characterHitPointMaximumFraction({
      character: character(level ? { exhaustion: { level } } : {}),
      readCurrentDefinition
    })

  it('halves the maximum from the authored level, and not below it', async () => {
    expect(await fractionAt(3)).toBeNull()
    expect(await fractionAt(4)).toEqual({ numerator: 1, denominator: 2 })
    expect(await fractionAt(5)).toEqual({ numerator: 1, denominator: 2 })
  })

  it('is whole again when the level is lowered', async () => {
    expect(await fractionAt(0)).toBeNull()
  })

  it('combines every held condition that carries one, with no condition-specific code', async () => {
    expect(
      await characterHitPointMaximumFraction({
        character: character({
          exhaustion: { level: 4 },
          conditions: [{ conditionTypeId: HOMEBREW_ID }, { conditionTypeId: PRONE }]
        }),
        readCurrentDefinition
      })
    ).toEqual({ numerator: 3, denominator: 8 })
  })

  it('leaves a condition with no rule-state definition whole', async () => {
    expect(
      await characterHitPointMaximumFraction({
        character: character({ exhaustion: { level: 6 } }),
        readCurrentDefinition: async () => null
      })
    ).toBeNull()
  })
})

describe('creatureHitPointMaximumFraction', () => {
  it('follows the level its condition row records', async () => {
    const at = (level: number) =>
      creatureHitPointMaximumFraction({
        conditionRows: [{ conditionTypeId: EXHAUSTION, level }],
        gameSystemId: DND5E_SYSTEM_ID,
        readCurrentDefinition
      })
    expect(await at(3)).toBeNull()
    expect(await at(4)).toEqual({ numerator: 1, denominator: 2 })
  })
})

describe('effectiveHitPointMaximum with a stored fraction', () => {
  it('rounds the maximum down and never reads below 0', () => {
    expect(applyHitPointMaximumFraction(11, { numerator: 1, denominator: 2 })).toBe(5)
    expect(applyHitPointMaximumFraction(11, undefined)).toBe(11)
    expect(effectiveHitPointMaximum(11, [], { numerator: 1, denominator: 2 })).toBe(5)
    expect(effectiveHitPointMaximum(0, [], { numerator: 1, denominator: 2 })).toBe(0)
  })
})
