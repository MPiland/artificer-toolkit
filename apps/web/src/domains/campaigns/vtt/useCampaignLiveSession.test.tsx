import { api } from '@artificer-toolkit/apis/convex/api'
import { liveSessionTicketDtoSchema } from '@artificer-toolkit/schema/api/liveSessionIdentity'
import { liveSessionCommandDtoSchema } from '@artificer-toolkit/schema/api/liveSessions'
import { sceneTransientEnvelopeDtoSchema } from '@artificer-toolkit/schema/api/vttScenes'
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { validated } from '../../../test/validatedFixture'
import type { createLiveSessionConnection } from './liveSessionClient'
import { useCampaignLiveSession } from './useCampaignLiveSession'

const liveTicket = validated(liveSessionTicketDtoSchema)({
  expiresAt: '2099-08-15T23:59:00.000Z',
  ticket: 'test-live-session-ticket'
})
const campaignId = '00000000-0000-4000-8000-000000000001'
const sceneId = '00000000-0000-4000-8000-000000000003'
const userId = '00000000-0000-4000-8000-000000000004'
const commandId = '00000000-0000-4000-8000-000000000006'
const command = validated(liveSessionCommandDtoSchema)({
  scope: 'SCENE',
  command: {
    barrierId: '00000000-0000-4000-8000-000000000005',
    commandId,
    expectedSceneVersion: 4,
    sceneId,
    state: 'OPEN',
    type: 'SET_SCENE_DOOR_STATE'
  }
})
const commit = { commandId, delta: null, sequence: 5, type: 'COMMAND_COMMITTED' as const }
const envelope = validated(sceneTransientEnvelopeDtoSchema)({
  baselineVersion: 1,
  audience: 'TABLE',
  kind: 'PING',
  position: { x: 4, y: 8 },
  sceneId,
  sequence: 2
})

const mocks = vi.hoisted(() => ({
  close: vi.fn(),
  getAccessToken: vi.fn(),
  issueTicket: vi.fn(),
  options: null as unknown,
  sendCommand: vi.fn(() => true),
  sendTransient: vi.fn(() => true),
  submitCommand: vi.fn(() => Promise.resolve(commit)),
  subscribeCampaignSummary: vi.fn(),
  subscribeCharacterSheet: vi.fn(),
  subscribeEncounterSession: vi.fn(),
  useConvex: vi.fn()
}))

vi.mock('#app/auth/betterAuthClient', () => ({
  betterAuthClient: { convex: { token: mocks.getAccessToken } }
}))

vi.mock('convex/react', () => ({ useConvex: mocks.useConvex }))

vi.mock('./liveSessionClient', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./liveSessionClient')>()),
  createLiveSessionConnection: (options: unknown) => {
    mocks.options = options
    return {
      close: mocks.close,
      sendCommand: mocks.sendCommand,
      sendTransient: mocks.sendTransient,
      submitCommand: mocks.submitCommand,
      subscribeCampaignSummary: mocks.subscribeCampaignSummary,
      subscribeCharacterSheet: mocks.subscribeCharacterSheet,
      subscribeEncounterSession: mocks.subscribeEncounterSession
    }
  }
}))

describe('useCampaignLiveSession', () => {
  beforeEach(() => {
    mocks.close.mockReset()
    mocks.getAccessToken.mockReset()
    mocks.issueTicket.mockReset()
    mocks.options = null
    mocks.sendCommand.mockClear()
    mocks.sendTransient.mockClear()
    mocks.submitCommand.mockClear()
    mocks.subscribeCampaignSummary.mockClear()
    mocks.subscribeCharacterSheet.mockClear()
    mocks.subscribeEncounterSession.mockClear()
    mocks.getAccessToken.mockResolvedValue({ data: { token: 'test-access-token' } })
    mocks.issueTicket.mockResolvedValue(liveTicket)
    mocks.useConvex.mockReturnValue({ action: mocks.issueTicket })
  })

  afterEach(() => vi.unstubAllEnvs())

  it('reuses an access token until the room would challenge it again', async () => {
    const tokenExpiringIn = (seconds: number) =>
      `header.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + seconds }))}.signature`
    const lasting = tokenExpiringIn(600)
    const expiring = tokenExpiringIn(30)
    mocks.getAccessToken
      .mockResolvedValueOnce({ data: { token: expiring } })
      .mockResolvedValueOnce({ data: { token: lasting } })
    renderHook(() => useCampaignLiveSession({ campaignId, enabled: true }))

    await waitFor(() => expect(mocks.options).not.toBeNull())
    const options = mocks.options as Parameters<typeof createLiveSessionConnection>[0]
    await expect(options.getAccessToken()).resolves.toBe(expiring)
    await expect(options.getAccessToken()).resolves.toBe(lasting)
    await expect(options.getAccessToken()).resolves.toBe(lasting)
    expect(mocks.getAccessToken).toHaveBeenCalledTimes(2)
  })

  it('wires the native ticket, authentication, transient, status, and error flow', async () => {
    const onTransient = vi.fn()
    const { result, unmount } = renderHook(() =>
      useCampaignLiveSession({ campaignId, enabled: true, onTransient })
    )

    await waitFor(() => expect(mocks.options).not.toBeNull())
    const options = mocks.options as Parameters<typeof createLiveSessionConnection>[0]
    expect(options.url).toBe(`ws://127.0.0.1:8787/live-session/${campaignId}`)
    await expect(options.getTicket()).resolves.toEqual(liveTicket)
    expect(mocks.issueTicket).toHaveBeenCalledWith(api.liveSessions.tickets.issue, { campaignId })
    await expect(options.getAccessToken()).resolves.toBe('test-access-token')
    expect(mocks.getAccessToken).toHaveBeenCalledWith({ fetchOptions: { throw: false } })

    act(() => {
      options.onTransient({ envelope, userId })
      options.onStatus('CONNECTED')
      options.onDurableState?.({
        commandReady: true,
        recipientState: {
          presentationVersion: null,
          recipientRole: 'PLAYER',
          scene: null
        },
        sequence: 4
      })
      options.onCommandRejected?.({
        code: 'STALE_STATE',
        commandId,
        currentSequence: 4,
        message: 'Scene state changed.',
        reason: null,
        warnings: null
      })
      options.onError(new Error('connection failed'))
    })
    expect(onTransient).toHaveBeenCalledWith({ envelope, userId })
    expect(result.current.status).toBe('CONNECTED')
    expect(result.current.error).toBe('connection failed')
    expect(result.current.commandReady).toBe(true)
    expect(result.current.sequence).toBe(4)
    expect(result.current.recipientState?.recipientRole).toBe('PLAYER')
    expect(result.current.rejection).toMatchObject({ code: 'STALE_STATE', commandId })
    await act(async () => {
      await expect(result.current.sendCommand(command)).resolves.toEqual(commit)
    })
    expect(mocks.submitCommand).toHaveBeenCalledWith(command)
    expect(result.current.rejection).toBeNull()
    expect(result.current.sendTransient(envelope)).toBe(true)
    expect(mocks.sendTransient).toHaveBeenCalledWith(envelope)
    expect(Object.keys(result.current).sort()).toEqual([
      'campaignSummary',
      'characterSheet',
      'commandReady',
      'encounterSession',
      'error',
      'readEncounter',
      'recipientState',
      'rejection',
      'sendCharacterSheetCommand',
      'sendCommand',
      'sendEncounterCommand',
      'sendSceneFog',
      'sendTransient',
      'sequence',
      'status'
    ])

    unmount()
    expect(mocks.close).toHaveBeenCalledOnce()
  })

  it('follows the room Encounter session only while it holds one and the socket is connected', async () => {
    const held = {
      held: true as const,
      version: 3,
      state: {
        encounter: null,
        pending: null,
        waitingOn: null,
        turnMovement: [],
        halfSpeedFields: [],
        auras: [],
        movementCostZones: [],
        placedZones: [],
        pendingZoneSightings: []
      },
      preparedPending: [],
      actorSides: null,
      settlement: null,
      timeline: null
    }
    const { result, rerender } = renderHook(
      ({ timeline }: { timeline: boolean }) =>
        useCampaignLiveSession({
          campaignId,
          enabled: true,
          encounterSession: { timeline },
          onTransient: vi.fn()
        }),
      { initialProps: { timeline: false } }
    )
    await waitFor(() => expect(mocks.options).not.toBeNull())
    const options = mocks.options as Parameters<typeof createLiveSessionConnection>[0]
    expect(mocks.subscribeEncounterSession).toHaveBeenLastCalledWith({ timeline: false })
    rerender({ timeline: true })
    expect(mocks.subscribeEncounterSession).toHaveBeenLastCalledWith({ timeline: true })

    act(() => {
      options.onStatus('CONNECTED')
      options.onEncounterSession?.(held)
    })
    expect(result.current.encounterSession).toEqual(held)
    act(() => options.onEncounterSession?.({ held: false }))
    expect(result.current.encounterSession).toBeNull()
    act(() => options.onEncounterSession?.(held))
    act(() => options.onStatus('RECONNECTING'))
    expect(result.current.encounterSession).toBeNull()
  })

  it('follows the live Campaign summary only while requested and connected', async () => {
    const summary = { characters: [], encounter: null }
    const { result, rerender } = renderHook(
      ({ campaignSummary }: { campaignSummary: boolean }) =>
        useCampaignLiveSession({ campaignId, campaignSummary, enabled: true }),
      { initialProps: { campaignSummary: true } }
    )
    await waitFor(() => expect(mocks.options).not.toBeNull())
    const options = mocks.options as Parameters<typeof createLiveSessionConnection>[0]
    expect(mocks.subscribeCampaignSummary).toHaveBeenLastCalledWith(true)

    act(() => {
      options.onStatus('CONNECTED')
      options.onCampaignSummary?.(summary)
    })
    expect(result.current.campaignSummary).toEqual(summary)
    act(() => options.onStatus('RECONNECTING'))
    expect(result.current.campaignSummary).toBeNull()

    act(() => options.onCampaignSummary?.(summary))
    rerender({ campaignSummary: false })
    expect(mocks.subscribeCampaignSummary).toHaveBeenLastCalledWith(false)
    expect(result.current.campaignSummary).toBeNull()
  })

  it('rejects missing Better Auth Convex tokens', async () => {
    mocks.getAccessToken.mockResolvedValue({ data: null })
    renderHook(() => useCampaignLiveSession({ campaignId, enabled: true, onTransient: vi.fn() }))

    await waitFor(() => expect(mocks.options).not.toBeNull())
    const options = mocks.options as Parameters<typeof createLiveSessionConnection>[0]
    await expect(options.getAccessToken()).rejects.toThrow('Unable to authenticate live play.')
  })

  it('stays disconnected and does not send while disabled', async () => {
    const { result } = renderHook(() =>
      useCampaignLiveSession({ campaignId, enabled: false, onTransient: vi.fn() })
    )

    expect(mocks.options).toBeNull()
    expect(result.current.commandReady).toBe(false)
    expect(result.current.recipientState).toBeNull()
    expect(result.current.sequence).toBeNull()
    expect(result.current.status).toBe('DISCONNECTED')
    expect(result.current.sendTransient(envelope)).toBe(false)
    await expect(result.current.sendCommand(command)).rejects.toThrow('Live play is not connected.')
  })
})
