import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { useQueryClient } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { useMutation as useConvexMutation } from 'convex/react'
import { getFunctionName } from 'convex/server'
import { api } from '@artificer-toolkit/apis/convex/api'
import {
  updateSocialContentPreferenceInputSchema,
  socialEligibilityDtoSchema
} from '@artificer-toolkit/schema/api/socialHub'
import { z } from 'zod'
import { expect, fn, mocked, userEvent, waitFor, within } from 'storybook/test'
import { MatureContentPreference } from './MatureContentPreference'

const initial = socialEligibilityDtoSchema.parse({
  eligible: true,
  profilePublicId: 'aaaaaaaa-1111-4111-8111-111111111111',
  adultAttestedAt: null,
  contentPreference: 'STANDARD',
  status: 'ACTIVE'
})
const update = fn()
const meta = {
  title: 'Settings/Native Social preference',
  component: MatureContentPreference,
  beforeEach: () => {
    update.mockClear()
  },
  decorators: [
    (Story, context) => {
      const queryClient = useQueryClient()
      const preferenceQuery = convexQuery(api.social.profiles.getEligibility, {})
      queryClient.setQueryDefaults(preferenceQuery.queryKey, { queryFn: async () => initial })
      mocked(useConvexMutation).mockImplementation((reference) => {
        const mutate: ReturnType<typeof useConvexMutation> = Object.assign(
          async (args?: unknown) => {
            if (
              getFunctionName(reference) !== getFunctionName(api.social.profiles.updatePreference)
            )
              throw new Error('Unexpected native mutation')
            const { input } = z
              .object({ input: updateSocialContentPreferenceInputSchema })
              .parse(args)
            update({ input })
            if (context.parameters.rejectPreference)
              throw new Error('Preference could not be saved.')
            return {
              ...initial,
              adultAttestedAt: '2024-04-01T12:00:00.000Z',
              contentPreference: input.contentPreference
            }
          },
          { withOptimisticUpdate: () => mutate }
        )
        return mutate
      })
      return <Story />
    }
  ]
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
    await expect(update).not.toHaveBeenCalled()
    await userEvent.click(mature)
    await waitFor(() => expect(body.getByRole('dialog')).toBeVisible())
    dialog = within(body.getByRole('dialog'))
    const birthDate = dialog.getByLabelText('Date of birth', { exact: false })
    await expect(birthDate).toHaveValue('')
    await userEvent.type(birthDate, '2000-01-01')
    await userEvent.click(dialog.getByRole('button', { name: 'Confirm age and show mature text' }))
    await waitFor(() => expect(body.queryByRole('dialog')).not.toBeInTheDocument())
    await expect(mature).toBeChecked()
    await expect(update).toHaveBeenLastCalledWith({
      input: { contentPreference: 'MATURE', birthDate: '2000-01-01' }
    })
    await userEvent.click(canvas.getByRole('radio', { name: 'Standard' }))
    await waitFor(() => expect(canvas.getByRole('radio', { name: 'Standard' })).toBeChecked())
    await expect(update).toHaveBeenLastCalledWith({ input: { contentPreference: 'STANDARD' } })
    await userEvent.click(mature)
    await waitFor(() => expect(mature).toBeChecked())
    await expect(body.queryByRole('dialog')).not.toBeInTheDocument()
    await expect(update).toHaveBeenLastCalledWith({ input: { contentPreference: 'MATURE' } })
  }
}
export const FailedAttestationKeepsStandard: Story = {
  parameters: { rejectPreference: true },
  play: async ({ canvas, canvasElement }) => {
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
