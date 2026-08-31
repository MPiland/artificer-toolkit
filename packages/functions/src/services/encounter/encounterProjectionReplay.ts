import {
  canonicalizeJson,
  checksumEncounterCurrentProjection,
  checksumLegacyEncounterCurrentProjectionV1,
  type EncounterEventRecord
} from '@artificer-toolkit/db'
import {
  encounterProjectionEventSchema,
  assertEncounterProjectionBlueprintHeader,
  encounterProjectionBlueprintHeaderSchema,
  legacyEncounterProjectionEventV1Schema,
  upgradeLegacyEncounterProjectionEventV1,
  type EncounterProjectionBlueprintHeader,
  type EncounterCurrentProjection,
  type EncounterProjectionEvent
} from '@artificer-toolkit/schema/projections/encounter'

import { EncounterConflictError } from './encounterErrors.js'

function requireValidProjectedResult(
  result: EncounterProjectionEvent,
  header?: EncounterProjectionBlueprintHeader
): EncounterProjectionEvent {
  if (
    checksumEncounterCurrentProjection(result.currentProjection) !==
      result.currentProjection.projectionChecksum ||
    canonicalizeJson(result.command.projection) !==
      canonicalizeJson(result.currentProjection.projection)
  ) {
    throw new EncounterConflictError('Encounter event has an invalid projected result.')
  }
  if (!header) return result
  try {
    assertEncounterProjectionBlueprintHeader({ header, projection: result.currentProjection })
  } catch {
    throw new EncounterConflictError('Encounter event has an invalid projected result.')
  }
  return result
}

export function parseEncounterProjectionEvent(
  resultPayload: unknown,
  header?: EncounterProjectionBlueprintHeader
) {
  const current = encounterProjectionEventSchema.safeParse(resultPayload)
  if (current.success) {
    return requireValidProjectedResult(current.data, header)
  }
  if (!header) throw new EncounterConflictError('Encounter event has an invalid projected result.')

  const legacy = legacyEncounterProjectionEventV1Schema.safeParse(resultPayload)
  if (
    !legacy.success ||
    checksumLegacyEncounterCurrentProjectionV1(legacy.data.currentProjection) !==
      legacy.data.currentProjection.projectionChecksum
  ) {
    throw new EncounterConflictError('Encounter event has an invalid projected result.')
  }
  let upgraded
  try {
    upgraded = upgradeLegacyEncounterProjectionEventV1({
      header: encounterProjectionBlueprintHeaderSchema.parse(header),
      event: legacy.data
    })
  } catch {
    throw new EncounterConflictError('Encounter event has an invalid projected result.')
  }
  const currentProjection = {
    ...upgraded.currentProjection,
    projectionChecksum: checksumEncounterCurrentProjection(upgraded.currentProjection)
  }
  return requireValidProjectedResult(
    encounterProjectionEventSchema.parse({
      ...upgraded,
      currentProjection,
      ruleReceipt: upgraded.ruleReceipt ?? null
    }),
    header
  )
}

export function replayEncounterCurrentProjection(
  events: readonly EncounterEventRecord[],
  header?: EncounterProjectionBlueprintHeader
): EncounterCurrentProjection {
  if (events.length === 0) {
    throw new EncounterConflictError('Encounter has no event stream to rebuild its projection.')
  }

  let projection: EncounterCurrentProjection | null = null
  events.forEach((event, index) => {
    if (event.version !== index) {
      throw new EncounterConflictError('Encounter event stream is not contiguous.')
    }
    const result = parseEncounterProjectionEvent(event.resultPayload, header)
    if (
      result.currentProjection.streamVersion !== event.version ||
      canonicalizeJson(result.command.projection) !==
        canonicalizeJson(result.currentProjection.projection) ||
      checksumEncounterCurrentProjection(result.currentProjection) !==
        result.currentProjection.projectionChecksum
    ) {
      throw new EncounterConflictError('Encounter event has an invalid projected result.')
    }
    projection = result.currentProjection
  })
  if (!projection) throw new EncounterConflictError('Encounter event stream has no projection.')
  return projection
}

export function assertEncounterCurrentProjectionReplay(input: {
  events: readonly EncounterEventRecord[]
  projection: EncounterCurrentProjection
  header?: EncounterProjectionBlueprintHeader
}): EncounterCurrentProjection {
  const replayed = replayEncounterCurrentProjection(input.events, input.header)
  if (canonicalizeJson(replayed) !== canonicalizeJson(input.projection)) {
    throw new EncounterConflictError('Encounter projection does not match its event replay.')
  }
  return replayed
}
