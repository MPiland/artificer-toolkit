import type { LiveSessionCharacterRulesInput } from '@artificer-toolkit/schema/api/liveSessionCharacterRules'
import {
  liveSessionEncounterRulesInputSchema,
  type LiveSessionEncounterRulesInput,
  type LiveSessionEncounterRulesRequest,
  type LiveSessionEncounterRulesResponse
} from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type { LiveSessionRulesRevisions } from '@artificer-toolkit/schema/api/liveSessionRulesRevisions'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'

import { mergeNativeRulesRevisions } from './nativeRulesRevisions.js'
import type { PreparedLiveCharacterSheet } from './nativeCharacterRules.js'

/** The planner contracts the room answers from its own SQLite transaction. */
export interface LiveCaptureReads {
  encounterRules(input: LiveSessionEncounterRulesInput): Promise<LiveSessionEncounterRulesResponse>
  prepareCharacter(scope: LiveSessionCharacterRulesInput): Promise<PreparedLiveCharacterSheet>
}

/**
 * One planner's Encounter captures under its admitted scope `initial`. Identical requests share
 * one read, each response must answer its request's kind, and the observed revisions and read
 * checksums accumulate for the commit fence.
 */
export function liveEncounterCaptures(
  initial: LiveSessionEncounterRulesInput,
  captures: LiveCaptureReads
) {
  let revisions: LiveSessionRulesRevisions = []
  const dependencies: Array<{ request: LiveSessionEncounterRulesRequest }> = []
  const reads = new Map<string, Promise<LiveSessionEncounterRulesResponse>>()
  function capture<R extends LiveSessionEncounterRulesRequest>(
    request: R
  ): Promise<Extract<LiveSessionEncounterRulesResponse, { kind: R['kind'] }>> {
    const key = checksumCanonicalJson(request)
    let read = reads.get(key)
    if (!read) {
      read = (async () => {
        const input = liveSessionEncounterRulesInputSchema.parse({ ...initial, request })
        const response = await captures.encounterRules(input)
        if (response.kind !== request.kind) throw new Error('Encounter capture kind mismatch.')
        revisions = mergeNativeRulesRevisions(revisions, response.revisions)
        dependencies.push({ request: input.request })
        return response
      })()
      reads.set(key, read)
    }
    // The kind check above narrows every stored read to its request's response.
    return read as Promise<Extract<LiveSessionEncounterRulesResponse, { kind: R['kind'] }>>
  }
  return {
    capture,
    dependencies,
    revisions: () => revisions,
    /** Adds observations a planner read through the Character preparation. */
    observe(observed: LiveSessionRulesRevisions) {
      revisions = mergeNativeRulesRevisions(revisions, observed)
    }
  }
}
