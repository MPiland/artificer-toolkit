import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { useQueryClient } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from '@artificer-toolkit/apis/convex/api'
import {
  socialApplicationDtoSchema,
  socialApplicationVersionInputSchema,
  type SocialApplicationDto,
  type SocialApplicationVersionInput
} from '@artificer-toolkit/schema/api/socialHub'
import { useMutation as useConvexMutation, usePaginatedQuery } from 'convex/react'
import { getFunctionName } from 'convex/server'
import { expect, fn, mocked, userEvent, within } from 'storybook/test'
import { SocialApplicationsView } from './SocialApplicationsView'

const application = socialApplicationDtoSchema.parse({
  applicationPublicId: 'aaaaaaaa-2222-4222-8222-222222222222',
  listingPublicId: '33333333-3333-4333-8333-333333333333',
  listingTitle: 'Ashen Road',
  applicant: { profilePublicId: '44444444-4444-4444-8444-444444444444', username: 'Player' },
  message: 'Ready to play.',
  status: 'SUBMITTED',
  listingVersion: 1,
  expectations: {
    contentGuidance: 'Be kind.',
    attendancePolicy: 'Attend sessions.',
    allowedContentRules: 'Ask first.',
    tableConduct: 'Respect others.',
    contentBoundaries: 'No harassment.',
    safetyPractices: ['SESSION_ZERO'],
    safetyDetails: 'Talk openly.'
  },
  submittedAt: '2026-09-01T00:00:00.000Z',
  respondedAt: null,
  version: 2
})

const terminal = socialApplicationDtoSchema.parse({
  ...application,
  applicationPublicId: '55555555-5555-4555-8555-555555555555',
  listingTitle: 'Older table',
  status: 'WITHDRAWN'
})
const withdrawal = fn<(input: SocialApplicationVersionInput) => Promise<SocialApplicationDto>>()

function Fixture({
  failWithdraw = false,
  directPending = false
}: {
  failWithdraw?: boolean
  directPending?: boolean
}) {
  const pending = {
    results: directPending ? [] : [application],
    status: 'Exhausted' as const,
    loadMore: fn(),
    isLoading: false as const
  }
  const history = {
    results: directPending ? [terminal] : [],
    status: 'Exhausted' as const,
    loadMore: fn(),
    isLoading: false as const
  }
  const queryClient = useQueryClient()
  queryClient.setQueryDefaults(
    convexQuery(api.social.applications.getOwn, {
      applicationPublicId: application.applicationPublicId
    }).queryKey,
    { queryFn: async () => application }
  )
  mocked(usePaginatedQuery).mockImplementation((reference, args) => {
    if (
      args !== 'skip' &&
      getFunctionName(reference) === getFunctionName(api.social.admissionLists.listOwnApplications)
    )
      return 'group' in args && args.group === 'PENDING' ? pending : history
    return { results: [], status: 'Exhausted', loadMore: fn(), isLoading: false }
  })
  mocked(useConvexMutation).mockImplementation((reference) => {
    const mutation: ReturnType<typeof useConvexMutation> = Object.assign(
      async (input?: unknown) => {
        if (getFunctionName(reference) === getFunctionName(api.social.applications.withdraw)) {
          withdrawal(socialApplicationVersionInputSchema.parse(input))
          if (failWithdraw) throw new Error('Withdraw failed.')
          return application
        }
        throw new Error(`Unexpected mutation ${getFunctionName(reference)}`)
      },
      { withOptimisticUpdate: () => mutation }
    )
    return mutation
  })
  return (
    <SocialApplicationsView
      applicationPublicId={
        directPending ? application.applicationPublicId.toUpperCase() : undefined
      }
    />
  )
}

const meta = {
  title: 'Domains/Social/Application history',
  component: Fixture,
  parameters: { layout: 'fullscreen' },
  beforeEach: () => {
    withdrawal.mockClear()
  }
} satisfies Meta<typeof Fixture>
export default meta
type Story = StoryObj<typeof meta>

export const DirectPendingLinkPrecedesHistory: Story = {
  args: { directPending: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Ashen Road')).toBeVisible()
    await expect(canvas.getByText('Older table')).toBeVisible()
    await expect(canvas.getAllByRole('article')[0]).toHaveTextContent('Ashen Road')
    await expect(canvas.getAllByRole('article')[0]).toHaveFocus()
  }
}

export const FailedWithdrawKeepsBlocksVisible: Story = {
  args: { failWithdraw: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Withdraw application' }))
    await expect(canvas.findByText('Withdraw failed.')).resolves.toBeVisible()
    await expect(canvas.getByText('Blocked profiles')).toBeVisible()
    await expect(withdrawal).toHaveBeenCalledWith({
      applicationPublicId: application.applicationPublicId,
      expectedVersion: application.version
    })
  }
}
