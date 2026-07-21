import { describe, expect, it } from 'vitest'

import { createSendAuthEmailHandler } from '../authEmailHook.js'

const basePayload = {
  email_data: {
    email_action_type: 'signup',
    redirect_to: 'https://app.artificer-toolkit.test/auth/confirmed',
    token: '123456',
    token_hash: 'signup-token-hash'
  },
  user: { email: 'new-user@example.com' }
}

function createRequest() {
  return new Request('https://artificer-toolkit.test/.netlify/functions/send-auth-email', {
    body: '{}',
    method: 'POST'
  })
}

describe('send auth email hook', () => {
  it('sends the selected template through the provider with a verification link', async () => {
    const sent: Array<{ html: string; subject: string; text: string; to: string }> = []
    const handler = createSendAuthEmailHandler({
      render: async (input) => ({ html: JSON.stringify(input), text: '' }),
      send: async (message) => {
        sent.push(message)
      },
      supabaseUrl: 'https://project.supabase.co',
      verifyWebhook: () => basePayload
    })

    const response = await handler(createRequest())

    expect(response.status).toBe(200)
    expect(sent).toHaveLength(1)
    expect(sent[0]?.to).toBe('new-user@example.com')
    expect(sent[0]?.subject).toBe('Confirm your Artificer Toolkit email')
    expect(sent[0]?.html).toContain('signup-token-hash')
    expect(sent[0]?.text).toContain('Confirm your email')
  })

  it('rejects a request whose hook signature cannot be verified', async () => {
    const handler = createSendAuthEmailHandler({
      render: async () => ({ html: '', text: '' }),
      send: async () => {
        throw new Error('should not send')
      },
      supabaseUrl: 'https://project.supabase.co',
      verifyWebhook: () => {
        throw new Error('invalid signature')
      }
    })

    const response = await handler(createRequest())

    expect(response.status).toBe(401)
  })

  it('sends invitations through the app callback that continues to password setup', async () => {
    const sent: Array<{ html: string; text: string; to: string }> = []
    const handler = createSendAuthEmailHandler({
      render: async (input) => ({ html: JSON.stringify(input), text: '' }),
      send: async (message) => {
        sent.push(message)
      },
      supabaseUrl: 'https://project.supabase.co',
      verifyWebhook: () => ({
        email_data: {
          email_action_type: 'invite',
          redirect_to: 'https://artificertoolkit.app',
          site_url: 'https://artificertoolkit.app',
          token: '123456',
          token_hash: 'invite-token-hash'
        },
        user: { email: 'invitee@example.com' }
      })
    })

    const response = await handler(createRequest())

    expect(response.status).toBe(200)
    expect(sent).toHaveLength(1)
    expect(sent[0]?.to).toBe('invitee@example.com')
    expect(sent[0]?.html).toContain(
      'https://artificertoolkit.app/auth/confirmed?token_hash=invite-token-hash&type=invite'
    )
    expect(sent[0]?.html).not.toContain('project.supabase.co/auth/v1/verify')
    expect(sent[0]?.html).not.toContain('123456')
    expect(sent[0]?.text).not.toContain('Verification code')
  })

  it("uses Supabase's reversed token-hash mapping for double-confirm email changes", async () => {
    const sent: Array<{ html: string; to: string }> = []
    const handler = createSendAuthEmailHandler({
      render: async (input) => ({ html: JSON.stringify(input), text: 'email change' }),
      send: async (message) => {
        sent.push(message)
      },
      supabaseUrl: 'https://project.supabase.co',
      verifyWebhook: () => ({
        email_data: {
          email_action_type: 'email_change',
          redirect_to: 'https://app.artificer-toolkit.test/account',
          token: 'old-address-otp',
          token_hash: 'new-address-hash',
          token_new: 'new-address-otp',
          token_hash_new: 'old-address-hash'
        },
        user: {
          email: 'old@example.com',
          new_email: 'new@example.com'
        }
      })
    })

    const response = await handler(createRequest())

    expect(response.status).toBe(200)
    expect(sent).toHaveLength(2)
    expect(sent[0]?.to).toBe('old@example.com')
    expect(sent[0]?.html).toContain('old-address-hash')
    expect(sent[1]?.to).toBe('new@example.com')
    expect(sent[1]?.html).toContain('new-address-hash')
  })

  it('sends one email-change message when double confirmation is not enabled', async () => {
    const sent: Array<{ html: string; to: string }> = []
    const handler = createSendAuthEmailHandler({
      render: async (input) => ({ html: JSON.stringify(input), text: 'email change' }),
      send: async (message) => {
        sent.push(message)
      },
      supabaseUrl: 'https://project.supabase.co',
      verifyWebhook: () => ({
        email_data: {
          email_action_type: 'email_change',
          token_hash: 'new-address-hash',
          token_new: 'new-address-otp'
        },
        user: {
          email: 'old@example.com',
          new_email: 'new@example.com'
        }
      })
    })

    const response = await handler(createRequest())

    expect(response.status).toBe(200)
    expect(sent).toHaveLength(1)
    expect(sent[0]?.to).toBe('new@example.com')
    expect(sent[0]?.html).toContain('new-address-hash')
  })

  it('rejects unsupported action types without echoing the request payload', async () => {
    const handler = createSendAuthEmailHandler({
      render: async () => ({ html: '', text: '' }),
      send: async () => {
        throw new Error('should not send')
      },
      supabaseUrl: 'https://project.supabase.co',
      verifyWebhook: () => ({
        email_data: {
          email_action_type: 'unknown_action'
        },
        user: { email: 'new-user@example.com' }
      })
    })

    const response = await handler(createRequest())

    expect(response.status).toBe(422)
    expect(await response.json()).toEqual({
      error: 'Unsupported authentication email action'
    })
  })

  it('returns a provider failure without exposing provider details', async () => {
    const handler = createSendAuthEmailHandler({
      render: async () => ({ html: '', text: '' }),
      send: async () => {
        throw new Error('Resend response detail')
      },
      supabaseUrl: 'https://project.supabase.co',
      verifyWebhook: () => basePayload
    })

    const response = await handler(createRequest())

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({
      error: 'Unable to send authentication email'
    })
  })
})
