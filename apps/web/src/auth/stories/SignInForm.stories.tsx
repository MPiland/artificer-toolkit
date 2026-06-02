import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { fn } from 'storybook/test'
import { SignInForm } from '../components'
import { createMockAuthClient } from './authStories.utils'

const meta = {
  title: 'Auth/SignInForm',
  component: SignInForm,
  args: {
    onSuccess: fn()
  },
  parameters: {
    layout: 'centered'
  }
} satisfies Meta<typeof SignInForm>

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
      result: { ok: false, message: 'Email or password is incorrect.' }
    })
  }
}

export const Loading: Story = {
  args: {
    authClient: createMockAuthClient({ delayMs: 1200 })
  }
}
