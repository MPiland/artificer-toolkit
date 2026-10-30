import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useQueryClient } from '@tanstack/react-query'
import { type ReactNode, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { nodeRuntimeNormalizeValuesRequestDtoSchema } from '@artificer-toolkit/schema/api/nodeRuntime'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { configureAuthoredRouteStoryQueries } from '#test/authoredRouteStory.utils'
import { normalizeFixtureNodeRuntimeValues } from '#test/nodeRuntimeResolver'
import { TestRouterProvider } from '#test/TestRouterProvider'
import { CampaignTabletopZoneTool } from './CampaignTabletopZoneTool'

// The structural-change guard verifies each edit with the native normalizer; run the real one.
vi.mock('convex/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('convex/react')>()),
  useConvex: () => ({
    query: async (_reference: unknown, input: unknown) =>
      normalizeFixtureNodeRuntimeValues(nodeRuntimeNormalizeValuesRequestDtoSchema.parse(input))
  })
}))

/** Answers the node-runtime resolve query with the real `packages/authoring` resolver. */
function RealNodeRuntime({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  useState(() => configureAuthoredRouteStoryQueries(queryClient))
  return children
}

describe('CampaignTabletopZoneTool (MOVE-3.2)', () => {
  it('authors the zone through the shared renderer’s outcome node map', async () => {
    render(
      <TestRouterProvider>
        <RealNodeRuntime>
          <CampaignTabletopZoneTool
            connected
            encounterId='00000000-0000-4000-8000-0000000000e1'
            encounterVersion={3}
            gameSystemId={srdSystemRecord.id}
            grid={{ kind: 'GRIDLESS', pixelsPerUnit: 10, unit: 'FEET' }}
            picking={false}
            onPickPoint={vi.fn()}
            onSend={vi.fn()}
          />
        </RealNodeRuntime>
      </TestRouterProvider>
    )

    await userEvent.setup().click(screen.getByRole('button', { name: 'Place a zone' }))
    const tool = await screen.findByRole('dialog', { name: 'Place a zone' })
    expect(await screen.findByText('Attachment', {}, { timeout: 10_000 })).toBeInTheDocument()
    expect(screen.getByText('Shape')).toBeInTheDocument()
    expect(screen.getByText('Components')).toBeInTheDocument()
    expect(tool).toHaveTextContent('Pick the zone’s center on the map.')
  }, 20_000)

  it('verifies a structural edit against the zone’s own node map', async () => {
    const user = userEvent.setup()
    render(
      <TestRouterProvider>
        <RealNodeRuntime>
          <CampaignTabletopZoneTool
            connected
            encounterId='00000000-0000-4000-8000-0000000000e1'
            encounterVersion={3}
            gameSystemId={srdSystemRecord.id}
            grid={{ kind: 'GRIDLESS', pixelsPerUnit: 10, unit: 'FEET' }}
            picking={false}
            onPickPoint={vi.fn()}
            onSend={vi.fn()}
          />
        </RealNodeRuntime>
      </TestRouterProvider>
    )

    await user.click(screen.getByRole('button', { name: 'Place a zone' }))
    const tool = await screen.findByRole('dialog', { name: 'Place a zone' })
    await user.click(
      await screen.findByRole('combobox', { name: /attachment/i }, { timeout: 10_000 })
    )
    await user.click(await screen.findByRole('option', { name: 'Source' }))

    await waitFor(() => expect(tool).toHaveTextContent(/Complete a placed-space zone/))
    expect(screen.getByRole('combobox', { name: /attachment/i })).toHaveValue('Source')
  }, 20_000)
})
