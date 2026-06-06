import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { MobileAppFooter } from './MobileAppFooter'
import type { MobileAppFooterItem } from './MobileAppFooter.types'

const items = [
  { icon: 'library', id: 'library', label: 'Library' },
  { icon: 'create', id: 'create', label: 'Create' },
  { icon: 'search', id: 'search', label: 'Search' },
  { icon: 'account', id: 'account', label: 'Account' }
] satisfies readonly MobileAppFooterItem[]

const meta = {
  title: 'Shell/App/Mobile App Footer',
  component: MobileAppFooter,
  parameters: {
    layout: 'fullscreen'
  },
  args: {
    items
  },
  decorators: [
    (Story) => (
      <div>
        <Story />
      </div>
    )
  ]
} satisfies Meta<typeof MobileAppFooter>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
