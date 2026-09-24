import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  authoredCatalogueSearchInputSchema,
  type AuthoredCataloguePage,
  type AuthoredCatalogueSearchInput
} from '@artificer-toolkit/schema/api/authoredCatalogue'
import { AuthoredCatalogueSearch } from './AuthoredCatalogueSearch'

const mocks = vi.hoisted(() => ({ convexQuery: vi.fn() }))
vi.mock('@convex-dev/react-query', () => ({ convexQuery: mocks.convexQuery }))

const item = (
  label: string,
  source: 'MASTER' | 'OWNED'
): AuthoredCataloguePage['page'][number] => ({
  id: `00000000-0000-4000-8000-${label === 'Zulu' ? '000000000001' : '000000000002'}`,
  publicId: label,
  systemId: '00000000-0000-4000-8000-000000000010',
  label,
  description: '<p>A searchable preview.</p>',
  activeUpdatedAt: '2026-09-04T00:00:00.000Z',
  status: 'ACTIVE',
  provenance: { kind: source, ownerUserId: source === 'OWNED' ? 'owner' : null },
  permissions: {
    canView: true,
    canCopy: true,
    canEdit: source === 'OWNED',
    canDelete: source === 'OWNED'
  }
})

beforeEach(() => {
  vi.clearAllMocks()
  mocks.convexQuery.mockImplementation((_reference: unknown, input: unknown) => ({
    queryKey: ['catalogue-search', input],
    enabled: input !== 'skip'
  }))
})

it('preserves ranked groups and permissions, bounds pages, and resets cursors for a new query', async () => {
  const requests: AuthoredCatalogueSearchInput[] = []
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        queryFn: ({ queryKey }) => {
          const input = authoredCatalogueSearchInputSchema.parse(queryKey[1])
          requests.push(input)
          return {
            page:
              input.source === 'OWNED'
                ? [item('Homebrew', 'OWNED')]
                : input.paginationOpts.cursor
                  ? [item('Next page', 'MASTER')]
                  : [item('Zulu', 'MASTER'), item('Alpha', 'MASTER')],
            isDone: input.source === 'OWNED' || Boolean(input.paginationOpts.cursor),
            continueCursor: 'next'
          } satisfies AuthoredCataloguePage
        }
      }
    }
  })
  const onView = vi.fn()
  const props = {
    subjectKind: 'BACKGROUND' as const,
    query: 'search',
    attributeColumns: [],
    viewMode: 'table' as const,
    cardColumnCount: 1,
    useMenuActions: false,
    onView,
    actionHandlers: { onEdit: vi.fn(), onCopy: vi.fn() }
  }
  const view = (query: string) => (
    <MantineProvider>
      <QueryClientProvider client={client}>
        <AuthoredCatalogueSearch {...props} query={query} />
      </QueryClientProvider>
    </MantineProvider>
  )
  const { rerender } = render(view('search'))
  const user = userEvent.setup()
  await screen.findByRole('button', { name: 'Open Zulu' })
  const master = within(screen.getByRole('region', { name: 'SRD search results' }))
  expect(
    master
      .getAllByRole('row')
      .slice(1)
      .map((row) => row.getAttribute('aria-label'))
  ).toEqual(['View Zulu', 'View Alpha'])
  expect(master.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Edit Homebrew' })).toBeEnabled()
  expect(master.getByText('2 loaded on this page · Relevance')).toBeVisible()
  expect(requests.every((request) => request.paginationOpts.numItems === 48)).toBe(true)
  await user.click(screen.getByRole('button', { name: 'Open Zulu' }))
  expect(onView).toHaveBeenCalledWith(expect.objectContaining({ publicId: 'Zulu' }))
  await user.click(screen.getByRole('button', { name: 'Next SRD results' }))
  await screen.findByRole('button', { name: 'Open Next page' })
  expect(screen.queryByRole('button', { name: 'Open Zulu' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Next SRD results' })).toBeDisabled()
  await user.click(screen.getByRole('button', { name: 'Previous SRD results' }))
  await screen.findByRole('button', { name: 'Open Zulu' })
  rerender(view('changed'))
  await waitFor(() =>
    expect(requests.filter((request) => request.query === 'changed')).toHaveLength(2)
  )
  expect(
    requests
      .filter((request) => request.query === 'changed')
      .every((request) => request.paginationOpts.cursor === null)
  ).toBe(true)
  expect(screen.getByRole('button', { name: 'Previous SRD results' })).toBeDisabled()
})

describe('search errors', () => {
  it('skips invalid input and renders an actionable error without stale cached rows', async () => {
    let fail = false
    const queryFn = vi.fn(() => {
      if (fail) throw new Error('Unauthenticated')
      return {
        page: [item('Zulu', 'MASTER')],
        isDone: true,
        continueCursor: ''
      } satisfies AuthoredCataloguePage
    })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, queryFn } } })
    const view = (query: string) => (
      <MantineProvider>
        <QueryClientProvider client={client}>
          <AuthoredCatalogueSearch
            subjectKind='CLASS'
            query={query}
            source='MASTER'
            category='BASE'
            viewMode='cards'
            cardColumnCount={1}
            attributeColumns={[]}
            actionHandlers={{}}
            useMenuActions
          />
        </QueryClientProvider>
      </MantineProvider>
    )
    const { rerender } = render(view('!!!'))
    expect(screen.getByText('Enter 1–16 words, up to 160 characters.')).toBeVisible()
    expect(queryFn).not.toHaveBeenCalled()
    rerender(view('search'))
    await screen.findByRole('button', { name: 'Open Zulu' })
    fail = true
    await client.invalidateQueries()
    await screen.findByRole('alert')
    expect(screen.queryByRole('button', { name: 'Open Zulu' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled()
    expect(
      screen.queryByRole('region', { name: 'Homebrew search results' })
    ).not.toBeInTheDocument()
    expect(mocks.convexQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ category: 'BASE' })
    )
  })
})
