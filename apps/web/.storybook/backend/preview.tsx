import type { Preview } from '@storybook/tanstack-react'
import { ConvexQueryClient } from '@convex-dev/react-query'
import { ConvexBetterAuthProvider } from '@convex-dev/better-auth/react'
import { api } from '@artificer-toolkit/apis/convex/api'
import type { AuthSessionUserDto } from '@artificer-toolkit/schema/api/auth'
import { useMutation } from 'convex/react'
import { expect, mocked, sb } from 'storybook/test'
import { betterAuthClient } from '#app/auth/betterAuthClient'
import { createAppQueryClient } from '#app/query/createAppQueryClient'
import { recordMissingQueryFnReports } from '../../src/test/storybook/missingQueryFnReports'
import {
  installQueryOverride,
  type StoryQueryOverride
} from '../../src/test/storybook/storyQueryOverride'
import {
  bindStoryReads,
  storyMutation,
  storyMutationHook
} from '../../src/test/storybook/storyWrites'
import {
  REVIEW_PASSWORD,
  reviewAccountEmail,
  STORY_ACCOUNTS,
  type StoryAccountKey
} from '../../../apis/tests/developmentReviewDataScenarios'
import { StoryFrame } from '../StoryFrame.tsx'

// Reads stay real; mutations are spies so no story write reaches the seeded deployment (D218).
sb.mock(import('convex/react'), { spy: true })

type StoryBackend = {
  convex: ConvexQueryClient
  queryClient: ReturnType<typeof createAppQueryClient>
  missingQueryFnReports: string[]
  user: AuthSessionUserDto
}

const storyBackends = new Map<string, StoryBackend>()

function getStoryBackend(storyId: string): StoryBackend {
  const backend = storyBackends.get(storyId)
  if (!backend) throw new Error(`Story ${storyId} rendered before its backend loader connected.`)
  return backend
}

/**
 * Signs in as the story account through the web app auth proxy and opens a read client. The
 * browser session holds one identity at a time, so a sign-in happens only when the story needs a
 * different account than the one already signed in; stories sharing an account share its session.
 */
async function connectStoryBackend(
  storyId: string,
  accountKey: StoryAccountKey,
  queryOverride: StoryQueryOverride | undefined
): Promise<void> {
  if (storyBackends.has(storyId)) return
  const url = import.meta.env.VITE_CONVEX_URL
  if (!url) throw new Error('Backend stories need VITE_CONVEX_URL for the seeded deployment.')
  const email = reviewAccountEmail(STORY_ACCOUNTS[accountKey])
  const current = await betterAuthClient.getSession()
  if (current.data?.user.email !== email) {
    const signIn = await betterAuthClient.signIn.email({
      email,
      password: REVIEW_PASSWORD
    })
    if (signIn.error) {
      throw new Error(`The story account could not sign in: ${signIn.error.message}`)
    }
  }
  const convex = new ConvexQueryClient(url, { expectAuth: true })
  Object.defineProperty(convex.convexClient, 'mutation', { value: storyMutation })
  const queryClient = createAppQueryClient(convex)
  if (queryOverride) installQueryOverride(queryOverride, queryClient, convex.convexClient)
  convex.convexClient.setAuth(
    async () => (await betterAuthClient.convex.token()).data?.token ?? null
  )
  const { user } = await convex.convexClient.query(api.account.session, {})
  if (!user) throw new Error('The story account has no session on the seeded deployment.')
  storyBackends.set(storyId, {
    convex,
    queryClient,
    missingQueryFnReports: recordMissingQueryFnReports(queryClient),
    user
  })
}

const preview: Preview = {
  decorators: [
    (Story, context) => {
      const backend = getStoryBackend(context.id)
      bindStoryReads(backend.convex.convexClient)
      return (
        <StoryFrame theme={context.globals.theme} queryClient={backend.queryClient}>
          <ConvexBetterAuthProvider
            client={backend.convex.convexClient}
            authClient={betterAuthClient}
          >
            <Story />
          </ConvexBetterAuthProvider>
        </StoryFrame>
      )
    }
  ],
  loaders: [
    (context) =>
      connectStoryBackend(
        context.id,
        context.parameters.storyAccount,
        context.parameters.queryOverride
      )
  ],
  beforeEach() {
    storyMutation.mockClear()
    mocked(useMutation).mockImplementation(storyMutationHook)
  },
  // A read without a query function shows a loading or empty state instead of the seeded record,
  // so it fails the story (D221).
  afterEach(context) {
    expect(getStoryBackend(context.id).missingQueryFnReports.splice(0)).toEqual([])
  },
  parameters: {
    layout: 'fullscreen',
    // The account a story reads as: the reader unless the story names another of STORY_ACCOUNTS.
    storyAccount: 'reader' satisfies StoryAccountKey,
    tanstack: {
      router: {
        // A context factory, unlike `useRouterContext`, reaches route loaders and `beforeLoad`.
        context: ({ storyContext }: { storyContext: { id: string } }) => {
          const { queryClient, user } = getStoryBackend(storyContext.id)
          return { queryClient, user }
        }
      }
    }
  }
}

export default preview
