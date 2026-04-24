import type { Meta, StoryObj } from '@storybook/react-vite'
import { ThemeToggle } from './ThemeToggle'

const meta = {
  title: 'Platform/Theme/ThemeToggle',
  component: ThemeToggle
} satisfies Meta<typeof ThemeToggle>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => <ThemeToggle />
}
