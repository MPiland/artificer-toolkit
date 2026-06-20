import { HttpResponse, http } from 'msw'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { NodeRuntimeResolveRequestDto } from '@artificer-toolkit/schema/api/nodeRuntime'
import {
  authoredCreateRouteLoaderData,
  authoredEditRouteLoaderData,
  authoredRouteStoryRecords
} from '#domains/authoredRouteStory.fixtures'
import { TestRouterProvider } from '#test/TestRouterProvider'
import { server } from '#test/msw/server'
import { AuthoringLayout } from '../layout/AuthoringLayout'
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

    render(
      <TestRouterProvider>
        {renderCreateLayout(domain)}
      </TestRouterProvider>
    )

    expect(await screen.findByRole('textbox', { name: /name/i })).toBeInTheDocument()
    expect(screen.getByTestId('authoring-form-canvas')).toBeInTheDocument()
    expect(screen.getByTestId('authoring-action-bar')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument()
  })

  it.each(DOMAINS)('renders the %s edit authoring route data', async (domain) => {
    useStaticNodeRuntimeResolver()

    render(
      <TestRouterProvider>
        {renderEditLayout(domain)}
      </TestRouterProvider>
    )

    expect(await screen.findByDisplayValue(authoredRouteStoryRecords[domain].label)).toBeInTheDocument()
    expect(screen.getByTestId('authoring-form-canvas')).toBeInTheDocument()
    expect(screen.getByTestId('authoring-action-bar')).toBeInTheDocument()
  })
})

function useStaticNodeRuntimeResolver() {
  server.use(
    http.post('*/api/trpc/nodeRuntime.resolve*', async ({ request }) => {
      const inputs = readBatchedInputs<NodeRuntimeResolveRequestDto>(await request.json())

      return trpcBatchJson(
        inputs.map((input) => (
          createStaticResolvedFormModel(input.mapId) ?? {
            mapId: input.mapId,
            steps: [],
            clearPaths: []
          }
        ))
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
