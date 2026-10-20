import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CharacterPreparationOptionsResponseDto } from '@artificer-toolkit/schema/api/characterPreparationOptions'
import { buildContentSnapshotPart } from '@artificer-toolkit/rules-runtime/contentSnapshots'
import { useCharacterPreparationCatalogue } from './useCharacterPreparationCatalogue'
import { clearPrivateContentSnapshots } from './privateContent'

const token = vi.hoisted(() => vi.fn().mockResolvedValue('content-token'))
vi.mock('./contentOrigin', () => ({ contentOrigin: 'https://session.example.test' }))
vi.mock('./queries', () => ({ useContentSnapshotToken: () => token }))
const id = (value: number) => `00000000-0000-4000-8000-${String(value).padStart(12, '0')}`
const unusedRef = { sha256: '0'.repeat(64), byteLength: 1, rootCount: 0 }
const part = (label: string) =>
  buildContentSnapshotPart(
    { format: 3, scope: 'SOURCE', scopeId: id(3), kind: 'SPELL', part: 'list' },
    [
      {
        id: id(4),
        label,
        level: 1,
        publicId: 'spell',
        magicSchoolId: id(5),
        magicSchoolLabel: 'Evocation',
        classIds: [id(2)],
        castingTime: { unit: 'ROUND', amount: 1 }
      }
    ]
  )
function options(
  list: ReturnType<typeof part>,
  revision = 1,
  builtRevision = revision
): CharacterPreparationOptionsResponseDto {
  return {
    characterId: id(1),
    streamVersion: 4,
    classes: [
      {
        classId: id(2),
        label: 'Cleric',
        preparedSpellLimit: 3,
        eligibleSpellIds: [id(4)],
        preparedSpellIds: []
      }
    ],
    catalogue: {
      kind: 'SNAPSHOTS',
      manifest: {
        systemId: id(6),
        sources: [
          {
            contentSourceId: id(3),
            kind: 'USER',
            head: {
              scope: 'SOURCE',
              scopeId: id(3),
              revision,
              builtRevision,
              kinds: {
                SPELL: {
                  index: unusedRef,
                  documents: unusedRef,
                  list: {
                    sha256: list.sha256,
                    byteLength: list.byteLength,
                    rootCount: list.rootCount
                  }
                }
              }
            }
          }
        ],
        campaign: { id: id(7), contentMaturity: 'STANDARD', head: null }
      }
    }
  }
}
const wrapper = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
}
afterEach(() => vi.unstubAllGlobals())

describe('useCharacterPreparationCatalogue', () => {
  it('reads only immutable Spell list metadata once and applies Campaign plain-text policy', async () => {
    const list = part('Fucking Fire')
    const fetchObject = vi.fn().mockImplementation(async () => new Response(list.json))
    vi.stubGlobal('fetch', fetchObject)
    const { result, rerender } = renderHook(({ data }) => useCharacterPreparationCatalogue(data), {
      initialProps: { data: options(list) },
      wrapper: wrapper()
    })
    await waitFor(() =>
      expect(result.current.spells).toEqual([{ spellId: id(4), label: '****ing Fire', level: 1 }])
    )
    expect(fetchObject).toHaveBeenCalledTimes(1)
    expect(fetchObject.mock.calls[0]?.[0]).toContain(`/spell/list/${list.sha256}.json`)
    expect(fetchObject.mock.calls[0]?.[1].headers).toEqual({
      authorization: 'Bearer content-token'
    })
    rerender({ data: { ...options(list), streamVersion: 5 } })
    expect(fetchObject).toHaveBeenCalledTimes(1)
    await act(() => clearPrivateContentSnapshots(null))
    expect(result.current.spells).toBeUndefined()
    expect(result.current.isError).toBe(true)
    expect(fetchObject).toHaveBeenCalledTimes(1)
    rerender({ data: options(list) })
    await waitFor(() => expect(result.current.spells?.[0]?.label).toBe('****ing Fire'))
    expect(fetchObject).toHaveBeenCalledTimes(2)
  })

  it('reports rebuilding heads and clears old metadata while a new hash loads', async () => {
    const original = part('Original')
    const published = part('Published')
    let finish: ((response: Response) => void) | undefined
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(new Response(original.json))
        .mockImplementationOnce(
          () =>
            new Promise<Response>((resolve) => {
              finish = resolve
            })
        )
    )
    const { result, rerender } = renderHook(({ data }) => useCharacterPreparationCatalogue(data), {
      initialProps: { data: options(original, 2, 1) },
      wrapper: wrapper()
    })
    await waitFor(() => expect(result.current.spells?.[0]?.label).toBe('Original'))
    expect(result.current.updating).toBe(true)
    rerender({ data: options(published, 2) })
    expect(result.current.spells).toBeUndefined()
    expect(result.current.isPending).toBe(true)
    await waitFor(() => expect(finish).toBeDefined())
    finish!(new Response(published.json))
    await waitFor(() => expect(result.current.spells?.[0]?.label).toBe('Published'))
    expect(result.current.updating).toBe(false)
  })
})
