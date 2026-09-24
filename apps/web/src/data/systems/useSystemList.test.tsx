import type { SystemListPageDto } from '@artificer-toolkit/schema/api/systems'
import { systemListPageInputDtoSchema } from '@artificer-toolkit/schema/api/systems'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { authoredRouteStorySystems } from '#domains/authoredRouteStory.fixtures'
import { getSystemListPage, loadSystemList } from './queries'
import { useSystemList } from './useSystemList'

const clients: QueryClient[] = []
afterEach(() => clients.splice(0).forEach((client) => client.clear()))

function page(index: number, continueCursor = ''): SystemListPageDto {
  return {
    page: [
      {
        ...authoredRouteStorySystems[0]!,
        id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
        label: `System ${index}`
      }
    ],
    isDone: !continueCursor,
    continueCursor
  }
}

function setup(
  read: (cursor: string | null) => SystemListPageDto | Promise<SystemListPageDto>,
  enabled = true
) {
  const queryFn = vi.fn(({ queryKey }: { queryKey: readonly unknown[] }) => {
    expect(queryKey[1]).toBe('content/systems:list')
    const input = systemListPageInputDtoSchema.parse(queryKey[2])
    expect(input.limit).toBe(10)
    return read(input.cursor)
  })
  const client = new QueryClient({ defaultOptions: { queries: { queryFn, retry: false } } })
  clients.push(client)
  const hook = renderHook((active: boolean) => useSystemList(active), {
    initialProps: enabled,
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
  })
  return { ...hook, client, queryFn }
}

it('withholds partial lists until every native page is loaded and applies later page updates', async () => {
  let complete: ((result: SystemListPageDto) => void) | undefined
  const hook = setup((cursor) =>
    cursor === null
      ? page(1, 'second')
      : new Promise((resolve) => {
          complete = resolve
        })
  )
  await waitFor(() => expect(hook.queryFn).toHaveBeenCalledTimes(2))
  expect(hook.result.current).toEqual({ data: undefined, isPending: true, isError: false })
  await act(async () => complete!(page(2)))
  await waitFor(() => expect(hook.result.current.data).toEqual([...page(1).page, ...page(2).page]))
  act(() => hook.client.setQueryData(getSystemListPage('second').queryKey, page(3)))
  await waitFor(() => expect(hook.result.current.data).toEqual([...page(1).page, ...page(3).page]))
  expect(hook.queryFn).toHaveBeenCalledTimes(2)
})

it('replaces a changed cursor chain and removes a formerly populated tail', async () => {
  const hook = setup((cursor) =>
    cursor === null ? page(1, 'second') : cursor === 'second' ? page(2) : page(3)
  )
  await waitFor(() => expect(hook.result.current.data).toHaveLength(2))
  act(() => hook.client.setQueryData(getSystemListPage().queryKey, page(4, 'replacement')))
  await waitFor(() => expect(hook.result.current.data).toEqual([...page(4).page, ...page(3).page]))
  act(() => hook.client.setQueryData(getSystemListPage().queryKey, page(5)))
  await waitFor(() => expect(hook.result.current.data).toEqual(page(5).page))
})

it('does not request pages while disabled and resumes without exposing partial data', async () => {
  const hook = setup(() => page(1), false)
  expect(hook.queryFn).not.toHaveBeenCalled()
  hook.rerender(true)
  await waitFor(() => expect(hook.result.current.data).toEqual(page(1).page))
  hook.rerender(false)
  expect(hook.result.current.data).toBeUndefined()
  hook.rerender(true)
  await waitFor(() => expect(hook.result.current.data).toEqual(page(1).page))
  expect(hook.queryFn).toHaveBeenCalledTimes(1)
})

it('treats an empty terminal page as a complete empty selection', async () => {
  const hook = setup(() => ({ page: [], isDone: true, continueCursor: '' }))
  await waitFor(() =>
    expect(hook.result.current).toEqual({ data: [], isPending: false, isError: false })
  )
})

it('fails the whole list when a later page fails rather than presenting partial options', async () => {
  const hook = setup((cursor) => {
    if (cursor === null) return page(1, 'second')
    throw new Error('System lookup failed')
  })
  await waitFor(() =>
    expect(hook.result.current).toEqual({ data: undefined, isPending: false, isError: true })
  )
})

it.each(['', 'second'])(
  'rejects invalid continuation %j in both the hook and loader',
  async (cursor) => {
    const hook = setup((current) =>
      current === null ? page(1, 'second') : { ...page(2), isDone: false, continueCursor: cursor }
    )
    await waitFor(() => expect(hook.result.current.isError).toBe(true))
    await expect(loadSystemList(hook.client)).rejects.toThrow('Invalid System page continuation.')
    expect(hook.queryFn).toHaveBeenCalledTimes(2)
  }
)

it('loads more than 25 preloaded pages without a render-depth limit or a System count cap', async () => {
  const hook = setup((cursor) => {
    const index = Number(cursor ?? 0)
    return page(index, index === 30 ? '' : String(index + 1))
  }, false)
  for (let index = 0; index <= 30; index++) {
    hook.client.setQueryData(
      getSystemListPage(index === 0 ? null : String(index)).queryKey,
      page(index, index === 30 ? '' : String(index + 1))
    )
  }
  hook.rerender(true)
  await waitFor(() => expect(hook.result.current.data).toHaveLength(31))
  expect(await loadSystemList(hook.client)).toEqual(hook.result.current.data)
  expect(hook.queryFn).not.toHaveBeenCalled()
})
