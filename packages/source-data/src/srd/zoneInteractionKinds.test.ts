import { describe, expect, it } from 'vitest'
import { ballBearingsBagOf1000 } from './equipment/ball-bearings-bag-of-1000.js'
import { caltropsBagOf20 } from './equipment/caltrops-bag-of-20.js'
import { huntingTrap } from './equipment/hunting-trap.js'
import { oilFlask } from './equipment/oil-flask.js'
import { bladeBarrier } from './spells/blade-barrier.js'

/** The interaction kinds each labelled manifest component authors, wherever it is nested. */
function interactionKindsByComponent(node: unknown): Record<string, readonly string[]> {
  if (Array.isArray(node)) return Object.assign({}, ...node.map(interactionKindsByComponent))
  if (typeof node !== 'object' || node === null) return {}
  const record = node as Record<string, unknown>
  const kinds = Array.isArray(record.interactionKinds)
    ? (record.interactionKinds as string[])
    : typeof record.interactionKind === 'string'
      ? [record.interactionKind]
      : null
  const own = typeof record.label === 'string' && kinds ? { [record.label]: kinds } : {}
  return Object.assign(own, ...Object.values(record).map(interactionKindsByComponent))
}

/**
 * SPELLS-17.2 and 17.5: the SRD says a creature that "enters the area" (or steps on a trap's plate)
 * triggers the effect, which includes a move that passes through and ends outside it.
 */
describe('SRD zones that trigger on entering the area pass-through too', () => {
  it.each([
    ['Caltrops', caltropsBagOf20, 'Enter the caltrop field'],
    ['Ball Bearings', ballBearingsBagOf1000, 'Move across the ball bearings'],
    ['Oil Flask', oilFlask, 'Enter burning oil'],
    ['Hunting Trap', huntingTrap, 'Pressure plate'],
    ['Blade Barrier', bladeBarrier, 'Whirling Blades']
  ])('%s authors its enter component as ENTER_OR_PASS_THROUGH', (_name, subject, component) => {
    const kinds = interactionKindsByComponent(subject)[component]
    expect(kinds).toContain('ENTER_OR_PASS_THROUGH')
    expect(kinds).not.toContain('ENTER_SPACE')
  })

  it('keeps the turn-based components of Oil Flask and Blade Barrier as they are', () => {
    expect(interactionKindsByComponent(oilFlask)['End turn in burning oil']).toEqual([
      'END_TURN_IN_SPACE'
    ])
    expect(interactionKindsByComponent(bladeBarrier)['Whirling Blades']).toContain(
      'START_TURN_IN_SPACE'
    )
  })
})
