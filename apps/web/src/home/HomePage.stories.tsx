import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { Shell } from '#app/shell'
import { HomePage } from './HomePage'

const meta = {
  title: 'Home/HomePage',
  component: HomePage,
  parameters: {
    layout: 'fullscreen'
  },
  decorators: [
    (Story) => (
      <Shell navigation={[]} currentPath='/home' isAuthenticated userEmail='creator@example.test'>
        <Story />
      </Shell>
    )
  ]
} satisfies Meta<typeof HomePage>

export default meta

type Story = StoryObj<typeof meta>

export const Mobile: Story = {
  parameters: {
    viewport: {
      defaultViewport: 'mobile1'
    }
  }
}
