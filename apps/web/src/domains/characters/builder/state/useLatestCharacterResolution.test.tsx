import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CharacterBuilderPayloadDto } from '@artificer-toolkit/schema/api/characters'
import {
  characterBuilderDraftPayloadFixture,
  characterBuilderPayloadFixture
} from '../fixtures/characterBuilder.fixtures'
import { normalizeCharacterForDraft, toCharacterFormValues } from '../shared/formNormalization'
import { useLatestCharacterResolution } from './useLatestCharacterResolution'

const mocks = vi.hoisted(() => ({
  mutateAsync: vi.fn()
}))

vi.mock('#app/data/characters/mutations', () => ({
  useResolveCharacterBuilderMutation: () => ({ mutateAsync: mocks.mutateAsync })
}))

describe('useLatestCharacterResolution', () => {
  beforeEach(() => {
    mocks.mutateAsync.mockReset()
  })

  it('coalesces identical in-flight structural resolutions', async () => {
    const pending = deferred<CharacterBuilderPayloadDto>()
    const onResolved = vi.fn()
    mocks.mutateAsync.mockReturnValueOnce(pending.promise)
    const { result } = renderHook(() =>
      useLatestCharacterResolution({
        expectedDraftId: 'draft-generation',
        mode: 'edit',
        onResolved
      })
    )
    const character = toCharacterFormValues(characterBuilderPayloadFixture)
    let firstPromise!: Promise<void>
    let secondPromise!: Promise<void>

    act(() => {
      firstPromise = result.current(character)
      secondPromise = result.current(structuredClone(character))
    })

    expect(mocks.mutateAsync).toHaveBeenCalledTimes(1)
    expect(secondPromise).toBe(firstPromise)

    pending.resolve(characterBuilderPayloadFixture)
    await act(async () => await firstPromise)

    expect(onResolved).toHaveBeenCalledWith(characterBuilderPayloadFixture)
  })

  it('sends native generation-bound inputs and ignores superseded responses', async () => {
    const first = deferred<CharacterBuilderPayloadDto>()
    const second = deferred<CharacterBuilderPayloadDto>()
    const onResolved = vi.fn()
    mocks.mutateAsync.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const { result } = renderHook(() =>
      useLatestCharacterResolution({
        expectedDraftId: 'draft-generation',
        mode: 'edit',
        onResolved
      })
    )
    const character = toCharacterFormValues(characterBuilderPayloadFixture)
    const changedCharacter = structuredClone(character)
    changedCharacter.intent.classes[0].classLevel += 1
    let firstPromise!: Promise<void>
    let secondPromise!: Promise<void>

    act(() => {
      firstPromise = result.current(character)
      secondPromise = result.current(changedCharacter)
    })

    expect(mocks.mutateAsync).toHaveBeenNthCalledWith(1, {
      character: normalizeCharacterForDraft(character),
      mode: 'edit',
      expectedDraftId: 'draft-generation'
    })

    second.resolve(characterBuilderDraftPayloadFixture)
    await act(async () => await secondPromise)
    first.resolve(characterBuilderPayloadFixture)
    await act(async () => await firstPromise)

    expect(onResolved).toHaveBeenCalledTimes(1)
    expect(onResolved).toHaveBeenCalledWith(characterBuilderDraftPayloadFixture)
  })

  it('ignores prior generations and responses received after unmount', async () => {
    const first = deferred<CharacterBuilderPayloadDto>()
    const second = deferred<CharacterBuilderPayloadDto>()
    const onResolved = vi.fn()
    mocks.mutateAsync.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const { result, rerender, unmount } = renderHook(
      ({ expectedDraftId }) =>
        useLatestCharacterResolution({ expectedDraftId, mode: 'edit', onResolved }),
      { initialProps: { expectedDraftId: 'first-generation' } }
    )
    const character = toCharacterFormValues(characterBuilderPayloadFixture)
    let firstPromise!: Promise<void>
    let secondPromise!: Promise<void>
    act(() => {
      firstPromise = result.current(character)
    })
    rerender({ expectedDraftId: 'second-generation' })
    act(() => {
      secondPromise = result.current(character)
    })
    expect(mocks.mutateAsync).toHaveBeenCalledTimes(2)
    first.resolve(characterBuilderPayloadFixture)
    await act(async () => await firstPromise)
    expect(onResolved).not.toHaveBeenCalled()
    unmount()
    second.resolve(characterBuilderDraftPayloadFixture)
    await act(async () => await secondPromise)
    expect(onResolved).not.toHaveBeenCalled()
  })
})

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })

  return { promise, resolve }
}
