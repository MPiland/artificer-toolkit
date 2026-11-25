import { screen } from '@testing-library/react'
import { useEffect } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { resizeViewport, stubDisplay } from '#test/stubDisplay'
import { CampaignTabletopDeviceGate } from './CampaignTabletopDeviceGate'

const campaignRouteParams = { campaignPublicId: 'camp1', campaignSlug: 'the-lost-mine' }

/** Stands in for the tabletop window, whose stage opens the room connection on mount. */
const room = vi.hoisted(() => ({ joined: vi.fn(), left: vi.fn() }))

function TabletopProbe() {
  useEffect(() => {
    room.joined()
    return () => room.left()
  }, [])
  return <p>Tabletop stage</p>
}

function renderGate() {
  return renderWithAppProviders(
    <CampaignTabletopDeviceGate campaignRouteParams={campaignRouteParams}>
      <TabletopProbe />
    </CampaignTabletopDeviceGate>
  )
}

describe('CampaignTabletopDeviceGate', () => {
  it('renders nothing on the server, which cannot know the screen', () => {
    stubDisplay({ screen: { height: 1080, width: 1920 }, viewportWidth: 1600 })
    expect(
      renderToString(
        <CampaignTabletopDeviceGate campaignRouteParams={campaignRouteParams}>
          <TabletopProbe />
        </CampaignTabletopDeviceGate>
      )
    ).toBe('')
  })

  describe('on a phone', () => {
    it('says the tabletop needs a large tablet or a computer, links back and never joins the room', async () => {
      room.joined.mockClear()
      stubDisplay({ screen: { height: 844, width: 390 }, viewportWidth: 390 })
      renderGate()

      expect(
        await screen.findByRole('heading', { name: /needs a larger screen/i })
      ).toBeInTheDocument()
      expect(screen.getByText(/large tablet or a computer/i)).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /back to the campaign/i })).toHaveAttribute(
        'href',
        '/campaigns/camp1/the-lost-mine'
      )
      expect(screen.queryByText('Tabletop stage')).toBeNull()
      expect(room.joined).not.toHaveBeenCalled()
    })
  })

  describe('on a large tablet in portrait', () => {
    it('covers the tabletop with the rotate-or-widen prompt, then shows it again without remounting', async () => {
      room.joined.mockClear()
      room.left.mockClear()
      stubDisplay({ screen: { height: 1366, width: 1024 }, viewportWidth: 820 })
      renderGate()

      const cover = await screen.findByRole('dialog', { name: /make the window wider/i })
      expect(cover).toHaveTextContent(/landscape or widen this window/i)
      expect(room.joined).toHaveBeenCalledTimes(1)

      resizeViewport(1366)
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(screen.getByText('Tabletop stage')).toBeVisible()
      expect(room.joined).toHaveBeenCalledTimes(1)
      expect(room.left).not.toHaveBeenCalled()
    })
  })

  describe('on a computer', () => {
    it('covers a narrowed window and uncovers it on widening', async () => {
      stubDisplay({ screen: { height: 1080, width: 1920 }, viewportWidth: 900 })
      renderGate()
      expect(await screen.findByRole('dialog')).toBeInTheDocument()

      resizeViewport(1280)
      expect(screen.queryByRole('dialog')).toBeNull()
    })

    it('shows the tabletop with no cover when the window is wide enough', async () => {
      stubDisplay({ screen: { height: 1080, width: 1920 }, viewportWidth: 1600 })
      renderGate()
      expect(await screen.findByText('Tabletop stage')).toBeInTheDocument()
      expect(screen.queryByRole('dialog')).toBeNull()
    })
  })
})
