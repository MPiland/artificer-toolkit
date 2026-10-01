import assert from 'node:assert/strict'
import type { Page } from '@playwright/test'
import { api } from '@artificer-toolkit/apis/convex/api'
import type { CharacterDraftListPage } from '@artificer-toolkit/schema/api/characterDrafts'
import type { CharacterListPage } from '@artificer-toolkit/schema/api/characterList'
import { ConvexHttpClient } from 'convex/browser'
import { developmentCli } from '../../../../../apis/tests/developmentCli'
import { developmentTarget } from '../../../../../apis/tests/developmentTarget'

export type E2ECharacterCleanup = {
  captureRoute(page: Page): void
  trackLabel(label: string): void
}

type TrackedCharacter = {
  label: string
  publicId?: string
}

type FixtureCharacter = {
  id: string
  label: string
  publicId: string
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
      const email = process.env.MVP_AUDIT_EMAIL?.trim().toLowerCase()
      assert.match(email ?? '', /^draft_[0-9a-f]{12}@example\.invalid$/)
      const session = requireEnvironment('CONVEX_E2E_SESSION')
      const userId = requireEnvironment('CONVEX_E2E_USER_ID')
      const targetEnvironment = developmentTarget(process.env)
      const token = await fetchConvexToken(targetEnvironment.siteUrl, session)
      const client = new ConvexHttpClient(targetEnvironment.deploymentUrl.origin, { logger: false })
      client.setAuth(token)
      const identity = await client.query(api.account.identity, {})
      assert.equal(identity.userId, userId, 'Cleanup session must belong to the fixture account.')

      const characters = await readFixtureCharacters(client)
      const matches = [...characters.values()].filter((character) =>
        target.publicId ? character.publicId === target.publicId : character.label === target.label
      )
      assert.ok(matches.length <= 1, 'Exact E2E Character identity is ambiguous.')
      const [found] = matches
      if (!found) {
        await assertCharacterAbsent(client, target)
        console.info(
          '[e2e-character-cleanup]',
          JSON.stringify({ cleanup: 'ABSENT', label: target.label, native: true })
        )
        return
      }
      await developmentCli(
        'characters/development:removePersonalFixtureCharacter',
        { userId, characterId: found.id },
        false
      )
      await assertCharacterAbsent(client, target)
      console.info(
        '[e2e-character-cleanup]',
        JSON.stringify({
          cleanup: 'PASS',
          label: target.label,
          native: true,
          publicId: found.publicId
        })
      )
    }
  }
}

async function fetchConvexToken(siteUrl: URL, session: string): Promise<string> {
  const response = await fetch(new URL('/api/auth/convex/token', siteUrl), {
    headers: { Authorization: `Bearer ${session}`, Origin: 'http://localhost:3000' },
    signal: AbortSignal.timeout(30_000)
  })
  assert.equal(response.status, 200, 'Fixture session could not refresh its Convex token.')
  const body: unknown = await response.json()
  assert.ok(body && typeof body === 'object' && 'token' in body && typeof body.token === 'string')
  return body.token
}

async function readFixtureCharacters(
  client: ConvexHttpClient
): Promise<Map<string, FixtureCharacter>> {
  const characters = new Map<string, FixtureCharacter>()
  let cursor: string | null = null
  while (true) {
    const active: CharacterListPage = await client.query(api.characters.list.list, {
      paginationOpts: { cursor, numItems: 8 }
    })
    for (const character of active.page) {
      const existing = characters.get(character.id)
      if (existing) {
        assert.equal(existing.label, character.label)
        assert.equal(existing.publicId, character.publicId)
      }
      characters.set(character.id, character)
    }
    if (active.isDone) break
    cursor = active.continueCursor
  }

  cursor = null
  while (true) {
    const drafts: CharacterDraftListPage = await client.query(api.characters.drafts.list, {
      paginationOpts: { cursor, numItems: 8 }
    })
    for (const draft of drafts.page) {
      const existing = characters.get(draft.characterId)
      if (existing) {
        assert.equal(existing.label, draft.label)
        assert.equal(existing.publicId, draft.publicId)
      }
      characters.set(draft.characterId, {
        id: draft.characterId,
        label: draft.label,
        publicId: draft.publicId
      })
    }
    if (drafts.isDone) break
    cursor = drafts.continueCursor
  }
  return characters
}

async function assertCharacterAbsent(
  client: ConvexHttpClient,
  target: TrackedCharacter
): Promise<void> {
  const characters = await readFixtureCharacters(client)
  assert.ok(
    ![...characters.values()].some(
      (character) =>
        (target.publicId ? character.publicId === target.publicId : false) ||
        character.label === target.label
    ),
    'Tracked Character remains after native cleanup.'
  )
}

function requireEnvironment(name: 'CONVEX_E2E_SESSION' | 'CONVEX_E2E_USER_ID'): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required for native E2E cleanup.`)
  return value
}
