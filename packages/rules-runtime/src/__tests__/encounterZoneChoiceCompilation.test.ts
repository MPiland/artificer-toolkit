import { describe, expect, it } from 'vitest'

import type { EquipmentAuthored } from '@artificer-toolkit/shared/subjects/authored'

import { encounterActionChoiceTarget } from '../encounterAreaAction.js'
import { chosenZonePlacement } from '../encounterZonePlacement.js'
import { DND5E_SAVE_DC_FACT_KEY } from '../systems/dnd5e/effectActionCompiler.js'
import {
  compileItemEntry,
  extraId,
  variantEquipment,
  type ZoneParts
} from '../testing/authoredZoneFixture.js'

/**
 * SPELLS-20 T4e (D140): an ON_USE CHOICE whose every option places one zone compiles to a cast-time
 * pick between those zones. Proved on a Caltrops variant authored from core options, not on any spell.
 */

const SHARP_ID = extraId(0x101)
const SHARPER_ID = extraId(0x102)

/** A copy with every authored `id` inside it renamed, so the two picks never share an identity. */
function reidentified<T>(value: T, offset: number): T {
  let next = offset
  return JSON.parse(JSON.stringify(value), (key, item: unknown) =>
    key === 'id' && typeof item === 'string' ? extraId(next++) : item
  ) as T
}

/** The Caltrops variant whose use picks its own zone or the zone `changeSecond` authors. */
function pickBetween(changeSecond: (parts: ZoneParts) => void): EquipmentAuthored {
  const equipment = variantEquipment(() => {})
  const effect = equipment.effects?.[0]
  const path = effect?.paths[0]
  const secondPath = variantEquipment(changeSecond).effects?.[0]?.paths[0]
  if (!effect || path?.selectionKind !== 'FIXED' || secondPath?.selectionKind !== 'FIXED')
    throw new Error('Caltrops must author one zone path.')
  const { resultBlock, ...shared } = path
  effect.paths[0] = {
    ...shared,
    groupType: 'CHOICE',
    selectionKind: 'CHOICE',
    options: [
      { id: SHARP_ID, order: 1, label: 'Sharp', resultBlock },
      {
        id: SHARPER_ID,
        order: 2,
        label: 'Sharper',
        resultBlock: reidentified(secondPath.resultBlock, 0x110)
      }
    ]
  }
  return equipment
}

const harderSave = ({ invocation }: ZoneParts) => {
  invocation.savingThrow = { ...invocation.savingThrow, baseDc: 18 }
}

/** The pick compiled through the real policy and entry compiler, required to compile. */
function compiledPick(changeSecond: (parts: ZoneParts) => void) {
  const entry = compileItemEntry(pickBetween(changeSecond))
  if (entry.schemaVersion !== 4 || entry.compilation.kind !== 'COMPILED')
    throw new Error('The pick must compile to a v4 entry.')
  return { entry, compilation: entry.compilation }
}

describe('a cast-time pick between zones (SPELLS-20 T4e, D140)', () => {
  it('compiles one zone per option, each keeping its own save', () => {
    const placement = compiledPick(harderSave).compilation.zonePlacement
    if (!placement) throw new Error('The pick must place a zone.')

    expect(chosenZonePlacement(placement, SHARP_ID)?.entry.adapterFacts).toMatchObject({
      [DND5E_SAVE_DC_FACT_KEY]: 15
    })
    expect(chosenZonePlacement(placement, SHARPER_ID)?.entry.adapterFacts).toMatchObject({
      [DND5E_SAVE_DC_FACT_KEY]: 18
    })
    expect(chosenZonePlacement(placement, undefined)).toBeNull()
    expect(chosenZonePlacement(placement, extraId(0x1ff))).toBeNull()
  })

  it('offers the options by label on the action’s point target', () => {
    const { entry, compilation } = compiledPick(harderSave)

    expect(
      encounterActionChoiceTarget(entry.targetPolicy, null, compilation.zonePlacement)
    ).toMatchObject({
      kind: 'POINT',
      choiceOptions: [
        { id: SHARP_ID, label: 'Sharp' },
        { id: SHARPER_ID, label: 'Sharper' }
      ]
    })
  })

  it('goes manual when the zones picked between cover different areas', () => {
    const entry = compileItemEntry(
      pickBetween(({ zone }) => {
        zone.shape = {
          id: zone.shape!.id,
          shapeKind: 'CUBE',
          edgeLength: { amount: 10, unit: 'FEET' }
        }
      })
    )

    expect(entry.compilation.kind).toBe('MANUAL')
  })
})
