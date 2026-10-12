import { projectCharacterSheetSlice } from '@artificer-toolkit/rules-runtime/character/sheetSlices'
import { act, renderHook, waitFor } from '@testing-library/react'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import { ConvexProvider, ConvexReactClient } from 'convex/react'
import { getFunctionName } from 'convex/server'
import type { OptimisticLocalStore } from 'convex/browser'
import { ConvexQueryClient } from '@convex-dev/react-query'
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { createAppQueryClient } from '#app/query/createAppQueryClient'
import { createSheet } from '#domains/characters/sheet/tests/sheetTestHarness'
import { itemPanelFixture } from '#domains/characters/sheet/inspector/inspector.fixtures'
import { getCharacterSheetSlice } from './queries'
import { useCharacterRestPreviewMutation, useCharacterSheetCommandMutation } from './mutations'

function setup() {
  const client = new ConvexReactClient('https://sheet-test.convex.cloud')
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ConvexProvider client={client}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ConvexProvider>
  )
  return { client, queryClient, wrapper }
}

const command = {
  commandId: '00000000-0000-4000-8000-000000000001',
  expectedVersion: 4,
  type: 'ADJUST_HIT_POINTS' as const,
  mode: 'DAMAGE' as const,
  amount: 1
}

const rest = {
  restKind: 'SHORT' as const,
  expectedVersion: 4,
  selectedHitDice: [],
  resetMaximumHitPointModifier: false,
  healingMode: 'AUTOMATIC' as const,
  manualHealingAccepted: false,
  selectedCompanionInstanceIds: [],
  requestRoll: false as const
}

describe('native character sheet mutations', () => {
  it('passes the character id and command to the generated mutation', async () => {
    const { client, queryClient, wrapper } = setup()
    const sheet = createSheet()
    const mutation = vi.spyOn(client, 'mutation').mockResolvedValue({
      characterId: sheet.meta.characterId,
      streamVersion: 5
    })
    const hook = renderHook(() => useCharacterSheetCommandMutation('character-1'), { wrapper })
    await act(async () => {
      await hook.result.current.mutateAsync(command)
    })
    expect(mutation).toHaveBeenCalledWith(
      convexApi.characters.sheetCommands.execute,
      { id: 'character-1', command },
      expect.anything()
    )
    hook.unmount()
    queryClient.clear()
    await client.close()
  })

  it('uses the campaign endpoint and limits optimistic updates to its matching Sheet queries', async () => {
    const { client, queryClient, wrapper } = setup()
    const campaignId = '00000000-0000-4000-8000-000000000123'
    const sheet = createSheet()
    sheet.meta.campaignId = campaignId
    const panel = { ...itemPanelFixture, characterId: sheet.meta.characterId }
    const mutation = vi.spyOn(client, 'mutation').mockResolvedValue({
      characterId: sheet.meta.characterId,
      streamVersion: 5
    })
    const hook = renderHook(
      () => useCharacterSheetCommandMutation(sheet.meta.characterId, campaignId),
      { wrapper }
    )
    try {
      await act(async () => {
        await hook.result.current.mutateAsync(command)
      })
      expect(mutation).toHaveBeenCalledWith(
        convexApi.campaigns.characterSheet.execute,
        { campaignId, characterId: sheet.meta.characterId, command },
        expect.anything()
      )

      const update = mutation.mock.calls[0]?.[2]?.optimisticUpdate
      expect(update).toBeTypeOf('function')
      const write = vi.fn<OptimisticLocalStore['setQuery']>()
      const store: OptimisticLocalStore = {
        getQuery: () => undefined,
        getAllQueries: vi
          .fn()
          .mockImplementation((reference: Parameters<OptimisticLocalStore['getAllQueries']>[0]) => {
            const name = getFunctionName(reference)
            if (name === getFunctionName(convexApi.characters.sheetSlices.get)) {
              return [
                {
                  args: { campaignId, id: sheet.meta.characterId, slice: 'COMMON' },
                  value: projectCharacterSheetSlice(sheet, 'COMMON')
                },
                {
                  args: { id: 'public-alias', slice: 'COMMON' },
                  value: projectCharacterSheetSlice(sheet, 'COMMON')
                },
                {
                  args: { id: 'public-alias', slice: 'ACTIONS' },
                  value: projectCharacterSheetSlice(sheet, 'ACTIONS')
                },
                {
                  args: {
                    campaignId: 'other-campaign',
                    id: sheet.meta.characterId,
                    slice: 'COMMON'
                  },
                  value: projectCharacterSheetSlice(sheet, 'COMMON')
                },
                {
                  args: { campaignId, id: 'other-character', slice: 'COMMON' },
                  value: projectCharacterSheetSlice(
                    { ...sheet, meta: { ...sheet.meta, characterId: 'other-character' } },
                    'COMMON'
                  )
                },
                {
                  args: { id: 'other-campaign-alias', slice: 'COMMON' },
                  value: projectCharacterSheetSlice(
                    { ...sheet, meta: { ...sheet.meta, campaignId: 'other-campaign' } },
                    'COMMON'
                  )
                }
              ]
            }
            if (name === getFunctionName(convexApi.campaigns.characterSheet.panel)) {
              return [
                {
                  args: { campaignId, characterId: sheet.meta.characterId, target: panel.target },
                  value: panel
                },
                {
                  args: {
                    campaignId: 'other-campaign',
                    characterId: sheet.meta.characterId,
                    target: panel.target
                  },
                  value: panel
                }
              ]
            }
            return []
          }),
        setQuery: write
      }
      update?.(store, { campaignId, characterId: sheet.meta.characterId, command })
      expect(write).toHaveBeenCalledTimes(4)
      expect(write).toHaveBeenCalledWith(
        convexApi.characters.sheetSlices.get,
        { campaignId, id: sheet.meta.characterId, slice: 'COMMON' },
        expect.objectContaining({
          data: expect.objectContaining({
            overview: expect.objectContaining({ currentHitPoints: 10, tempHitPoints: 2 })
          })
        })
      )
      expect(write).toHaveBeenCalledWith(
        convexApi.campaigns.characterSheet.panel,
        { campaignId, characterId: sheet.meta.characterId, target: panel.target },
        panel
      )
      expect(write).toHaveBeenCalledWith(
        convexApi.characters.sheetSlices.get,
        { id: 'public-alias', slice: 'COMMON' },
        expect.objectContaining({
          data: expect.objectContaining({ overview: expect.objectContaining({ tempHitPoints: 2 }) })
        })
      )
      write.mockClear()
      update?.(store, {
        campaignId,
        characterId: sheet.meta.characterId,
        command: {
          commandId: command.commandId,
          expectedVersion: command.expectedVersion,
          type: 'USE_RESOURCE',
          resourceGrantId: sheet.resources.items[0]!.id
        }
      })
      expect(write).toHaveBeenCalledTimes(4)
      expect(write).toHaveBeenCalledWith(
        convexApi.characters.sheetSlices.get,
        { id: 'public-alias', slice: 'ACTIONS' },
        expect.objectContaining({
          data: expect.objectContaining({
            resources: {
              items: [
                expect.objectContaining({
                  used: sheet.resources.items[0]!.used + 1,
                  remaining: sheet.resources.items[0]!.remaining - 1
                })
              ]
            }
          })
        })
      )
    } finally {
      hook.unmount()
      queryClient.clear()
      await client.close()
    }
  })

  it('projects only matching canonical identities across UUID and alias caches', async () => {
    const { client, queryClient, wrapper } = setup()
    const sheet = createSheet()
    const panel = { ...itemPanelFixture, characterId: sheet.meta.characterId }
    const mutation = vi.spyOn(client, 'mutation').mockResolvedValue({
      characterId: sheet.meta.characterId,
      streamVersion: 5
    })
    const hook = renderHook(() => useCharacterSheetCommandMutation(sheet.meta.characterId), {
      wrapper
    })
    try {
      await act(async () => {
        await hook.result.current.mutateAsync(command)
      })
      const update = mutation.mock.calls[0]?.[2]?.optimisticUpdate
      expect(update).toBeTypeOf('function')
      const write = vi.fn<OptimisticLocalStore['setQuery']>()
      const store: OptimisticLocalStore = {
        getQuery: () => undefined,
        getAllQueries: vi
          .fn()
          .mockImplementation((reference: Parameters<OptimisticLocalStore['getAllQueries']>[0]) =>
            getFunctionName(reference) === getFunctionName(convexApi.characters.sheetSlices.get)
              ? [
                  {
                    args: { id: sheet.meta.characterId, slice: 'COMMON' },
                    value: projectCharacterSheetSlice(sheet, 'COMMON')
                  },
                  {
                    args: { id: 'alias', slice: 'COMMON' },
                    value: projectCharacterSheetSlice(sheet, 'COMMON')
                  },
                  { args: { id: 'unloaded', slice: 'COMMON' }, value: undefined },
                  { args: { id: 'absent', slice: 'COMMON' }, value: null },
                  {
                    args: { id: sheet.meta.characterId, slice: 'COMMON' },
                    value: projectCharacterSheetSlice(
                      { ...sheet, meta: { ...sheet.meta, characterId: 'other' } },
                      'COMMON'
                    )
                  }
                ]
              : [
                  { args: { id: sheet.meta.characterId, target: panel.target }, value: panel },
                  { args: { id: 'alias', target: panel.target }, value: panel },
                  { args: { id: 'unloaded', target: panel.target }, value: undefined },
                  {
                    args: { id: sheet.meta.characterId, target: panel.target },
                    value: { ...panel, characterId: 'other' }
                  }
                ]
          ),
        setQuery: write
      }
      update?.(store, { id: sheet.meta.characterId, command })
      expect(write).toHaveBeenCalledTimes(4)
      for (const id of [sheet.meta.characterId, 'alias']) {
        expect(write).toHaveBeenCalledWith(
          convexApi.characters.sheetSlices.get,
          { id, slice: 'COMMON' },
          expect.objectContaining({
            data: expect.objectContaining({
              overview: expect.objectContaining({ currentHitPoints: 10, tempHitPoints: 2 })
            })
          })
        )
        expect(write).toHaveBeenCalledWith(
          convexApi.characters.panels.get,
          { id, target: panel.target },
          panel
        )
      }
      expect(sheet.overview.tempHitPoints).toBe(3)

      write.mockClear()
      const resource = panel.resources[0]!
      update?.(store, {
        id: sheet.meta.characterId,
        command: {
          commandId: command.commandId,
          expectedVersion: command.expectedVersion,
          type: 'USE_RESOURCE',
          resourceGrantId: resource.id
        }
      })
      expect(write).toHaveBeenCalledTimes(4)
      expect(write).toHaveBeenCalledWith(
        convexApi.characters.panels.get,
        { id: 'alias', target: panel.target },
        expect.objectContaining({
          resources: [expect.objectContaining({ remaining: resource.remaining - 1 })]
        })
      )
      expect(panel.resources[0]?.remaining).toBe(resource.remaining)
    } finally {
      hook.unmount()
      queryClient.clear()
      await client.close()
    }
  })

  it('keeps a newer pushed Sheet when a command returns an older receipt', async () => {
    const client = new ConvexReactClient('https://sheet-test.convex.cloud')
    const original = createSheet()
    let current = projectCharacterSheetSlice(original, 'COMMON')
    const callbacks = new Set<() => void>()
    vi.spyOn(client, 'watchQuery').mockReturnValue({
      localQueryResult: () => current,
      journal: () => undefined,
      onUpdate: (callback) => {
        callbacks.add(callback)
        return () => callbacks.delete(callback)
      }
    })
    const read = vi.spyOn(client, 'query').mockImplementation(async () => current)
    vi.spyOn(client, 'mutation').mockImplementation(async () => {
      current = projectCharacterSheetSlice(
        { ...original, meta: { ...original.meta, streamVersion: 9 } },
        'COMMON'
      )
      for (const callback of callbacks) callback()
      return {
        characterId: original.meta.characterId,
        streamVersion: 5
      }
    })
    const convex = new ConvexQueryClient(client)
    const queryClient = createAppQueryClient(convex)
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ConvexProvider client={client}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </ConvexProvider>
    )
    const query = getCharacterSheetSlice('alias', 'COMMON')
    const hook = renderHook(
      () => ({
        sheet: useQuery(query),
        mutation: useCharacterSheetCommandMutation(original.meta.characterId)
      }),
      { wrapper }
    )
    try {
      await waitFor(() => expect(hook.result.current.sheet.data?.meta.streamVersion).toBe(4))
      expect(
        queryClient.getQueryCache().find({ queryKey: query.queryKey })?.getObserversCount()
      ).toBe(1)
      await act(async () => {
        await hook.result.current.mutation.mutateAsync(command)
      })
      await waitFor(() => expect(hook.result.current.sheet.data?.meta.streamVersion).toBe(9))
      expect(queryClient.getQueryData(query.queryKey)).toMatchObject({
        data: { meta: { streamVersion: 9 } }
      })
      expect(read).toHaveBeenCalledTimes(1)
    } finally {
      hook.unmount()
      queryClient.clear()
      convex.unsubscribe?.()
      await client.close()
    }
  })

  it('ends a Concentration on Convex first and then in the room, with the same command', async () => {
    const { client, queryClient, wrapper } = setup()
    const campaignId = '00000000-0000-4000-8000-000000000123'
    const calls: string[] = []
    const mutation = vi.spyOn(client, 'mutation').mockImplementation(async () => {
      calls.push('convex')
      return { characterId: 'character-1', streamVersion: 5 }
    })
    const room = vi.fn(async () => {
      calls.push('room')
      return { characterId: 'character-1', streamVersion: 4 }
    })
    const end = {
      commandId: command.commandId,
      expectedVersion: 4,
      type: 'END_CONCENTRATION' as const
    }
    const hook = renderHook(
      () => useCharacterSheetCommandMutation('character-1', campaignId, null, room),
      { wrapper }
    )
    try {
      let response: unknown
      await act(async () => {
        response = await hook.result.current.mutateAsync(end)
      })
      expect(calls).toEqual(['convex', 'room'])
      expect(room).toHaveBeenCalledWith(end)
      expect(mutation).toHaveBeenCalledWith(
        convexApi.campaigns.characterSheet.execute,
        { campaignId, characterId: 'character-1', command: end },
        expect.anything()
      )
      expect(response).toEqual({ characterId: 'character-1', streamVersion: 5 })

      calls.length = 0
      mutation.mockRejectedValueOnce(new Error('This Character is not concentrating.'))
      await act(async () => {
        await expect(hook.result.current.mutateAsync(end)).rejects.toThrow('not concentrating')
      })
      expect(calls).toEqual([])
    } finally {
      hook.unmount()
      queryClient.clear()
      await client.close()
    }
  })

  it('forwards native rest preview query errors through TanStack mutation', async () => {
    const { client, queryClient, wrapper } = setup()
    const error = new Error('preview failed')
    const query = vi.spyOn(client, 'query').mockRejectedValue(error)
    const hook = renderHook(() => useCharacterRestPreviewMutation('character-1'), { wrapper })
    await act(async () => {
      await expect(hook.result.current.mutateAsync(rest)).rejects.toBe(error)
    })
    expect(query).toHaveBeenCalledWith(convexApi.characters.rest.preview, {
      id: 'character-1',
      input: rest
    })
    hook.unmount()
    queryClient.clear()
    await client.close()
  })

  it('uses the campaign rest preview endpoint for a campaign sheet', async () => {
    const { client, queryClient, wrapper } = setup()
    const campaignId = '00000000-0000-4000-8000-000000000123'
    const query = vi.spyOn(client, 'query').mockResolvedValue({})
    const hook = renderHook(() => useCharacterRestPreviewMutation('character-1', campaignId), {
      wrapper
    })
    await act(async () => {
      await hook.result.current.mutateAsync(rest)
    })
    expect(query).toHaveBeenCalledWith(convexApi.campaigns.characterSheet.restPreview, {
      campaignId,
      characterId: 'character-1',
      input: rest
    })
    hook.unmount()
    queryClient.clear()
    await client.close()
  })
})
