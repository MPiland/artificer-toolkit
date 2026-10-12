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
import { fn, mocked, sb } from 'storybook/test'
import { AppProviders } from '#app/providers/AppProviders'
import { createAppQueryClient } from '#app/query/createAppQueryClient'
import { setupWorker } from 'msw/browser'
import { mswLoader } from 'msw-storybook-addon/csf3'
import MockDate from 'mockdate'
import '#css/main.css'
import '@mantine/notifications/styles.layer.css'
import '@mantine/core/styles.layer.css'
import '@mantine/tiptap/styles.layer.css'

// Stories supply explicit native fixtures; never construct a live client through a class spy.
sb.mock(import('convex/react'))
sb.mock(import('convex-helpers/react'), { spy: true })
sb.mock(import('../src/domains/campaigns/vtt/vttSceneRenderer.ts'), { spy: true })

async function unavailableConvexCall(): Promise<never> {
  throw new Error('Convex calls require an explicit Storybook fixture.')
}
const unavailableConvexClient = new ConvexReactClient('https://story-fixture.convex.cloud', {
  logger: false
})
Object.defineProperty(unavailableConvexClient, 'query', {
  value: fn<ConvexReactClient['query']>().mockImplementation(unavailableConvexCall)
})
const unavailableConvexMutation: ReturnType<typeof useMutation> = Object.assign(
  unavailableConvexCall,
  { withOptimisticUpdate: () => unavailableConvexMutation }
)

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
      const queryClient = getStoryQueryClient(context.id)

      return (
        <AppProviders
          key={colorScheme}
          defaultColorScheme={colorScheme}
          forceColorScheme={colorScheme}
          queryClient={queryClient}
        >
          <ColorSchemeScript defaultColorScheme={colorScheme} />
          <div style={{ blockSize: '100dvh' }}>
            <Story />
          </div>
        </AppProviders>
      )
    }
  ],
  loaders: [
    mswLoader(async () => {
      const worker = setupWorker()
      await worker.start({ onUnhandledFrame: 'bypass' })
      return worker
    })
  ],
  async beforeEach() {
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
        useRouterContext: ({ storyContext }: RouterContextInput) => ({
          queryClient: getStoryQueryClient(storyContext.id),
          user: null,
          ...storyContext.parameters?.tanstack?.router?.context
        })
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
