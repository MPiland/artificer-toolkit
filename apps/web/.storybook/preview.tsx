import type { Preview } from '@storybook/react-vite'
import { TestRouterProvider } from '#test/TestRouterProvider'
import { handlers } from '#test/msw/handlers'
import { initialize, mswLoader } from 'msw-storybook-addon'
import '#css/main.css'
import '@mantine/notifications/styles.layer.css'
import '@mantine/core/styles.layer.css'
import '@mantine/tiptap/styles.layer.css'
import '#css/theme.css'

initialize({
  onUnhandledRequest: 'bypass'
})

const preview: Preview = {
  decorators: [
    (Story) => (
      <TestRouterProvider>
        <Story />
      </TestRouterProvider>
    )
  ],
  loaders: [
    mswLoader
  ],
  parameters: {
    layout: 'fullscreen',
    controls: {
      expanded: true
    },
    msw: {
      handlers
    }
  }
}

export default preview
