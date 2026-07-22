import { HttpResponse, http } from 'msw'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { NodeRuntimeResolveRequestDto } from '@artificer-toolkit/schema/api/nodeRuntime'
import {
  authoredCreateRouteLoaderData,
  authoredEditRouteLoaderData,
  authoredRouteStoryRecords,
  authoredRouteStorySystem
} from '#domains/authoredRouteStory.fixtures'
import { TestRouterProvider } from '#test/TestRouterProvider'
import { server } from '#test/msw/server'
import { AuthoringLayout } from '../layout/AuthoringLayout'
import { authoredFormActionFactories } from '../actions/authoredFormActionFactories'
import { createStaticResolvedFormModel } from '../node-map/staticResolvedModel'
import type { AuthoredFormDomain } from '../factories/authoredFormFactories.types'

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
    useStaticNodeRuntimeResolver()

    render(<TestRouterProvider>{renderCreateLayout(domain)}</TestRouterProvider>)

    expect(await screen.findByRole('textbox', { name: /name/i })).toBeInTheDocument()
    expect(screen.getByTestId('authoring-form-canvas')).toBeInTheDocument()
    expect(screen.getByTestId('authoring-action-bar')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^back$/i })).toBeDisabled()
    expect(screen.getByRole('link', { name: /^cancel$/i })).toHaveAttribute(
      'href',
      authoredFormActionFactories[domain].listPath
    )
    expect(
      within(screen.getByTestId('authoring-action-bar')).queryByRole('link', {
        name: /^cancel$/i
      })
    ).not.toBeInTheDocument()
  })

  it('shows Back after advancing from the first create step', async () => {
    const user = userEvent.setup()
    useStaticNodeRuntimeResolver()

    render(<TestRouterProvider>{renderCreateLayout('race')}</TestRouterProvider>)

    await user.type(await screen.findByRole('textbox', { name: /name/i }), 'Test Race')
    await user.click(screen.getByRole('link', { name: /^next$/i }))

    expect(screen.getByRole('link', { name: /^back$/i })).toHaveAttribute('href')
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

function trpcBatchJson(data: readonly unknown[]) {
  return HttpResponse.json(data.map((item) => ({ result: { data: item } })))
}

function readBatchedInputs<TInput>(body: unknown): TInput[] {
  if (typeof body !== 'object' || body === null || !('0' in body)) {
    throw new Error('Expected batched tRPC input.')
  }

  return Object.entries(body as Record<string, TInput>)
    .sort(([left], [right]) => Number(left) - Number(right))
    .map(([, input]) => input)
}
