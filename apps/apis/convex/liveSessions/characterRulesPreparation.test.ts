import { afterEach, expect, it, vi } from 'vitest'
import { liveSessionCharacterRulesInputSchema } from '@artificer-toolkit/schema/api/liveSessionCharacterRules'
import { prepareNativeLiveCharacterSheet } from '../../../session-worker/src/nativeCharacterRules'
import { setupCharacterRun } from '../../tests/fixtures/encounterCharacter'
import { loadCharacterSheetFacts } from '../characters/sheetFacts'
import { readCharacterRulesCapture } from './characterRulesCapture'
import { withSceneVisionTracking } from '../lib/mutations'
import {
  insertActiveLiveAuthority,
  stubLiveSessionFetch,
  workerEnvironment
} from '../../tests/fixtures/liveSessionWorker'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

it('prepares the same Character facts in the Worker through authenticated capture HTTP', async () => {
  const fixture = await setupCharacterRun()
  const authorityEpoch = crypto.randomUUID()
  await fixture.t.run((ctx) =>
    insertActiveLiveAuthority(ctx, {
      campaignId: fixture.campaign.id,
      epoch: authorityEpoch,
      createdAt: fixture.campaign.createdAt
    })
  )
  const scope = {
    campaignId: fixture.campaign.id,
    authorityEpoch,
    expectedUserId: fixture.owner.userId,
    expectedRole: 'OWNER' as const,
    characterId: fixture.character.id,
    expectedStreamVersion: fixture.actorSourceRevision
  }
  const secret = 'private-character-rules-test-secret-at-least-32-bytes'
  vi.stubEnv('LIVE_SESSION_WORKER_SECRET', secret)
  const path = '/live-sessions/character-rules'
  const input = { ...scope, request: { kind: 'INPUTS' } }
  const request = { body: JSON.stringify(input), method: 'POST' }
  const missingSecret = await fixture.owner.caller.fetch(path, request)
  expect(missingSecret.status).toBe(401)
  const missingIdentity = await fixture.t.fetch(path, {
    ...request,
    headers: { 'x-artificer-live-session-secret': secret }
  })
  expect(missingIdentity.status).toBe(401)
  expect(missingIdentity.headers.get('Cache-Control')).toBe('no-store')

  const requests: ReturnType<typeof liveSessionCharacterRulesInputSchema.parse>[] = []
  stubLiveSessionFetch(async (pathname, init) => {
    expect(pathname).toBe(path)
    const headers = new Headers(init?.headers)
    expect(headers.get('authorization')).toBe('Bearer fixture-access-token')
    expect(headers.get('x-artificer-live-session-secret')).toBe(secret)
    if (typeof init?.body !== 'string') throw new Error('Missing capture body.')
    requests.push(liveSessionCharacterRulesInputSchema.parse(JSON.parse(init.body)))
    return fixture.owner.caller.fetch(pathname, init)
  })
  const actual = await prepareNativeLiveCharacterSheet(
    workerEnvironment(secret),
    'fixture-access-token',
    scope
  )
  expect(actual.campaignContext.viewer).toBe('CAMPAIGN_OWNER')
  expect(requests.map((read) => read.request.kind)).toEqual(['INPUTS', 'PUBLICATIONS'])
  expect(actual.dependencies.map((dependency) => dependency.request)).toEqual(
    requests.map((read) => read.request)
  )
  await fixture.owner.caller.run(async (ctx) => {
    const expected = await loadCharacterSheetFacts(
      ctx,
      fixture.owner.userId,
      fixture.character.id,
      fixture.campaign.id
    )
    if (!expected) throw new Error('Missing Character facts.')
    expect(actual.prepared.character).toEqual(expected.prepared.character)
    expect(actual.prepared.resolution).toEqual(expected.prepared.resolution)
    expect(actual.ruleEvaluation).toEqual(expected.ruleEvaluation)
    expect(actual.adjustments).toEqual(expected.adjustments)
    expect(actual.sheetState).toEqual(expected.sheetState)
    for (const dependency of actual.dependencies) {
      const current = await readCharacterRulesCapture(ctx, {
        ...scope,
        request: dependency.request
      })
      expect(current.readChecksum).toBe(dependency.readChecksum)
    }
  })

  // A later source page must not combine a changed Campaign with the old Sheet inputs.
  stubLiveSessionFetch(async (pathname, init) => {
    const response = await fixture.owner.caller.fetch(pathname, init)
    if (typeof init?.body !== 'string') throw new Error('Missing capture body.')
    const input = liveSessionCharacterRulesInputSchema.parse(JSON.parse(init.body))
    if (input.request.kind === 'INPUTS') {
      await fixture.t.run(async (rawCtx) => {
        const ctx = withSceneVisionTracking(rawCtx)
        const row = await ctx.db
          .query('campaigns')
          .withIndex('by_publicId', (q) => q.eq('id', fixture.campaign.id))
          .unique()
        if (!row) throw new Error('Missing Campaign.')
        await ctx.db.patch(row._id, { attunementSlotOverride: 4 })
      })
    }
    return response
  })
  await expect(
    prepareNativeLiveCharacterSheet(workerEnvironment(secret), 'fixture-access-token', scope)
  ).rejects.toThrow(/revision|changed/i)
})
