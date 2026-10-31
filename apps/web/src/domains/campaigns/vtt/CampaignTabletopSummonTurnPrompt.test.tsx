import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { CampaignTabletopSummonTurnPrompt } from './CampaignTabletopSummonTurnPrompt'

describe('CampaignTabletopSummonTurnPrompt', () => {
  it('announces the summon and its owner as a status', () => {
    renderWithAppProviders(
      <CampaignTabletopSummonTurnPrompt ownerLabel='Aria' summonLabel='Spectral Hound' />
    )
    const prompt = screen.getByRole('status')
    expect(prompt).toHaveTextContent("Spectral Hound's turn")
    expect(prompt).toHaveTextContent('commanded by Aria')
  })
})
