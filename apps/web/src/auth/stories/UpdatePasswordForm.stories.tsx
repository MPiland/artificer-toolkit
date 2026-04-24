import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { UpdatePasswordForm } from '../components'
import { createMockAuthClient } from './authStories.utils'

const meta = {
  title: 'Auth/UpdatePasswordForm',
  component: UpdatePasswordForm,
  args: {
    onSuccess: fn()
  },
  parameters: {
    layout: 'centered'
  }
} satisfies Meta<typeof UpdatePasswordForm>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    authClient: createMockAuthClient()
  }
}

export const Error: Story = {
  args: {
    authClient: createMockAuthClient({
      result: { ok: false, message: 'That recovery session expired. Please request a new link.' }
    })
  }
}

export const Loading: Story = {
  args: {
    authClient: createMockAuthClient({ delayMs: 1200 })
  }
}
