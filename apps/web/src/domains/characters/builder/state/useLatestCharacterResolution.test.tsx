import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CharacterBuilderPayloadDto } from '@artificer-toolkit/schema/api/characters'
import {
  characterBuilderDraftPayloadFixture,
  characterBuilderPayloadFixture
} from '../fixtures/characterBuilder.fixtures'
import { toCharacterFormValues } from '../shared/formNormalization'
import { useLatestCharacterResolution } from './useLatestCharacterResolution'

const mocks = { resolve: vi.fn() }

describe('useLatestCharacterResolution', () => {
  beforeEach(() => {
    mocks.resolve.mockReset()
  })

  it('does nothing until an evaluator is ready', async () => {
    const onResolved = vi.fn()
    const { result } = renderHook(() =>
      useLatestCharacterResolution({ generation: 'draft:create', resolve: null, onResolved })
    )

    await act(
      async () => await result.current(toCharacterFormValues(characterBuilderPayloadFixture))
    )

    expect(onResolved).not.toHaveBeenCalled()
  })

  it('coalesces identical in-flight structural resolutions', async () => {
    const pending = deferred<CharacterBuilderPayloadDto>()
    const onResolved = vi.fn()
    mocks.resolve.mockReturnValueOnce(pending.promise)
    const { result } = renderHook(() =>
      useLatestCharacterResolution({
        generation: 'draft-generation:edit',
        resolve: mocks.resolve,
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

    expect(mocks.resolve).toHaveBeenCalledTimes(1)
    expect(secondPromise).toBe(firstPromise)

    pending.resolve(characterBuilderPayloadFixture)
    await act(async () => await firstPromise)

    expect(onResolved).toHaveBeenCalledWith(characterBuilderPayloadFixture)
  })

  it('resolves the latest values and ignores superseded responses', async () => {
    const first = deferred<CharacterBuilderPayloadDto>()
    const second = deferred<CharacterBuilderPayloadDto>()
    const onResolved = vi.fn()
    mocks.resolve.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const { result } = renderHook(() =>
      useLatestCharacterResolution({
        generation: 'draft-generation:edit',
        resolve: mocks.resolve,
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

    expect(mocks.resolve).toHaveBeenNthCalledWith(1, character)
    expect(mocks.resolve).toHaveBeenNthCalledWith(2, changedCharacter)

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
    mocks.resolve.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const { result, rerender, unmount } = renderHook(
      ({ generation }) =>
        useLatestCharacterResolution({ generation, resolve: mocks.resolve, onResolved }),
      { initialProps: { generation: 'first-generation:edit' } }
    )
    const character = toCharacterFormValues(characterBuilderPayloadFixture)
    let firstPromise!: Promise<void>
    let secondPromise!: Promise<void>
    act(() => {
      firstPromise = result.current(character)
    })
    rerender({ generation: 'second-generation:edit' })
    act(() => {
      secondPromise = result.current(character)
    })
    expect(mocks.resolve).toHaveBeenCalledTimes(2)
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
