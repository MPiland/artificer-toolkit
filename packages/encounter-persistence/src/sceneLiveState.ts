import type { SceneLiveStateHeader } from '@artificer-toolkit/schema/api/sceneLiveState'
import {
  sceneStoredLiveStateSchema,
  sceneStoredLiveEntitySchema
} from '@artificer-toolkit/schema/projections/sceneLivePersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'

export function parseSceneLiveEntity(row: unknown, version: number) {
  const value = sceneStoredLiveEntitySchema.parse(row)
  const { checksum, ...content } = value
  const isDoor = value.value?.collection === 'barriers' && value.value.entity.kind === 'DOOR'
  const hasDoorState = value.doorState !== undefined && value.doorState !== null
  if (
    checksumCanonicalJson(content) !== checksum ||
    value.version > version ||
    (value.value === null) !== (value.ordinal === null) ||
    isDoor !== hasDoorState ||
    ((value.collection === 'tokens' || value.collection === 'barriers') &&
      value.entityId !== value.entityId.toLowerCase()) ||
    (value.value !== null &&
      (value.value.entity.id !== value.entityId || value.value.collection !== value.collection))
  )
    throw new Error('Stored live Scene entity is inconsistent.')
  return value
}

/** Advances native Scene counters without coupling their persistence meaning to a backend. */
export function advanceLiveState(
  header: SceneLiveStateHeader,
  live: ReturnType<typeof sceneStoredLiveStateSchema.parse> | null
) {
  return sceneStoredLiveStateSchema.parse({
    sceneId: header.id,
    version: header.version + 1,
    fogLayerCount: live?.fogLayerCount ?? 0,
    nextFogOrdinal: live?.nextFogOrdinal ?? 0,
    counts: header.currentCounts,
    nextOrdinals: live?.nextOrdinals ?? { ...header.counts, measurements: 0 },
    settings: live?.settings ?? {
      ambientIllumination: {
        value: header.ambientIllumination,
        daylight: header.daylight,
        version: 0
      },
      visionRevealMode: { value: header.visionRevealMode, version: 0 },
      fogMode: { value: header.fogMode, version: 0 }
    }
  })
}
