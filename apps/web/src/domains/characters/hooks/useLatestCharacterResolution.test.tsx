import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CharacterBuilderPayloadDto } from '@artificer-toolkit/schema/api/characters'
import {
  characterBuilderDraftPayloadFixture,
  characterBuilderPayloadFixture
} from '../character.fixtures'
import { toCharacterFormValues } from '../characterBuilder.utils'
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
    const { result } = renderHook(() => useLatestCharacterResolution({
      mode: 'edit',
      onResolved
    }))
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

  it('aborts superseded resolutions and ignores their late responses', async () => {
    const first = deferred<CharacterBuilderPayloadDto>()
    const second = deferred<CharacterBuilderPayloadDto>()
    const onResolved = vi.fn()
    mocks.mutateAsync
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
    const { result } = renderHook(() => useLatestCharacterResolution({
      mode: 'edit',
      onResolved
    }))
    const character = toCharacterFormValues(characterBuilderPayloadFixture)
    const changedCharacter = structuredClone(character)
    changedCharacter.intent.classes[0].classLevel += 1
    let firstPromise!: Promise<void>
    let secondPromise!: Promise<void>

    act(() => {
      firstPromise = result.current(character)
      secondPromise = result.current(changedCharacter)
    })

    const firstRequest = mocks.mutateAsync.mock.calls[0]?.[0] as {
      signal?: AbortSignal
    }
    expect(firstRequest.signal?.aborted).toBe(true)

    second.resolve(characterBuilderDraftPayloadFixture)
    await act(async () => await secondPromise)
    first.resolve(characterBuilderPayloadFixture)
    await act(async () => await firstPromise)

    expect(onResolved).toHaveBeenCalledTimes(1)
    expect(onResolved).toHaveBeenCalledWith(characterBuilderDraftPayloadFixture)
  })
})

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })

  return { promise, resolve }
}
