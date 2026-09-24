'use node'

import { v } from 'convex/values'
import { renderSocialNotificationEmail } from '@artificer-toolkit/emails'
import { internalAction } from '../_generated/server'
import { internal } from '../_generated/api'
import { requiredEmailEnvironment, sendRenderedEmail } from '../emailTransport'

export const send = internalAction({
  args: { intentId: v.id('notificationDeliveryIntents'), attempt: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      const input = await ctx.runQuery(internal.notifications.delivery.emailInput, args)
      if (!input) {
        await ctx.runMutation(internal.notifications.delivery.complete, args)
        return null
      }
      const email = await renderSocialNotificationEmail({
        appUrl: requiredEmailEnvironment('SITE_URL'),
        data: input.data,
        workflowKey: input.workflowKey
      })
      if (requiredEmailEnvironment('MAIL_DELIVERY_MODE') === 'resend') {
        await ctx.runMutation(internal.notifications.delivery.enqueueRendered, {
          ...args,
          subject: email.subject,
          html: email.html
        })
        return null
      }
      await sendRenderedEmail(ctx, {
        recipient: input.recipient,
        fromEnvironmentVariable: 'NOTIFICATION_EMAIL_FROM',
        subject: email.subject,
        html: email.html,
        idempotencyKey: input.id,
        retryAttempts: 10
      })
      await ctx.runMutation(internal.notifications.delivery.complete, args)
    } catch {
      // Keep provider/configuration details and recipient addresses out of durable error metadata.
      await ctx.runMutation(internal.notifications.delivery.retry, args)
    }
    return null
  }
})
