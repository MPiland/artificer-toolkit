import {
  canonicalizeJson,
  checksumEncounterCurrentProjection,
  type EncounterEventRecord
} from '@artificer-toolkit/db'
import {
  encounterProjectionEventSchema,
  type EncounterCurrentProjection
} from '@artificer-toolkit/schema/projections/encounter'

import { EncounterConflictError } from './encounterErrors.js'

export function replayEncounterCurrentProjection(
  events: readonly EncounterEventRecord[]
): EncounterCurrentProjection {
  if (events.length === 0) {
    throw new EncounterConflictError('Encounter has no event stream to rebuild its projection.')
  }

  let projection: EncounterCurrentProjection | null = null
  events.forEach((event, index) => {
    if (event.version !== index) {
      throw new EncounterConflictError('Encounter event stream is not contiguous.')
    }
    const result = encounterProjectionEventSchema.safeParse(event.resultPayload)
    if (
      !result.success ||
      result.data.currentProjection.streamVersion !== event.version ||
      canonicalizeJson(result.data.command.projection) !==
        canonicalizeJson(result.data.currentProjection.projection) ||
      checksumEncounterCurrentProjection(result.data.currentProjection) !==
        result.data.currentProjection.projectionChecksum
    ) {
      throw new EncounterConflictError('Encounter event has an invalid projected result.')
    }
    projection = result.data.currentProjection
  })
  if (!projection) throw new EncounterConflictError('Encounter event stream has no projection.')
  return projection
}

export function assertEncounterCurrentProjectionReplay(input: {
  events: readonly EncounterEventRecord[]
  projection: EncounterCurrentProjection
}): EncounterCurrentProjection {
  const replayed = replayEncounterCurrentProjection(input.events)
  if (canonicalizeJson(replayed) !== canonicalizeJson(input.projection)) {
    throw new EncounterConflictError('Encounter projection does not match its event replay.')
  }
  return replayed
}
