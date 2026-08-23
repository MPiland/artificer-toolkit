import assert from 'node:assert/strict'
import type { Page } from '@playwright/test'
import { createCharacterRepository, createDb } from '@artificer-toolkit/db'
import { getSupabaseAdminClient } from '../../../../src/supabase/admin.server'

const loopbackHosts = new Set(['127.0.0.1', 'localhost', '::1'])

export type E2ECharacterCleanup = {
  captureRoute(page: Page): void
  trackLabel(label: string): void
}

type TrackedCharacter = {
  label: string
  publicId?: string
}

export function createE2ECharacterCleanup(): {
  cleanup: () => Promise<void>
  tracker: E2ECharacterCleanup
} {
  let tracked: TrackedCharacter | undefined

  return {
    tracker: {
      captureRoute(page) {
        if (!tracked) throw new Error('Track the Character label before capturing its route.')
        const match = /^\/characters\/([^/]+)\//.exec(new URL(page.url()).pathname)
        if (!match?.[1] || match[1] === 'new') {
          throw new Error('Expected an exact persisted Character route before cleanup tracking.')
        }
        if (tracked.publicId && tracked.publicId !== match[1]) {
          throw new Error('Character journey changed route identity unexpectedly.')
        }
        tracked.publicId = match[1]
      },
      trackLabel(label) {
        if (tracked) throw new Error('Only one Character may be tracked per E2E journey.')
        tracked = { label }
      }
    },
    async cleanup() {
      const target = tracked
      if (!target) return
      const databaseUrl = requireLoopbackUrl('DATABASE_CONNECTION_STRING')
      requireLoopbackUrl('SUPABASE_URL')
      const expectedEmail = process.env.MVP_AUDIT_EMAIL?.trim().toLowerCase()
      if (!expectedEmail) throw new Error('MVP_AUDIT_EMAIL is required for exact E2E cleanup.')

      const db = createDb({ connectionString: databaseUrl.toString() })
      try {
        const deleted = await db.transaction().execute(async (trx) => {
          const characters = await trx
            .selectFrom('characters')
            .select(['id', 'label', 'status', 'stream_version', 'user_id'])
            .where('label', '=', target.label)
            .forUpdate()
            .execute()
          assert.ok(characters.length <= 1, 'Exact E2E Character label is ambiguous.')
          const character = characters[0]
          if (!character) return null

          const { data, error } = await getSupabaseAdminClient().auth.admin.getUserById(
            character.user_id
          )
          if (error) throw error
          assert.equal(data.user.email?.toLowerCase(), expectedEmail)

          const routes = await trx
            .selectFrom('authored_route_ids')
            .select(['subject_kind', 'subject_id', 'public_id'])
            .where('subject_kind', '=', 'CHARACTER')
            .where('subject_id', '=', character.id)
            .forUpdate()
            .execute()
          assert.equal(routes.length, 1, 'Persisted E2E Character must have one exact route.')
          const route = routes[0]!
          if (target.publicId) assert.equal(route.public_id, target.publicId)

          const deletedCharacter = await trx
            .deleteFrom('characters')
            .where('id', '=', character.id)
            .returning('id')
            .execute()
          assert.deepEqual(deletedCharacter, [{ id: character.id }])
          const deletedRoute = await trx
            .deleteFrom('authored_route_ids')
            .where('subject_kind', '=', 'CHARACTER')
            .where('subject_id', '=', character.id)
            .where('public_id', '=', route.public_id)
            .returning(['subject_id', 'public_id'])
            .execute()
          assert.deepEqual(deletedRoute, [{ public_id: route.public_id, subject_id: character.id }])

          return { characterId: character.id, publicId: route.public_id }
        })

        if (!deleted) {
          if (target.publicId) {
            const route = await db
              .selectFrom('authored_route_ids')
              .select('subject_id')
              .where('subject_kind', '=', 'CHARACTER')
              .where('public_id', '=', target.publicId)
              .execute()
            assert.equal(route.length, 0)
          }
          console.info(
            '[e2e-character-cleanup]',
            JSON.stringify({ cleanup: 'ABSENT', label: target.label, localOnly: true })
          )
          return
        }

        assert.equal(await createCharacterRepository(db).findById(deleted.characterId), null)
        const characterRows = await db
          .selectFrom('characters')
          .select('id')
          .where('id', '=', deleted.characterId)
          .execute()
        const routeRows = await db
          .selectFrom('authored_route_ids')
          .select('subject_id')
          .where('subject_kind', '=', 'CHARACTER')
          .where((expression) =>
            expression.or([
              expression('subject_id', '=', deleted.characterId),
              expression('public_id', '=', deleted.publicId)
            ])
          )
          .execute()
        assert.equal(characterRows.length, 0)
        assert.equal(routeRows.length, 0)
        console.info(
          '[e2e-character-cleanup]',
          JSON.stringify({ cleanup: 'PASS', localOnly: true, ...deleted })
        )
      } finally {
        await db.destroy()
      }
    }
  }
}

function requireLoopbackUrl(name: string): URL {
  const rawValue = process.env[name]?.trim()
  if (!rawValue) throw new Error(`${name} is required for exact E2E cleanup.`)
  const value = new URL(rawValue)
  if (!loopbackHosts.has(value.hostname.toLowerCase())) {
    throw new Error(`${name} must target loopback for exact E2E cleanup.`)
  }
  return value
}
