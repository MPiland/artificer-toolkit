import {
  encounterReadDtoSchema,
  encounterReadResultDtoSchema,
  type EncounterReadResultDto
} from '@artificer-toolkit/schema/api/encounterRead'
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LiveSessionReadRejectedError } from './liveSessionClient'
import type { HeldEncounterSession } from './useCampaignLiveSession'
import { readFromRoomOrFallback, useRoomEncounterRead } from './useRoomEncounterRead'
import { validated } from '../../../test/validatedFixture'

const encounterId = '00000000-0000-4000-8000-000000000001'
const read = validated(encounterReadDtoSchema)({
  input: { encounterId },
  kind: 'LATEST_EVIDENCE_ROLLS'
})
const answer = validated(encounterReadResultDtoSchema)({
  kind: 'LATEST_EVIDENCE_ROLLS',
  result: []
})

function heldAt(version: number): HeldEncounterSession {
  return {
    held: true,
    version,
    state: {
      encounter: null,
      pending: null,
      waitingOn: null,
      turnMovement: [],
      halfSpeedFields: [],
      auras: [],
      movementCostZones: [],
      placedZones: []
    },
    preparedPending: [],
    actorSides: null,
    settlement: null,
    timeline: null
  }
}

const select = (result: EncounterReadResultDto) =>
  result.kind === 'LATEST_EVIDENCE_ROLLS' ? result.result.length : undefined

describe('useRoomEncounterRead', () => {
  it('does not ask the room unless it holds the session', () => {
    const readEncounter = vi.fn()
    const { result } = renderHook(() =>
      useRoomEncounterRead({ read, readEncounter, room: null, select })
    )

    expect(result.current).toEqual({ routed: false })
    expect(readEncounter).not.toHaveBeenCalled()
  })

  it('asks again when the session version changes and drops answers older than the frame', async () => {
    const readEncounter = vi
      .fn()
      .mockResolvedValueOnce({ result: answer, version: 3 })
      .mockResolvedValueOnce({ result: answer, version: 3 })
      .mockResolvedValueOnce({ result: answer, version: 4 })
    const { result, rerender } = renderHook(
      ({ version }) => useRoomEncounterRead({ read, readEncounter, room: heldAt(version), select }),
      { initialProps: { version: 3 } }
    )

    await waitFor(() => expect(result.current).toEqual({ routed: true, value: 0, error: null }))
    expect(readEncounter).toHaveBeenCalledTimes(1)

    rerender({ version: 4 })
    expect(result.current).toEqual({ routed: true, value: undefined, error: null })
    await waitFor(() => expect(readEncounter).toHaveBeenCalledTimes(2))
    // The second answer was read at version 3, older than the version 4 frame.
    await act(async () => undefined)
    expect(result.current).toEqual({ routed: true, value: undefined, error: null })

    rerender({ version: 5 })
    await waitFor(() => expect(readEncounter).toHaveBeenCalledTimes(3))
    await act(async () => undefined)
    expect(result.current).toEqual({ routed: true, value: undefined, error: null })
  })

  it('asks again when the refresh key changes at the same session version', async () => {
    const readEncounter = vi.fn().mockResolvedValue({ result: answer, version: 3 })
    const { result, rerender } = renderHook(
      ({ refreshKey }) =>
        useRoomEncounterRead({ read, readEncounter, refreshKey, room: heldAt(3), select }),
      { initialProps: { refreshKey: 'a' } }
    )

    await waitFor(() => expect(result.current).toEqual({ routed: true, value: 0, error: null }))
    rerender({ refreshKey: 'a' })
    expect(readEncounter).toHaveBeenCalledTimes(1)

    rerender({ refreshKey: 'a,b' })
    expect(result.current).toEqual({ routed: true, value: undefined, error: null })
    await waitFor(() => expect(readEncounter).toHaveBeenCalledTimes(2))
  })

  it('reads Convex when the room cannot answer, and shows a refusal the room gave', async () => {
    const readEncounter = vi
      .fn()
      .mockRejectedValueOnce(new LiveSessionReadRejectedError('Unavailable.', 'UNAVAILABLE', null))
      .mockRejectedValueOnce(
        new LiveSessionReadRejectedError('Not yours.', 'DOMAIN_REJECTED', 'NOT_ACTOR_CONTROLLER')
      )
    const { result, rerender } = renderHook(
      ({ version }) => useRoomEncounterRead({ read, readEncounter, room: heldAt(version), select }),
      { initialProps: { version: 3 } }
    )

    await waitFor(() => expect(result.current).toEqual({ routed: false }))

    rerender({ version: 4 })
    await waitFor(() =>
      expect(result.current).toMatchObject({
        routed: true,
        error: expect.objectContaining({ message: 'Not yours.' })
      })
    )
  })
})

describe('readFromRoomOrFallback', () => {
  const fallback = vi.fn().mockResolvedValue('convex')

  it('prefers the room, and falls back when it is absent, unavailable or stale', async () => {
    const readEncounter = vi
      .fn()
      .mockResolvedValueOnce({ result: answer, version: 3 })
      .mockRejectedValueOnce(new LiveSessionReadRejectedError('Unavailable.', 'UNAVAILABLE', null))
      .mockResolvedValueOnce({ result: answer, version: 2 })
    const from = (roomVersion: number | null) =>
      readFromRoomOrFallback({
        fallback,
        read,
        readEncounter,
        roomVersion,
        select: () => 'room'
      })

    await expect(from(3)).resolves.toBe('room')
    await expect(from(3)).resolves.toBe('convex')
    await expect(from(3)).resolves.toBe('convex')
    await expect(from(null)).resolves.toBe('convex')
    expect(readEncounter).toHaveBeenCalledTimes(3)
  })

  it('throws a refusal the room gave instead of reading Convex', async () => {
    fallback.mockClear()
    const readEncounter = vi
      .fn()
      .mockRejectedValue(new LiveSessionReadRejectedError('Not yours.', 'FORBIDDEN', null))

    await expect(
      readFromRoomOrFallback({
        fallback,
        read,
        readEncounter,
        roomVersion: 3,
        select: () => 'room'
      })
    ).rejects.toThrow('Not yours.')
    expect(fallback).not.toHaveBeenCalled()
  })
})
