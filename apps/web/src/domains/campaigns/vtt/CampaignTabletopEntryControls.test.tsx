import { act, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { stubDisplay } from '#test/stubDisplay'
import { createTabletopCampaign } from './CampaignTabletop.stories.fixtures'
import { CampaignTabletopButton } from './CampaignTabletopButton'
import { CampaignTabletopLauncher } from './CampaignTabletopLauncher'

const campaignFetches = vi.hoisted(() => ({ count: 0 }))

vi.mock('#app/data/campaigns/queries', async () => {
  const { createTabletopCampaign: createCampaign } =
    await import('./CampaignTabletop.stories.fixtures')
  return {
    getCampaignDetail: () => ({
      queryKey: ['tabletop-entry-controls'],
      queryFn: async () => {
        campaignFetches.count += 1
        return createCampaign('PLAYER')
      }
    })
  }
})

const phone = { height: 844, width: 390 }
const smallTablet = { height: 1023, width: 768 }

function renderLauncher() {
  return renderWithAppProviders(
    <CampaignTabletopLauncher campaign={createTabletopCampaign('OWNER')} />
  )
}

function renderButton() {
  return renderWithAppProviders(<CampaignTabletopButton campaignId='campaign-1' />)
}

describe('controls that open the live tabletop', () => {
  describe.each([
    ['phone', phone, 390],
    ['small tablet', smallTablet, 768]
  ])('on a %s', (_device, size, viewportWidth) => {
    it('hides the Session workspace launcher', () => {
      stubDisplay({ screen: size, viewportWidth })
      renderLauncher()
      expect(screen.queryByRole('link', { name: /open tabletop window/i })).toBeNull()
      expect(screen.queryByText('Live tabletop')).toBeNull()
    })

    it('hides the Sheet button even once the Campaign has loaded', async () => {
      stubDisplay({ screen: size, viewportWidth })
      campaignFetches.count = 0
      renderButton()
      await waitFor(() => expect(campaignFetches.count).toBe(1))
      await act(async () => {})
      expect(screen.queryByRole('link', { name: /open live tabletop window/i })).toBeNull()
    })
  })

  describe.each([
    ['a large tablet in portrait', { height: 1366, width: 1024 }, 820],
    ['a large tablet in landscape', { height: 1024, width: 1366 }, 1366],
    ['a narrowed computer window', { height: 1080, width: 1920 }, 500],
    ['a computer', { height: 1080, width: 1920 }, 1800]
  ])('on %s', (_device, size, viewportWidth) => {
    it('shows the Session workspace launcher', async () => {
      stubDisplay({ screen: size, viewportWidth })
      renderLauncher()
      expect(await screen.findByRole('link', { name: /open tabletop window/i })).toBeInTheDocument()
    })

    it('shows the Sheet button', async () => {
      stubDisplay({ screen: size, viewportWidth })
      renderButton()
      expect(
        await screen.findByRole('link', { name: /open live tabletop window/i })
      ).toBeInTheDocument()
    })
  })
})
