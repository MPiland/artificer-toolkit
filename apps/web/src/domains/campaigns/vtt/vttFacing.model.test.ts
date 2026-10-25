import { describe, expect, it } from 'vitest'
import { facingDirections, facingLabel, travelFacingDegrees } from './vttFacing.model'

describe('VTT facing model', () => {
  it('offers every facing of the rule’s step, clockwise from north', () => {
    expect(facingDirections(90)).toEqual([0, 90, 180, 270])
    expect(facingDirections(60)).toHaveLength(6)
  })

  it('defaults a move’s facing to its last leg’s direction of travel, snapped to the step', () => {
    const east = { x: 100, y: 0 }
    expect(travelFacingDegrees([{ x: 0, y: 0 }, east], 90)).toBe(90)
    // Up and slightly left is nearest north; the closing leg decides, not the first.
    expect(travelFacingDegrees([{ x: 0, y: 0 }, east, { x: 90, y: -100 }], 90)).toBe(0)
    expect(
      travelFacingDegrees(
        [
          { x: 0, y: 0 },
          { x: -100, y: 100 }
        ],
        45
      )
    ).toBe(225)
    // A closing leg that does not move falls back to the leg before it.
    expect(
      travelFacingDegrees(
        [
          { x: 0, y: 0 },
          { x: 0, y: 100 },
          { x: 0, y: 100 }
        ],
        90
      )
    ).toBe(180)
    expect(
      travelFacingDegrees(
        [
          { x: 0, y: 0 },
          { x: 0, y: 0 }
        ],
        90
      )
    ).toBeNull()
  })

  it('names compass facings and states the degrees of any other', () => {
    expect(facingLabel(0)).toBe('North')
    expect(facingLabel(135)).toBe('South-east')
    expect(facingLabel(60)).toBe('60° from north')
  })
})
