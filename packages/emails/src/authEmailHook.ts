import { render } from '@react-email/render'
import React from 'react'
import { Resend } from 'resend'
import { Webhook } from 'standardwebhooks'

import { AuthEmail } from './AuthEmailTemplate.js'
import {
  getAuthEmailContent,
  getAuthEmailPlainText,
  isAuthEmailAction,
  type AuthEmailAction
} from './authEmailContent.js'

type AuthEmailData = {
  email_action_type: string
  redirect_to?: string
  site_url?: string
  token?: string
  token_hash?: string
  token_new?: string
  token_hash_new?: string
}

type AuthEmailHookPayload = {
  email_data: AuthEmailData
  user: {
    email: string
    new_email?: string
  }
}

type EmailMessage = {
  html: string
  subject: string
  text: string
  to: string
}

type RenderInput = {
  action: AuthEmailAction
  actionUrl?: string
  token?: string
}

export type SendAuthEmailDependencies = {
  render: (input: RenderInput) => Promise<{ html: string; text: string }>
  send: (message: EmailMessage) => Promise<void>
  supabaseUrl: string
  verifyWebhook: (body: string, headers: Record<string, string>) => unknown
}

export type AuthEmailHookConfig = {
  from: string
  resendApiKey: string
  supabaseUrl: string
  webhookSecret: string
}

function isAuthEmailHookPayload(value: unknown): value is AuthEmailHookPayload {
  if (!value || typeof value !== 'object') {
    return false
  }

  const payload = value as { email_data?: unknown; user?: unknown }

  if (!payload.email_data || typeof payload.email_data !== 'object') {
    return false
  }

  if (!payload.user || typeof payload.user !== 'object') {
    return false
  }

  const emailData = payload.email_data as { email_action_type?: unknown }
  const user = payload.user as { email?: unknown }

  return (
    typeof emailData.email_action_type === 'string' &&
    typeof user.email === 'string' &&
    user.email.length > 0
  )
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function getVerificationUrl({
  supabaseUrl,
  action,
  tokenHash,
  redirectTo
}: {
  action: AuthEmailAction
  redirectTo?: string
  supabaseUrl: string
  tokenHash: string
}): string {
  const url = new URL('/auth/v1/verify', supabaseUrl)

  url.searchParams.set('token', tokenHash)
  url.searchParams.set('type', action)

  if (redirectTo) {
    url.searchParams.set('redirect_to', redirectTo)
  }

  return url.toString()
}

function getInviteConfirmationUrl(siteUrl: string, tokenHash: string): string {
  const url = new URL('/auth/confirmed', siteUrl)

  url.searchParams.set('token_hash', tokenHash)
  url.searchParams.set('type', 'invite')

  return url.toString()
}

function buildMessages(
  payload: AuthEmailHookPayload,
  supabaseUrl: string
): Array<{ actionUrl?: string; token?: string; to: string }> | null {
  const action = payload.email_data.email_action_type

  if (!isAuthEmailAction(action)) {
    return null
  }

  const token = readString(payload.email_data.token)

  if (action === 'reauthentication') {
    return token ? [{ to: payload.user.email, token }] : null
  }

  if (action === 'invite') {
    const siteUrl = readString(payload.email_data.site_url)
    const tokenHash = readString(payload.email_data.token_hash)

    return siteUrl && tokenHash
      ? [
          {
            actionUrl: getInviteConfirmationUrl(siteUrl, tokenHash),
            to: payload.user.email
          }
        ]
      : null
  }

  if (action === 'email_change') {
    const tokenNew = readString(payload.email_data.token_new)
    const tokenHash = readString(payload.email_data.token_hash)
    const tokenHashNew = readString(payload.email_data.token_hash_new)
    const newEmail = readString(payload.user.new_email)

    if (token && tokenNew && tokenHash && tokenHashNew && newEmail) {
      return [
        {
          actionUrl: getVerificationUrl({
            action,
            redirectTo: readString(payload.email_data.redirect_to),
            supabaseUrl,
            tokenHash: tokenHashNew
          }),
          token,
          to: payload.user.email
        },
        {
          actionUrl: getVerificationUrl({
            action,
            redirectTo: readString(payload.email_data.redirect_to),
            supabaseUrl,
            tokenHash
          }),
          token: tokenNew,
          to: newEmail
        }
      ]
    }

    const emailChangeToken = token ?? tokenNew

    if (!emailChangeToken || !tokenHash) {
      return null
    }

    return [
      {
        actionUrl: getVerificationUrl({
          action,
          redirectTo: readString(payload.email_data.redirect_to),
          supabaseUrl,
          tokenHash
        }),
        token: emailChangeToken,
        to: newEmail ?? payload.user.email
      }
    ]
  }

  const tokenHash = readString(payload.email_data.token_hash)

  if (!token || !tokenHash) {
    return null
  }

  return [
    {
      actionUrl: getVerificationUrl({
        action,
        redirectTo: readString(payload.email_data.redirect_to),
        supabaseUrl,
        tokenHash
      }),
      token,
      to: payload.user.email
    }
  ]
}

export function createSendAuthEmailHandler(
  dependencies: SendAuthEmailDependencies
): (request: Request) => Promise<Response> {
  return async (request) => {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 })
    }

    const body = await request.text()
    let verifiedPayload: unknown

    try {
      verifiedPayload = dependencies.verifyWebhook(body, Object.fromEntries(request.headers))
    } catch {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!isAuthEmailHookPayload(verifiedPayload)) {
      return Response.json({ error: 'Invalid authentication email request' }, { status: 400 })
    }

    const action = verifiedPayload.email_data.email_action_type

    if (!isAuthEmailAction(action)) {
      return Response.json({ error: 'Unsupported authentication email action' }, { status: 422 })
    }

    const messages = buildMessages(verifiedPayload, dependencies.supabaseUrl)

    if (!messages) {
      return Response.json({ error: 'Invalid authentication email request' }, { status: 400 })
    }

    try {
      for (const message of messages) {
        const rendered = await dependencies.render({
          action,
          actionUrl: message.actionUrl,
          token: message.token
        })
        const content = getAuthEmailContent(action)

        await dependencies.send({
          html: rendered.html,
          subject: content.subject,
          text:
            rendered.text ||
            getAuthEmailPlainText({
              action,
              actionUrl: message.actionUrl,
              token: message.token
            }),
          to: message.to
        })
      }
    } catch {
      return Response.json({ error: 'Unable to send authentication email' }, { status: 500 })
    }

    return Response.json({})
  }
}

export function createAuthEmailHookHandler(config: AuthEmailHookConfig) {
  const resend = new Resend(config.resendApiKey)
  const webhook = new Webhook(config.webhookSecret.replace(/^v1,whsec_/, ''))

  return createSendAuthEmailHandler({
    render: async ({ action, actionUrl, token }) => {
      const email = React.createElement(AuthEmail, { action, actionUrl, token })

      return {
        html: await render(email),
        text: await render(email, { plainText: true })
      }
    },
    send: async ({ html, subject, text, to }) => {
      const response = await resend.emails.send({
        from: config.from,
        html,
        subject,
        text,
        to
      })

      if (response.error) {
        throw new Error('Resend delivery failed')
      }
    },
    supabaseUrl: config.supabaseUrl,
    verifyWebhook: (body, headers) => webhook.verify(body, headers)
  })
}
