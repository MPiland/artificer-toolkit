import { render } from '@react-email/render'
import { describe, expect, it } from 'vitest'
import { AuthEmail } from '../AuthEmailTemplate.js'
import {
  authEmailActions,
  getAuthEmailContent,
  getAuthEmailPlainText
} from '../authEmailContent.js'

describe('AuthEmail', () => {
  it.each([
    ['signup', 'Confirm your Artificer Toolkit email'],
    ['recovery', 'Reset your Artificer Toolkit password'],
    ['invite', "You're invited to Artificer Toolkit"],
    ['magiclink', 'Your Artificer Toolkit sign-in link'],
    ['email_change', 'Confirm your new Artificer Toolkit email'],
    ['reauthentication', 'Your Artificer Toolkit verification code']
  ] as const)('provides the %s subject', (action, subject) => {
    expect(getAuthEmailContent(action).subject).toBe(subject)
  })

  it.each(authEmailActions)('renders branded %s content', async (action) => {
    const content = getAuthEmailContent(action)
    const html = await render(
      <AuthEmail action={action} actionUrl='https://app.example.test/verify' token='123456' />
    )

    expect(html).toContain('Artificer Toolkit')
    const decodedHtml = html.replaceAll('&#x27;', "'")

    expect(decodedHtml).toContain(content.title)
    expect(decodedHtml).toContain(content.securityNote)
  })

  it('keeps the action URL and verification code in the plaintext fallback', () => {
    expect(
      getAuthEmailPlainText({
        action: 'recovery',
        actionUrl: 'https://app.example.test/reset',
        token: '123456'
      })
    ).toContain('Reset password: https://app.example.test/reset')
    expect(
      getAuthEmailPlainText({
        action: 'recovery',
        actionUrl: 'https://app.example.test/reset',
        token: '123456'
      })
    ).toContain('Verification code: 123456')
  })

  it('does not render a link for reauthentication', async () => {
    const html = await render(<AuthEmail action='reauthentication' token='123456' />)

    expect(html).not.toContain('href=')
    expect(html).toContain('123456')
  })
})
