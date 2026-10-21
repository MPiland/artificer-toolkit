import { describe, expect, it } from 'vitest'

import {
  type DamageTypeTaken,
  clearDamageTypesTaken,
  revertDamageTypesTaken,
  withDamageTypesTaken
} from '../encounterDamageTypesSinceTurnStart.js'

const FIRE = '00000000-0000-4000-8000-0000000000f1'
const ACID = '00000000-0000-4000-8000-0000000000a1'
const FIRST = '00000000-0000-4000-8000-000000000c01'
const SECOND = '00000000-0000-4000-8000-000000000c02'

const noRecord: { damageTypesSinceTurnStart?: DamageTypeTaken[] } = {}

const damage = (damageTypeId: string, resolvedAmount: number) =>
  ({ kind: 'DAMAGE', damageTypeId, resolvedAmount }) as never

describe('the damage types a creature took since its turn began (SPELLS-33 T4i1b1)', () => {
  it('records each type that dealt damage once per command, and skips zero damage', () => {
    const taken = withDamageTypesTaken(
      noRecord,
      [damage(FIRE, 3), damage(FIRE, 2), damage(ACID, 0)],
      FIRST
    )
    expect(taken.damageTypesSinceTurnStart).toEqual([{ damageTypeId: FIRE, commandId: FIRST }])
  })

  it('leaves a holder untouched when no damage landed', () => {
    const holder = noRecord
    expect(withDamageTypesTaken(holder, [{ kind: 'HEAL' } as never], FIRST)).toBe(holder)
  })

  it('undo removes the command’s entries and leaves the rest', () => {
    const earlier = { damageTypeId: ACID, commandId: FIRST }
    const recorded = withDamageTypesTaken(
      { damageTypesSinceTurnStart: [earlier] },
      [damage(FIRE, 4)],
      SECOND
    )
    expect(recorded.damageTypesSinceTurnStart).toHaveLength(2)

    expect(revertDamageTypesTaken(recorded, { commandId: SECOND, cleared: [] })).toEqual({
      damageTypesSinceTurnStart: [earlier]
    })
  })

  it('undo of a start-of-turn trigger puts back exactly the entries it cleared', () => {
    const recorded = withDamageTypesTaken(noRecord, [damage(FIRE, 4), damage(ACID, 1)], FIRST)
    const { holder, cleared } = clearDamageTypesTaken(recorded)
    expect(holder).toEqual({})
    expect(revertDamageTypesTaken(holder, { commandId: SECOND, cleared })).toEqual(recorded)
  })
})
