export const authEmailActions = [
  'signup',
  'recovery',
  'invite',
  'magiclink',
  'email_change',
  'reauthentication'
] as const

export type AuthEmailAction = (typeof authEmailActions)[number]

export type AuthEmailProps = {
  action: AuthEmailAction
  actionUrl?: string
  token?: string
}

export type AuthEmailContent = {
  subject: string
  preview: string
  title: string
  body: string
  actionLabel?: string
  includeToken: boolean
  securityNote: string
}

const contentByAction: Record<AuthEmailAction, AuthEmailContent> = {
  signup: {
    subject: 'Confirm your Artificer Toolkit email',
    preview: 'Confirm your email address to finish creating your account.',
    title: 'Confirm your email',
    body: 'Confirm this email address to finish creating your Artificer Toolkit account.',
    actionLabel: 'Confirm email',
    includeToken: true,
    securityNote: 'If you did not create an account, you can safely ignore this email.'
  },
  recovery: {
    subject: 'Reset your Artificer Toolkit password',
    preview: 'Use this email to choose a new password for your account.',
    title: 'Reset your password',
    body: 'We received a request to reset your Artificer Toolkit password.',
    actionLabel: 'Reset password',
    includeToken: true,
    securityNote: 'If you did not request a password reset, you can safely ignore this email.'
  },
  invite: {
    subject: "You're invited to Artificer Toolkit",
    preview: 'Accept your invitation and set up your account.',
    title: "You've been invited",
    body: 'Accept this invitation to create your Artificer Toolkit account.',
    actionLabel: 'Accept invitation',
    includeToken: false,
    securityNote: 'If you were not expecting this invitation, you can safely ignore this email.'
  },
  magiclink: {
    subject: 'Your Artificer Toolkit sign-in link',
    preview: 'Use this link or code to sign in securely.',
    title: 'Sign in to Artificer Toolkit',
    body: 'Use this secure, one-time link to sign in to your account.',
    actionLabel: 'Sign in',
    includeToken: true,
    securityNote: 'If you did not request this sign-in link, you can safely ignore this email.'
  },
  email_change: {
    subject: 'Confirm your new Artificer Toolkit email',
    preview: 'Confirm this email change to update your account.',
    title: 'Confirm your email change',
    body: 'Confirm this email address to complete the change for your Artificer Toolkit account.',
    actionLabel: 'Confirm email change',
    includeToken: true,
    securityNote: 'If you did not request this change, you can safely ignore this email.'
  },
  reauthentication: {
    subject: 'Your Artificer Toolkit verification code',
    preview: 'Use this code to verify your identity.',
    title: 'Verify your identity',
    body: 'Enter this code in Artificer Toolkit to continue.',
    includeToken: true,
    securityNote: 'If you did not request this verification, you can safely ignore this email.'
  }
}

export function isAuthEmailAction(value: string): value is AuthEmailAction {
  return (authEmailActions as readonly string[]).includes(value)
}

export function getAuthEmailContent(action: AuthEmailAction): AuthEmailContent {
  return contentByAction[action]
}

export function getAuthEmailPlainText({ action, actionUrl, token }: AuthEmailProps): string {
  const content = getAuthEmailContent(action)
  const lines = ['Artificer Toolkit', '', content.title, '', content.body]

  if (actionUrl && content.actionLabel) {
    lines.push('', `${content.actionLabel}: ${actionUrl}`)
  }

  if (token && content.includeToken) {
    lines.push('', `Verification code: ${token}`)
  }

  lines.push('', content.securityNote)
  return lines.join('\n')
}
