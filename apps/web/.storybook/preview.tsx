import type { Preview } from '@storybook/tanstack-react'
import { ColorSchemeScript } from '@mantine/core'
import { handlers } from '#test/msw/handlers'
import { AppProviders } from '#app/providers/AppProviders'
import { createAppQueryClient } from '#app/query/createAppQueryClient'
import { initialize, mswLoader } from 'msw-storybook-addon'
import '#css/main.css'
import '@mantine/notifications/styles.layer.css'
import '@mantine/core/styles.layer.css'
import '@mantine/tiptap/styles.layer.css'

initialize({
  onUnhandledRequest: 'bypass'
})

type StoryColorScheme = 'dark' | 'light'
type StoryQueryClient = ReturnType<typeof createAppQueryClient>
type RouterContextInput = { storyContext: { id: string } }

const storyQueryClients = new Map<string, StoryQueryClient>()

function getStoryQueryClient(storyId: string) {
  const existingClient = storyQueryClients.get(storyId)
  if (existingClient) return existingClient

  const queryClient = createAppQueryClient()
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
          defaultColorScheme={colorScheme}
          forceColorScheme={colorScheme}
          queryClient={queryClient}
        >
          <ColorSchemeScript defaultColorScheme={colorScheme} />
          <Story />
        </AppProviders>
      )
    }
  ],
  loaders: [mswLoader],
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
    msw: {
      handlers
    },
    tanstack: {
      router: {
        useRouterContext: ({ storyContext }: RouterContextInput) => ({
          queryClient: getStoryQueryClient(storyContext.id),
          user: null
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
