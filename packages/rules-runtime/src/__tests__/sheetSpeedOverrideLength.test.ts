import { human } from '@artificer-toolkit/source-data/srd/races/human.js'
import { describe, expect, it } from 'vitest'

import { resolveCharacterRecordStats } from '../character/characterRecordStats.js'
import {
  prepareFixtureBuilder,
  prepareFixtureSheet,
  readyFighterFixture,
  system
} from '../testing/characterContextFixtures.js'

const walk = system.speeds.find((speed) => speed.code === 'WALK')
if (!walk) throw new Error('Expected the SRD walking Speed.')
const fly = system.speeds.find((speed) => speed.code === 'FLY')
if (!fly) throw new Error('Expected the SRD flying Speed.')
const swim = system.speeds.find((speed) => speed.code === 'SWIM')
if (!swim) throw new Error('Expected the SRD swimming Speed.')

type SpeedOverride = { speedId: string; value: { amount: number; unit: 'FEET' | 'YARDS' } }

/** A Character whose race speed is 6 yards and who holds the given Sheet speed overrides. */
const prepare = async (overrides: readonly SpeedOverride[]) => {
  const fixture = readyFighterFixture()
  const documents = {
    ...fixture.documents,
    RACE: [
      { ...human, features: [], speeds: [{ speedId: walk.id, amount: 6, unit: 'YARDS' as const }] }
    ]
  }
  const { character } = await prepareFixtureBuilder({ character: fixture.character, documents })
  const timestamp = new Date(0).toISOString()
  return prepareFixtureSheet({
    character,
    documents,
    adjustments: overrides.map((override) => ({
      id: crypto.randomUUID(),
      characterId: character.id,
      createdBy: character.userId,
      updatedBy: character.userId,
      createdAt: timestamp,
      updatedAt: timestamp,
      family: 'MOVEMENT' as const,
      field: 'SPEED_OVERRIDE' as const,
      ...override
    }))
  })
}

describe('a Sheet speed override is a length (RELIABILITY-5.T2)', () => {
  it('converts an override in feet into the unit of a base authored in yards', async () => {
    const { sheet, ruleEvaluation } = await prepare([
      { speedId: walk.id, value: { amount: 30, unit: 'FEET' } }
    ])

    // 30 ft is 10 yards, replacing the 6-yard base.
    expect(ruleEvaluation.output.movement.speeds).toEqual([
      expect.objectContaining({ speedId: walk.id, amount: 10, unit: 'YARDS' })
    ])
    expect(sheet.overview.facts.find((fact) => fact.label === 'Speed')?.value).toBe('10 yards')
    expect(resolveCharacterRecordStats(ruleEvaluation).speeds).toEqual([
      { speedId: walk.id, amount: 30, unit: 'FEET' }
    ])
  })

  it('shows a speed the Character has no base for in the override’s own unit', async () => {
    const { ruleEvaluation } = await prepare([
      { speedId: fly.id, value: { amount: 12, unit: 'YARDS' } }
    ])

    expect(ruleEvaluation.output.movement.speeds).toContainEqual(
      expect.objectContaining({ speedId: fly.id, amount: 12, unit: 'YARDS' })
    )
    expect(resolveCharacterRecordStats(ruleEvaluation).speeds).toContainEqual({
      speedId: fly.id,
      amount: 36,
      unit: 'FEET'
    })
  })

  it('lists no speed that has neither a base nor an override', async () => {
    const { ruleEvaluation } = await prepare([
      { speedId: fly.id, value: { amount: 12, unit: 'YARDS' } }
    ])

    expect(ruleEvaluation.output.movement.speeds.map((speed) => speed.speedId).sort()).toEqual(
      [walk.id, fly.id].sort()
    )
    expect(ruleEvaluation.output.movement.speeds.map((speed) => speed.speedId)).not.toContain(
      swim.id
    )
  })
})
