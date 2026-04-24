import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { ResetPasswordForm } from '../components'
import { createMockAuthClient } from './authStories.utils'

const meta = {
  title: 'Auth/ResetPasswordForm',
  component: ResetPasswordForm,
  args: {
    onSuccess: fn()
  },
  parameters: {
    layout: 'centered'
  }
} satisfies Meta<typeof ResetPasswordForm>

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
      result: { ok: false, message: 'We could not send a reset link for that email.' }
    })
  }
}

export const Loading: Story = {
  args: {
    authClient: createMockAuthClient({ delayMs: 1200 })
  }
}
