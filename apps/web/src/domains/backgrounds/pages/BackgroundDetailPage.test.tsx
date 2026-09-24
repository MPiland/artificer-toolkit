import { screen } from '@testing-library/react'
import { vi } from 'vitest'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { ownedBackgroundFixture, ownedBackgroundResponseFixture } from '../background.fixtures'
import { BackgroundDetailPage } from './BackgroundDetailPage'

vi.mock('convex/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('convex/react')>()),
  useQuery: () => ({ assetId: null, revision: 0 })
}))

it('keeps hook order when a live update removes the displayed background', () => {
  const props = {
    backgroundId: ownedBackgroundFixture.id,
    draft: null,
    references: { currencies: [], equipment: [], languages: [], skills: [] },
    view: 'active' as const
  }
  const { rerender } = renderWithAppProviders(
    <BackgroundDetailPage {...props} response={ownedBackgroundResponseFixture} />
  )
  expect(screen.getByRole('button', { name: 'Export JSON' })).toBeInTheDocument()

  rerender(<BackgroundDetailPage {...props} response={null} />)

  expect(screen.getByText('That background could not be found.')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Export JSON' })).not.toBeInTheDocument()
})
