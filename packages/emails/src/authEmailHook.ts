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

const AUTH_EMAIL_HOOK_MAX_BODY_BYTES = 64 * 1024

type AuthEmailData = {
  email_action_type: string
  redirect_to?: string
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
  idempotencyKey: string
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
  siteUrl: string
  supabaseUrl: string
  verifyWebhook: (body: string, headers: Record<string, string>) => unknown
}

export type AuthEmailHookConfig = {
  from: string
  resendApiKey: string
  siteUrl: string
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

async function readRequestBody(request: Request): Promise<string | null> {
  const declaredLength = request.headers.get('content-length')
  if (
    declaredLength !== null &&
    Number.isFinite(Number(declaredLength)) &&
    Number(declaredLength) > AUTH_EMAIL_HOOK_MAX_BODY_BYTES
  ) {
    return null
  }
  if (!request.body) return ''

  const chunks: Uint8Array[] = []
  const reader = request.body.getReader()
  let byteLength = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    byteLength += value.byteLength
    if (byteLength > AUTH_EMAIL_HOOK_MAX_BODY_BYTES) {
      await reader.cancel().catch(() => undefined)
      return null
    }
    chunks.push(value)
  }

  const body = new Uint8Array(byteLength)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }

  return new TextDecoder().decode(body)
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

function isTrustedRedirect(redirectTo: string | undefined, siteUrl: string): boolean {
  if (!redirectTo) return true

  try {
    return new URL(redirectTo).origin === new URL(siteUrl).origin
  } catch {
    return false
  }
}

function buildMessages(
  payload: AuthEmailHookPayload,
  siteUrl: string,
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
    const tokenHash = readString(payload.email_data.token_hash)

    return tokenHash
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

    const body = await readRequestBody(request)
    if (body === null) {
      return Response.json({ error: 'Authentication email request is too large' }, { status: 413 })
    }

    let verifiedPayload: unknown

    try {
      verifiedPayload = dependencies.verifyWebhook(body, Object.fromEntries(request.headers))
    } catch {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!isAuthEmailHookPayload(verifiedPayload)) {
      return Response.json({ error: 'Invalid authentication email request' }, { status: 400 })
    }

    const webhookId = readString(request.headers.get('webhook-id'))
    if (!webhookId) {
      return Response.json({ error: 'Invalid authentication email request' }, { status: 400 })
    }

    const action = verifiedPayload.email_data.email_action_type

    if (!isAuthEmailAction(action)) {
      return Response.json({ error: 'Unsupported authentication email action' }, { status: 422 })
    }

    if (
      !isTrustedRedirect(readString(verifiedPayload.email_data.redirect_to), dependencies.siteUrl)
    ) {
      return Response.json({ error: 'Invalid authentication email redirect' }, { status: 400 })
    }

    const messages = buildMessages(verifiedPayload, dependencies.siteUrl, dependencies.supabaseUrl)

    if (!messages) {
      return Response.json({ error: 'Invalid authentication email request' }, { status: 400 })
    }

    try {
      for (const [messageIndex, message] of messages.entries()) {
        const rendered = await dependencies.render({
          action,
          actionUrl: message.actionUrl,
          token: message.token
        })
        const content = getAuthEmailContent(action)

        await dependencies.send({
          html: rendered.html,
          // One stable key per recipient lets retries resume a two-message email change safely.
          idempotencyKey: `${webhookId}:${messageIndex}`,
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
    send: async ({ html, idempotencyKey, subject, text, to }) => {
      const response = await resend.emails.send(
        {
          from: config.from,
          html,
          subject,
          text,
          to
        },
        { idempotencyKey }
      )

      if (response.error) {
        throw new Error('Resend delivery failed')
      }
    },
    siteUrl: config.siteUrl,
    supabaseUrl: config.supabaseUrl,
    verifyWebhook: (body, headers) => webhook.verify(body, headers)
  })
}
