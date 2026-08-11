import { sql } from 'kysely'

import type { DBLike } from '#types'

import type { SocialRateLimitAction, SocialRateLimitWindow } from './types.js'

export function createSocialRateLimitRepository(db: DBLike) {
  return {
    async consumeSocialRateLimit(input: {
      userId: string
      action: SocialRateLimitAction
      window: SocialRateLimitWindow
      limit: number
      now: string
    }): Promise<boolean> {
      const windowStart =
        input.window === 'HOUR'
          ? sql`date_trunc('hour', ${input.now}::timestamptz)`
          : sql`date_trunc('day', ${input.now}::timestamptz)`
      const result = await sql<{ action_count: number }>`
        insert into social_action_rate_limits (
          user_id, action_kind, window_kind, window_started_at, action_count
        ) values (
          ${input.userId}::uuid, ${input.action}, ${input.window}, ${windowStart}, 1
        )
        on conflict (user_id, action_kind, window_kind, window_started_at)
        do update set action_count = social_action_rate_limits.action_count + 1,
          updated_at = ${input.now}::timestamptz
        where social_action_rate_limits.action_count < ${input.limit}
        returning action_count
      `.execute(db)
      return Boolean(result.rows[0])
    }
  }
}
