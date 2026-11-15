import type { Preview } from '@storybook/tanstack-react'
import { ColorSchemeScript } from '@mantine/core'
import {
  ConvexReactClient,
  useAction,
  useConvexAuth,
  useConvex,
  useMutation,
  useQuery,
  usePaginatedQuery as useNativePaginatedQuery
} from 'convex/react'
import { usePaginatedQuery } from 'convex-helpers/react'
import { ConvexQueryClient } from '@convex-dev/react-query'
import { ConvexBetterAuthProvider } from '@convex-dev/better-auth/react'
import type { AuthSessionUserDto } from '@artificer-toolkit/schema/api/auth'
import { api } from '@artificer-toolkit/apis/convex/api'
import { fn, mocked, sb } from 'storybook/test'
import { betterAuthClient } from '#app/auth/betterAuthClient'
import { AppProviders } from '#app/providers/AppProviders'
import { createAppQueryClient } from '#app/query/createAppQueryClient'
import { setupWorker } from 'msw/browser'
import { mswLoader } from 'msw-storybook-addon/csf3'
import MockDate from 'mockdate'
import {
  REVIEW_PASSWORD,
  REVIEW_STORY_READER
} from '../../apis/tests/developmentReviewDataScenarios'
import '#css/main.css'
import '@mantine/notifications/styles.layer.css'
import '@mantine/core/styles.layer.css'
import '@mantine/tiptap/styles.layer.css'

// Props-only stories supply explicit native fixtures through these spies; backend stories reset them
// to the real hooks.
sb.mock(import('convex/react'), { spy: true })
sb.mock(import('convex-helpers/react'), { spy: true })
sb.mock(import('../src/domains/campaigns/vtt/vttSceneRenderer.ts'), { spy: true })

async function unavailableConvexCall(): Promise<never> {
  throw new Error('Convex calls require an explicit Storybook fixture.')
}
const unavailableConvexClient = new ConvexReactClient('https://story-fixture.convex.cloud', {
  logger: false
})
for (const method of ['query', 'mutation', 'action'] as const) {
  Object.defineProperty(unavailableConvexClient, method, {
    value: fn().mockImplementation(unavailableConvexCall)
  })
}
const unavailableConvexMutation: ReturnType<typeof useMutation> = Object.assign(
  unavailableConvexCall,
  { withOptimisticUpdate: () => unavailableConvexMutation }
)

/**
 * Stories tagged `backend` read the seeded local deployment (D218, D221) signed in as the story
 * account; their writes are `fn()` spies and never reach it.
 */
const BACKEND_TAG = 'backend'
type StoryBackend = {
  convex: ConvexQueryClient
  queryClient: StoryQueryClient
  user: AuthSessionUserDto
}
const storyBackends = new Map<string, StoryBackend>()
const storyWrite: ReturnType<typeof useMutation> = Object.assign(
  fn(async () => null),
  { withOptimisticUpdate: () => storyWrite }
)

async function connectStoryBackend(storyId: string): Promise<void> {
  // Auth tokens are checked against the real clock.
  MockDate.reset()
  if (storyBackends.has(storyId)) return
  const url = import.meta.env.VITE_CONVEX_URL
  if (!url) throw new Error('Backend stories need VITE_CONVEX_URL for the seeded deployment.')
  const current = await betterAuthClient.getSession()
  if (current.data?.user.email !== REVIEW_STORY_READER.email) {
    const signIn = await betterAuthClient.signIn.email({
      email: REVIEW_STORY_READER.email,
      password: REVIEW_PASSWORD
    })
    if (signIn.error) {
      throw new Error(`The story account could not sign in: ${signIn.error.message}`)
    }
  }
  const convex = new ConvexQueryClient(url, { expectAuth: true })
  Object.defineProperty(convex.convexClient, 'mutation', { value: fn(async () => null) })
  const queryClient = createAppQueryClient(convex)
  convex.convexClient.setAuth(
    async () => (await betterAuthClient.convex.token()).data?.token ?? null
  )
  const { user } = await convex.convexClient.query(api.account.session, {})
  if (!user) throw new Error('The story account has no session on the seeded deployment.')
  storyBackends.set(storyId, { convex, queryClient, user })
}

type StoryColorScheme = 'dark' | 'light'
type StoryQueryClient = ReturnType<typeof createAppQueryClient>
type RouterContextInput = {
  storyContext: {
    id: string
    parameters?: {
      tanstack?: {
        router?: {
          context?: Record<string, unknown>
        }
      }
    }
  }
}

const storyQueryClients = new Map<string, StoryQueryClient>()

function getStoryQueryClient(storyId: string) {
  const existingClient = storyQueryClients.get(storyId)
  if (existingClient) return existingClient

  const queryClient = createAppQueryClient()
  queryClient.setQueryDefaults(['convexQuery'], { queryFn: unavailableConvexCall })
  storyQueryClients.set(storyId, queryClient)
  return queryClient
}

function getStoryColorScheme(value: unknown): StoryColorScheme {
  return value === 'light' ? 'light' : 'dark'
}

const preview: Preview = {
  decorators: [
    (Story, context) => {
      const colorScheme = getStoryColorScheme(context.globals.theme)
      const backend = storyBackends.get(context.id)
      const queryClient = backend?.queryClient ?? getStoryQueryClient(context.id)
      const story = (
        <div style={{ blockSize: '100dvh' }}>
          <Story />
        </div>
      )

      return (
        <AppProviders
          key={colorScheme}
          defaultColorScheme={colorScheme}
          forceColorScheme={colorScheme}
          queryClient={queryClient}
        >
          <ColorSchemeScript defaultColorScheme={colorScheme} />
          {backend ? (
            <ConvexBetterAuthProvider
              client={backend.convex.convexClient}
              authClient={betterAuthClient}
            >
              {story}
            </ConvexBetterAuthProvider>
          ) : (
            story
          )}
        </AppProviders>
      )
    }
  ],
  loaders: [
    mswLoader(async () => {
      const worker = setupWorker()
      await worker.start({ onUnhandledFrame: 'bypass' })
      return worker
    }),
    async (context) => {
      if (context.tags.includes(BACKEND_TAG)) await connectStoryBackend(context.id)
    }
  ],
  async beforeEach(context) {
    if (context.tags.includes(BACKEND_TAG)) {
      for (const hook of [
        useConvexAuth,
        useConvex,
        useQuery,
        useNativePaginatedQuery,
        usePaginatedQuery,
        useAction
      ]) {
        mocked(hook).mockReset()
      }
      mocked(useMutation).mockImplementation(() => storyWrite)
      return
    }
    MockDate.set('2024-04-01T12:00:00Z')
    mocked(useConvexAuth).mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      isRefreshing: false
    })
    mocked(useConvex).mockReturnValue(unavailableConvexClient)
    mocked(useQuery).mockReturnValue(undefined)
    mocked(usePaginatedQuery).mockReturnValue({
      isLoading: false,
      loadMore: () => undefined,
      results: [],
      status: 'Exhausted'
    })
    mocked(useNativePaginatedQuery).mockReturnValue({
      isLoading: false,
      loadMore: () => undefined,
      results: [],
      status: 'Exhausted'
    })
    mocked(useAction).mockImplementation(() => unavailableConvexCall)
    mocked(useMutation).mockImplementation(() => unavailableConvexMutation)
  },
  globalTypes: {
    theme: {
      name: 'Theme',
      description: 'Mantine color scheme',
      defaultValue: 'dark',
      toolbar: {
        icon: 'mirror',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' }
        ],
        dynamicTitle: true
      }
    }
  },
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      disabled: true
    },
    controls: {
      expanded: true
    },
    tanstack: {
      router: {
        useRouterContext: ({ storyContext }: RouterContextInput) => {
          const backend = storyBackends.get(storyContext.id)
          return {
            queryClient: backend?.queryClient ?? getStoryQueryClient(storyContext.id),
            user: backend?.user ?? null,
            ...storyContext.parameters?.tanstack?.router?.context
          }
        }
      }
    },
    options: {
      showPanel: false,
      storySort: {
        method: 'alphabetical',
        locales: 'en-US'
      }
    }
  }
}

export default preview
