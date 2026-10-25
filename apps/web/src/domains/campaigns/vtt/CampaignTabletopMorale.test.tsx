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

  it('confirms the proposed outcome or another, and shows the latest check', async () => {
    const { onConfirm } = renderMorale({
      actor: {
        ...actor,
        moraleOffers: [],
        morale: {
          commandId: '00000000-0000-4000-8000-0000000000c2',
          definitionId: '00000000-0000-4000-8000-0000000000c3',
          triggerKind: 'INDIVIDUAL_REDUCED_TO_HALF',
          scope: 'SUBJECT',
          rollerActorId: ACTOR_ID,
          groupLeaderActorId: null,
          save: null,
          proposed: 'FLEE',
          disposition: null,
          firedTriggerKinds: ['INDIVIDUAL_REDUCED_TO_HALF']
        }
      }
    })
    expect(screen.getByText(/failed against overwhelming opposition · proposes Flee/)).toBeTruthy()
    await userEvent.click(
      screen.getByRole('button', { name: 'Surrender: confirm morale for Goblin' })
    )
    expect(onConfirm).toHaveBeenCalledWith('SURRENDER')
  })

  it('names the group leader only for a group trigger', async () => {
    const LEADER_ID = '00000000-0000-4000-8000-0000000000c4'
    const { onCheck } = renderMorale({
      actor: {
        ...actor,
        moraleOffers: [{ triggerKind: 'GROUP_SURPRISED' as const, origin: 'GM_DECLARED' as const }]
      },
      leaders: [{ id: LEADER_ID, label: 'Hobgoblin captain' }]
    })
    await userEvent.click(screen.getByRole('combobox', { name: 'Group leader for Goblin' }))
    await userEvent.click(await screen.findByText('Hobgoblin captain'))
    await userEvent.click(screen.getByRole('button', { name: 'Check morale for Goblin' }))
    expect(onCheck).toHaveBeenCalledWith(
      expect.objectContaining({ triggerKind: 'GROUP_SURPRISED', leaderActorId: LEADER_ID })
    )
  })
})
