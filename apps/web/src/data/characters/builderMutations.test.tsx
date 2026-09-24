import { act, renderHook } from '@testing-library/react'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import { ConvexProvider, ConvexReactClient } from 'convex/react'
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import {
  characterBuilderPayloadFixture,
  characterPreviewFixture
} from '#domains/characters/builder/fixtures/characterBuilder.fixtures'
import {
  normalizeCharacterForDraft,
  toCharacterFormValues
} from '#domains/characters/builder/shared/formNormalization'
import { characterBuilderResolveInputSchema } from '@artificer-toolkit/schema/api/characterBuilderQueries'
import {
  useCommitCharacterBuilderMutation,
  useCreateCharacterDraftMutation,
  useDiscardCharacterDraftMutation,
  usePreviewCharacterSaveMutation,
  useResolveCharacterBuilderMutation,
  useSaveCharacterDraftMutation
} from './mutations'

function setup() {
  const client = new ConvexReactClient('https://builder-test.convex.cloud')
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ConvexProvider client={client}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ConvexProvider>
  )
  return { client, queryClient, wrapper }
}

const input = {
  character: normalizeCharacterForDraft(toCharacterFormValues(characterBuilderPayloadFixture)),
  mode: 'edit' as const,
  expectedDraftId: '00000000-0000-4000-8000-000000000201'
}

const nativePayload = { ...characterBuilderPayloadFixture, character: input.character }
const nativePreview = { ...characterPreviewFixture, character: input.character }

const draft = {
  characterId: input.character.id,
  publicId: 'character-draft',
  userId: 'user-1',
  systemId: input.character.systemId,
  label: input.character.label,
  status: 'DRAFT' as const,
  draftState: 'DRAFT_ONLY' as const,
  id: input.expectedDraftId,
  mode: 'edit' as const,
  payload: { character: input.character }
}

describe('native character Builder mutations', () => {
  it('writes drafts through native mutations with the expected draft generation', async () => {
    const { client, queryClient, wrapper } = setup()
    const mutation = vi
      .spyOn(client, 'mutation')
      .mockResolvedValueOnce(draft)
      .mockResolvedValueOnce(draft)
      .mockResolvedValueOnce({ ok: true as const })
    const create = renderHook(() => useCreateCharacterDraftMutation(), { wrapper })
    const save = renderHook(() => useSaveCharacterDraftMutation(), { wrapper })
    const discard = renderHook(() => useDiscardCharacterDraftMutation(), { wrapper })
    const createInput = { id: input.character.id, systemId: input.character.systemId }
    const saveInput = {
      characterId: input.character.id,
      expectedDraftId: input.expectedDraftId,
      character: input.character,
      mode: 'edit' as const,
      builderIntent: undefined,
      baseActiveUpdatedAt: undefined
    }
    const serializedSaveInput = {
      characterId: input.character.id,
      expectedDraftId: input.expectedDraftId,
      character: input.character,
      mode: 'edit' as const
    }
    await act(async () => {
      await create.result.current.mutateAsync(createInput)
      await save.result.current.mutateAsync(saveInput)
      await discard.result.current.mutateAsync({
        id: input.character.id,
        expectedDraftId: input.expectedDraftId
      })
    })
    expect(mutation).toHaveBeenNthCalledWith(
      1,
      convexApi.characters.drafts.create,
      createInput,
      expect.anything()
    )
    expect(mutation).toHaveBeenNthCalledWith(
      2,
      convexApi.characters.drafts.save,
      serializedSaveInput,
      expect.anything()
    )
    expect(mutation).toHaveBeenNthCalledWith(
      3,
      convexApi.characters.drafts.discard,
      {
        id: input.character.id,
        expectedDraftId: input.expectedDraftId
      },
      expect.anything()
    )
    create.unmount()
    save.unmount()
    discard.unmount()
    queryClient.clear()
    await client.close()
  })

  it('queries resolve and preview with the generated native references and draft generation', async () => {
    const { client, queryClient, wrapper } = setup()
    const query = vi
      .spyOn(client, 'query')
      .mockResolvedValueOnce(nativePayload)
      .mockResolvedValueOnce(nativePreview)
    const resolve = renderHook(() => useResolveCharacterBuilderMutation(), { wrapper })
    const preview = renderHook(() => usePreviewCharacterSaveMutation(), { wrapper })
    await act(async () => {
      await resolve.result.current.mutateAsync(input)
      await preview.result.current.mutateAsync(input)
    })
    expect(query).toHaveBeenNthCalledWith(1, convexApi.characters.builder.resolve, input)
    expect(query).toHaveBeenNthCalledWith(2, convexApi.characters.builder.preview, input)
    expect(input).toHaveProperty('expectedDraftId')
    expect(input).not.toHaveProperty('targetStatus')
    expect(input).not.toHaveProperty('authoredContentUpgradePreviewChecksum')
    resolve.unmount()
    preview.unmount()
    queryClient.clear()
    await client.close()
  })

  it('commits through the native mutation and parses the native receipt', async () => {
    const { client, queryClient, wrapper } = setup()
    const mutation = vi.spyOn(client, 'mutation').mockResolvedValue({
      character: input.character,
      publicId: 'character-owned',
      streamVersion: 2
    })
    const hook = renderHook(() => useCommitCharacterBuilderMutation(), { wrapper })
    await act(async () => {
      await hook.result.current.mutateAsync(input)
    })
    expect(mutation).toHaveBeenCalledWith(
      convexApi.characters.commit.commit,
      input,
      expect.anything()
    )
    hook.unmount()
    queryClient.clear()
    await client.close()
  })

  it('rejects retired Builder request fields and missing draft generations', () => {
    expect(() => characterBuilderResolveInputSchema.parse({ ...input, request: input })).toThrow()
    expect(() =>
      characterBuilderResolveInputSchema.parse({ character: input.character, mode: 'edit' })
    ).toThrow()
  })
})
