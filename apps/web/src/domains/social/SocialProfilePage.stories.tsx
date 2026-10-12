import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { useQueryClient } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { useMutation as useConvexMutation } from 'convex/react'
import { getFunctionName } from 'convex/server'
import { api } from '@artificer-toolkit/apis/convex/api'
import {
  socialBlockInputSchema,
  createSocialReportInputSchema
} from '@artificer-toolkit/schema/api/socialHub'
import { expect, fn, mocked, userEvent, waitFor, within } from 'storybook/test'
import { SocialProfilePage } from './SocialProfilePage'

const targetId = 'aaaaaaaa-1111-4111-8111-111111111111'
const mutation = fn<(name: string, input: unknown) => void>()
const mutationNames = {
  blockCreate: getFunctionName(api.social.blocks.create),
  blockRemove: getFunctionName(api.social.blocks.remove),
  reportCreate: getFunctionName(api.social.reports.create)
}
const statusQuery = convexQuery(api.social.blocks.getStatus, { profilePublicId: targetId })

const meta = {
  title: 'Social/Profile/Native actions',
  component: SocialProfilePage,
  args: { profilePublicId: targetId },
  beforeEach: () => {
    mutation.mockClear()
  },
  decorators: [
    (Story, context) => {
      const queryClient = useQueryClient()
      queryClient.setQueryDefaults(convexQuery(api.social.profiles.getEligibility, {}).queryKey, {
        queryFn: async () => ({
          eligible: true,
          profilePublicId: 'bbbbbbbb-2222-4222-8222-222222222222',
          status: 'ACTIVE',
          adultAttestedAt: null,
          contentPreference: 'STANDARD'
        })
      })
      queryClient.setQueryDefaults(statusQuery.queryKey, {
        queryFn: async () => ({ blocked: Boolean(context.parameters.blocked) })
      })
      queryClient.setQueryDefaults(
        convexQuery(api.social.discovery.getProfile, { profilePublicId: targetId }).queryKey,
        {
          queryFn: async () => ({ profilePublicId: targetId, username: 'TargetPlayer' })
        }
      )
      mocked(useConvexMutation).mockImplementation((reference) => {
        const mutate: ReturnType<typeof useConvexMutation> = Object.assign(
          async (input?: unknown) => {
            const name = getFunctionName(reference)
            mutation(name, input)
            if (name === mutationNames.reportCreate) {
              if (!input || typeof input !== 'object' || !('input' in input))
                throw new Error('Missing report input')
              createSocialReportInputSchema.parse(input.input)
              return { status: 'SUBMITTED' }
            }
            socialBlockInputSchema.parse(input)
            if (name !== mutationNames.blockCreate && name !== mutationNames.blockRemove)
              throw new Error(`Unexpected mutation ${name}`)
            if (context.parameters.failRemove && name === mutationNames.blockRemove)
              throw new Error('Unblock failed')
            queryClient.setQueryData(statusQuery.queryKey, {
              blocked: name === mutationNames.blockCreate
            })
            return null
          },
          { withOptimisticUpdate: () => mutate }
        )
        return mutate
      })
      return <Story />
    }
  ]
} satisfies Meta<typeof SocialProfilePage>

export default meta
type Story = StoryObj<typeof meta>

export const BlockUnblockAndReport: Story = {
  play: async ({ canvas, canvasElement }) => {
    await canvas.findByRole('heading', { name: '@TargetPlayer' })
    await userEvent.click(canvas.getByRole('button', { name: 'Block' }))
    await canvas.findByRole('heading', { name: 'Blocked profile' })
    await expect(canvas.queryByText('@TargetPlayer')).not.toBeInTheDocument()
    await expect(mutation).toHaveBeenCalledWith(mutationNames.blockCreate, {
      profilePublicId: targetId
    })
    await userEvent.click(canvas.getByRole('button', { name: 'Report' }))
    const body = within(canvasElement.ownerDocument.body)
    const dialog = within(await body.findByRole('dialog'))
    await userEvent.type(
      await dialog.findByRole('textbox', { name: /What happened/ }),
      'Please review this interaction.'
    )
    await userEvent.click(dialog.getByRole('button', { name: 'Submit report' }))
    await waitFor(() =>
      expect(mutation).toHaveBeenCalledWith(mutationNames.reportCreate, {
        input: {
          targetKind: 'PROFILE',
          targetPublicId: targetId,
          reason: 'OTHER',
          details: 'Please review this interaction.'
        }
      })
    )
    await waitFor(() => expect(body.queryByRole('dialog')).not.toBeInTheDocument())
    await userEvent.click(canvas.getByRole('button', { name: 'Unblock' }))
    await canvas.findByRole('heading', { name: '@TargetPlayer' })
    await expect(mutation).toHaveBeenCalledWith(mutationNames.blockRemove, {
      profilePublicId: targetId
    })
  }
}

export const UnblockFailure: Story = {
  parameters: { blocked: true, failRemove: true },
  play: async ({ canvas }) => {
    await canvas.findByRole('heading', { name: 'Blocked profile' })
    await userEvent.click(canvas.getByRole('button', { name: 'Unblock' }))
    await canvas.findByText('The block could not be removed. Try again.')
    await expect(canvas.getByRole('heading', { name: 'Blocked profile' })).toBeVisible()
  }
}
