import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import { getFunctionName } from 'convex/server'
import type { RoomEncounterRun } from '../vtt/roomEncounterRun'
import { tabletopPlayerEncounter } from '../vtt/CampaignTabletop.stories.fixtures'

const mocks = vi.hoisted(() => ({
  convexQuery: vi.fn(),
  useQuery: vi.fn()
}))

vi.mock('@convex-dev/react-query', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@convex-dev/react-query')>()),
  convexQuery: mocks.convexQuery
}))
vi.mock('@tanstack/react-query', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-query')>()),
  useQuery: mocks.useQuery
}))

import { useEncounterPendingDecision } from './useEncounterPendingDecision'

const encounterId = '00000000-0000-4000-8000-000000000001'
const pendingFunction = getFunctionName(convexApi.encounters.pendingReads.pendingRuleOccurrence)
const room: RoomEncounterRun = { encounter: tabletopPlayerEncounter, pending: null }

function pendingReadArgs() {
  const call = mocks.convexQuery.mock.calls.find(
    ([reference]) => getFunctionName(reference) === pendingFunction
  )
  return call?.[1]
}

describe('useEncounterPendingDecision', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.convexQuery.mockReturnValue({ queryKey: ['pending'] })
    mocks.useQuery.mockReturnValue({ data: undefined, error: null, isPending: true })
  })

  it('skips the Convex read while the room holds the Run', () => {
    const { result } = renderHook(() => useEncounterPendingDecision(encounterId, room))

    expect(pendingReadArgs()).toBe('skip')
    expect(result.current).toEqual({ data: null, error: null, isPending: false })
  })

  it('reads the pending decision from Convex without the room', () => {
    renderHook(() => useEncounterPendingDecision(encounterId, null))

    expect(pendingReadArgs()).toEqual({ encounterId })
  })

  it('skips the Convex read when disabled without the room', () => {
    renderHook(() => useEncounterPendingDecision(encounterId, null, false))

    expect(pendingReadArgs()).toBe('skip')
  })
})
