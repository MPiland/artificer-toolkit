import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { api } from '@artificer-toolkit/apis/convex/api'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { storyMutation, writesTo } from '#app/test/storybook/storyWrites'
import { MatureContentPreference } from './MatureContentPreference'

// Reads the story account's own Social profile, which has not confirmed its age (D218, D221).
// Writes are spies.
const meta = {
  title: 'Settings/Native Social preference',
  component: MatureContentPreference
} satisfies Meta<typeof MatureContentPreference>
export default meta
type Story = StoryObj<typeof meta>

export const AttestThenSwitchWithoutResubmittingBirthDate: Story = {
  play: async ({ canvas, canvasElement }) => {
    const mature = await canvas.findByRole('radio', { name: 'Mature' })
    await waitFor(() => expect(mature).toBeEnabled())
    await userEvent.click(mature)
    const body = within(canvasElement.ownerDocument.body)
    await waitFor(() => expect(body.getByRole('dialog')).toBeVisible())
    let dialog = within(body.getByRole('dialog'))
    await userEvent.type(dialog.getByLabelText('Date of birth', { exact: false }), '2000-01-01')
    await userEvent.click(dialog.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(body.queryByRole('dialog')).not.toBeInTheDocument())
    await expect(writesTo(api.social.profiles.updatePreference)).toEqual([])
    await userEvent.click(mature)
    await waitFor(() => expect(body.getByRole('dialog')).toBeVisible())
    dialog = within(body.getByRole('dialog'))
    const birthDate = dialog.getByLabelText('Date of birth', { exact: false })
    await expect(birthDate).toHaveValue('')
    await userEvent.type(birthDate, '2000-01-01')
    await userEvent.click(dialog.getByRole('button', { name: 'Confirm age and show mature text' }))
    await waitFor(() => expect(body.queryByRole('dialog')).not.toBeInTheDocument())
    await expect(mature).toBeChecked()
    await expect(writesTo(api.social.profiles.updatePreference).at(-1)).toEqual({
      input: { contentPreference: 'MATURE', birthDate: '2000-01-01' }
    })
    await userEvent.click(canvas.getByRole('radio', { name: 'Standard' }))
    await waitFor(() => expect(canvas.getByRole('radio', { name: 'Standard' })).toBeChecked())
    await expect(writesTo(api.social.profiles.updatePreference).at(-1)).toEqual({
      input: { contentPreference: 'STANDARD' }
    })
    await userEvent.click(mature)
    await waitFor(() => expect(mature).toBeChecked())
    await expect(body.queryByRole('dialog')).not.toBeInTheDocument()
    await expect(writesTo(api.social.profiles.updatePreference).at(-1)).toEqual({
      input: { contentPreference: 'MATURE' }
    })
  }
}

export const FailedAttestationKeepsStandard: Story = {
  play: async ({ canvas, canvasElement }) => {
    storyMutation.mockRejectedValueOnce(new Error('Preference could not be saved.'))
    const mature = await canvas.findByRole('radio', { name: 'Mature' })
    await waitFor(() => expect(mature).toBeEnabled())
    await userEvent.click(mature)
    const body = within(canvasElement.ownerDocument.body)
    await waitFor(() => expect(body.getByRole('dialog')).toBeVisible())
    const dialog = within(body.getByRole('dialog'))
    const birthDate = dialog.getByLabelText('Date of birth', { exact: false })
    await userEvent.type(birthDate, '2000-01-01')
    await userEvent.click(dialog.getByRole('button', { name: 'Confirm age and show mature text' }))
    await expect(await dialog.findByText('Preference could not be saved.')).toBeVisible()
    await expect(canvas.getByLabelText('Standard')).toBeChecked()
    await expect(birthDate).toHaveValue('2000-01-01')
    await userEvent.click(dialog.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(body.queryByRole('dialog')).not.toBeInTheDocument())
    await expect(canvas.queryByText('Preference could not be saved.')).not.toBeInTheDocument()
  }
}
