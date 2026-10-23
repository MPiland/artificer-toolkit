import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import type { CharacterBuilderStartingEquipmentViewDto } from '@artificer-toolkit/schema/api/characters'
import type { RollResultDto } from '@artificer-toolkit/schema/api/rolls'
import { ConvexReactClient } from 'convex/react'
import { getFunctionName } from 'convex/server'
import { api } from '@artificer-toolkit/apis/convex/api'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import type { CharacterStartingEquipmentDecision } from '../../core/characterBuilder.types'
import { CharacterStartingEquipmentChoices } from './CharacterStartingEquipmentChoices'
import { createStartingEquipmentDecision } from './startingEquipment'

const view = {
  source: 'CLASS',
  sourceLabel: 'Barbarian',
  choiceLabels: {},
  startingGold: { dieConfig: '2d4', multiplier: 10, currencyId: 'gp' },
  startingEquipment: { id: 'barbarian-starting-equipment', sets: [] }
} satisfies CharacterBuilderStartingEquipmentViewDto

function StartingGoldHarness() {
  const [decision, setDecision] = useState<CharacterStartingEquipmentDecision>({
    ...createStartingEquipmentDecision('CLASS'),
    tookGold: true,
    gold: { goldOption: '2d4', totalGold: 0 }
  })

  return (
    <CharacterStartingEquipmentChoices
      currencyOptions={[{ id: 'gp', label: 'Gold' }]}
      decision={decision}
      equipmentOptions={[]}
      onChange={setDecision}
      readOnly={false}
      view={view}
    />
  )
}

const roll = {
  id: 'starting-gold-roll',
  normalizedExpression: '2d4',
  evidence: {
    terms: [{ count: 2, die: 4, rolls: [3, 4], subtotal: 7 }],
    modifier: 0,
    mode: 'NORMAL',
    keep: 'FIRST',
    subtotal: 7,
    transform: { kind: 'NONE' },
    total: 7
  }
} satisfies RollResultDto

describe('CharacterStartingEquipmentChoices', () => {
  it('keeps an emptied starting gold total empty until a roll sets a new one', async () => {
    const user = userEvent.setup()
    const convexClient = new ConvexReactClient('https://builder-test.convex.cloud')
    const executeConfiguration = vi.spyOn(convexClient, 'mutation').mockResolvedValueOnce(roll)
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)

    try {
      renderWithAppProviders(<StartingGoldHarness />, { convexClient })

      await user.clear(screen.getByLabelText(/starting gold total/i))
      expect(screen.getByLabelText(/starting gold total/i)).toHaveValue('')

      await user.click(screen.getByRole('button', { name: 'Roll 2d4' }))
      await waitFor(() => expect(screen.getByLabelText(/starting gold total/i)).toHaveValue('70'))
    } finally {
      executeConfiguration.mockRestore()
      getContext.mockRestore()
      await convexClient.close()
    }
  })

  it('rolls starting gold and keeps the total editable', async () => {
    const user = userEvent.setup()
    const convexClient = new ConvexReactClient('https://builder-test.convex.cloud')
    const executeConfiguration = vi.spyOn(convexClient, 'mutation').mockResolvedValueOnce(roll)
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)

    try {
      renderWithAppProviders(<StartingGoldHarness />, { convexClient })

      await user.click(screen.getByRole('button', { name: 'Roll 2d4' }))

      await waitFor(() => expect(screen.getByLabelText(/starting gold total/i)).toHaveValue('70'))
      expect(executeConfiguration.mock.calls[0]?.[1]).toEqual({ configuration: '2d4' })
      expect(getFunctionName(executeConfiguration.mock.calls[0]![0])).toBe(
        getFunctionName(api.rolls.executeConfiguration)
      )

      const total = screen.getByLabelText(/starting gold total/i)
      await user.clear(total)
      await user.type(total, '95')
      await user.tab()
      expect(screen.getByLabelText(/starting gold total/i)).toHaveValue('95')
    } finally {
      executeConfiguration.mockRestore()
      getContext.mockRestore()
      await convexClient.close()
    }
  })
})
