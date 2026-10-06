import type { LiveRoomInputsResponse } from '@artificer-toolkit/schema/api/liveRoomInputs'
import { sceneDefinitionCollectionSchema } from '@artificer-toolkit/schema/api/sceneDefinitionSave'
import { sceneLiveStateHeaderSchema } from '@artificer-toolkit/schema/api/sceneLiveState'
import { sceneStoredDefinitionEntitySchema } from '@artificer-toolkit/schema/projections/sceneDefinitionPersistence'
import { canonicalizeJson, checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { RoomRecord } from './roomEncounterStore.js'

export const ROOM_SCENE_DEFINITION_HEADER = 'SCENE_DEFINITION_HEADER'
export const ROOM_SCENE_DEFINITION_ENTITY = 'SCENE_DEFINITION_ENTITY'

/** Immutable geometry is validated once at hydrate; live overrides stay in checkpoint records. */
export function roomSceneDefinitionRecords(
  pages: readonly Extract<LiveRoomInputsResponse, { kind: 'SCENE_DEFINITION' }>[]
): RoomRecord[] {
  const first = pages[0]
  if (!first) throw new Error('Room Scene definition inputs are missing.')
  const header = sceneLiveStateHeaderSchema.parse(first.header)
  const headerJson = canonicalizeJson(header)
  const sourceJson = canonicalizeJson(first.source)
  const ids = new Set<string>()
  const ordinals = new Map<string, Set<number>>()
  const entities = pages.flatMap((page) => {
    if (
      canonicalizeJson(page.header) !== headerJson ||
      canonicalizeJson(page.source) !== sourceJson
    )
      throw new Error('Room Scene definition changed during hydrate.')
    return page.entities.map((raw) => {
      const value = sceneStoredDefinitionEntitySchema.parse(raw)
      const collection = value.value.collection
      const identity = canonicalizeJson([value.saveId, collection, value.entityId])
      const key = canonicalizeJson([value.saveId, collection, value.ordinal, value.entityId])
      const positions = ordinals.get(collection) ?? new Set<number>()
      if (
        value.saveId !== header.definitionSaveId ||
        value.entityId !== value.value.entity.id ||
        value.ordinal >= header.counts[collection] ||
        value.checksum !== checksumCanonicalJson(value.value) ||
        positions.has(value.ordinal) ||
        ids.has(identity)
      )
        throw new Error('Room Scene definition integrity mismatch.')
      positions.add(value.ordinal)
      ordinals.set(collection, positions)
      ids.add(identity)
      return {
        kind: ROOM_SCENE_DEFINITION_ENTITY,
        key,
        revision: null,
        json: canonicalizeJson(value)
      }
    })
  })
  if (
    header.id !== first.source.sceneId ||
    header.definitionSaveId !== first.source.definitionSaveId ||
    header.definitionVersion !== first.source.definitionVersion ||
    sceneDefinitionCollectionSchema.options.some(
      (collection) => (ordinals.get(collection)?.size ?? 0) !== header.counts[collection]
    )
  )
    throw new Error('Room Scene definition source or counts are inconsistent.')
  return [
    { kind: ROOM_SCENE_DEFINITION_HEADER, key: header.id, revision: null, json: headerJson },
    ...entities
  ]
}
