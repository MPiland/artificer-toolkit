import {
  d20FoldedBonusTotal,
  formatD20FoldedBonus
} from '@artificer-toolkit/schema/shared/d20FoldedBonuses'
import {
  SRD_ABILITY_DEFINITION_IDS,
  srdSystemRecord
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import type { SceneBarrier, SceneToken } from '@artificer-toolkit/shared/vtt/scene'
import { describe, expect, it } from 'vitest'

import {
  coverFoldedBonuses,
  resolveEncounterCover,
  type EncounterCoverFacts
} from '../encounterCover.js'

/** The SRD System's own cover data: what each tier adds and to which saves. */
const rules = srdSystemRecord.cover
if (!rules) throw new Error('The SRD System authors no cover rules.')
const tier = (code: string): EncounterCoverFacts['tier'] => {
  const found = rules.tiers.find((candidate) => candidate.code === code)
  if (!found) throw new Error(`The SRD System has no ${code} cover tier.`)
  return { label: found.label, bonus: found.bonus, blocksTargeting: found.blocksTargeting }
}
const facts = (code: string): EncounterCoverFacts => ({
  tier: tier(code),
  saveAbilityDefinitionIds: rules.saveAbilityDefinitionIds
})

describe('the d20 bonus a cover tier folds (SPELLS-14.T2)', () => {
  it('raises an attack’s target defense by the tier’s bonus', () => {
    expect(coverFoldedBonuses(facts('HALF'), { kind: 'ATTACK' })).toEqual([
      { label: 'Half cover', amount: 2, operand: 'defenseOrDc' }
    ])
    expect(coverFoldedBonuses(facts('THREE_QUARTERS'), { kind: 'ATTACK' })[0]?.amount).toBe(5)
  })

  it('adds to the saver’s roll only for the abilities the System names', () => {
    expect(
      coverFoldedBonuses(facts('HALF'), {
        kind: 'SAVE',
        abilityDefinitionId: SRD_ABILITY_DEFINITION_IDS.DEXTERITY
      })
    ).toEqual([{ label: 'Half cover', amount: 2, operand: 'modifier' }])
    expect(
      coverFoldedBonuses(facts('HALF'), {
        kind: 'SAVE',
        abilityDefinitionId: SRD_ABILITY_DEFINITION_IDS.CONSTITUTION
      })
    ).toEqual([])
  })

  it('folds nothing without cover', () => {
    expect(coverFoldedBonuses(null, { kind: 'ATTACK' })).toEqual([])
    expect(
      coverFoldedBonuses({ tier: null, saveAbilityDefinitionIds: [] }, { kind: 'ATTACK' })
    ).toEqual([])
  })

  it('totals and labels each operand separately', () => {
    const bonuses = coverFoldedBonuses(facts('HALF'), { kind: 'ATTACK' })
    expect(d20FoldedBonusTotal(bonuses, 'defenseOrDc')).toBe(2)
    expect(d20FoldedBonusTotal(bonuses, 'modifier')).toBe(0)
    expect(formatD20FoldedBonus({ label: 'Half cover', amount: 2, operand: 'modifier' })).toBe(
      'Half cover +2'
    )
    expect(formatD20FoldedBonus(bonuses[0]!)).toBe("Half cover: target's defense +2")
  })
})

describe('the GM’s cover override on the target token (SPELLS-14.T3)', () => {
  const token = (id: string, x: number, override?: SceneToken['coverTierOverride']) =>
    ({
      assetId: null,
      controlledByUserIds: [],
      ...(override && { coverTierOverride: override }),
      height: 10,
      hidden: false,
      id,
      label: id,
      locked: false,
      position: { x, y: 5 },
      rotationDegrees: 0,
      senses: [],
      vision: null,
      width: 10
    }) satisfies SceneToken
  // A wall the full height of the target's square, between the attacker (cell 0:0) and the target
  // (cell 4:0): every line is blocked, so the geometry alone gives total cover.
  const fullWall: SceneBarrier = {
    a: { x: 30, y: -20 },
    b: { x: 30, y: 30 },
    blocksLight: true,
    blocksMovement: true,
    id: 'wall',
    kind: 'WALL'
  }
  const attacker = token('attacker', 5)
  const resolve = (input: {
    override?: SceneToken['coverTierOverride']
    barriers?: SceneBarrier[]
    automatic: boolean
  }) =>
    resolveEncounterCover({
      system: srdSystemRecord,
      scene: {
        barriers: input.barriers ?? [],
        doorStates: {},
        grid: {
          cellSize: 10,
          diagonalPolicy: 'EQUAL',
          distancePerCell: 5,
          kind: 'SQUARE',
          origin: { x: 0, y: 0 },
          unit: 'FEET'
        },
        tokens: [attacker, token('target', 45, input.override)]
      },
      origin: { kind: 'TOKEN', token: attacker },
      targetTokenId: 'target',
      automatic: input.automatic
    })

  it('applies the GM’s tier with automatic cover off, with the System tier’s bonus', () => {
    expect(resolve({ automatic: false })).toBeNull()
    expect(resolve({ automatic: false, override: { tierCode: 'HALF' } })).toEqual(facts('HALF'))
    expect(
      coverFoldedBonuses(resolve({ automatic: false, override: { tierCode: 'HALF' } }), {
        kind: 'ATTACK'
      })
    ).toEqual([{ label: 'Half cover', amount: 2, operand: 'defenseOrDc' }])
  })

  it('blocks targeting when the GM sets the tier that blocks it', () => {
    expect(
      resolve({ automatic: false, override: { tierCode: 'TOTAL' } })?.tier?.blocksTargeting
    ).toBe(true)
  })

  it('replaces the computed tier when automatic cover is on, from any origin', () => {
    expect(resolve({ automatic: true, barriers: [fullWall] })?.tier).toEqual(tier('TOTAL'))
    expect(
      resolve({ automatic: true, barriers: [fullWall], override: { tierCode: 'HALF' } })
    ).toEqual(facts('HALF'))
    expect(
      resolve({ automatic: true, barriers: [fullWall], override: { tierCode: null } })
    ).toEqual({ tier: null, saveAbilityDefinitionIds: rules.saveAbilityDefinitionIds })
    expect(resolve({ automatic: true, override: { tierCode: 'THREE_QUARTERS' } })).toEqual(
      facts('THREE_QUARTERS')
    )
  })

  it('gives no cover for a tier code the System does not author', () => {
    expect(
      resolve({ automatic: true, barriers: [fullWall], override: { tierCode: 'MISSING' } })
    ).toBeNull()
  })
})
