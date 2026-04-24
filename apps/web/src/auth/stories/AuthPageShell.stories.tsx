import type { Meta, StoryObj } from '@storybook/react-vite'
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
    description: 'Welcome back to Artificer Toolkit',
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
    title: 'Create an account',
    description: 'Start building your world today',
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
    description: 'Enter your email and we\'ll send you a reset link.',
    children: null
  },
  render: ({ title, description }) => (
    <AuthPageShell title={title} description={description}>
      <ResetPasswordForm {...ResetPasswordFormStories.Default.args} />
    </AuthPageShell>
  )
}

export const UpdatePassword: Story = {
  args: {
    title: 'Set a new password',
    description: 'Choose a new password to finish recovering your account.',
    children: null
  },
  render: ({ title, description }) => (
    <AuthPageShell title={title} description={description}>
      <UpdatePasswordForm {...UpdatePasswordFormStories.Default.args} />
    </AuthPageShell>
  )
}
