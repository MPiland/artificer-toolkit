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
    const pendingOccurrenceKey = queryKeys.encounters.pendingOccurrence(tabletopGmEncounter.id)
    queryClient.setQueryData(pendingOccurrenceKey, { stale: true })
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
      changedAggregates: [
        {
          aggregateId: tabletopGmEncounter.id,
          aggregateKind: 'ENCOUNTER',
          version: projection.version
        }
      ],
      deliverySequence: 1,
      encounterActorTokenBindings: [],
      encounterSceneBindings: [],
      originCommandId: commandId,
      replayed: false,
      response: { occurrence: null, projection, resolution: null, roll: null },
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
    expect(
      queryClient.getQueryState(queryKeys.encounters.list(tabletopGmEncounter.campaignId))
        ?.isInvalidated
    ).toBe(false)
    expect(queryClient.getQueryData(pendingOccurrenceKey)).toBeNull()
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
        encounterActorTokenBindings: [],
        encounterSceneBindings: [],
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
        changedAggregates: [
          {
            aggregateId: currentSheet.meta.characterId,
            aggregateKind: 'CHARACTER',
            version: 5
          }
        ],
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

  it('invalidates cached aggregates when a refreshed READY advances authoritative versions', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const characterId = characterSheetFixture.meta.characterId
    const actionsKey = queryKeys.characters.actions(characterId)
    const sheetKey = queryKeys.characters.sheet(characterId)
    const panelsKey = queryKeys.characters.panels(characterId)
    const detailKey = queryKeys.characters.detail(characterId)
    const draftKey = queryKeys.characters.draft(characterId)
    const preparationOptionsKey = queryKeys.characters.preparationOptions(characterId)
    const encounterKey = queryKeys.encounters.list(tabletopGmEncounter.campaignId)
    const pendingOccurrenceKey = queryKeys.encounters.pendingOccurrence(tabletopGmEncounter.id)
    const campaignKey = queryKeys.campaigns.detail(tabletopGmEncounter.campaignId)
    for (const key of [
      sheetKey,
      actionsKey,
      panelsKey,
      detailKey,
      draftKey,
      preparationOptionsKey,
      encounterKey,
      pendingOccurrenceKey,
      campaignKey
    ]) {
      queryClient.setQueryData(key, { cached: true })
    }
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
    const ready = (characterVersion: number, encounterVersion: number, campaignVersion: number) =>
      ({
        aggregateVersions: [
          {
            aggregateId: tabletopGmEncounter.campaignId,
            aggregateKind: 'CAMPAIGN',
            version: campaignVersion
          },
          { aggregateId: characterId, aggregateKind: 'CHARACTER', version: characterVersion },
          {
            aggregateId: tabletopGmEncounter.id,
            aggregateKind: 'ENCOUNTER',
            version: encounterVersion
          }
        ],
        campaignId: tabletopGmEncounter.campaignId,
        deliverySequence: 0,
        encounterActorTokenBindings: [],
        encounterSceneBindings: [],
        sceneSnapshots: [],
        sessionId: tabletopGmEncounter.sessionId,
        type: 'READY'
      }) satisfies LiveSessionWebSocketServerMessageDto

    act(() => options.onMessage(ready(1, tabletopGmEncounter.version, 3)))
    for (const key of [
      sheetKey,
      actionsKey,
      panelsKey,
      detailKey,
      draftKey,
      preparationOptionsKey,
      encounterKey,
      pendingOccurrenceKey,
      campaignKey
    ]) {
      expect(queryClient.getQueryState(key)?.isInvalidated).toBe(false)
    }

    act(() => options.onMessage(ready(2, tabletopGmEncounter.version + 1, 4)))
    await waitFor(() => {
      for (const key of [
        sheetKey,
        actionsKey,
        panelsKey,
        detailKey,
        draftKey,
        preparationOptionsKey,
        encounterKey,
        pendingOccurrenceKey,
        campaignKey
      ]) {
        expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true)
      }
    })
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
