import { render, screen } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import userEvent from '@testing-library/user-event'
import { getFunctionName } from 'convex/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@artificer-toolkit/apis/convex/api'
import { authoredCatalogueItemSchema } from '@artificer-toolkit/schema/api/authoredCatalogue'
import { spellResponseDtoSchema } from '@artificer-toolkit/schema/api/content'
import { authoredRouteStoryResponses } from '#domains/authoredRouteStory.fixtures'
import { GuidedStartChoice } from './GuidedStartChoice'

const mocks = vi.hoisted(() => ({
  copySource: vi.fn(),
  useContentCatalogue: vi.fn(),
  useQuery: vi.fn()
}))

vi.mock('#app/data/contentSnapshots/useContentCatalogue', () => ({
  useContentCatalogue: mocks.useContentCatalogue
}))

vi.mock('@tanstack/react-query', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-query')>()),
  useQuery: mocks.useQuery
}))

vi.mock('../layout/AuthoringFormContext', () => ({
  useAuthoringActions: () => ({ copySource: mocks.copySource })
}))

const source = authoredCatalogueItemSchema.parse({
  id: 'e80601a2-6162-4674-a748-28af7d9d1d49',
  publicId: 'acolyte',
  systemId: 'f07a619a-9f4e-44e7-bcf0-3bbda8206e53',
  label: 'Acolyte',
  description: '<p>Temple trained.</p>',
  provenance: { kind: 'MASTER', ownerUserId: null },
  permissions: { canView: true, canEdit: false, canCopy: true, canDelete: false }
})

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
    mocks.useContentCatalogue.mockReturnValue({ items: [source], isError: false, isPending: false })
  })

  it('lazily reads the exact-System native Background catalogue and copies its selected UUID', async () => {
    const user = userEvent.setup()
    renderChoice()

    expect(mocks.useContentCatalogue).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: /^Use an existing background/ }))

    expect(mocks.useContentCatalogue).toHaveBeenCalledWith('BACKGROUND', {
      enabled: true,
      systemId: 'f07a619a-9f4e-44e7-bcf0-3bbda8206e53'
    })

    await user.type(screen.getByRole('combobox', { name: 'Search backgrounds' }), source.label)
    await user.click(await screen.findByRole('option', { name: source.label }))
    expect(screen.getByText('Temple trained.')).toBeInTheDocument()
    expect(screen.getByText('SRD')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Create copy' }))

    expect(mocks.copySource).toHaveBeenCalledWith(source.id)
  })

  it('keeps the searchable picker disabled until the catalogue has loaded', async () => {
    mocks.useContentCatalogue.mockReturnValue({ items: undefined, isError: false, isPending: true })
    const user = userEvent.setup()
    renderChoice()

    await user.click(screen.getByRole('button', { name: /^Use an existing background/ }))

    expect(screen.getByRole('combobox', { name: 'Search backgrounds' })).toBeDisabled()
  })

  it('disables copying when a reactive update removes the selected source', async () => {
    const user = userEvent.setup()
    const catalogue = { items: [source], isError: false, isPending: false }
    mocks.useContentCatalogue.mockReturnValue(catalogue)
    const view = renderChoice()

    await user.click(screen.getByRole('button', { name: /^Use an existing background/ }))
    await user.type(screen.getByRole('combobox', { name: 'Search backgrounds' }), source.label)
    await user.click(await screen.findByRole('option', { name: source.label }))
    expect(screen.getByRole('button', { name: 'Create copy' })).toBeEnabled()

    mocks.useContentCatalogue.mockReturnValue({ ...catalogue, items: [] })
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
    expect(mocks.useContentCatalogue).toHaveBeenCalledWith('BACKGROUND', {
      enabled: false,
      systemId: ''
    })
    expect(screen.getByText('A System is required before backgrounds can be copied.')).toBeVisible()

    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.useContentCatalogue.mockImplementation(() => {
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

    expect(mocks.useContentCatalogue).toHaveBeenCalledWith('CLASS', {
      enabled: true,
      systemId: 'f07a619a-9f4e-44e7-bcf0-3bbda8206e53'
    })
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

      expect(mocks.useContentCatalogue).toHaveBeenCalledWith(subjectKind, {
        enabled: true,
        systemId: 'f07a619a-9f4e-44e7-bcf0-3bbda8206e53'
      })
      await user.type(screen.getByRole('combobox', { name: `Search ${plural}` }), source.label)
      await user.click(await screen.findByRole('option', { name: source.label }))
      await user.click(screen.getByRole('button', { name: 'Create copy' }))

      expect(mocks.copySource).toHaveBeenCalledWith(source.id)
      expect(mocks.useQuery).not.toHaveBeenCalled()
    }
  )

  it('loads native Spell metadata for a selected source and keeps copying independent', async () => {
    const user = userEvent.setup()
    const spell = authoredRouteStoryResponses.spell
    mocks.useQuery.mockReturnValue({
      data: spellResponseDtoSchema.parse({
        ...spell,
        item: { ...spell.item, level: 3, castingTime: { amount: 1, unit: 'MINUTE' } }
      }),
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
        queryKey: [
          'convexQuery',
          getFunctionName(api.content.details.get),
          { id: source.id, subjectKind: 'SPELL' }
        ]
      })
    )
    expect(screen.getByText('Level 3 · 1 minute')).toBeInTheDocument()
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
