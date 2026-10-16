import { describe, expect, it } from 'vitest'

import {
  encounterAreaCaughtChecksum,
  encounterChosenActorEntries,
  encounterChosenActorsChecksum,
  removeEncounterAreaTarget
} from '../encounterAreaPending.js'

const token = (tokenId: string, x: number) => ({
  tokenId,
  position: { x, y: 150 },
  width: 100,
  height: 100,
  rotationDegrees: 0
})

const FIRST = '00000000-0000-4000-8000-0000000000a1'
const SECOND = '00000000-0000-4000-8000-0000000000a2'
const THIRD = '00000000-0000-4000-8000-0000000000a3'

const scene = { sceneId: '00000000-0000-4000-8000-0000000000b1', sceneVersion: 4 }
const area = { origin: { x: 50, y: 150 }, shape: { kind: 'RADIUS' as const, radius: 400 } }

function context(targets: { actorId: string; testedJson?: string }[]) {
  const sealed = targets.map(({ actorId, testedJson }, index) => ({
    actorId,
    token: token(`00000000-0000-4000-8000-0000000000c${index}`, 150 + index * 100),
    ...(testedJson === undefined ? {} : { testedJson })
  }))
  return {
    scene,
    area,
    removedActorIds: [] as string[],
    caughtChecksum: encounterAreaCaughtChecksum({ scene, area, caught: sealed }),
    targets: sealed
  }
}

describe('removing a creature from a pending area', () => {
  it('drops the creature, remembers it, and seals the checksum over those still caught', () => {
    const before = context([{ actorId: FIRST }, { actorId: SECOND }, { actorId: THIRD }])
    const removed = removeEncounterAreaTarget(before, SECOND)
    if (removed.kind !== 'REMOVED') throw new Error('Expected the creature to be removed.')
    expect(removed.targets.map((target) => target.actorId)).toEqual([FIRST, THIRD])
    expect(removed.removedActorIds).toEqual([SECOND])
    expect(removed.caughtChecksum).not.toBe(before.caughtChecksum)
    expect(removed.caughtChecksum).toBe(
      encounterAreaCaughtChecksum({
        scene,
        area,
        caught: before.targets.filter((target) => target.actorId !== SECOND)
      })
    )
  })

  it('refuses a creature whose save was already answered', () => {
    const before = context([{ actorId: FIRST, testedJson: '{}' }, { actorId: SECOND }])
    expect(removeEncounterAreaTarget(before, FIRST)).toEqual({ kind: 'ANSWERED' })
  })

  it('refuses a creature the area never caught or already lost', () => {
    const before = context([{ actorId: FIRST }])
    expect(removeEncounterAreaTarget(before, THIRD)).toEqual({ kind: 'NOT_CAUGHT' })
    const removed = removeEncounterAreaTarget(before, FIRST)
    if (removed.kind !== 'REMOVED') throw new Error('Expected the creature to be removed.')
    expect(removeEncounterAreaTarget({ ...before, ...removed }, FIRST)).toEqual({
      kind: 'NOT_CAUGHT'
    })
  })
})

describe('removing a creature that several rays are aimed at', () => {
  it('drops every ray aimed at it, remembering it once for each', () => {
    const before = context([{ actorId: FIRST }, { actorId: SECOND }, { actorId: FIRST }])
    const removed = removeEncounterAreaTarget(before, FIRST)
    if (removed.kind !== 'REMOVED') throw new Error('Expected the creature to be removed.')
    expect(removed.targets.map((target) => target.actorId)).toEqual([SECOND])
    expect(removed.removedActorIds).toEqual([FIRST, FIRST])
  })

  it('refuses the creature once any ray aimed at it has been answered', () => {
    const before = context([{ actorId: FIRST }, { actorId: FIRST, testedJson: '{}' }])
    expect(removeEncounterAreaTarget(before, FIRST)).toEqual({ kind: 'ANSWERED' })
  })
})

describe('the entries of a list of chosen creatures', () => {
  const AREA = '00000000-0000-4000-8000-0000000000d1'

  it('gives each ray its own occurrence, keeping the first one a creature has when named once', () => {
    const entries = encounterChosenActorEntries(AREA, [FIRST, SECOND, FIRST, FIRST])
    expect(new Set(entries.map((entry) => entry.occurrenceId)).size).toBe(4)
    expect(entries.map((entry) => entry.actorId)).toEqual([FIRST, SECOND, FIRST, FIRST])
    expect(encounterChosenActorEntries(AREA, [FIRST])[0]?.occurrenceId).toBe(
      entries[0]?.occurrenceId
    )
  })
})

describe('sealing the creatures a chosen-creature action named', () => {
  it('is the same whatever order they were named in, and differs for another set', () => {
    expect(encounterChosenActorsChecksum([FIRST, SECOND])).toBe(
      encounterChosenActorsChecksum([SECOND, FIRST])
    )
    expect(encounterChosenActorsChecksum([FIRST, SECOND])).not.toBe(
      encounterChosenActorsChecksum([FIRST, THIRD])
    )
    expect(encounterChosenActorsChecksum([FIRST])).not.toBe(
      encounterChosenActorsChecksum([FIRST, SECOND])
    )
  })
})
