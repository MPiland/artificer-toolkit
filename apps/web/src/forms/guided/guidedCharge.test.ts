import type { ChargeUseDto } from '@artificer-toolkit/schema/shared'
import { CHARGE_RESET_OPTIONS, createCharge, isSimpleCharge } from './guidedCharge'

describe('guided charges', () => {
  it('offers short rest, long rest and dawn resets', () => {
    expect(CHARGE_RESET_OPTIONS.map((option) => option.value)).toEqual([
      'SHORT_REST',
      'LONG_REST',
      'DAWN'
    ])
  })

  it('creates a one-use fixed charge that resets on a long rest', () => {
    const charge = createCharge()

    expect(charge).toMatchObject({
      amount: 1,
      resetKind: 'LONG_REST',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE'
    })
    expect(createCharge().id).not.toBe(charge.id)
  })

  it('detects simple charges and rejects scaling ones', () => {
    const simple = createCharge()
    const scaling: ChargeUseDto = { ...simple, scalingKind: 'PER_LEVEL', levels: [] }

    expect(isSimpleCharge(simple)).toBe(true)
    expect(isSimpleCharge(scaling)).toBe(false)
  })
})
