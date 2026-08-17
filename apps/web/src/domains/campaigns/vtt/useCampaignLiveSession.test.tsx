import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { PropsWithChildren } from 'react'
import type { LiveSessionWebSocketServerMessageDto } from '@artificer-toolkit/schema/api/liveSessions'
import type { CharacterSheetCommandResponseDto } from '@artificer-toolkit/schema/api/characterSheetCommands'
import { describe, expect, it, vi } from 'vitest'
import { queryKeys } from '#app/lib/queryKeys'
import type { createLiveSessionConnection } from './liveSessionClient'
import { tabletopGmEncounter } from './CampaignTabletop.stories.fixtures'
import { characterSheetFixture } from '#domains/characters/sheet/fixtures/characterSheet.fixtures'
import { useCampaignLiveSession } from './useCampaignLiveSession'

const mocks = vi.hoisted(() => ({
  close: vi.fn(),
  executeCommand: vi.fn(),
  options: null as unknown,
  sendCommand: vi.fn(() => true),
  sendTransient: vi.fn(() => true)
}))

vi.mock('./liveSessionClient', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./liveSessionClient')>()),
  createLiveSessionConnection: (options: unknown) => {
    mocks.options = options
    return {
      close: mocks.close,
      executeCommand: mocks.executeCommand,
      sendCommand: mocks.sendCommand,
      sendTransient: mocks.sendTransient
    }
  }
}))

describe('useCampaignLiveSession', () => {
  beforeEach(() => {
    mocks.options = null
    mocks.executeCommand.mockReset()
  })

  it('tracks live Encounter commands and applies the authoritative committed projection', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    })
    queryClient.setQueryData(queryKeys.encounters.list(tabletopGmEncounter.campaignId), [
      tabletopGmEncounter
    ])
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
    const commandId = crypto.randomUUID()
    const { result } = renderHook(
      () =>
        useCampaignLiveSession({
          campaignId: tabletopGmEncounter.campaignId,
          enabled: true,
          onTransient: () => undefined,
          sessionId: tabletopGmEncounter.sessionId
        }),
      { wrapper }
    )

    await waitFor(() => expect(mocks.options).not.toBeNull())
    act(() => {
      result.current.sendCommand({
        aggregateKind: 'ENCOUNTER',
        command: {
          commandId,
          encounterId: tabletopGmEncounter.id,
          expectedVersion: tabletopGmEncounter.version,
          type: 'ADVANCE_TURN'
        }
      })
    })
    expect(result.current.encounterCommandPending).toBe(true)

    const projection = {
      ...tabletopGmEncounter,
      currentActorId: tabletopGmEncounter.actors[1]!.id,
      version: tabletopGmEncounter.version + 1
    }
    const message = {
      acceptedSequence: 1,
      aggregateId: tabletopGmEncounter.id,
      aggregateKind: 'ENCOUNTER',
      deliverySequence: 1,
      originCommandId: commandId,
      replayed: false,
      response: { projection, resolution: null, roll: null },
      type: 'COMMAND_COMMITTED',
      version: projection.version
    } satisfies LiveSessionWebSocketServerMessageDto
    const options = mocks.options as Parameters<typeof createLiveSessionConnection>[0]
    act(() => options.onMessage(message))

    expect(result.current.encounterCommandPending).toBe(false)
    expect(
      queryClient.getQueryData<(typeof tabletopGmEncounter)[]>(
        queryKeys.encounters.list(tabletopGmEncounter.campaignId)
      )?.[0]?.currentActorId
    ).toBe(projection.currentActorId)
  })

  it('treats a delayed Character replay older than READY as a receipt instead of regressing the Sheet', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const currentSheet = structuredClone(characterSheetFixture)
    currentSheet.meta.streamVersion = 4
    queryClient.setQueryData(
      queryKeys.characters.sheet(currentSheet.meta.characterId),
      currentSheet
    )
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
    renderHook(
      () =>
        useCampaignLiveSession({
          campaignId: tabletopGmEncounter.campaignId,
          enabled: true,
          onTransient: () => undefined,
          sessionId: tabletopGmEncounter.sessionId
        }),
      { wrapper }
    )

    await waitFor(() => expect(mocks.options).not.toBeNull())
    const options = mocks.options as Parameters<typeof createLiveSessionConnection>[0]
    act(() =>
      options.onMessage({
        aggregateVersions: [
          {
            aggregateId: currentSheet.meta.characterId,
            aggregateKind: 'CHARACTER',
            version: 6
          }
        ],
        campaignId: tabletopGmEncounter.campaignId,
        deliverySequence: 2,
        sceneSnapshots: [],
        sessionId: tabletopGmEncounter.sessionId,
        type: 'READY'
      })
    )

    const replayedSheet = structuredClone(currentSheet)
    replayedSheet.meta.streamVersion = 5
    const response = {
      characterId: currentSheet.meta.characterId,
      panels: [],
      sheet: replayedSheet,
      streamVersion: 5
    } satisfies CharacterSheetCommandResponseDto
    act(() =>
      options.onMessage({
        acceptedSequence: 1,
        aggregateId: currentSheet.meta.characterId,
        aggregateKind: 'CHARACTER',
        deliverySequence: 1,
        originCommandId: crypto.randomUUID(),
        replayed: true,
        response,
        type: 'COMMAND_COMMITTED',
        version: 5
      })
    )

    expect(
      queryClient.getQueryData<typeof currentSheet>(
        queryKeys.characters.sheet(currentSheet.meta.characterId)
      )?.meta.streamVersion
    ).toBe(4)
  })

  it('invalidates Campaign authority data when a connected membership is revoked', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const detailKey = queryKeys.campaigns.detail(tabletopGmEncounter.campaignId)
    queryClient.setQueryData(detailKey, { id: tabletopGmEncounter.campaignId, role: 'OWNER' })
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
    renderHook(
      () =>
        useCampaignLiveSession({
          campaignId: tabletopGmEncounter.campaignId,
          enabled: true,
          onTransient: () => undefined,
          sessionId: tabletopGmEncounter.sessionId
        }),
      { wrapper }
    )

    await waitFor(() => expect(mocks.options).not.toBeNull())
    const options = mocks.options as Parameters<typeof createLiveSessionConnection>[0]
    act(() =>
      options.onMessage({
        code: 'UNAUTHORIZED',
        commandId: null,
        message: 'Campaign membership changed. Reconnect with a new ticket.',
        type: 'COMMAND_REJECTED'
      })
    )

    expect(queryClient.getQueryState(detailKey)?.isInvalidated).toBe(true)
  })
})
