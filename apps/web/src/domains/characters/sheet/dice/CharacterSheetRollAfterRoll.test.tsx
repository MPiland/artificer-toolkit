import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { RollAfterRollOfferDto } from '@artificer-toolkit/schema/api/rolls'
import { CharacterSheetRollAfterRoll } from './CharacterSheetRollAfterRoll'

const offer: RollAfterRollOfferDto = {
  effectId: '00000000-0000-4000-8000-000000000201',
  grantId: 'guidance-die',
  label: 'Guidance',
  count: 1,
  faces: 4,
  sign: 'ADD'
}

function renderOffers(pending = false) {
  const onAdd = vi.fn()
  const onKeep = vi.fn()
  render(
    <MantineProvider>
      <CharacterSheetRollAfterRoll
        offers={[offer]}
        pending={pending}
        onAdd={onAdd}
        onKeep={onKeep}
      />
    </MantineProvider>
  )
  return { onAdd, onKeep }
}

describe('CharacterSheetRollAfterRoll', () => {
  it('offers each held die with its size and adds the one chosen', async () => {
    const { onAdd, onKeep } = renderOffers()
    await userEvent.click(screen.getByRole('button', { name: 'Guidance +1d4' }))
    expect(onAdd).toHaveBeenCalledWith(offer)
    expect(onKeep).not.toHaveBeenCalled()
  })

  it('keeps the roll as rolled', async () => {
    const { onAdd, onKeep } = renderOffers()
    await userEvent.click(screen.getByRole('button', { name: 'Keep roll' }))
    expect(onKeep).toHaveBeenCalledOnce()
    expect(onAdd).not.toHaveBeenCalled()
  })

  it('disables both choices while a choice is being saved', () => {
    renderOffers(true)
    expect(screen.getByRole('button', { name: 'Guidance +1d4' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Keep roll' })).toBeDisabled()
  })
})
