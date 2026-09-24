'use node'

import { renderAuthEmail } from '@artificer-toolkit/emails'
import { authEmailDeliveryInputSchema } from '@artificer-toolkit/schema/api/auth'
import { v } from 'convex/values'

import { internalAction } from './_generated/server'
import { requiredEmailEnvironment, sendRenderedEmail } from './emailTransport'

function assertActionUrlOrigin(actionUrl: string): void {
  const siteUrl = new URL(requiredEmailEnvironment('SITE_URL'))

  if (new URL(actionUrl).origin !== siteUrl.origin) {
    throw new Error('Authentication email destination must use the configured site origin.')
  }
}

export const send = internalAction({
  args: {
    action: v.union(
      v.literal('signup'),
      v.literal('recovery'),
      v.literal('invite'),
      v.literal('email_change')
    ),
    recipient: v.string(),
    actionUrl: v.string(),
    token: v.optional(v.string())
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const input = authEmailDeliveryInputSchema.parse(args)
    assertActionUrlOrigin(input.actionUrl)
    const email = await renderAuthEmail(input)
    await sendRenderedEmail(ctx, {
      recipient: input.recipient,
      fromEnvironmentVariable: 'AUTH_EMAIL_FROM',
      subject: email.subject,
      html: email.html,
      text: email.text
    })
    return null
  }
})
