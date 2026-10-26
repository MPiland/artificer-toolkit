import { describe, expect, it } from 'vitest'

import { withZoneDcs, zoneConcealedFrom } from '../encounterZoneConcealment.js'

const PLACER = '00000000-0000-4000-8000-000000000001'
const OTHER = '00000000-0000-4000-8000-000000000002'
const spotDc = { value: 14, source: 'PLACER_ROLL' as const }
const disarmDc = { value: 12, source: 'FLAT' as const }
const plain = { schemaVersion: 1 as const, revealed: true }

describe('zone concealment (MOVE-3.3)', () => {
  it('conceals a zone with a spot DC from a player none of whose Characters knows of it', () => {
    const concealed = withZoneDcs(plain, { spotDc, disarmDc: null, placerActorId: PLACER })
    const player = (...ids: string[]) => ({
      kind: 'PLAYER' as const,
      controlledActorIds: new Set(ids)
    })

    expect(zoneConcealedFrom(concealed, { kind: 'GM' })).toBe(false)
    expect(zoneConcealedFrom(concealed, player(OTHER, PLACER))).toBe(false)
    expect(zoneConcealedFrom(concealed, player(OTHER))).toBe(true)
    expect(zoneConcealedFrom(concealed, player())).toBe(true)
    expect(
      zoneConcealedFrom(
        withZoneDcs(plain, { spotDc: null, disarmDc, placerActorId: PLACER }),
        player()
      )
    ).toBe(false)
  })

  it('makes the placer know of a newly concealed zone and keeps who knows when the DCs change', () => {
    const concealed = withZoneDcs(plain, { spotDc, disarmDc, placerActorId: PLACER })
    expect(concealed).toEqual({
      ...plain,
      concealment: { spotDc, knownByActorIds: [PLACER] },
      disarmDc
    })
    expect(withZoneDcs(plain, { spotDc, disarmDc: null, placerActorId: null })).toEqual({
      ...plain,
      concealment: { spotDc, knownByActorIds: [] }
    })

    const known = { ...concealed, concealment: { spotDc, knownByActorIds: [PLACER, OTHER] } }
    expect(
      withZoneDcs(known, {
        spotDc: { value: 18, source: 'FLAT' },
        disarmDc: null,
        placerActorId: PLACER
      })
    ).toEqual({
      ...plain,
      concealment: { spotDc: { value: 18, source: 'FLAT' }, knownByActorIds: [PLACER, OTHER] }
    })
    expect(withZoneDcs(known, { spotDc: null, disarmDc: null, placerActorId: PLACER })).toEqual(
      plain
    )
  })
})
