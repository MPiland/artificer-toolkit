import {
  liveSessionCharacterRulesInputSchema,
  type LiveSessionCharacterRulesResponse
} from '@artificer-toolkit/schema/api/liveSessionCharacterRules'
import {
  isLiveSessionCaptureBundleAdmission,
  liveSessionCharacterRulesScope
} from '@artificer-toolkit/schema/api/liveSessionEncounterCaptureBundle'
import {
  liveSessionEncounterRulesInputSchema,
  type LiveSessionEncounterRulesInput,
  type LiveSessionEncounterRulesRequest,
  type LiveSessionEncounterRulesResponse
} from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import { DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID } from '@artificer-toolkit/rules-runtime/systems/dnd5e/concentrationIdentity'
import type { LiveSessionRulesRevisions } from '@artificer-toolkit/schema/api/liveSessionRulesRevisions'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'

import { callLiveSessionRoute, type NativeLiveSessionEnvironment } from './liveSessionRoutes.js'
import { ROOM_LIMITS } from './roomLimits.js'

/** One rules capture response, tagged with its route. */
export type LiveRulesCapture =
  | { route: 'characterRules'; response: LiveSessionCharacterRulesResponse }
  | { route: 'encounterRules'; response: LiveSessionEncounterRulesResponse }

/**
 * One command's reads: System-level captures through the room cache, and the volatile reads its
 * capture bundle already made, each taken once.
 */
export interface LiveCaptureReads {
  read(key: string): LiveRulesCapture | undefined
  write(key: string, capture: LiveRulesCapture): void
  bundle(key: string, capture: LiveRulesCapture): void
  takeBundled(key: string): LiveRulesCapture | undefined
}

/**
 * The room's cache of System-level rules captures (definitions, vocabulary, Character sources).
 * Entries are keyed by their SYSTEM and CAMPAIGN revisions, so a revision bump misses; volatile
 * reads (Encounter state, actors, Character inputs) never enter it. Commit fences stay authoritative.
 */
export class LiveCaptureCache {
  readonly #entries = new Map<
    string,
    { capture: LiveRulesCapture; bytes: number; expiresAt: number }
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
    const bundled = new Map<string, LiveRulesCapture>()
    return {
      bundle: (key, capture) => {
        bundled.set(key, capture)
      },
      takeBundled: (key) => {
        const capture = bundled.get(key)
        bundled.delete(key)
        return capture
      },
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
  route: LiveRulesCapture['route'],
  scope: Record<string, string>,
  request: unknown,
  revisions: LiveSessionRulesRevisions
): string | null {
  const stamps = captureStamps(revisions)
  return stamps.length === 2 ? checksumCanonicalJson({ route, scope, request, stamps }) : null
}

/** Identifies a volatile read by its route and complete input, so only the same read takes it. */
export function bundledCaptureKey(route: LiveRulesCapture['route'], input: unknown): string {
  return checksumCanonicalJson({ route, input })
}

/**
 * Reads one Encounter rules capture. A command admission read by the room fetches the command's
 * whole capture bundle (D32) and later reads take their part from it. Definitions and the System
 * vocabulary are read as the Campaign owner, so they go through the room cache. Returns the
 * observations to merge: a cached read keeps its original response and contributes only its stamps.
 */
export async function captureEncounterRules(
  environment: NativeLiveSessionEnvironment,
  accessToken: string,
  input: LiveSessionEncounterRulesInput,
  observed: LiveSessionRulesRevisions,
  captures: LiveCaptureReads | undefined
): Promise<{ response: LiveSessionEncounterRulesResponse; revisions: LiveSessionRulesRevisions }> {
  const key = bundledCaptureKey('encounterRules', input)
  if (captures && isLiveSessionCaptureBundleAdmission(input.request))
    await captureBundle(environment, accessToken, input, captures)
  const bundled = captures?.takeBundled(key)
  if (bundled?.route === 'encounterRules')
    return { response: bundled.response, revisions: bundled.response.revisions }
  const cacheable =
    input.request.kind === 'DEFINITION' || input.request.kind === 'SYSTEM_VOCABULARY'
  const scope = { campaignId: input.campaignId }
  const cacheKey = cacheable
    ? captureCacheKey('encounterRules', scope, input.request, observed)
    : null
  const cached = cacheKey ? captures?.read(cacheKey) : undefined
  if (cached?.route === 'encounterRules')
    return { response: cached.response, revisions: captureStamps(cached.response.revisions) }
  const response = await callLiveSessionRoute(environment, accessToken, 'encounterRules', input)
  const written = cacheable
    ? captureCacheKey('encounterRules', scope, input.request, response.revisions)
    : null
  if (written) captures?.write(written, { route: 'encounterRules', response })
  return { response, revisions: response.revisions }
}

async function captureBundle(
  environment: NativeLiveSessionEnvironment,
  accessToken: string,
  admission: LiveSessionEncounterRulesInput,
  captures: LiveCaptureReads
): Promise<void> {
  const bundle = await callLiveSessionRoute(environment, accessToken, 'encounterBundle', {
    ...admission,
    // Concentration checks read each damaged actor's Concentration slot.
    maintenanceDefinitionIds: [DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID]
  })
  // The Run's System travels once; its INPUTS responses get it back.
  const { system, inputs } = bundle
  const parts: Array<{
    request: LiveSessionEncounterRulesRequest
    response: LiveSessionEncounterRulesResponse
  }> = [...bundle.encounter]
  if (inputs && system) parts.push({ request: { kind: 'INPUTS' }, response: { ...inputs, system } })
  for (const { request, response } of parts) {
    const input = liveSessionEncounterRulesInputSchema.parse({ ...admission, request })
    captures.bundle(bundledCaptureKey('encounterRules', input), {
      route: 'encounterRules',
      response
    })
  }
  for (const { actorId, response: characterInputs } of bundle.characters) {
    if (!system) throw new Error('Bundled Character inputs are unavailable.')
    const response = { ...characterInputs, system }
    const input = liveSessionCharacterRulesInputSchema.parse({
      ...liveSessionCharacterRulesScope(admission, {
        id: actorId,
        sourceId: response.character.id
      }),
      request: { kind: 'INPUTS' }
    })
    captures.bundle(bundledCaptureKey('characterRules', input), {
      route: 'characterRules',
      response
    })
  }
}
