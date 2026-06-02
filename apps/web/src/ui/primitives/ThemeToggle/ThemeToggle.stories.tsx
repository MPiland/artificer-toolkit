import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { ThemeToggle } from './ThemeToggle'

const meta = {
  title: 'UI/Primitives/ThemeToggle',
  component: ThemeToggle,
  parameters: {
    layout: 'centered'
  }
} satisfies Meta<typeof ThemeToggle>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
