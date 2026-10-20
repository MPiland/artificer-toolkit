import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { useMemo } from 'react'
import { addedAdvantageRoll, cancelledAdvantageRoll } from './adjustedRoll.fixtures'
import { DiceRollPresentation } from './DiceRollPresentation'

const meta = {
  title: 'Dice/Roll mode change',
  component: DiceRollPresentation,
  args: { onRollRevealed: () => undefined },
  decorators: [
    (Story) => (
      <div style={{ height: 240, position: 'relative' }}>
        <Story />
      </div>
    )
  ]
} satisfies Meta<typeof DiceRollPresentation>

export default meta
type Story = StoryObj<typeof meta>

/** A fresh roll id per mount, so each load of the story plays the arrival animation once. */
function useArrivingRoll(create: (id: string) => ReturnType<typeof cancelledAdvantageRoll>) {
  return useMemo(() => create(crypto.randomUUID()), [create])
}

/** The ✕ draws over the cancelled die; with reduced motion the settled result shows at once. */
export const CancelledDie: Story = {
  render: (args) => (
    <DiceRollPresentation {...args} roll={useArrivingRoll(cancelledAdvantageRoll)} />
  )
}

/** The added die rolls in after the mode change. */
export const AddedDie: Story = {
  render: (args) => <DiceRollPresentation {...args} roll={useArrivingRoll(addedAdvantageRoll)} />
}
