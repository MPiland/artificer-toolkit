import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { createCampaignDetail } from '../campaignDetail.fixtures'
import { CampaignNotebook } from './CampaignNotebook'

const mocks = vi.hoisted(() => ({
  notebook: {
    results: [],
    status: 'LoadingFirstPage' as 'LoadingFirstPage' | 'Exhausted',
    loadMore: vi.fn()
  }
}))

vi.mock('convex/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('convex/react')>()),
  useMutation: () => vi.fn(),
  usePaginatedQuery: () => mocks.notebook
}))

vi.mock('#app/ui/primitives/RichTextEditor/RichTextEditor', () => ({
  default: () => null
}))

describe('CampaignNotebook', () => {
  // Sections render above the creator, so a creator shown before they load jumps away while the
  // author is filling it in and closes an open Visibility menu out of view.
  it('shows the new-section form only once the first page of sections has loaded', () => {
    const campaign = createCampaignDetail()
    mocks.notebook.status = 'LoadingFirstPage'
    const { rerender } = renderWithAppProviders(
      <CampaignNotebook campaign={campaign} currentUserId='author' />
    )
    expect(screen.getByLabelText('Loading Campaign notes')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'New section' })).not.toBeInTheDocument()

    mocks.notebook.status = 'Exhausted'
    rerender(<CampaignNotebook campaign={campaign} currentUserId='author' />)
    expect(screen.getByRole('heading', { name: 'New section' })).toBeVisible()
  })
})
