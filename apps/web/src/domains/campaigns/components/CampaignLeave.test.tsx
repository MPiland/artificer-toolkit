import { StrictMode } from 'react'
import { screen, waitFor } from '@testing-library/react'
import { getFunctionName } from 'convex/server'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { CampaignLeave } from './CampaignLeave'

const mocks = vi.hoisted(() => ({ leave: vi.fn(), removeCampaignQueries: vi.fn() }))
vi.mock('convex/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('convex/react')>()),
  useMutation: (reference: Parameters<typeof getFunctionName>[0]) => {
    if (
      getFunctionName(reference) !== getFunctionName(convexApi.campaigns.membershipDeparture.leave)
    )
      throw new Error('Unexpected mutation')
    return mocks.leave
  }
}))
vi.mock('#app/data/campaigns/queries', () => ({
  removeCampaignQueries: mocks.removeCampaignQueries
}))

const input = {
  campaignId: '11111111-1111-4111-8111-111111111111',
  expectedCampaignVersion: 2,
  expectedMembershipAccessStartedAt: '2026-09-03T00:00:00.000Z',
  commandId: '77777777-7777-4777-8777-777777777777'
}

describe('CampaignLeave', () => {
  afterEach(() => vi.clearAllMocks())

  it('drops the Campaign queries before it leaves with the confirmed input', async () => {
    mocks.leave.mockResolvedValue({ ok: true })
    const assign = vi.fn()
    vi.stubGlobal('location', { ...window.location, assign })
    renderWithAppProviders(<CampaignLeave input={input} onFailed={vi.fn()} />)

    await waitFor(() => expect(assign).toHaveBeenCalledWith('/campaigns'))
    expect(mocks.removeCampaignQueries).toHaveBeenCalledWith(expect.anything(), input.campaignId)
    expect(mocks.leave).toHaveBeenCalledWith(input)
    expect(mocks.removeCampaignQueries.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.leave.mock.invocationCallOrder[0] ?? 0
    )
    vi.unstubAllGlobals()
  })

  it('retries the exact input once, then reports the failure to the page', async () => {
    mocks.leave.mockRejectedValue(new Error('Departure acknowledgement unavailable.'))
    const onFailed = vi.fn()
    renderWithAppProviders(<CampaignLeave input={input} onFailed={onFailed} />)

    expect(screen.getByLabelText('Leaving Campaign')).toBeInTheDocument()
    await waitFor(
      () => expect(onFailed).toHaveBeenCalledWith('Departure acknowledgement unavailable.'),
      {
        timeout: 2500
      }
    )
    expect(mocks.leave).toHaveBeenCalledTimes(2)
    for (const [sent] of mocks.leave.mock.calls) expect(sent).toBe(input)
  })

  it('sends one departure when StrictMode reruns the mount effect', async () => {
    mocks.leave.mockResolvedValue({ ok: true })
    const assign = vi.fn()
    vi.stubGlobal('location', { ...window.location, assign })
    renderWithAppProviders(
      <StrictMode>
        <CampaignLeave input={input} onFailed={vi.fn()} />
      </StrictMode>
    )

    await waitFor(() => expect(assign).toHaveBeenCalledWith('/campaigns'))
    expect(mocks.leave).toHaveBeenCalledTimes(1)
    expect(mocks.removeCampaignQueries).toHaveBeenCalledTimes(1)
    vi.unstubAllGlobals()
  })
})
