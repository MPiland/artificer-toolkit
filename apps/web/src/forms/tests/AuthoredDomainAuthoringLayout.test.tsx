import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  nodeRuntimeNormalizeValuesRequestDtoSchema,
  nodeRuntimeResolveRequestDtoSchema
} from '@artificer-toolkit/schema/api/nodeRuntime'
import { compactNodeRuntimeResponse } from '@artificer-toolkit/schema/api/nodeRuntimeTransport'
import { srdBaselineContent } from '@artificer-toolkit/source-data/srd/index.js'
import { getFunctionName } from 'convex/server'
import { api } from '@artificer-toolkit/apis/convex/api'
import type { AuthSessionUserDto } from '@artificer-toolkit/schema/api/auth'
import {
  authoredCreateRouteLoaderData,
  authoredEditRouteLoaderData,
  authoredRouteStoryDrafts,
  authoredRouteStoryRecords,
  authoredRouteStorySystem
} from '#domains/authoredRouteStory.fixtures'
import {
  normalizeFixtureNodeRuntimeValues,
  resolveFixtureNodeRuntime
} from '#test/nodeRuntimeResolver'
import { warmFixtureAuthoredSources } from '@artificer-toolkit/authoring/nodeRuntime/srdSourceReader'
import { TestRouterProvider } from '#test/TestRouterProvider'
import { AuthoringLayout, AuthoringLayoutContent } from '../layout/AuthoringLayout'
import { AuthoringFormProvider } from '../layout/AuthoringFormProvider'
import { useAuthoringForm } from '../layout/AuthoringFormContext'
import type { AuthoredFormDomain } from '../factories/authoredFormFactories.types'

const convexMocks = vi.hoisted(() => ({
  mutation: vi.fn(),
  nodeRuntimeResolve: vi.fn(),
  query: vi.fn(),
  useContentCatalogue: vi.fn()
}))

vi.mock('convex/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('convex/react')>()),
  useAction: () => vi.fn(),
  useConvex: () => convexMocks,
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
  useMutation: () => vi.fn(),
  useQuery: () => ({ assetId: null, revision: 0 })
}))

vi.mock('#app/data/contentSnapshots/useContentCatalogue', () => ({
  useContentCatalogue: convexMocks.useContentCatalogue
}))

vi.mock('#app/query/createAppQueryClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('#app/query/createAppQueryClient')>()
  return {
    ...actual,
    createAppQueryClient: () => {
      const client = actual.createAppQueryClient()
      client.setQueryDefaults(['convexQuery'], {
        queryFn: () => {
          throw new Error('Unexpected native query in authored layout fixture.')
        }
      })
      client.setQueryDefaults(['convexQuery', getFunctionName(api.authoring.nodeRuntime.resolve)], {
        queryFn: ({ queryKey }) => convexMocks.nodeRuntimeResolve(queryKey)
      })
      return client
    }
  }
})

const DOMAINS = [
  'background',
  'class',
  'creature',
  'equipment',
  'feat',
  'race',
  'spell',
  'vehicle'
] satisfies AuthoredFormDomain[]

const nativeRaceCatalogueItems = [
  {
    activeUpdatedAt: '2026-01-01T00:00:00.000Z',
    category: 'BASE',
    description: 'Elves are magical people of otherworldly grace.',
    id: '00000000-0000-4000-8000-000000000001',
    label: 'Elf',
    permissions: { canCopy: true, canDelete: false, canEdit: false, canView: true },
    provenance: { kind: 'MASTER', ownerUserId: null },
    publicId: 'elf',
    status: 'ACTIVE',
    systemId: authoredRouteStorySystem.id
  },
  {
    activeUpdatedAt: '2026-01-01T00:00:00.000Z',
    category: 'BASE',
    description: 'Owned base race.',
    id: authoredRouteStoryRecords.race.id,
    label: 'Owned base race',
    permissions: { canCopy: true, canDelete: false, canEdit: false, canView: true },
    provenance: { kind: 'OWNED', ownerUserId: 'story-user' },
    publicId: 'current-race',
    status: 'ACTIVE',
    systemId: authoredRouteStorySystem.id
  },
  {
    activeUpdatedAt: '2026-01-01T00:00:00.000Z',
    category: 'SUBRACE',
    description: 'Not a parent.',
    id: '00000000-0000-4000-8000-000000000002',
    label: 'Wood Elf',
    permissions: { canCopy: true, canDelete: false, canEdit: false, canView: true },
    provenance: { kind: 'MASTER', ownerUserId: null },
    publicId: 'wood-elf',
    status: 'ACTIVE',
    systemId: authoredRouteStorySystem.id
  }
]

beforeAll(warmFixtureAuthoredSources, 60_000)

beforeEach(() => {
  convexMocks.mutation.mockReset().mockResolvedValue(authoredRouteStoryDrafts.race)
  convexMocks.nodeRuntimeResolve.mockReset().mockImplementation(resolveNodeRuntimeQuery)
  convexMocks.query.mockReset().mockImplementation(resolveNormalization)
  convexMocks.useContentCatalogue
    .mockReset()
    .mockImplementation((_subjectKind, { enabled = true } = {}) => ({
      items: enabled ? nativeRaceCatalogueItems : undefined,
      isError: false,
      isPending: false
    }))
})

describe('non-character authored domain layout coverage', () => {
  it.each(DOMAINS)('renders the %s create authoring route data', async (domain) => {
    const user = userEvent.setup()
    useFixtureNodeRuntimeResolver()

    render(<TestRouterProvider>{renderCreateLayout(domain)}</TestRouterProvider>)

    expect(await screen.findByRole('heading', { name: 'How do you want to begin?' })).toHaveFocus()
    expect(screen.getByTestId('authoring-form-canvas')).toBeInTheDocument()
    expect(screen.queryByLabelText('Authoring preview')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^back$/i })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^cancel$/i })).toHaveAttribute('href')

    await user.click(screen.getByRole('button', { name: /Start from scratch/i }))
    expect(await screen.findByRole('textbox', { name: /name/i })).toBeInTheDocument()
  })

  it('shows Back after advancing from the first create step', async () => {
    const user = userEvent.setup()
    useFixtureNodeRuntimeResolver()

    render(<TestRouterProvider>{renderCreateLayout('race')}</TestRouterProvider>)

    await user.click(await screen.findByRole('button', { name: /Start from scratch/i }))
    await user.type(await screen.findByRole('textbox', { name: /name/i }), 'Test Race')
    await user.click(screen.getByRole('button', { name: /^next$/i }))

    expect(screen.getByRole('button', { name: /^back$/i })).toBeEnabled()
    expect(screen.getByRole('heading', { level: 1, name: 'Test Race' })).toBeInTheDocument()
  })

  it('keeps starting-point UI state clean until an inline copy is confirmed', async () => {
    const user = userEvent.setup()
    useFixtureNodeRuntimeResolver()
    render(<TestRouterProvider>{renderCreateLayout('race')}</TestRouterProvider>)

    expect(await screen.findByText('All changes saved')).toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: /Use an existing race/i }))

    const picker = await screen.findByRole('combobox', { name: /Search races/i })
    expect(picker).toBeInTheDocument()
    expect(screen.getByText(/nothing is copied until you confirm/i)).toBeInTheDocument()
    expect(convexMocks.mutation).not.toHaveBeenCalled()
    expect(convexMocks.useContentCatalogue).toHaveBeenLastCalledWith('RACE', {
      enabled: true,
      systemId: authoredRouteStorySystem.id
    })
    await user.click(picker)
    await user.type(picker, 'Elf')
    await user.click(await screen.findByRole('option', { name: 'Elf', hidden: true }))
    expect(screen.getAllByText('Elf').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('SRD')).toBeInTheDocument()
    expect(screen.getByText(/Elves are magical people/i)).toBeInTheDocument()
    expect(screen.getByText('All changes saved')).toBeInTheDocument()
    expect(convexMocks.mutation).not.toHaveBeenCalled()

    const createCopy = screen.getByRole('button', { name: /Create copy/i })
    expect(createCopy).toBeEnabled()
    await user.click(createCopy)
    await waitFor(() => expect(convexMocks.mutation).toHaveBeenCalledOnce())
    expect(convexMocks.mutation).toHaveBeenCalledWith(expect.anything(), {
      subjectKind: 'RACE',
      subjectId: nativeRaceCatalogueItems[0].id
    })

    expect(screen.queryByText('Could not duplicate that race yet.')).not.toBeInTheDocument()
    expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument()
  })

  it('loads native Race parents only for a subrace and excludes subrace parents', async () => {
    const user = userEvent.setup()
    useFixtureNodeRuntimeResolver()

    render(<TestRouterProvider>{renderCreateLayout('race')}</TestRouterProvider>)
    await user.click(await screen.findByRole('button', { name: /Start from scratch/i }))
    expect(convexMocks.useContentCatalogue).toHaveBeenLastCalledWith('RACE', {
      enabled: false,
      systemId: authoredRouteStorySystem.id
    })

    await user.click(screen.getByRole('combobox', { name: 'Type' }))
    await user.click(await screen.findByRole('option', { name: 'Subrace', hidden: true }))

    expect(convexMocks.useContentCatalogue).toHaveBeenLastCalledWith('RACE', {
      enabled: true,
      systemId: authoredRouteStorySystem.id
    })
    const parent = screen.getByRole('combobox', { name: 'Parent race' })
    await user.click(parent)
    expect(await screen.findByRole('option', { name: 'Elf', hidden: true })).toBeInTheDocument()
    expect(
      screen.getByRole('option', { name: 'Owned base race', hidden: true })
    ).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Wood Elf', hidden: true })).not.toBeInTheDocument()
  })

  it('updates the live preview title from the current form name', async () => {
    const user = userEvent.setup()
    useFixtureNodeRuntimeResolver()

    render(<TestRouterProvider>{renderCreateLayout('equipment')}</TestRouterProvider>)

    await user.click(await screen.findByRole('button', { name: /Start from scratch/i }))
    expect(screen.queryByLabelText('Authoring preview')).not.toBeInTheDocument()

    await user.type(await screen.findByRole('textbox', { name: /name/i }), 'Moon Blade')

    const preview = await screen.findByLabelText('Authoring preview')
    expect(await within(preview).findByText('Moon Blade')).toBeInTheDocument()
    expect(
      within(preview).getByText('Add a description to preview its reader copy.')
    ).toBeInTheDocument()
  })

  it('updates the Advanced workspace title from the current form name', async () => {
    useFixtureNodeRuntimeResolver()

    render(
      <TestRouterProvider user={createAdvancedAuthoringUser()}>
        {renderCreateLayout('equipment')}
      </TestRouterProvider>
    )

    await userEvent.setup().type(await screen.findByRole('textbox', { name: 'Name' }), 'Moon Blade')

    expect(screen.getByRole('heading', { level: 1, name: 'Moon Blade' })).toBeInTheDocument()
  })

  it('rejects a blank name when saving or activating instead of defaulting to "Untitled"', async () => {
    const user = userEvent.setup()
    useFixtureNodeRuntimeResolver()

    render(
      <TestRouterProvider user={createAdvancedAuthoringUser()}>
        {renderCreateLayout('equipment')}
      </TestRouterProvider>
    )

    const name = await screen.findByRole('textbox', { name: 'Name' })
    expect(name).toHaveValue('')
    expect(screen.getByRole('button', { name: /^activate$/i })).toBeDisabled()

    await user.type(name, '   ')
    await user.click(screen.getByRole('button', { name: 'Save Draft' }))
    expect((await screen.findAllByText(/Name is required./)).length).toBeGreaterThan(0)

    expect(screen.getByRole('button', { name: /^activate$/i })).toBeDisabled()
    expect(convexMocks.mutation).not.toHaveBeenCalled()
  })

  it('creates an item only after a System is chosen and a label is given (RELIABILITY-8 journey)', async () => {
    const user = userEvent.setup()
    useFixtureNodeRuntimeResolver()
    const advancedUser = createAdvancedAuthoringUser()
    const { authoringData } = authoredCreateRouteLoaderData
    const createLayout = (system: typeof authoredRouteStorySystem | null) => (
      <TestRouterProvider user={advancedUser}>
        <AuthoringLayout data={{ ...authoringData, system }} domain='equipment' mode='create' />
      </TestRouterProvider>
    )

    // No System on the route: an explicit choice, never the first System in the list.
    const { rerender } = render(createLayout(null))
    const systemChoice = await screen.findByRole('combobox', { name: /Choose the system/ })
    expect(systemChoice).toHaveValue('')
    expect(screen.queryByRole('textbox', { name: 'Name' })).not.toBeInTheDocument()
    expect(convexMocks.mutation).not.toHaveBeenCalled()

    // The route now carries the chosen System: a blank label is a field error, not "Untitled".
    rerender(createLayout(authoredRouteStorySystem))
    const name = await screen.findByRole('textbox', { name: 'Name' })
    await user.type(name, '   ')
    await user.click(screen.getByRole('button', { name: 'Save Draft' }))
    expect((await screen.findAllByText(/Name is required./)).length).toBeGreaterThan(0)
    expect(convexMocks.mutation).not.toHaveBeenCalled()

    await user.clear(name)
    await user.type(name, 'Moon Blade')
    await user.click(screen.getByRole('button', { name: 'Save Draft' }))
    await waitFor(() => expect(convexMocks.mutation).toHaveBeenCalledOnce())
    expect(convexMocks.mutation.mock.calls[0]?.[1]).toMatchObject({
      payload: { label: 'Moon Blade', systemId: authoredRouteStorySystem.id }
    })
  }, 20_000)

  it('uses natural equipment language in the guided start choice', async () => {
    useFixtureNodeRuntimeResolver()

    render(<TestRouterProvider>{renderCreateLayout('equipment')}</TestRouterProvider>)

    expect(await screen.findByText(/Create a new item,/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Use an existing item/i })).toBeInTheDocument()
    expect(screen.queryByText(/new equipment/i)).not.toBeInTheDocument()
  })

  it('guides a new spell through grouped questions on the canonical form', async () => {
    const user = userEvent.setup()
    useFixtureNodeRuntimeResolver()

    render(<TestRouterProvider>{renderCreateLayout('spell')}</TestRouterProvider>)

    expect(screen.queryByRole('button', { name: /^activate$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^back$/i })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Authoring preview')).not.toBeInTheDocument()

    expect(await screen.findByRole('heading', { name: 'How do you want to begin?' })).toHaveFocus()
    await user.click(screen.getByRole('button', { name: /Start from scratch/i }))
    const basicsHeading = await screen.findByRole('heading', { name: 'Start with the basics' })
    expect(basicsHeading).toHaveFocus()
    expect(screen.getByRole('combobox', { name: 'Level' })).toHaveValue('Cantrip')

    await user.type(screen.getByRole('textbox', { name: 'Spell name' }), 'Ember Thread')
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
    await chooseSpellSchool(user)
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled()
    expect(screen.getByRole('heading', { level: 1, name: 'Ember Thread' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(await screen.findByRole('heading', { name: 'What does the spell do?' })).toHaveFocus()
    expect(screen.queryByLabelText('Authoring preview')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()

    const damageOutcome = screen.getByRole('button', { name: /Damage/ })
    await user.click(damageOutcome)
    expect(damageOutcome).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled()
    expect(screen.queryByLabelText('Authoring preview')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(await screen.findByLabelText('Authoring preview')).toBeInTheDocument()

    const mechanicsHeading = await screen.findByRole('heading', {
      name: 'Describe the mechanics'
    })
    expect(mechanicsHeading).toHaveFocus()
    expect(screen.getByRole('textbox', { name: 'Damage dice' })).toHaveValue('1d6')
    expect(screen.getByRole('textbox', { name: 'Range (feet)' })).toHaveValue('60')

    await user.clear(screen.getByRole('textbox', { name: 'Damage dice' }))
    await user.type(screen.getByRole('textbox', { name: 'Damage dice' }), 'not dice')
    expect(screen.getByText('Enter dice such as 1d6.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
    await user.clear(screen.getByRole('textbox', { name: 'Damage dice' }))
    await user.type(screen.getByRole('textbox', { name: 'Damage dice' }), '1d6')

    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(await screen.findByRole('heading', { name: 'Review your spell' })).toHaveFocus()
    expect(screen.getByText(/one creature within 60 feet/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^activate$/i })).toBeInTheDocument()
  })

  it('shows Guided while the Advanced form model is still resolving', async () => {
    let releaseModel: () => void = () => undefined
    const pendingModel = new Promise<void>((resolve) => {
      releaseModel = resolve
    })

    convexMocks.nodeRuntimeResolve.mockImplementation(async (queryKey) => {
      await pendingModel
      return resolveNodeRuntimeQuery(queryKey)
    })

    render(<TestRouterProvider>{renderCreateLayout('spell')}</TestRouterProvider>)

    try {
      expect(
        await screen.findByRole('heading', { name: 'How do you want to begin?' }, { timeout: 500 })
      ).toBeInTheDocument()
    } finally {
      releaseModel()
    }
  })

  it('shows progress while an Advanced form model is still resolving', async () => {
    let releaseModel: () => void = () => undefined
    const pendingModel = new Promise<void>((resolve) => {
      releaseModel = resolve
    })

    convexMocks.nodeRuntimeResolve.mockImplementation(async (queryKey) => {
      await pendingModel
      return resolveNodeRuntimeQuery(queryKey)
    })

    render(
      <TestRouterProvider user={createAdvancedAuthoringUser()}>
        {renderCreateLayout('equipment')}
      </TestRouterProvider>
    )

    try {
      expect(await screen.findByRole('status')).toHaveTextContent('Loading authoring tools…')
    } finally {
      releaseModel()
    }

    expect(await screen.findByRole('heading', { name: 'Basics' })).toBeInTheDocument()
  })

  it('recovers an authoring resolution failure without losing unsaved form values', async () => {
    const user = userEvent.setup()
    convexMocks.nodeRuntimeResolve.mockRejectedValue(new Error('Native resolution failed.'))

    render(<TestRouterProvider>{renderCreateLayout('spell')}</TestRouterProvider>)

    await user.click(await screen.findByRole('button', { name: /Start from scratch/i }))
    await user.type(await screen.findByRole('textbox', { name: 'Spell name' }), 'Unsaved spell')
    await user.click(screen.getByRole('button', { name: /switch to advanced/i }))

    const alert = await screen.findByRole(
      'alert',
      { name: 'Could not load authoring tools' },
      { timeout: 3000 }
    )
    expect(alert).toHaveTextContent('Could not load authoring tools')
    expect(screen.queryByText('Loading authoring tools…')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Unsaved spell' })).toBeInTheDocument()

    useFixtureNodeRuntimeResolver()
    await user.click(within(alert).getByRole('button', { name: 'Retry' }))

    expect(await screen.findByRole('textbox', { name: 'Name' })).toHaveValue('Unsaved spell')
    expect(screen.queryByText('Could not load authoring tools')).not.toBeInTheDocument()
  })

  it('preserves a guided spell when switching through Advanced', async () => {
    const user = userEvent.setup()
    useFixtureNodeRuntimeResolver()

    render(<TestRouterProvider>{renderCreateLayout('spell')}</TestRouterProvider>)

    await user.click(await screen.findByRole('button', { name: /switch to advanced/i }))
    const firstGuidedButton = await screen.findByRole('button', { name: 'Use guided authoring' })
    await waitFor(() => expect(firstGuidedButton).toHaveFocus())
    await user.click(firstGuidedButton)
    expect(await screen.findByRole('heading', { name: 'How do you want to begin?' })).toHaveFocus()
    await user.click(screen.getByRole('button', { name: /Start from scratch/i }))
    expect(await screen.findByRole('heading', { name: 'Start with the basics' })).toHaveFocus()

    await user.type(screen.getByRole('textbox', { name: 'Spell name' }), 'Ember Thread')
    await chooseSpellSchool(user)
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await user.click(await screen.findByRole('button', { name: /Damage/ }))
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await user.click(screen.getByRole('button', { name: /switch to advanced/i }))
    const guidedButton = await screen.findByRole('button', { name: 'Use guided authoring' })
    await waitFor(() => expect(guidedButton).toHaveFocus())
    await user.click(guidedButton)

    expect(await screen.findByRole('heading', { name: 'Review your spell' })).toHaveFocus()
    expect(screen.getAllByText('Ember Thread').length).toBeGreaterThan(0)
    expect(screen.getAllByText('1d6').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Fire').length).toBeGreaterThan(0)
  })

  it('returns Guided to its initial question when the canonical form is reset', async () => {
    const user = userEvent.setup()
    useFixtureNodeRuntimeResolver()

    render(<TestRouterProvider>{renderCreateSpellWithResetTrigger()}</TestRouterProvider>)

    await user.click(await screen.findByRole('button', { name: /Start from scratch/i }))
    await user.type(await screen.findByRole('textbox', { name: 'Spell name' }), 'Ember Thread')
    await chooseSpellSchool(user)
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await user.click(await screen.findByRole('button', { name: /Damage/ }))
    await user.click(screen.getByRole('button', { name: 'Test reset form' }))

    expect(await screen.findByRole('heading', { name: 'Start with the basics' })).toHaveFocus()
    expect(screen.queryByDisplayValue('Ember Thread')).not.toBeInTheDocument()
    expect(screen.getAllByText('Untitled Spell').length).toBeGreaterThan(0)
  })

  it.each(DOMAINS)('renders the %s edit authoring route data', async (domain) => {
    useFixtureNodeRuntimeResolver()

    render(<TestRouterProvider>{renderEditLayout(domain)}</TestRouterProvider>)

    expect(
      await screen.findByDisplayValue(authoredRouteStoryRecords[domain].label)
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /(?:add|change)(?: an)? image/i })
    ).toBeInTheDocument()
    expect(screen.getByTestId('authoring-form-canvas')).toBeInTheDocument()
    expect(screen.getByTestId('authoring-action-bar')).toBeInTheDocument()
  })

  it('marks an unchanged submitted draft as saved without reloading the editor', async () => {
    const user = userEvent.setup()
    useFixtureNodeRuntimeResolver()
    render(<TestRouterProvider>{renderEditLayout('spell')}</TestRouterProvider>)

    const name = await screen.findByRole('textbox', { name: /name/i })
    await user.clear(name)
    await user.type(name, 'Saved without reload')
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Save Draft' }))

    expect(await screen.findByText('All changes saved')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save Draft' })).toBeDisabled()
    expect(name).toHaveValue('Saved without reload')
  })

  it('guards populated Spell material values before deselecting Material', async () => {
    const user = userEvent.setup()
    useFixtureNodeRuntimeResolver()

    render(<TestRouterProvider>{renderEditLayout('spell')}</TestRouterProvider>)

    await user.click(await screen.findByRole('link', { name: /^casting/i }))
    const components = await screen.findByRole('combobox', { name: /components/i })
    expect(screen.getAllByText('a tiny ball of bat guano and sulfur').length).toBeGreaterThan(0)

    await user.click(components)
    await user.keyboard('{Backspace}')
    const confirmation = await screen.findByRole('dialog', { name: /clear hidden values/i })
    expect(screen.getByText('Material Description')).toBeInTheDocument()

    await user.click(within(confirmation).getByRole('button', { name: /^cancel$/i }))
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /clear hidden values/i })).not.toBeInTheDocument()
    })
    expect(screen.getAllByText('a tiny ball of bat guano and sulfur').length).toBeGreaterThan(0)

    await user.click(components)
    await user.keyboard('{Backspace}')
    await user.click(
      within(await screen.findByRole('dialog', { name: /clear hidden values/i })).getByRole(
        'button',
        { name: /clear and continue/i }
      )
    )

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /remove material/i })).not.toBeInTheDocument()
      expect(screen.queryByText('Material Description')).not.toBeInTheDocument()
    })
  }, 15_000)

  it('clears an empty Spell material branch without prompting', async () => {
    const user = userEvent.setup()
    useFixtureNodeRuntimeResolver()
    const spell = authoredEditRouteLoaderData.spell.authoringData.response.item
    if (!spell) throw new Error('Expected the owned Spell fixture.')

    render(
      <TestRouterProvider>
        <AuthoringLayout
          data={{
            ...authoredEditRouteLoaderData.spell.authoringData,
            response: {
              ...authoredEditRouteLoaderData.spell.authoringData.response,
              item: { ...spell, materialDescription: '' }
            }
          }}
          domain='spell'
          mode='edit'
        />
      </TestRouterProvider>
    )

    await user.click(await screen.findByRole('link', { name: /^casting/i }))
    const components = await screen.findByRole('combobox', { name: /components/i })
    expect(await screen.findByText('Material Description')).toBeInTheDocument()

    await user.click(components)
    await user.keyboard('{Backspace}')

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /clear hidden values/i })).not.toBeInTheDocument()
      expect(screen.queryByText('Material Description')).not.toBeInTheDocument()
    })
  })

  it('preserves the Spell branch when normalization fails', async () => {
    const user = userEvent.setup()
    useFixtureNodeRuntimeResolver()
    convexMocks.query.mockRejectedValue(new Error('Native normalization failed.'))

    render(<TestRouterProvider>{renderEditLayout('spell')}</TestRouterProvider>)

    await user.click(await screen.findByRole('link', { name: /^casting/i }))
    const components = await screen.findByRole('combobox', { name: /components/i })
    await user.click(components)
    await user.keyboard('{Backspace}')

    expect(await screen.findByText('This change could not be verified. Try again.')).toBeVisible()
    expect(screen.getAllByText('a tiny ball of bat guano and sulfur').length).toBeGreaterThan(0)
  })

  it('submits a Creature loadout hand slot and natural armor bonus from the editor', async () => {
    const user = userEvent.setup()
    useFixtureNodeRuntimeResolver()
    const { authoringData } = authoredEditRouteLoaderData.creature
    const creature = authoringData.response.item
    if (!creature) throw new Error('Expected the owned Creature fixture.')
    const loadoutEntry = {
      id: '00000000-0000-4000-8000-0000000000a1',
      equipmentId: srdBaselineContent.subjects.equipment[0]!.id,
      quantity: 1,
      useState: 'MAIN_HAND' as const,
      attuned: false,
      actionFeatureIds: []
    }

    render(
      <TestRouterProvider>
        <AuthoringLayout
          data={{
            ...authoringData,
            response: {
              ...authoringData.response,
              item: { ...creature, equipmentLoadout: [loadoutEntry] }
            }
          }}
          domain='creature'
          mode='edit'
        />
      </TestRouterProvider>
    )

    await user.click(await screen.findByRole('link', { name: /^stats/i }))
    const naturalArmor = await screen.findByRole('textbox', { name: /natural armor bonus/i })
    await user.clear(naturalArmor)
    await user.type(naturalArmor, '3')

    await user.click(await screen.findByRole('link', { name: /^equipment/i }))
    const useState = await screen.findByRole('combobox', { name: /use state/i })
    await user.click(useState)
    for (const label of ['Main hand', 'Off hand', 'Carried', 'Worn'])
      expect(await screen.findByRole('option', { name: label })).toBeInTheDocument()
    await user.click(screen.getByRole('option', { name: 'Off hand' }))
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: /use state/i })).toHaveValue('Off hand')
    )

    await user.click(screen.getByRole('button', { name: 'Save Draft' }))

    await waitFor(() => expect(convexMocks.mutation).toHaveBeenCalled())
    expect(convexMocks.mutation.mock.calls.at(-1)?.[1]).toMatchObject({
      payload: {
        naturalArmorBonus: 3,
        equipmentLoadout: [{ ...loadoutEntry, useState: 'OFF_HAND' }]
      }
    })
  }, 20_000)

  it('submits a Creature sense entry added in the editor', async () => {
    const user = userEvent.setup()
    useFixtureNodeRuntimeResolver()
    const { authoringData } = authoredEditRouteLoaderData.creature
    const creature = authoringData.response.item
    if (!creature) throw new Error('Expected the owned Creature fixture.')

    render(
      <TestRouterProvider>
        <AuthoringLayout
          data={{
            ...authoringData,
            response: { ...authoringData.response, item: { ...creature, senses: [] } }
          }}
          domain='creature'
          mode='edit'
        />
      </TestRouterProvider>
    )

    await user.click(await screen.findByRole('link', { name: /^stats/i }))
    await user.click(await screen.findByRole('button', { name: /add sense/i }))
    await user.click(await screen.findByRole('button', { name: /^sens 1/i }))
    await user.click(await screen.findByRole('combobox', { name: /^sense/i }))
    await user.click(await screen.findByRole('option', { name: 'Darkvision' }))
    await user.click(screen.getByRole('button', { name: 'Save Draft' }))

    await waitFor(() => expect(convexMocks.mutation).toHaveBeenCalled())
    expect(convexMocks.mutation.mock.calls.at(-1)?.[1]).toMatchObject({
      payload: {
        senses: [
          {
            senseDefinitionId: '00000000-0000-0000-000a-000100000000',
            range: { rangeKind: 'DISTANCE', amount: 30, unit: 'FEET' }
          }
        ]
      }
    })
  }, 20_000)

  it('renders a freshly added Creature sense editor while the root model has no scope for it', async () => {
    const user = userEvent.setup()
    const { authoringData } = authoredEditRouteLoaderData.creature
    const creature = authoringData.response.item
    if (!creature) throw new Error('Expected the owned Creature fixture.')
    convexMocks.nodeRuntimeResolve.mockImplementation((queryKey: readonly unknown[]) => {
      const { values } = nodeRuntimeResolveRequestDtoSchema.parse(queryKey[2])
      // The root request that includes the new sense never settles, so the root model keeps no
      // scope for the added row.
      if (Array.isArray(values.senses) && values.senses.length > 0)
        return new Promise(() => undefined)
      return resolveNodeRuntimeQuery(queryKey)
    })

    render(
      <TestRouterProvider>
        <AuthoringLayout
          data={{
            ...authoringData,
            response: { ...authoringData.response, item: { ...creature, senses: [] } }
          }}
          domain='creature'
          mode='edit'
        />
      </TestRouterProvider>
    )

    await user.click(await screen.findByRole('link', { name: /^stats/i }))
    await user.click(await screen.findByRole('button', { name: /add sense/i }))
    await user.click(await screen.findByRole('button', { name: /^sens 1/i }))

    expect(
      await screen.findByRole('combobox', { name: /^sense/i }, { timeout: 5000 })
    ).toBeInTheDocument()
  }, 20_000)

  it('loads native Spell copy sources after selection', async () => {
    const user = userEvent.setup()
    useFixtureNodeRuntimeResolver()

    render(<TestRouterProvider>{renderCreateLayout('spell')}</TestRouterProvider>)

    await user.click(await screen.findByRole('button', { name: /Use an existing spell/i }))

    expect(convexMocks.useContentCatalogue).toHaveBeenCalledWith('SPELL', {
      enabled: true,
      systemId: authoredRouteStorySystem.id
    })
  })
})

async function chooseSpellSchool(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('combobox', { name: /School of magic/ }))
  await user.click(await screen.findByRole('option', { name: 'Evocation' }))
}

function useFixtureNodeRuntimeResolver() {
  convexMocks.nodeRuntimeResolve.mockImplementation(resolveNodeRuntimeQuery)
}

async function resolveNodeRuntimeQuery(queryKey: readonly unknown[]) {
  return compactNodeRuntimeResponse(
    await resolveFixtureNodeRuntime(nodeRuntimeResolveRequestDtoSchema.parse(queryKey[2]))
  )
}

function resolveNormalization(reference: Parameters<typeof getFunctionName>[0], input: unknown) {
  if (getFunctionName(reference) !== getFunctionName(api.authoring.nodeRuntime.normalizeValues)) {
    throw new Error('Expected native node-runtime normalization.')
  }
  return normalizeFixtureNodeRuntimeValues(nodeRuntimeNormalizeValuesRequestDtoSchema.parse(input))
}

function renderCreateLayout(domain: AuthoredFormDomain) {
  switch (domain) {
    case 'background':
      return (
        <AuthoringLayout
          data={authoredCreateRouteLoaderData.authoringData}
          domain='background'
          mode='create'
        />
      )
    case 'class':
      return (
        <AuthoringLayout
          data={authoredCreateRouteLoaderData.authoringData}
          domain='class'
          mode='create'
        />
      )
    case 'creature':
      return (
        <AuthoringLayout
          data={authoredCreateRouteLoaderData.authoringData}
          domain='creature'
          mode='create'
        />
      )
    case 'equipment':
      return (
        <AuthoringLayout
          data={authoredCreateRouteLoaderData.authoringData}
          domain='equipment'
          mode='create'
        />
      )
    case 'feat':
      return (
        <AuthoringLayout
          data={authoredCreateRouteLoaderData.authoringData}
          domain='feat'
          mode='create'
        />
      )
    case 'race':
      return (
        <AuthoringLayout
          data={authoredCreateRouteLoaderData.authoringData}
          domain='race'
          mode='create'
        />
      )
    case 'spell':
      return (
        <AuthoringLayout
          data={authoredCreateRouteLoaderData.authoringData}
          domain='spell'
          mode='create'
        />
      )
    case 'vehicle':
      return (
        <AuthoringLayout
          data={authoredCreateRouteLoaderData.authoringData}
          domain='vehicle'
          mode='create'
        />
      )
  }
}

function createAdvancedAuthoringUser(): AuthSessionUserDto {
  return {
    userId: '13c13d4a-1a19-4cdc-8dc8-a9cac3492b1e',
    role: 'user',
    email: 'author@example.invalid',
    username: 'advanced_author',
    registrationCompleted: true,
    authoringExperience: 'advanced'
  }
}

function renderEditLayout(domain: AuthoredFormDomain) {
  switch (domain) {
    case 'background':
      return (
        <AuthoringLayout
          data={authoredEditRouteLoaderData.background.authoringData}
          domain='background'
          mode='edit'
        />
      )
    case 'class':
      return (
        <AuthoringLayout
          data={authoredEditRouteLoaderData.class.authoringData}
          domain='class'
          mode='edit'
        />
      )
    case 'creature':
      return (
        <AuthoringLayout
          data={authoredEditRouteLoaderData.creature.authoringData}
          domain='creature'
          mode='edit'
        />
      )
    case 'equipment':
      return (
        <AuthoringLayout
          data={authoredEditRouteLoaderData.equipment.authoringData}
          domain='equipment'
          mode='edit'
        />
      )
    case 'feat':
      return (
        <AuthoringLayout
          data={authoredEditRouteLoaderData.feat.authoringData}
          domain='feat'
          mode='edit'
        />
      )
    case 'race':
      return (
        <AuthoringLayout
          data={authoredEditRouteLoaderData.race.authoringData}
          domain='race'
          mode='edit'
        />
      )
    case 'spell':
      return (
        <AuthoringLayout
          data={authoredEditRouteLoaderData.spell.authoringData}
          domain='spell'
          mode='edit'
        />
      )
    case 'vehicle':
      return (
        <AuthoringLayout
          data={authoredEditRouteLoaderData.vehicle.authoringData}
          domain='vehicle'
          mode='edit'
        />
      )
  }
}

function renderCreateSpellWithResetTrigger() {
  return (
    <AuthoringFormProvider
      data={authoredCreateRouteLoaderData.authoringData}
      domain='spell'
      mode='create'
    >
      <SpellResetHarness />
    </AuthoringFormProvider>
  )
}

function SpellResetHarness() {
  const { resetForm } = useAuthoringForm()

  return (
    <>
      <button type='button' onClick={() => void resetForm()}>
        Test reset form
      </button>
      <AuthoringLayoutContent />
    </>
  )
}
