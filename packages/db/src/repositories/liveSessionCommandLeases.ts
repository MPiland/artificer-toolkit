import type { DBLike } from '#types'
import { sql } from 'kysely'

import { withTransaction } from '../utils/transaction.js'

export interface LiveSessionCommandLeaseIdentity {
  sessionId: string
  authorityId: string
}

export interface LockedLiveSessionCommandLease {
  sessionId: string
  authorityId: string | null
}

interface LeaseMutationInput extends LiveSessionCommandLeaseIdentity {
  now: string
  expiresAt: string
}

export function createLiveSessionCommandLeaseRepository(db: DBLike) {
  return {
    claim(input: LeaseMutationInput): Promise<boolean> {
      return withTransaction(db, async (trx) => {
        const session = await sql<{ status: string }>`
          SELECT status
          FROM public.campaign_sessions
          WHERE id = ${input.sessionId}
          FOR UPDATE
        `.execute(trx)
        if (session.rows[0]?.status !== 'OPEN') return false

        const claimed = await sql<{ session_id: string }>`
          INSERT INTO public.live_session_command_leases (
            session_id,
            authority_id,
            expires_at,
            updated_at
          )
          VALUES (
            ${input.sessionId},
            ${input.authorityId},
            ${input.expiresAt}::timestamptz,
            ${input.now}::timestamptz
          )
          ON CONFLICT (session_id) DO UPDATE
          SET
            authority_id = EXCLUDED.authority_id,
            expires_at = EXCLUDED.expires_at,
            updated_at = EXCLUDED.updated_at
          WHERE
            live_session_command_leases.authority_id = EXCLUDED.authority_id
            OR live_session_command_leases.expires_at <= ${input.now}::timestamptz
          RETURNING session_id
        `.execute(trx)
        return claimed.rows.length === 1
      })
    },

    renew(input: LeaseMutationInput): Promise<boolean> {
      return withTransaction(db, async (trx) => {
        const session = await sql<{ status: string }>`
          SELECT status
          FROM public.campaign_sessions
          WHERE id = ${input.sessionId}
          FOR UPDATE
        `.execute(trx)
        if (session.rows[0]?.status !== 'OPEN') return false

        const renewed = await sql<{ session_id: string }>`
          UPDATE public.live_session_command_leases
          SET
            expires_at = ${input.expiresAt}::timestamptz,
            updated_at = ${input.now}::timestamptz
          WHERE
            session_id = ${input.sessionId}
            AND authority_id = ${input.authorityId}
            AND expires_at > ${input.now}::timestamptz
          RETURNING session_id
        `.execute(trx)
        return renewed.rows.length === 1
      })
    },

    release(identity: LiveSessionCommandLeaseIdentity): Promise<void> {
      return withTransaction(db, async (trx) => {
        await sql`
          SELECT id
          FROM public.campaign_sessions
          WHERE id = ${identity.sessionId}
          FOR UPDATE
        `.execute(trx)
        await sql`
          DELETE FROM public.live_session_command_leases
          WHERE session_id = ${identity.sessionId}
            AND authority_id = ${identity.authorityId}
        `.execute(trx)
      })
    },

    async lockForSession(
      sessionId: string,
      now: string
    ): Promise<LockedLiveSessionCommandLease | null> {
      const result = await sql<{ session_id: string; authority_id: string | null }>`
        SELECT
          sessions.id AS session_id,
          leases.authority_id
        FROM public.campaign_sessions AS sessions
        LEFT JOIN public.live_session_command_leases AS leases
          ON leases.session_id = sessions.id
          AND leases.expires_at > ${now}::timestamptz
        WHERE sessions.id = ${sessionId}
        FOR SHARE OF sessions
      `.execute(db)
      const row = result.rows[0]
      return row ? { sessionId: row.session_id, authorityId: row.authority_id } : null
    },

    async lockForCharacter(
      characterId: string,
      now: string
    ): Promise<LockedLiveSessionCommandLease[]> {
      const result = await sql<{ session_id: string; authority_id: string | null }>`
        SELECT
          sessions.id AS session_id,
          leases.authority_id
        FROM public.campaign_session_attendance AS attendance
        INNER JOIN public.campaign_sessions AS sessions
          ON sessions.id = attendance.session_id
          AND sessions.status = 'OPEN'
        LEFT JOIN public.live_session_command_leases AS leases
          ON leases.session_id = sessions.id
          AND leases.expires_at > ${now}::timestamptz
        WHERE attendance.character_id = ${characterId}
          AND attendance.present = true
        ORDER BY sessions.id ASC
        FOR SHARE OF sessions
      `.execute(db)
      return result.rows.map((row) => ({
        sessionId: row.session_id,
        authorityId: row.authority_id
      }))
    }
  }
}
