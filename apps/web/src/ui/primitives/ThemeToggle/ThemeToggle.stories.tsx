import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { expect } from 'storybook/test'
import { ThemeToggle } from './ThemeToggle'

const meta = {
  title: 'UI/Primitives/ThemeToggle',
  component: ThemeToggle,
  tags: ['ai-generated', 'needs-work'],
  parameters: {
    layout: 'centered'
  }
} satisfies Meta<typeof ThemeToggle>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const CssCheck: Story = {
  play: async ({ canvas }) => {
    const button = canvas.getByRole('button', { name: /switch to light mode/i })
    await expect(getComputedStyle(button).backgroundColor).toBe('rgba(236, 106, 6, 0.18)')
  }
}
