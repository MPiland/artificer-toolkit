import { afterEach, describe, expect, it, vi } from 'vitest'
import type { LiveSessionEncounterRulesInput } from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type { LiveSessionRulesRevisions } from '@artificer-toolkit/schema/api/liveSessionRulesRevisions'
import {
  captureCacheKey,
  captureEncounterRules,
  captureStamps,
  LiveCaptureCache,
  type CachedRulesCapture
} from './nativeCaptureCache.js'
import { ROOM_LIMITS } from './roomLimits.js'

const systemId = '00000000-0000-4000-8000-000000000001'
const campaignId = '00000000-0000-4000-8000-000000000002'
const characterId = '00000000-0000-4000-8000-000000000003'
const definitionId = '00000000-0000-4000-8000-000000000004'
const revision = (index: number) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`
const readChecksum = 'a'.repeat(64)

function revisions(stamps: {
  system?: number
  campaign?: number
  play?: number
  character?: number
}) {
  return [
    { scope: 'SYSTEM', id: systemId, revision: revision(stamps.system ?? 10) },
    { scope: 'CAMPAIGN', id: campaignId, revision: revision(stamps.campaign ?? 20) },
    { scope: 'PLAY', id: campaignId, revision: revision(stamps.play ?? 30) },
    { scope: 'CHARACTER', id: characterId, revision: revision(stamps.character ?? 40) }
  ] satisfies LiveSessionRulesRevisions
}

function definition(observed: LiveSessionRulesRevisions): CachedRulesCapture {
  return {
    route: 'encounterRules',
    response: { kind: 'DEFINITION', definition: null, readChecksum, revisions: observed }
  }
}

const scope: Omit<LiveSessionEncounterRulesInput, 'request'> = {
  campaignId,
  authorityEpoch: revision(50),
  expectedUserId: revision(51),
  expectedRole: 'OWNER',
  encounterId: revision(52),
  expectedVersion: 3
}
const environment = {
  CONVEX_SITE_URL: 'https://convex.example.test',
  LIVE_SESSION_WORKER_SECRET: 'capture-cache-unit-test-secret-at-least-32-bytes'
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('room capture cache', () => {
  it('keys a read on its SYSTEM and CAMPAIGN stamps only', () => {
    const key = captureCacheKey(
      'encounterRules',
      { campaignId },
      { kind: 'SYSTEM_VOCABULARY' },
      revisions({})
    )
    expect(key).not.toBeNull()
    // Volatile play and Character revisions never change the key of a System-level read.
    expect(
      captureCacheKey(
        'encounterRules',
        { campaignId },
        { kind: 'SYSTEM_VOCABULARY' },
        revisions({ play: 31, character: 41 })
      )
    ).toBe(key)
    for (const bumped of [revisions({ system: 11 }), revisions({ campaign: 21 })])
      expect(
        captureCacheKey('encounterRules', { campaignId }, { kind: 'SYSTEM_VOCABULARY' }, bumped)
      ).not.toBe(key)
    expect(
      captureCacheKey(
        'characterRules',
        { campaignId },
        { kind: 'SYSTEM_VOCABULARY' },
        revisions({})
      )
    ).not.toBe(key)
    expect(
      captureCacheKey('encounterRules', { campaignId }, { kind: 'SYSTEM_VOCABULARY' }, [])
    ).toBeNull()
    expect(captureStamps(revisions({})).map(({ scope }) => scope)).toEqual(['CAMPAIGN', 'SYSTEM'])
  })

  it('serves a copy of a hit and forgets exactly the entries a command reused', () => {
    const cache = new LiveCaptureCache()
    const writer = cache.reads()
    writer.write('first', definition(revisions({})))
    writer.write('second', definition(revisions({})))
    expect(writer.dropReused()).toBe(false)

    const reader = cache.reads()
    const hit = reader.read('first')
    expect(hit).toEqual(definition(revisions({})))
    if (hit?.route !== 'encounterRules') throw new Error('Expected a cached Encounter read.')
    hit.response.revisions.length = 0
    expect(cache.reads().read('first')).toEqual(definition(revisions({})))
    expect(reader.read('missing')).toBeUndefined()
    expect(reader.dropReused()).toBe(true)
    expect(cache.reads().read('first')).toBeUndefined()
    expect(cache.reads().read('second')).toBeDefined()

    cache.clear()
    expect(cache.size).toBe(0)
    expect(cache.reads().read('second')).toBeUndefined()
  })

  it('bounds the cache by age, entry count and bytes', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-25T00:00:00.000Z'))
    const cache = new LiveCaptureCache()
    const reads = cache.reads()
    reads.write('aged', definition(revisions({})))
    vi.setSystemTime(Date.now() + ROOM_LIMITS.captureCacheTtlMs)
    expect(reads.read('aged')).toBeUndefined()
    expect(cache.size).toBe(0)

    for (let index = 0; index <= ROOM_LIMITS.captureCacheMaxEntries; index++)
      reads.write(`entry-${index}`, definition(revisions({})))
    expect(cache.size).toBe(ROOM_LIMITS.captureCacheMaxEntries)
    expect(reads.read('entry-0')).toBeUndefined()
    expect(reads.read(`entry-${ROOM_LIMITS.captureCacheMaxEntries}`)).toBeDefined()

    cache.clear()
    const large = (bytes: number): CachedRulesCapture => ({
      route: 'characterRules',
      response: {
        kind: 'PUBLICATIONS',
        readChecksum,
        revisions: revisions({}),
        continueAfter: null,
        publications: [
          {
            identity: {
              subjectId: definitionId,
              subjectKind: 'CLASS',
              systemId,
              contentSourceId: revision(60),
              versionId: revision(61),
              checksum: readChecksum
            },
            version: 1,
            documentJson: 'x'.repeat(bytes),
            campaignShared: false,
            campaignParentAllowed: true
          }
        ]
      }
    })
    reads.write('oversized', large(ROOM_LIMITS.captureCacheMaxBytes))
    expect(cache.size).toBe(0)
    const third = Math.floor(ROOM_LIMITS.captureCacheMaxBytes / 3)
    for (const key of ['a', 'b', 'c']) reads.write(key, large(third))
    expect(cache.size).toBe(2)
    expect(reads.read('a')).toBeUndefined()
  })

  it('reads only definitions and the System vocabulary through the cache', async () => {
    const calls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        const body = JSON.parse(String(init.body)) as LiveSessionEncounterRulesInput
        calls.push(body.request.kind)
        return Response.json(
          body.request.kind === 'DEFINITION'
            ? { kind: 'DEFINITION', definition: null, readChecksum, revisions: revisions({}) }
            : { kind: 'INITIATIVE_ROUND', state: null, readChecksum, revisions: revisions({}) }
        )
      })
    )
    const cache = new LiveCaptureCache()
    const observed = revisions({})
    const definitionInput = { ...scope, request: { kind: 'DEFINITION' as const, definitionId } }
    const roundInput = { ...scope, request: { kind: 'INITIATIVE_ROUND' as const } }

    const cold = await captureEncounterRules(
      environment,
      'token',
      definitionInput,
      observed,
      cache.reads()
    )
    expect(cold.revisions).toEqual(observed)
    const warm = await captureEncounterRules(
      environment,
      'token',
      definitionInput,
      observed,
      cache.reads()
    )
    expect(warm.response).toEqual(cold.response)
    // A cached read contributes only the stamps it is keyed on.
    expect(warm.revisions).toEqual(captureStamps(observed))
    await captureEncounterRules(environment, 'token', roundInput, observed, cache.reads())
    await captureEncounterRules(environment, 'token', roundInput, observed, cache.reads())
    // A bumped stamp misses; so does a plan that has not observed both stamps yet.
    await captureEncounterRules(
      environment,
      'token',
      definitionInput,
      revisions({ campaign: 21 }),
      cache.reads()
    )
    await captureEncounterRules(environment, 'token', definitionInput, [], cache.reads())
    expect(calls).toEqual([
      'DEFINITION',
      'INITIATIVE_ROUND',
      'INITIATIVE_ROUND',
      'DEFINITION',
      'DEFINITION'
    ])
  })
})
