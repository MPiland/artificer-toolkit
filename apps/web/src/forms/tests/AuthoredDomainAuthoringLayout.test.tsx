import { HttpResponse, http } from 'msw'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { NodeRuntimeResolveRequestDto } from '@artificer-toolkit/schema/api/nodeRuntime'
import {
  authoredCreateRouteLoaderData,
  authoredEditRouteLoaderData,
  authoredRouteStoryDrafts,
  authoredRouteStoryRecords,
  authoredRouteStorySystem
} from '#domains/authoredRouteStory.fixtures'
import { TestRouterProvider } from '#test/TestRouterProvider'
import { server } from '#test/msw/server'
import { AuthoringLayout, AuthoringLayoutContent } from '../layout/AuthoringLayout'
import { AuthoringFormProvider } from '../layout/AuthoringFormProvider'
import { useAuthoringForm } from '../layout/AuthoringFormContext'
import { createStaticResolvedFormModel } from '../node-map/staticResolvedModel'
import type { AuthoredFormDomain } from '../factories/authoredFormFactories.types'

const mocks = vi.hoisted(() => ({
  updateAuthUser: vi.fn()
}))

vi.mock('#supabase/client', () => ({
  getSupabaseBrowserClient: () => ({
    auth: { updateUser: mocks.updateAuthUser }
  })
}))

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

describe('non-character authored domain layout coverage', () => {
  it.each(DOMAINS)('renders the %s create authoring route data', async (domain) => {
    const user = userEvent.setup()
    useStaticNodeRuntimeResolver()

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
    useStaticNodeRuntimeResolver()

    render(<TestRouterProvider>{renderCreateLayout('race')}</TestRouterProvider>)

    await user.click(await screen.findByRole('button', { name: /Start from scratch/i }))
    await user.type(await screen.findByRole('textbox', { name: /name/i }), 'Test Race')
    await user.click(screen.getByRole('button', { name: /^next$/i }))

    expect(screen.getByRole('button', { name: /^back$/i })).toBeEnabled()
  })

  it('keeps starting-point UI state clean until an inline copy is confirmed', async () => {
    const user = userEvent.setup()
    useStaticNodeRuntimeResolver()
    let duplicateRequests = 0
    server.use(
      http.post('*/api/trpc/content.races.duplicate', () => {
        duplicateRequests += 1
        return trpcJson(authoredRouteStoryDrafts.race)
      })
    )

    render(<TestRouterProvider>{renderCreateLayout('race')}</TestRouterProvider>)

    expect(await screen.findByText('All changes saved')).toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: /Use an existing race/i }))

    const picker = await screen.findByRole('combobox', { name: /Search races/i })
    expect(picker).toBeInTheDocument()
    expect(screen.getByText(/nothing is copied until you confirm/i)).toBeInTheDocument()
    expect(duplicateRequests).toBe(0)
    await user.click(picker)
    await user.type(picker, 'Elf')
    await user.click(await screen.findByRole('option', { name: 'Elf', hidden: true }))
    expect(screen.getAllByText('Elf').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('SRD')).toBeInTheDocument()
    expect(screen.getByText(/Elves are magical people/i)).toBeInTheDocument()
    expect(screen.getByText('All changes saved')).toBeInTheDocument()
    expect(duplicateRequests).toBe(0)

    const createCopy = screen.getByRole('button', { name: /Create copy/i })
    expect(createCopy).toBeEnabled()
    await user.click(createCopy)
    await waitFor(() => expect(duplicateRequests).toBe(1))

    expect(screen.queryByText('Could not duplicate that race yet.')).not.toBeInTheDocument()
    expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument()
  })

  it('updates the live preview title from the current form name', async () => {
    const user = userEvent.setup()
    useStaticNodeRuntimeResolver()

    render(<TestRouterProvider>{renderCreateLayout('equipment')}</TestRouterProvider>)

    await user.click(await screen.findByRole('button', { name: /Start from scratch/i }))
    expect(screen.queryByLabelText('Authoring preview')).not.toBeInTheDocument()

    await user.type(await screen.findByRole('textbox', { name: /name/i }), 'Moon Blade')

    const preview = await screen.findByLabelText('Authoring preview')
    expect(await within(preview).findByText('Moon Blade')).toBeInTheDocument()
  })

  it('guides a new spell through grouped questions on the canonical form', async () => {
    const user = userEvent.setup()
    useStaticNodeRuntimeResolver()

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

  it('preserves a guided spell when switching through Advanced', async () => {
    const user = userEvent.setup()
    mocks.updateAuthUser.mockResolvedValue({ error: null })
    useStaticNodeRuntimeResolver()

    render(<TestRouterProvider>{renderCreateLayout('spell')}</TestRouterProvider>)

    await user.click(await screen.findByRole('button', { name: /switch to advanced/i }))
    const firstGuidedButton = await screen.findByRole('button', { name: 'Use guided authoring' })
    await waitFor(() => expect(firstGuidedButton).toHaveFocus())
    await user.click(firstGuidedButton)
    expect(await screen.findByRole('heading', { name: 'How do you want to begin?' })).toHaveFocus()
    await user.click(screen.getByRole('button', { name: /Start from scratch/i }))
    expect(await screen.findByRole('heading', { name: 'Start with the basics' })).toHaveFocus()

    await user.type(screen.getByRole('textbox', { name: 'Spell name' }), 'Ember Thread')
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
    useStaticNodeRuntimeResolver()

    render(<TestRouterProvider>{renderCreateSpellWithResetTrigger()}</TestRouterProvider>)

    await user.click(await screen.findByRole('button', { name: /Start from scratch/i }))
    await user.type(await screen.findByRole('textbox', { name: 'Spell name' }), 'Ember Thread')
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await user.click(await screen.findByRole('button', { name: /Damage/ }))
    await user.click(screen.getByRole('button', { name: 'Test reset form' }))

    expect(await screen.findByRole('heading', { name: 'Start with the basics' })).toHaveFocus()
    expect(screen.queryByDisplayValue('Ember Thread')).not.toBeInTheDocument()
    expect(screen.getAllByText('Untitled Spell').length).toBeGreaterThan(0)
  })

  it.each(DOMAINS)('renders the %s edit authoring route data', async (domain) => {
    useStaticNodeRuntimeResolver()

    render(<TestRouterProvider>{renderEditLayout(domain)}</TestRouterProvider>)

    expect(
      await screen.findByDisplayValue(authoredRouteStoryRecords[domain].label)
    ).toBeInTheDocument()
    expect(screen.getByTestId('authoring-form-canvas')).toBeInTheDocument()
    expect(screen.getByTestId('authoring-action-bar')).toBeInTheDocument()
  })

  it('guards populated Spell material values before deselecting Material', async () => {
    const user = userEvent.setup()
    useStaticNodeRuntimeResolver()

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
    useStaticNodeRuntimeResolver()
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
    useStaticNodeRuntimeResolver()
    server.use(http.post('*/api/trpc/nodeRuntime.normalizeValues*', () => HttpResponse.error()))

    render(<TestRouterProvider>{renderEditLayout('spell')}</TestRouterProvider>)

    await user.click(await screen.findByRole('link', { name: /^casting/i }))
    const components = await screen.findByRole('combobox', { name: /components/i })
    await user.click(components)
    await user.keyboard('{Backspace}')

    expect(await screen.findByText('This change could not be verified. Try again.')).toBeVisible()
    expect(screen.getAllByText('a tiny ball of bat guano and sulfur').length).toBeGreaterThan(0)
  })
})

function useStaticNodeRuntimeResolver() {
  server.use(
    http.post('*/api/trpc/nodeRuntime.resolve*', async ({ request }) => {
      const inputs = readBatchedInputs<NodeRuntimeResolveRequestDto>(await request.json())

      return trpcBatchJson(
        inputs.map(
          (input) =>
            createStaticResolvedFormModel(input.mapId, {
              ancestors: input.ancestors,
              parentValues: input.parentValues,
              system: authoredRouteStorySystem,
              values: input.values
            }) ?? {
              mapId: input.mapId,
              steps: [],
              clearPaths: []
            }
        )
      )
    })
  )
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

function trpcBatchJson(data: readonly unknown[]) {
  return HttpResponse.json(data.map((item) => ({ result: { data: item } })))
}

function trpcJson(data: unknown) {
  return HttpResponse.json([{ result: { data } }])
}

function readBatchedInputs<TInput>(body: unknown): TInput[] {
  if (typeof body !== 'object' || body === null || !('0' in body)) {
    throw new Error('Expected batched tRPC input.')
  }

  return Object.entries(body as Record<string, TInput>)
    .sort(([left], [right]) => Number(left) - Number(right))
    .map(([, input]) => input)
}
