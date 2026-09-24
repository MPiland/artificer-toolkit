import { render, screen } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GuidedStartChoice } from './GuidedStartChoice'

const mocks = vi.hoisted(() => ({
  copySource: vi.fn(),
  loadMore: vi.fn(),
  usePaginatedQuery: vi.fn(),
  useQuery: vi.fn()
}))

vi.mock('convex/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('convex/react')>())
}))

vi.mock('convex-helpers/react', () => ({
  usePaginatedQuery: mocks.usePaginatedQuery
}))

vi.mock('@tanstack/react-query', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-query')>()),
  useQuery: mocks.useQuery
}))

vi.mock('../layout/AuthoringFormContext', () => ({
  useAuthoringForm: () => ({ copySource: mocks.copySource })
}))

const source = {
  id: 'e80601a2-6162-4674-a748-28af7d9d1d49',
  label: 'Acolyte',
  description: '<p>Temple trained.</p>',
  permissions: { canCopy: true },
  provenance: { kind: 'MASTER' }
}

function renderChoice(
  systemId = 'f07a619a-9f4e-44e7-bcf0-3bbda8206e53',
  domain:
    | 'background'
    | 'class'
    | 'feat'
    | 'creature'
    | 'equipment'
    | 'race'
    | 'spell'
    | 'vehicle' = 'background'
) {
  return render(
    <GuidedStartChoice
      domain={domain}
      domainLabel={
        domain === 'background'
          ? 'Background'
          : domain === 'class'
            ? 'Class'
            : domain === 'feat'
              ? 'Feat'
              : domain === 'creature'
                ? 'Creature'
                : domain === 'equipment'
                  ? 'Equipment'
                  : domain === 'race'
                    ? 'Race'
                    : domain === 'spell'
                      ? 'Spell'
                      : 'Vehicle'
      }
      systemId={systemId}
      onAdvanced={vi.fn()}
      onFresh={vi.fn()}
    />,
    {
      wrapper: ({ children }) => <MantineProvider env='test'>{children}</MantineProvider>
    }
  )
}

describe('GuidedStartChoice', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.copySource.mockResolvedValue(undefined)
    mocks.useQuery.mockReturnValue({
      data: [],
      isError: false,
      isLoading: false
    })
    mocks.usePaginatedQuery.mockReturnValue({
      loadMore: mocks.loadMore,
      results: [source],
      status: 'Exhausted'
    })
  })

  it('lazily reads the exact-System native Background catalogue and copies its selected UUID', async () => {
    const user = userEvent.setup()
    renderChoice()

    expect(mocks.usePaginatedQuery).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: /^Use an existing background/ }))

    expect(mocks.usePaginatedQuery).toHaveBeenCalledWith(
      expect.anything(),
      {
        subjectKind: 'BACKGROUND',
        systemId: 'f07a619a-9f4e-44e7-bcf0-3bbda8206e53'
      },
      { initialNumItems: 48 }
    )

    await user.type(screen.getByRole('combobox', { name: 'Search backgrounds' }), source.label)
    await user.click(await screen.findByRole('option', { name: source.label }))
    expect(screen.getByText('Temple trained.')).toBeInTheDocument()
    expect(screen.getByText('SRD')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Create copy' }))

    expect(mocks.copySource).toHaveBeenCalledWith(source.id)
  })

  it('loads every native page before enabling the searchable picker', async () => {
    mocks.usePaginatedQuery.mockReturnValue({
      loadMore: mocks.loadMore,
      results: [source],
      status: 'CanLoadMore'
    })
    const user = userEvent.setup()
    renderChoice()

    await user.click(screen.getByRole('button', { name: /^Use an existing background/ }))

    expect(mocks.loadMore).toHaveBeenCalledWith(48)
    expect(screen.getByRole('combobox', { name: 'Search backgrounds' })).toBeDisabled()
  })

  it('disables copying when a reactive update removes the selected source', async () => {
    const user = userEvent.setup()
    const catalogue = {
      loadMore: mocks.loadMore,
      results: [source],
      status: 'Exhausted' as const
    }
    mocks.usePaginatedQuery.mockReturnValue(catalogue)
    const view = renderChoice()

    await user.click(screen.getByRole('button', { name: /^Use an existing background/ }))
    await user.type(screen.getByRole('combobox', { name: 'Search backgrounds' }), source.label)
    await user.click(await screen.findByRole('option', { name: source.label }))
    expect(screen.getByRole('button', { name: 'Create copy' })).toBeEnabled()

    catalogue.results = []
    view.rerender(
      <GuidedStartChoice
        domain='background'
        domainLabel='Background'
        systemId='f07a619a-9f4e-44e7-bcf0-3bbda8206e53'
        onAdvanced={vi.fn()}
        onFresh={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: 'Create copy' })).toBeDisabled()
  })

  it('skips native loading without a System and contains native query errors', async () => {
    const user = userEvent.setup()
    const view = renderChoice('')

    await user.click(screen.getByRole('button', { name: /^Use an existing background/ }))
    expect(mocks.usePaginatedQuery).toHaveBeenCalledWith(expect.anything(), 'skip', {
      initialNumItems: 48
    })
    expect(screen.getByText('A System is required before backgrounds can be copied.')).toBeVisible()

    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.usePaginatedQuery.mockImplementation(() => {
      throw new Error('native failure')
    })
    view.rerender(
      <GuidedStartChoice
        domain='background'
        domainLabel='Background'
        systemId='df7f5cb7-2204-4fd5-a323-0d3d4c81443d'
        onAdvanced={vi.fn()}
        onFresh={vi.fn()}
      />
    )
    expect(screen.getByText('Sources are unavailable. Try again.')).toBeVisible()
    expect(errorLog).toHaveBeenCalled()
    errorLog.mockRestore()
  })

  it('reads the exact-System native Class catalogue', async () => {
    const user = userEvent.setup()
    renderChoice(undefined, 'class')

    await user.click(screen.getByRole('button', { name: /^Use an existing class/ }))

    expect(mocks.usePaginatedQuery).toHaveBeenCalledWith(
      expect.anything(),
      {
        subjectKind: 'CLASS',
        systemId: 'f07a619a-9f4e-44e7-bcf0-3bbda8206e53'
      },
      { initialNumItems: 48 }
    )
  })

  it.each([
    ['feat', 'FEAT', 'feat', 'feats'],
    ['creature', 'CREATURE', 'creature', 'creatures'],
    ['equipment', 'EQUIPMENT', 'item', 'items'],
    ['race', 'RACE', 'race', 'races'],
    ['vehicle', 'VEHICLE', 'vehicle', 'vehicles']
  ] as const)(
    'reads the exact-System native %s catalogue and copies its selected UUID',
    async (domain, subjectKind, noun, plural) => {
      const user = userEvent.setup()
      renderChoice(undefined, domain)

      await user.click(
        screen.getByRole('button', {
          name: new RegExp(`^Use an existing ${noun}`)
        })
      )

      expect(mocks.usePaginatedQuery).toHaveBeenCalledWith(
        expect.anything(),
        { subjectKind, systemId: 'f07a619a-9f4e-44e7-bcf0-3bbda8206e53' },
        { initialNumItems: 48 }
      )
      await user.type(screen.getByRole('combobox', { name: `Search ${plural}` }), source.label)
      await user.click(await screen.findByRole('option', { name: source.label }))
      await user.click(screen.getByRole('button', { name: 'Create copy' }))

      expect(mocks.copySource).toHaveBeenCalledWith(source.id)
      expect(mocks.useQuery).not.toHaveBeenCalled()
    }
  )

  it('loads native Spell metadata for a selected source and keeps copying independent', async () => {
    const user = userEvent.setup()
    mocks.useQuery.mockReturnValue({
      data: { item: { castingTime: { amount: 1, unit: 'BONUS_ACTION' }, level: 3 } },
      isError: false,
      isPending: false
    })
    renderChoice(undefined, 'spell')

    await user.click(screen.getByRole('button', { name: /^Use an existing spell/ }))
    expect(mocks.useQuery).not.toHaveBeenCalled()
    await user.type(screen.getByRole('combobox', { name: 'Search spells' }), source.label)
    await user.click(await screen.findByRole('option', { name: source.label }))

    expect(mocks.useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['convexQuery', 'content/details:get', { id: source.id, subjectKind: 'SPELL' }]
      })
    )
    expect(screen.getByText('Level 3 · 1 bonus action')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Create copy' }))
    expect(mocks.copySource).toHaveBeenCalledWith(source.id)
  })

  it('allows copying a selected native Spell when its metadata detail is unavailable', async () => {
    const user = userEvent.setup()
    mocks.useQuery.mockReturnValue({ data: undefined, isError: true, isPending: false })
    renderChoice(undefined, 'spell')

    await user.click(screen.getByRole('button', { name: /^Use an existing spell/ }))
    await user.type(screen.getByRole('combobox', { name: 'Search spells' }), source.label)
    await user.click(await screen.findByRole('option', { name: source.label }))

    expect(
      screen.getByText('Spell details are unavailable. You can still create a copy.')
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Create copy' }))
    expect(mocks.copySource).toHaveBeenCalledWith(source.id)
  })
})
