import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { fn } from 'storybook/test'
import {
  AuthPageShell,
  SignInForm,
  ResetPasswordForm,
  SignUpForm,
  UpdatePasswordForm
} from '../components'
import { createMockAuthClient } from './authStories.utils'

const meta = {
  title: 'Guest/AuthShell',
  component: AuthPageShell,
  parameters: {
    layout: 'fullscreen'
  }
} satisfies Meta<typeof AuthPageShell>

export default meta

type Story = StoryObj<typeof meta>

export const SignIn: Story = {
  args: {
    title: 'Sign in',
    description: 'Sign in to continue.',
    children: null
  },
  render: ({ title, description }) => (
    <AuthPageShell title={title} description={description}>
      <SignInForm authClient={createMockAuthClient()} onSuccess={fn()} />
    </AuthPageShell>
  )
}

export const SignUp: Story = {
  args: {
    title: 'Create your account',
    description: 'Create an account to save your characters and homebrew.',
    children: null
  },
  render: ({ title, description }) => (
    <AuthPageShell title={title} description={description}>
      <SignUpForm authClient={createMockAuthClient()} onSuccess={fn()} />
    </AuthPageShell>
  )
}

export const ResetPassword: Story = {
  args: {
    title: 'Reset your password',
    description: 'Enter the email address for your account.',
    children: null
  },
  render: ({ title, description }) => (
    <AuthPageShell title={title} description={description}>
      <ResetPasswordForm authClient={createMockAuthClient()} onSuccess={fn()} />
    </AuthPageShell>
  )
}

export const UpdatePassword: Story = {
  args: {
    title: 'Set a new password',
    description: 'Choose a new password for your account.',
    children: null
  },
  render: ({ title, description }) => (
    <AuthPageShell title={title} description={description}>
      <UpdatePasswordForm authClient={createMockAuthClient()} onSuccess={fn()} />
    </AuthPageShell>
  )
}
