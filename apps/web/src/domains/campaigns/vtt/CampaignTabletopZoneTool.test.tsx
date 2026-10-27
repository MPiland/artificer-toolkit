import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useQueryClient } from '@tanstack/react-query'
import { type ReactNode, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { configureAuthoredRouteStoryQueries } from '#test/authoredRouteStory.utils'
import { TestRouterProvider } from '#test/TestRouterProvider'
import { CampaignTabletopZoneTool } from './CampaignTabletopZoneTool'

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
})
