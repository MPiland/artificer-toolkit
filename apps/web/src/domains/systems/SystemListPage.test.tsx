import { QueryClient, QueryClientProvider, type QueryFunctionContext } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Suspense } from 'react'
import { MantineProvider } from '@mantine/core'
import type { SystemListItemDto, SystemListPageDto } from '@artificer-toolkit/schema/api/systems'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SystemListPage } from './SystemListPage'

const mocks = vi.hoisted(() => ({
  convexQuery: vi.fn(),
  navigate: vi.fn()
}))

vi.mock('@convex-dev/react-query', () => ({ convexQuery: mocks.convexQuery }))

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => mocks.navigate }))

const system = (id: string, label: string): SystemListItemDto => ({
  id,
  label,
  description: null,
  rulesetCode: 'DND5E_2014',
  rulesetVersion: '2014',
  userId: 'user-1',
  rulesCatalogues: []
})

function isSystemPageArgs(value: unknown): value is { cursor: string | null; limit: number } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'cursor' in value &&
    'limit' in value &&
    ((typeof value.cursor === 'string' && value.cursor.length > 0) || value.cursor === null) &&
    value.limit === 10
  )
}

function getCursor({ queryKey }: QueryFunctionContext): string | null {
  const args = queryKey[1]
  if (!isSystemPageArgs(args)) throw new Error('Unexpected System list query arguments')
  return args.cursor
}

function renderSystemList(
  pages: Record<string, SystemListPageDto>,
  requestedCursors: (string | null)[]
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        queryFn: (context) => {
          const cursor = getCursor(context)
          requestedCursors.push(cursor)
          return pages[cursor ?? 'first']
        },
        retry: false
      }
    }
  })

  return render(
    <MantineProvider>
      <QueryClientProvider client={queryClient}>
        <Suspense fallback={<div>Loading systems</div>}>
          <SystemListPage />
        </Suspense>
      </QueryClientProvider>
    </MantineProvider>
  )
}

describe('SystemListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.convexQuery.mockImplementation((_reference: unknown, args: unknown) => ({
      queryKey: ['system-list-page', args]
    }))
  })

  it('uses exact cursors for next and previous pages, disables the final page, and opens cards', async () => {
    const user = userEvent.setup()
    const requestedCursors: (string | null)[] = []
    renderSystemList(
      {
        first: { page: [system('system-1', 'Alpha')], isDone: false, continueCursor: 'cursor-1' },
        'cursor-1': { page: [system('system-2', 'Beta')], isDone: true, continueCursor: 'cursor-2' }
      },
      requestedCursors
    )

    await screen.findByText('Alpha')
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Open System' }))
    expect(mocks.navigate).toHaveBeenCalledWith({
      to: '/systems/$systemId',
      params: { systemId: 'system-1' }
    })

    await user.click(screen.getByRole('button', { name: 'Next page' }))
    await screen.findByText('Beta')
    expect(requestedCursors).toEqual([null, 'cursor-1'])
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Previous page' }))
    await screen.findByText('Alpha')
  })

  it('renders the empty System list', async () => {
    renderSystemList({ first: { page: [], isDone: true, continueCursor: '' } }, [])

    expect(await screen.findByText('No Game Systems are available.')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled()
  })
})
