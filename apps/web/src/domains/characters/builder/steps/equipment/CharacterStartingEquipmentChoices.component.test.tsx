import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import type { CharacterBuilderStartingEquipmentViewDto } from '@artificer-toolkit/schema/api/characters'
import type { RollResultDto } from '@artificer-toolkit/schema/api/rolls'
import { api } from '#app/lib/api'
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

describe('CharacterStartingEquipmentChoices', () => {
  it('rolls starting gold and keeps the total editable', async () => {
    const user = userEvent.setup()
    const roll = {
      id: 'starting-gold-roll',
      normalizedExpression: '2d4',
      evidence: {
        terms: [{ count: 2, die: 4, rolls: [3, 4], subtotal: 7 }],
        modifier: 0,
        mode: 'NORMAL',
        subtotal: 7,
        transform: { kind: 'NONE' },
        total: 7
      }
    } satisfies RollResultDto
    const executeConfiguration = vi
      .spyOn(api.rolls, 'executeConfiguration')
      .mockResolvedValueOnce(roll)
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)

    try {
      renderWithAppProviders(<StartingGoldHarness />)

      await user.click(screen.getByRole('button', { name: 'Roll 2d4' }))

      await waitFor(() => expect(screen.getByLabelText(/starting gold total/i)).toHaveValue('70'))
      expect(executeConfiguration).toHaveBeenCalledWith({ configuration: '2d4' })

      const total = screen.getByLabelText(/starting gold total/i)
      await user.clear(total)
      await user.type(total, '95')
      await user.tab()
      expect(screen.getByLabelText(/starting gold total/i)).toHaveValue('95')
    } finally {
      executeConfiguration.mockRestore()
      getContext.mockRestore()
    }
  })
})
