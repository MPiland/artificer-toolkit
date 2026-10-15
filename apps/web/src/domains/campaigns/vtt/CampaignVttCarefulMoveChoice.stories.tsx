import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { CampaignVttCarefulMoveChoice } from './CampaignVttCarefulMoveChoice'
import type { HalfSpeedField } from './CampaignVttCarefulMove.model'

const square = (left: number): HalfSpeedField['shape'] => ({
  kind: 'POLYGON',
  points: [
    { x: left, y: 300 },
    { x: left + 100, y: 300 },
    { x: left + 100, y: 400 },
    { x: left, y: 400 }
  ]
})

const caltrops: HalfSpeedField = {
  id: '00000000-0000-4000-8000-000000000001',
  label: 'Caltrop field',
  shape: square(200)
}
const unlabeled: HalfSpeedField = {
  id: '00000000-0000-4000-8000-000000000002',
  label: null,
  shape: square(500)
}

const meta = {
  title: 'Campaigns/VTT/Careful Move Choice',
  component: CampaignVttCarefulMoveChoice,
  decorators: [
    (Story) => (
      <div style={{ position: 'relative', height: 220, width: 'min(40rem, 100%)' }}>
        <Story />
      </div>
    )
  ],
  args: { fields: [caltrops], onChoose: fn(), onCancel: fn() }
} satisfies Meta<typeof CampaignVttCarefulMoveChoice>

export default meta
type Story = StoryObj<typeof meta>

export const SingleLabeledField: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('This path enters the Caltrop field.')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Move carefully' }))
    await expect(args.onChoose).toHaveBeenCalledWith(true)
    await userEvent.click(canvas.getByRole('button', { name: 'Move normally' }))
    await expect(args.onChoose).toHaveBeenLastCalledWith(false)
  }
}

export const UnlabeledAndMultipleFields: Story = {
  args: { fields: [caltrops, unlabeled] },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText('This path enters the Caltrop field and a field.')
    ).toBeVisible()
  }
}
