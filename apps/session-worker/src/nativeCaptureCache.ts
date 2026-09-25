import type { LiveSessionCharacterRulesResponse } from '@artificer-toolkit/schema/api/liveSessionCharacterRules'
import type {
  LiveSessionEncounterRulesInput,
  LiveSessionEncounterRulesResponse
} from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type { LiveSessionRulesRevisions } from '@artificer-toolkit/schema/api/liveSessionRulesRevisions'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'

import { callLiveSessionRoute, type NativeLiveSessionEnvironment } from './liveSessionRoutes.js'
import { ROOM_LIMITS } from './roomLimits.js'

/** A rules capture whose result depends only on content fenced by the SYSTEM and CAMPAIGN revisions. */
export type CachedRulesCapture =
  | { route: 'characterRules'; response: LiveSessionCharacterRulesResponse }
  | { route: 'encounterRules'; response: LiveSessionEncounterRulesResponse }

/** One command's reads through the room cache. */
export interface LiveCaptureReads {
  read(key: string): CachedRulesCapture | undefined
  write(key: string, capture: CachedRulesCapture): void
}

/**
 * The room's cache of System-level rules captures (definitions, vocabulary, Character sources).
 * Entries are keyed by their SYSTEM and CAMPAIGN revisions, so a revision bump misses; volatile
 * reads (Encounter state, actors, Character inputs) never enter it. Commit fences stay authoritative.
 */
export class LiveCaptureCache {
  readonly #entries = new Map<
    string,
    { capture: CachedRulesCapture; bytes: number; expiresAt: number }
  >()
  #bytes = 0

  get size(): number {
    return this.#entries.size
  }

  clear(): void {
    this.#entries.clear()
    this.#bytes = 0
  }

  /** A command's view; `dropReused` forgets exactly the entries that command reused. */
  reads(): LiveCaptureReads & { dropReused(): boolean } {
    const reused = new Set<string>()
    return {
      read: (key) => {
        const entry = this.#entries.get(key)
        if (!entry) return undefined
        this.#delete(key)
        if (entry.expiresAt <= Date.now()) return undefined
        // Reinsert as most recently used; callers get a copy they may mutate.
        this.#entries.set(key, entry)
        this.#bytes += entry.bytes
        reused.add(key)
        return structuredClone(entry.capture)
      },
      write: (key, capture) => {
        const bytes = JSON.stringify(capture.response).length
        if (bytes > ROOM_LIMITS.captureCacheMaxBytes) return
        const now = Date.now()
        this.#delete(key)
        this.#entries.set(key, {
          capture: structuredClone(capture),
          bytes,
          expiresAt: now + ROOM_LIMITS.captureCacheTtlMs
        })
        this.#bytes += bytes
        for (const [candidate, entry] of this.#entries)
          if (entry.expiresAt <= now) this.#delete(candidate)
        for (const candidate of this.#entries.keys()) {
          if (
            this.#entries.size <= ROOM_LIMITS.captureCacheMaxEntries &&
            this.#bytes <= ROOM_LIMITS.captureCacheMaxBytes
          )
            break
          this.#delete(candidate)
        }
      },
      dropReused: () => {
        for (const key of reused) this.#delete(key)
        return reused.size > 0
      }
    }
  }

  #delete(key: string): void {
    const entry = this.#entries.get(key)
    if (!entry) return
    this.#entries.delete(key)
    this.#bytes -= entry.bytes
  }
}

/** The observations a cached read is keyed on and contributes to a plan's commit fence. */
export function captureStamps(revisions: LiveSessionRulesRevisions): LiveSessionRulesRevisions {
  return revisions
    .filter((observation) => observation.scope === 'SYSTEM' || observation.scope === 'CAMPAIGN')
    .sort((left, right) => left.scope.localeCompare(right.scope))
}

/** Null until both stamps are observed, so the first read of a plan always goes to Convex. */
export function captureCacheKey(
  route: CachedRulesCapture['route'],
  scope: Record<string, string>,
  request: unknown,
  revisions: LiveSessionRulesRevisions
): string | null {
  const stamps = captureStamps(revisions)
  return stamps.length === 2 ? checksumCanonicalJson({ route, scope, request, stamps }) : null
}

/**
 * Reads one Encounter rules capture. Definitions and the System vocabulary are read as the Campaign
 * owner, so they go through the room cache; everything else is read fresh. Returns the observations
 * to merge: a cached read keeps its original response and contributes only its stamps.
 */
export async function captureEncounterRules(
  environment: NativeLiveSessionEnvironment,
  accessToken: string,
  input: LiveSessionEncounterRulesInput,
  observed: LiveSessionRulesRevisions,
  captures: LiveCaptureReads | undefined
): Promise<{ response: LiveSessionEncounterRulesResponse; revisions: LiveSessionRulesRevisions }> {
  const cacheable =
    input.request.kind === 'DEFINITION' || input.request.kind === 'SYSTEM_VOCABULARY'
  const scope = { campaignId: input.campaignId }
  const key = cacheable ? captureCacheKey('encounterRules', scope, input.request, observed) : null
  const cached = key ? captures?.read(key) : undefined
  if (cached?.route === 'encounterRules')
    return { response: cached.response, revisions: captureStamps(cached.response.revisions) }
  const response = await callLiveSessionRoute(environment, accessToken, 'encounterRules', input)
  const written = cacheable
    ? captureCacheKey('encounterRules', scope, input.request, response.revisions)
    : null
  if (written) captures?.write(written, { route: 'encounterRules', response })
  return { response, revisions: response.revisions }
}
