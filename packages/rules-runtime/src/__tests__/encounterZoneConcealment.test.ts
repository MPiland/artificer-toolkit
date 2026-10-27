import { describe, expect, it } from 'vitest'

import {
  withZoneDcs,
  withZoneSightings,
  withZoneSightingStatus,
  zoneConcealedFrom,
  zoneSightingCandidates,
  zoneSightPoint
} from '../encounterZoneConcealment.js'

const PLACER = '00000000-0000-4000-8000-000000000001'
const OTHER = '00000000-0000-4000-8000-000000000002'
const SIGHTED = '00000000-0000-4000-8000-000000000003'
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
      concealment: { spotDc, knownByActorIds: [PLACER], sightings: [] },
      disarmDc
    })
    expect(withZoneDcs(plain, { spotDc, disarmDc: null, placerActorId: null })).toEqual({
      ...plain,
      concealment: { spotDc, knownByActorIds: [], sightings: [] }
    })

    const sightings = [{ actorId: SIGHTED, status: 'PROMPTED' as const }]
    const known = {
      ...concealed,
      concealment: { spotDc, knownByActorIds: [PLACER, OTHER], sightings }
    }
    expect(
      withZoneDcs(known, {
        spotDc: { value: 18, source: 'FLAT' },
        disarmDc: null,
        placerActorId: PLACER
      })
    ).toEqual({
      ...plain,
      concealment: {
        spotDc: { value: 18, source: 'FLAT' },
        knownByActorIds: [PLACER, OTHER],
        sightings
      }
    })
    expect(withZoneDcs(known, { spotDc: null, disarmDc: null, placerActorId: PLACER })).toEqual(
      plain
    )
  })
})

describe('zone sightings (MOVE-3.5)', () => {
  const concealed = withZoneDcs(plain, { spotDc, disarmDc: null, placerActorId: PLACER })

  it('notices only Characters that neither know of the zone nor were already sighted', () => {
    expect(zoneSightingCandidates(plain, [PLACER, OTHER])).toEqual([])
    expect(zoneSightingCandidates(concealed, [PLACER, OTHER, SIGHTED])).toEqual([OTHER, SIGHTED])

    const sighted = withZoneSightings(concealed, [SIGHTED, PLACER, OTHER, SIGHTED])
    expect(sighted.concealment).toEqual({
      spotDc,
      knownByActorIds: [PLACER],
      sightings: [
        { actorId: OTHER, status: 'PROMPTED' },
        { actorId: SIGHTED, status: 'PROMPTED' }
      ]
    })
    expect(zoneSightingCandidates(sighted, [PLACER, OTHER, SIGHTED])).toEqual([])
    expect(withZoneSightings(sighted, [OTHER, SIGHTED])).toBe(sighted)
    expect(withZoneSightings(plain, [OTHER])).toBe(plain)
  })

  it('dismisses and re-prompts a sighting, and finds none for an unsighted Character', () => {
    const sighted = withZoneSightings(concealed, [OTHER])
    const dismissed = withZoneSightingStatus(sighted, OTHER, 'DISMISSED')
    expect(dismissed?.concealment?.sightings).toEqual([{ actorId: OTHER, status: 'DISMISSED' }])
    expect(dismissed && zoneSightingCandidates(dismissed, [OTHER])).toEqual([])
    expect(dismissed && withZoneSightingStatus(dismissed, OTHER, 'PROMPTED')).toEqual(sighted)
    expect(withZoneSightingStatus(sighted, SIGHTED, 'DISMISSED')).toBeNull()
  })

  it('looks at a circle or ring center and a polygon point mean', () => {
    expect(zoneSightPoint({ kind: 'CIRCLE', center: { x: 3, y: 4 }, radius: 10 })).toEqual({
      x: 3,
      y: 4
    })
    expect(
      zoneSightPoint({
        kind: 'POLYGON',
        points: [
          { x: 0, y: 0 },
          { x: 30, y: 0 },
          { x: 30, y: 30 },
          { x: 0, y: 30 }
        ]
      })
    ).toEqual({ x: 15, y: 15 })
  })
})
