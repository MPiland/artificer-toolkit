import { sql } from 'kysely'

import type {
  NotificationIntentData,
  NotificationIntentOperation,
  NotificationSourceKind,
  NotificationWorkflowKey
} from '@artificer-toolkit/schema/api/notifications'
import type { DBLike } from '#types'

export interface NotificationDeliveryIntentRecord {
  id: string
  operation: NotificationIntentOperation
  workflowKey: NotificationWorkflowKey
  sourcePublicId: string
  recipientNotificationId: string
  payload: unknown
  attemptCount: number
  recipientEmail: string | null
  recipientUsername: string | null
}

type RawClaimedIntent = {
  id: string
  operation: NotificationIntentOperation
  workflow_key: NotificationWorkflowKey
  source_public_id: string
  recipient_notification_id: string
  payload: unknown
  attempt_count: number
  recipient_email: string | null
  recipient_username: string | null
}

function mapClaimedIntent(row: RawClaimedIntent): NotificationDeliveryIntentRecord {
  return {
    id: row.id,
    operation: row.operation,
    workflowKey: row.workflow_key,
    sourcePublicId: row.source_public_id,
    recipientNotificationId: row.recipient_notification_id,
    payload: row.payload,
    attemptCount: row.attempt_count,
    recipientEmail: row.recipient_email,
    recipientUsername: row.recipient_username
  }
}

export function createNotificationRepository(db: DBLike) {
  return {
    async findRecipientIdForUser(userId: string): Promise<string | null> {
      const profile = await db
        .selectFrom('profiles')
        .select('notification_recipient_id')
        .where('id', '=', userId)
        .executeTakeFirst()
      return profile?.notification_recipient_id ?? null
    },

    async insertDeliveryIntent(input: {
      operation: NotificationIntentOperation
      workflowKey: NotificationWorkflowKey
      sourceKind: NotificationSourceKind
      sourcePublicId: string
      recipientUserId: string
      groupingKey?: string
      payload?: NotificationIntentData
      occurredAt: string
    }): Promise<string | null> {
      const result = await sql<{ id: string }>`
        insert into notification_delivery_intents (
          operation, workflow_key, source_kind, source_public_id,
          recipient_notification_id, grouping_key, payload, occurred_at
        )
        select ${input.operation}, ${input.workflowKey}, ${input.sourceKind},
          ${input.sourcePublicId}::uuid, profile.notification_recipient_id,
          ${input.groupingKey ?? null}, ${JSON.stringify(input.payload ?? {})}::jsonb,
          ${input.occurredAt}::timestamptz
        from profiles profile
        where profile.id = ${input.recipientUserId}::uuid
        on conflict (
          recipient_notification_id, source_kind, source_public_id, workflow_key, operation
        ) do nothing
        returning id
      `.execute(db)
      return result.rows[0]?.id ?? null
    },

    async insertApplicationSubmittedCancellations(
      applicationIds: string[],
      occurredAt: string
    ): Promise<number> {
      if (applicationIds.length === 0) return 0
      const result = await sql<{ id: string }>`
        insert into notification_delivery_intents (
          operation, workflow_key, source_kind, source_public_id,
          recipient_notification_id, payload, occurred_at
        )
        select 'CANCEL', 'social-application-submitted', 'SOCIAL_APPLICATION',
          application.id, host_profile.notification_recipient_id, '{}'::jsonb,
          ${occurredAt}::timestamptz
        from social_applications application
        join social_listings listing on listing.id = application.listing_id
        join campaigns campaign on campaign.id = listing.campaign_id
        join profiles host_profile on host_profile.id = campaign.owner_user_id
        where application.id = any(${sql.val(applicationIds)}::uuid[])
        on conflict (
          recipient_notification_id, source_kind, source_public_id, workflow_key, operation
        ) do nothing
        returning id
      `.execute(db)
      return result.rows.length
    },

    async insertInvitationReceivedCancellations(
      inviteIds: string[],
      occurredAt: string
    ): Promise<number> {
      if (inviteIds.length === 0) return 0
      const result = await sql<{ id: string }>`
        insert into notification_delivery_intents (
          operation, workflow_key, source_kind, source_public_id,
          recipient_notification_id, payload, occurred_at
        )
        select 'CANCEL', 'social-invitation-received', 'CAMPAIGN_INVITE', invite.id,
          recipient.notification_recipient_id, '{}'::jsonb, ${occurredAt}::timestamptz
        from campaign_invites invite
        join profiles recipient on recipient.id = invite.recipient_user_id
        where invite.id = any(${sql.val(inviteIds)}::uuid[])
        on conflict (
          recipient_notification_id, source_kind, source_public_id, workflow_key, operation
        ) do nothing
        returning id
      `.execute(db)
      return result.rows.length
    },

    async markExhaustedDeliveryIntents(now: string, staleBefore: string): Promise<number> {
      const result = await sql<{ id: string }>`
        update notification_delivery_intents
        set claimed_at = null, failed_at = ${now}::timestamptz,
          last_error_code = 'ATTEMPTS_EXHAUSTED'
        where delivered_at is null and failed_at is null
          and attempt_count >= 10
          and (claimed_at is null or claimed_at <= ${staleBefore}::timestamptz)
        returning id
      `.execute(db)
      return result.rows.length
    },

    async suppressCancelledDeliveryTriggers(now: string, staleBefore: string): Promise<number> {
      const result = await sql<{ id: string }>`
        update notification_delivery_intents trigger_intent
        set claimed_at = null, failed_at = ${now}::timestamptz,
          last_error_code = 'SOURCE_CANCELLED'
        where trigger_intent.operation = 'TRIGGER'
          and trigger_intent.delivered_at is null and trigger_intent.failed_at is null
          and (
            trigger_intent.claimed_at is null
            or trigger_intent.claimed_at <= ${staleBefore}::timestamptz
          )
          and exists (
            select 1 from notification_delivery_intents cancel_intent
            where cancel_intent.operation = 'CANCEL'
              and cancel_intent.recipient_notification_id =
                trigger_intent.recipient_notification_id
              and cancel_intent.source_kind = trigger_intent.source_kind
              and cancel_intent.source_public_id = trigger_intent.source_public_id
              and cancel_intent.workflow_key = trigger_intent.workflow_key
          )
        returning trigger_intent.id
      `.execute(db)
      return result.rows.length
    },

    async claimDeliveryIntents(input: {
      limit: number
      now: string
      staleBefore: string
    }): Promise<NotificationDeliveryIntentRecord[]> {
      const result = await sql<RawClaimedIntent>`
        with due as (
          select intent.id
          from notification_delivery_intents intent
          where intent.delivered_at is null and intent.failed_at is null
            and intent.next_attempt_at <= ${input.now}::timestamptz
            and (intent.claimed_at is null or intent.claimed_at <= ${input.staleBefore}::timestamptz)
            and intent.attempt_count < 10
            and (
              intent.operation <> 'TRIGGER'
              or not exists (
                select 1 from notification_delivery_intents cancel_intent
                where cancel_intent.operation = 'CANCEL'
                  and cancel_intent.recipient_notification_id =
                    intent.recipient_notification_id
                  and cancel_intent.source_kind = intent.source_kind
                  and cancel_intent.source_public_id = intent.source_public_id
                  and cancel_intent.workflow_key = intent.workflow_key
              )
            )
            and (
              intent.operation <> 'CANCEL'
              or not exists (
                select 1 from notification_delivery_intents active_trigger
                where active_trigger.operation = 'TRIGGER'
                  and active_trigger.recipient_notification_id =
                    intent.recipient_notification_id
                  and active_trigger.source_kind = intent.source_kind
                  and active_trigger.source_public_id = intent.source_public_id
                  and active_trigger.workflow_key = intent.workflow_key
                  and active_trigger.delivered_at is null
                  and active_trigger.failed_at is null
                  and active_trigger.claimed_at > ${input.staleBefore}::timestamptz
              )
            )
          order by intent.next_attempt_at, intent.occurred_at, intent.id
          for update skip locked
          limit ${input.limit}
        ), claimed as (
          update notification_delivery_intents intent
          set claimed_at = ${input.now}::timestamptz,
            attempt_count = intent.attempt_count + 1
          from due
          where intent.id = due.id
          returning intent.*
        )
        select claimed.id, claimed.operation, claimed.workflow_key,
          claimed.source_public_id, claimed.recipient_notification_id,
          claimed.payload, claimed.attempt_count, auth_user.email as recipient_email,
          profile.username as recipient_username
        from claimed
        join profiles profile
          on profile.notification_recipient_id = claimed.recipient_notification_id
        join auth.users auth_user on auth_user.id = profile.id
        order by claimed.next_attempt_at, claimed.occurred_at, claimed.id
      `.execute(db)
      return result.rows.map(mapClaimedIntent)
    },

    async markDeliverySucceeded(intentId: string, deliveredAt: string): Promise<void> {
      await db
        .updateTable('notification_delivery_intents')
        .set({ claimed_at: null, delivered_at: deliveredAt, last_error_code: null })
        .where('id', '=', intentId)
        .where('failed_at', 'is', null)
        .executeTakeFirstOrThrow()
    },

    async markDeliveryRetry(input: {
      intentId: string
      nextAttemptAt: string
      errorCode: string
    }): Promise<void> {
      await db
        .updateTable('notification_delivery_intents')
        .set({
          claimed_at: null,
          next_attempt_at: input.nextAttemptAt,
          last_error_code: input.errorCode
        })
        .where('id', '=', input.intentId)
        .where('delivered_at', 'is', null)
        .where('failed_at', 'is', null)
        .executeTakeFirstOrThrow()
    },

    async markDeliveryFailed(input: {
      intentId: string
      failedAt: string
      errorCode: string
    }): Promise<void> {
      await db
        .updateTable('notification_delivery_intents')
        .set({
          claimed_at: null,
          failed_at: input.failedAt,
          last_error_code: input.errorCode
        })
        .where('id', '=', input.intentId)
        .where('delivered_at', 'is', null)
        .executeTakeFirstOrThrow()
    }
  }
}
