import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { renderWithAppProviders } from '#test/renderWithAppProviders'

import { CampaignTabletopMorale } from './CampaignTabletopMorale'

vi.mock('#app/settings/useGmRollVisibilityPreference', () => ({
  useGmRollVisibilityPreference: () => ({
    gmRollVisibility: 'PUBLIC',
    setGmRollVisibility: vi.fn()
  })
}))

const ACTOR_ID = '00000000-0000-4000-8000-0000000000c1'
const actor = {
  id: ACTOR_ID,
  label: 'Goblin',
  morale: null,
  moraleOffers: [
    { triggerKind: 'INDIVIDUAL_REDUCED_TO_HALF' as const, origin: 'RUN_STATE' as const }
  ]
}

function renderMorale(overrides: Partial<Parameters<typeof CampaignTabletopMorale>[0]> = {}) {
  const onCheck = vi.fn()
  const onConfirm = vi.fn()
  renderWithAppProviders(
    <CampaignTabletopMorale
      actor={actor}
      disabled={false}
      leaders={[]}
      onCheck={onCheck}
      onConfirm={onConfirm}
      {...overrides}
    />
  )
  return { onCheck, onConfirm }
}

describe('Tabletop morale', () => {
  it('checks the offered trigger with the GM’s roll visibility', async () => {
    const { onCheck } = renderMorale()
    await userEvent.click(screen.getByRole('button', { name: 'Check morale for Goblin' }))
    expect(onCheck).toHaveBeenCalledWith({
      triggerKind: 'INDIVIDUAL_REDUCED_TO_HALF',
      leaderActorId: null,
      overwhelmingOpposition: false,
      escapePossible: true,
      visibility: 'PUBLIC'
    })
  })

  it('shows nothing when no trigger is offered and no check was made', () => {
    renderMorale({ actor: { ...actor, moraleOffers: [] } })
    expect(screen.queryByRole('group', { name: 'Morale for Goblin' })).toBeNull()
  })
})
