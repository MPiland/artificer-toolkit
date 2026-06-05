import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { fn } from 'storybook/test'
import { AuthPageShell, SignInForm, ResetPasswordForm, SignUpForm, UpdatePasswordForm } from '../components'
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
    description: 'Welcome back. Your table is waiting.',
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
    description: 'Start with a character or homebrew draft, then keep it ready for play.',
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
    description: 'Enter your email and we\'ll send a secure reset link if email delivery is available.',
    variant: 'support',
    children: null
  },
  render: ({ title, description, variant }) => (
    <AuthPageShell title={title} description={description} variant={variant}>
      <ResetPasswordForm authClient={createMockAuthClient()} onSuccess={fn()} />
    </AuthPageShell>
  )
}

export const UpdatePassword: Story = {
  args: {
    title: 'Set a new password',
    description: 'Choose a new password, then return to your toolkit.',
    variant: 'support',
    children: null
  },
  render: ({ title, description, variant }) => (
    <AuthPageShell title={title} description={description} variant={variant}>
      <UpdatePasswordForm authClient={createMockAuthClient()} onSuccess={fn()} />
    </AuthPageShell>
  )
}
