import type { Meta, StoryObj } from '@storybook/react-vite'
import { AuthPageShell } from './AuthPageShell'
import { LoginForm, ResetPasswordForm, SignupForm, UpdatePasswordForm } from './AuthForms'
import type { AuthClient } from './authClient'

const mockAuthClient: AuthClient = {
  signIn: async () => ({ ok: true }),
  signUp: async () => ({ ok: true }),
  requestPasswordReset: async () => ({ ok: true }),
  updatePassword: async () => ({ ok: true }),
  signOut: async () => ({ ok: true })
}

const meta = {
  title: 'Public/Auth/AuthPageShell',
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
      <LoginForm authClient={mockAuthClient} />
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
      <SignupForm authClient={mockAuthClient} />
    </AuthPageShell>
  )
}

export const ResetPassword: Story = {
  args: {
    title: 'Reset your password',
    description: "Enter your email and we'll send you a reset link.",
    children: null
  },
  render: ({ title, description }) => (
    <AuthPageShell title={title} description={description}>
      <ResetPasswordForm authClient={mockAuthClient} />
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
      <UpdatePasswordForm authClient={mockAuthClient} />
    </AuthPageShell>
  )
}
