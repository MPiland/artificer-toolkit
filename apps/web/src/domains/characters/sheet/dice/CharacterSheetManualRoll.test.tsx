import { MantineProvider } from '@mantine/core'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useMemo, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { RollRecordDto } from '@artificer-toolkit/schema/api/rolls'
import type { OfferedRollModeDto } from '@artificer-toolkit/schema/shared/systemCoreCode'
import { CharacterSheetManualRoll } from './CharacterSheetManualRoll'
import type {
  CharacterSheetRollDestinations,
  CharacterSheetRollRequest,
  CharacterSheetRolls
} from './dice.types'
import { CharacterSheetRollContext, CharacterSheetRollDestinationContext } from './rollContext'

const rollModes: OfferedRollModeDto[] = [{ code: 'NORMAL', label: 'Normal', keep: 'FIRST' }]

const destinations: CharacterSheetRollDestinations = {
  destination: 'PRIVATE',
  destinationOptions: [],
  setDestination: () => undefined,
  stateRollDestination: 'PRIVATE',
  stateRollDestinationOptions: []
}

/** Stands in for the roll transport: each roll stays pending until the test settles it. */
function RollTransport({
  onRoll
}: {
  onRoll: (request: CharacterSheetRollRequest, settle: () => void) => void
}) {
  const [pending, setPending] = useState(false)
  const rolls = useMemo<CharacterSheetRolls>(
    () => ({
      clearManualRoll: () => undefined,
      executeRoll: (request) => {
        setPending(true)
        return new Promise<RollRecordDto | undefined>((resolve) =>
          onRoll(request, () => {
            setPending(false)
            resolve(undefined)
          })
        )
      },
      hasManualRoll: false,
      pending
    }),
    [onRoll, pending]
  )
  return (
    <CharacterSheetRollContext.Provider value={rolls}>
      <CharacterSheetRollDestinationContext.Provider value={destinations}>
        <CharacterSheetManualRoll rollModes={rollModes} />
      </CharacterSheetRollDestinationContext.Provider>
    </CharacterSheetRollContext.Provider>
  )
}

describe('CharacterSheetManualRoll', () => {
  // A natively disabled button drops keyboard focus to the page, so Escape no longer reached the
  // roller and the next open-button click closed it under the user (RELIABILITY-21.22).
  it('keeps the Roll button focused while a roll is pending, then rolls again', async () => {
    const user = userEvent.setup()
    const settles: (() => void)[] = []
    const onRoll = vi.fn((_request: CharacterSheetRollRequest, settle: () => void) => {
      settles.push(settle)
    })
    render(
      <MantineProvider>
        <RollTransport onRoll={onRoll} />
      </MantineProvider>
    )

    await user.click(screen.getByRole('button', { name: 'Open manual dice roller' }))
    const roll = await screen.findByRole('button', { name: 'Roll' })
    await user.click(roll)

    expect(onRoll).toHaveBeenCalledOnce()
    expect(roll).not.toBeDisabled()
    expect(roll).toHaveAttribute('aria-disabled', 'true')
    expect(roll).toHaveFocus()
    await user.click(roll)
    expect(onRoll).toHaveBeenCalledOnce()

    settles[0]?.()
    await waitFor(() => expect(roll).not.toHaveAttribute('aria-disabled', 'true'))
    await user.click(roll)
    expect(onRoll).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('button', { name: 'Roll' })).toBe(roll)

    settles[1]?.()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })
})
