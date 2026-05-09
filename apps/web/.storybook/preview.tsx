import type { Preview } from '@storybook/react-vite'
import { TestRouterProvider } from '#test/TestRouterProvider'
import { handlers } from '#test/msw/handlers'
import { initialize, mswLoader } from 'msw-storybook-addon'
import '#css/main.css'
import '@mantine/notifications/styles.layer.css'
import '@mantine/core/styles.layer.css'
import '@mantine/tiptap/styles.layer.css'

initialize({
  onUnhandledRequest: 'bypass'
})

const preview: Preview = {
  decorators: [
    (Story, context) => (
      <TestRouterProvider defaultColorScheme={context.globals.theme === 'light' ? 'light' : 'dark'}>
        <Story />
      </TestRouterProvider>
    )
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
