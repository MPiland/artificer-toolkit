import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { AuthPageShell, SignInForm, ResetPasswordForm, SignUpForm, UpdatePasswordForm } from '../components'
import * as ResetPasswordFormStories from './ResetPasswordForm.stories'
import * as SignInFormStories from './SignInForm.stories'
import * as SignUpFormStories from './SignUpForm.stories'
import * as UpdatePasswordFormStories from './UpdatePasswordForm.stories'

const meta = {
  title: 'Guest/Auth/AuthPageShell',
  component: AuthPageShell,
  parameters: {
    layout: 'fullscreen'
  }
} satisfies Meta<typeof AuthPageShell>

export default meta

type Story = StoryObj<typeof meta>

export const Login: Story = {
  args: {
    title: 'Sign in',
    description: 'Welcome back. Your table is waiting.',
    children: null
  },
  render: ({ title, description }) => (
    <AuthPageShell title={title} description={description}>
      <SignInForm {...SignInFormStories.Default.args} />
    </AuthPageShell>
  )
}

export const Signup: Story = {
  args: {
    title: 'Create your account',
    description: 'Start with a character or homebrew draft, then keep it ready for play.',
    children: null
  },
  render: ({ title, description }) => (
    <AuthPageShell title={title} description={description}>
      <SignUpForm {...SignUpFormStories.Default.args} />
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
      <ResetPasswordForm {...ResetPasswordFormStories.Default.args} />
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
      <UpdatePasswordForm {...UpdatePasswordFormStories.Default.args} />
    </AuthPageShell>
  )
}
