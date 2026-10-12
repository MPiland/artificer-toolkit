import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { useState } from 'react'
import { useMutation as useConvexMutation, usePaginatedQuery } from 'convex/react'
import { getFunctionName } from 'convex/server'
import { api } from '@artificer-toolkit/apis/convex/api'
import {
  socialModerationEvidenceDtoSchema,
  socialModerationQueuePageSchema,
  socialReportReviewInputSchema,
  socialListingModerationInputSchema,
  socialProfileModerationInputSchema
} from '@artificer-toolkit/schema/api/socialModeration'
import { socialReportPublicIdInputSchema } from '@artificer-toolkit/schema/api/socialHub'
import { expect, fn, mocked, userEvent, within } from 'storybook/test'
import { SocialModerationPage } from './SocialModerationPage'

const report = socialModerationEvidenceDtoSchema.parse({
  reportPublicId: 'aaaaaaaa-0000-4000-8000-000000000001',
  targetKind: 'PROFILE',
  reason: 'HARASSMENT',
  status: 'SUBMITTED',
  createdAt: '2026-09-01T12:00:00.000Z',
  updatedAt: '2026-09-01T12:00:00.000Z',
  version: 1,
  reporter: { profilePublicId: 'aaaaaaaa-0000-4000-8000-000000000002', username: 'Reporter' },
  details: 'Please review this captured profile.',
  evidence: {
    profilePublicId: 'aaaaaaaa-0000-4000-8000-000000000003',
    username: 'ReportedPlayer',
    status: 'ACTIVE'
  }
})
const queuePage = socialModerationQueuePageSchema.parse({
  page: [
    {
      reportPublicId: report.reportPublicId,
      targetKind: report.targetKind,
      reason: report.reason,
      status: report.status,
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
      version: report.version
    }
  ],
  isDone: true,
  continueCursor: ''
})
const calls = fn()
const more = fn()
const names = {
  list: getFunctionName(api.social.moderation.list),
  open: getFunctionName(api.social.moderation.open),
  review: getFunctionName(api.social.moderation.review),
  listingAction: getFunctionName(api.social.listingModeration.action),
  profileAction: getFunctionName(api.social.profileModeration.action)
}

function Fixture({ failAction = false }: { failAction?: boolean }) {
  const [loaded, setLoaded] = useState(false)
  mocked(usePaginatedQuery).mockImplementation((reference, args, options) => {
    const name = getFunctionName(reference)
    if (name !== names.list) throw new Error(`Unexpected query: ${name}`)
    calls(name, args, options)
    return {
      results: loaded ? queuePage.page : [],
      status: loaded ? 'Exhausted' : 'CanLoadMore',
      isLoading: false,
      loadMore: (count: number) => {
        more(count)
        setLoaded(true)
      }
    }
  })
  mocked(useConvexMutation).mockImplementation((reference) => {
    const mutate: ReturnType<typeof useConvexMutation> = Object.assign(
      async (input?: unknown) => {
        const name = getFunctionName(reference)
        if (name === names.open) {
          calls(name, socialReportPublicIdInputSchema.parse(input))
          return report
        }
        const schema =
          name === names.review
            ? socialReportReviewInputSchema
            : name === names.listingAction
              ? socialListingModerationInputSchema
              : name === names.profileAction
                ? socialProfileModerationInputSchema
                : undefined
        if (!schema) throw new Error(`Unexpected mutation: ${name}`)
        const parsed = schema.parse(input)
        calls(name, parsed)
        if (failAction) throw new Error('Report changed. Reopen it before trying again.')
        return socialModerationEvidenceDtoSchema.parse({
          ...report,
          status: 'UNDER_REVIEW',
          version: parsed.expectedVersion + 1
        })
      },
      { withOptimisticUpdate: () => mutate }
    )
    return mutate
  })
  return <SocialModerationPage />
}

const meta = {
  title: 'Social/Native moderation',
  component: Fixture,
  parameters: { layout: 'fullscreen' },
  beforeEach: () => {
    calls.mockClear()
    more.mockClear()
  }
} satisfies Meta<typeof Fixture>
export default meta
type Story = StoryObj<typeof meta>

export const ReviewAndSuspend: Story = {
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.queryByText('No reports in the queue.')).not.toBeInTheDocument()
    await expect(calls).toHaveBeenCalledWith(names.list, {}, { initialNumItems: 8 })
    await userEvent.click(canvas.getByRole('button', { name: 'Load more reports' }))
    await expect(more).toHaveBeenCalledWith(8)
    await expect(canvas.queryByText(report.details)).not.toBeInTheDocument()
    await userEvent.click(await canvas.findByRole('button', { name: 'Open report' }))
    await expect(calls).toHaveBeenCalledWith(names.open, {
      reportPublicId: report.reportPublicId
    })
    await expect(await canvas.findByText(report.details)).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Record action' })).toBeDisabled()
    await userEvent.type(
      canvas.getByRole('textbox', { name: 'Audit reason' }),
      'Review captured evidence.'
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Record action' }))
    await expect(calls).toHaveBeenCalledWith(names.review, {
      reportPublicId: report.reportPublicId,
      expectedVersion: 1,
      action: 'START_REVIEW',
      reason: 'Review captured evidence.'
    })
    await expect(canvas.getByRole('textbox', { name: 'Audit reason' })).toHaveValue('')
    await userEvent.click(canvas.getByLabelText('Action', { selector: 'input' }))
    await userEvent.click(
      within(canvasElement.ownerDocument.body).getByRole('option', { name: 'Suspend profile' })
    )
    await userEvent.type(
      canvas.getByRole('textbox', { name: 'Audit reason' }),
      'Confirmed conduct violation.'
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Record action' }))
    await expect(calls).toHaveBeenCalledWith(names.profileAction, {
      reportPublicId: report.reportPublicId,
      expectedVersion: 2,
      action: 'SUSPEND_PROFILE',
      reason: 'Confirmed conduct violation.'
    })
  }
}

export const ActionFailure: Story = {
  args: { failAction: true },
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Load more reports' }))
    await userEvent.click(await canvas.findByRole('button', { name: 'Open report' }))
    await userEvent.type(
      await canvas.findByRole('textbox', { name: 'Audit reason' }),
      'Review captured evidence.'
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Record action' }))
    await expect(
      await canvas.findByText('Report changed. Reopen it before trying again.')
    ).toBeVisible()
    await expect(canvas.getByText(report.details)).toBeVisible()
    await expect(canvas.getByRole('textbox', { name: 'Audit reason' })).toHaveValue(
      'Review captured evidence.'
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Open report' }))
    await expect(
      canvas.queryByText('Report changed. Reopen it before trying again.')
    ).not.toBeInTheDocument()
    await expect(canvas.getByRole('textbox', { name: 'Audit reason' })).toHaveValue('')
  }
}
