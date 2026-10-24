import type {
  SceneLiveEntity,
  SceneLiveStateHeader
} from '@artificer-toolkit/schema/api/sceneLiveState'
import {
  LEGACY_VISUAL_ONLY_DARKNESS_REPLAY_KIND,
  sceneCommandResultDtoSchema,
  type SceneCommandResultDto,
  type SceneLiveCommandInputDto
} from '@artificer-toolkit/schema/api/vttScenes'
import {
  sceneStoredInlineCommandSchema,
  sceneStoredLiveCommandSchema,
  sceneStoredLiveEntitySchema,
  sceneStoredLiveStateSchema
} from '@artificer-toolkit/schema/projections/sceneLivePersistence'
import { sceneStoredDefinitionEntitySchema } from '@artificer-toolkit/schema/projections/sceneDefinitionPersistence'
import type { SceneAtomicDelta } from '@artificer-toolkit/shared/vtt/scene'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { advanceLiveState, parseSceneLiveEntity } from './sceneLiveState.js'

type StoredRow<T extends { parse(value: unknown): unknown }> = ReturnType<T['parse']>

/** Why an inline Scene command was refused; integrity failures throw instead. */
type SceneInlineRefusal = {
  kind: 'FORBIDDEN' | 'STALE' | 'INVALID'
  message: string
}

type SceneInlinePlan =
  | SceneInlineRefusal
  | { kind: 'REPLAY'; result: SceneCommandResultDto }
  | {
      kind: 'COMMIT'
      result: SceneCommandResultDto
      state: StoredRow<typeof sceneStoredLiveStateSchema>
      change: StoredRow<typeof sceneStoredLiveEntitySchema> | null
      receipt: StoredRow<typeof sceneStoredInlineCommandSchema>
    }

/**
 * Plans one inline Scene command (settings, lights, darkness, annotations, measurements) against
 * the stored live head: the GM edits everything, a player only their own measurements. A target
 * changed after `expectedSceneVersion` is stale; unrelated newer edits rebase. The caller writes
 * `state`, `change` and `receipt` together with its own commit.
 */
export function planSceneInlineCommand(args: {
  input: SceneLiveCommandInputDto
  header: SceneLiveStateHeader
  live: StoredRow<typeof sceneStoredLiveStateSchema> | null
  actor: { role: 'OWNER' | 'PLAYER'; userId: string }
  readCommand(commandId: string): unknown
  readLiveEntity(collection: SceneLiveEntity['collection'], entityId: string): unknown
  readDefinitionEntity(collection: SceneLiveEntity['collection'], entityId: string): unknown
}): SceneInlinePlan {
  const { header, actor } = args
  const input = {
    ...args.input,
    sceneId: args.input.sceneId.toLowerCase(),
    commandId: args.input.commandId.toLowerCase()
  }
  const isMeasurement =
    input.type === 'UPSERT_SCENE_MEASUREMENT' || input.type === 'REMOVE_SCENE_MEASUREMENT'
  if (actor.role !== 'OWNER' && !isMeasurement)
    return { kind: 'FORBIDDEN', message: 'Only the GM can change this Scene.' }
  if (
    actor.role !== 'OWNER' &&
    input.type === 'UPSERT_SCENE_MEASUREMENT' &&
    input.measurement.createdByUserId !== actor.userId
  )
    return { kind: 'FORBIDDEN', message: 'Players may only save their own measurements.' }
  if (input.sceneId !== header.id) throw new Error('Scene inline command targets another Scene.')
  const inputChecksum = checksumCanonicalJson(input)
  const priorRow = args.readCommand(input.commandId)
  if (priorRow) {
    const stored = sceneStoredLiveCommandSchema.parse(priorRow)
    if (stored.encoding !== 'INLINE')
      return { kind: 'INVALID', message: 'Command ID was already used with different input.' }
    const prior = sceneStoredInlineCommandSchema.parse(stored)
    if (
      prior.inputChecksum !== checksumCanonicalJson(prior.input) ||
      prior.resultChecksum !== checksumCanonicalJson(prior.result) ||
      prior.result.sceneId !== input.sceneId ||
      prior.result.commandId !== input.commandId ||
      prior.result.replayed ||
      prior.result.version > header.version
    )
      throw new Error('Stored Scene command is inconsistent.')
    if (prior.inputChecksum !== inputChecksum)
      return { kind: 'INVALID', message: 'Command ID was already used with different input.' }
    if (actor.role !== 'OWNER' && prior.actorUserId !== actor.userId)
      return { kind: 'FORBIDDEN', message: 'Players may only replay their own Scene commands.' }
    return { kind: 'REPLAY', result: { ...prior.result, replayed: true } }
  }
  if (
    input.type === 'UPSERT_SCENE_DARKNESS' &&
    input.legacyReplayKind === LEGACY_VISUAL_ONLY_DARKNESS_REPLAY_KIND
  )
    return {
      kind: 'INVALID',
      message: 'Legacy visual-only darkness input is valid only for replaying a committed command.'
    }
  if (input.expectedSceneVersion > header.version)
    return { kind: 'STALE', message: 'Scene version is ahead of the authoritative state.' }
  const changed = {
    kind: 'STALE',
    message: 'Scene target changed before this command completed.'
  } as const
  const state = advanceLiveState(header, args.live)
  const version = state.version
  let delta: SceneAtomicDelta
  let change: StoredRow<typeof sceneStoredLiveEntitySchema> | null = null
  if (input.type === 'SET_SCENE_AMBIENT_ILLUMINATION') {
    if (state.settings.ambientIllumination.version > input.expectedSceneVersion) return changed
    state.settings.ambientIllumination = {
      value: input.illumination,
      daylight: input.daylight,
      version
    }
    delta = {
      kind: 'AMBIENT_ILLUMINATION_SET',
      daylight: input.daylight,
      illumination: input.illumination
    }
  } else if (input.type === 'SET_SCENE_VISION_REVEAL_MODE') {
    if (state.settings.visionRevealMode.version > input.expectedSceneVersion) return changed
    state.settings.visionRevealMode = { value: input.mode, version }
    delta = { kind: 'VISION_REVEAL_MODE_SET', mode: input.mode }
  } else if (input.type === 'SET_SCENE_FOG_MODE') {
    if (state.settings.fogMode.version > input.expectedSceneVersion) return changed
    // Fog layers stay stored while fog is OFF, so turning fog back on restores exploration.
    state.settings.fogMode = { value: input.mode, version }
    delta = { kind: 'FOG_MODE_SET', mode: input.mode }
  } else {
    const target = inlineTarget(input)
    const overrideRow = args.readLiveEntity(target.collection, target.entityId)
    const override = overrideRow ? parseSceneLiveEntity(overrideRow, header.version) : null
    if (actor.role !== 'OWNER' && target.collection === 'measurements') {
      const current = override?.value?.collection === 'measurements' ? override.value.entity : null
      if (
        (current && current.createdByUserId !== actor.userId) ||
        (input.type === 'REMOVE_SCENE_MEASUREMENT' && !current)
      )
        return { kind: 'FORBIDDEN', message: 'Players may only change their own measurements.' }
    }
    if (override && override.version > input.expectedSceneVersion) return changed
    // Only the target entity is needed: its last write is the complete conflict history.
    const baseRow =
      override || target.collection === 'measurements'
        ? null
        : args.readDefinitionEntity(target.collection, target.entityId)
    let ordinal = override?.ordinal ?? null
    let exists = override !== null && override.value !== null
    if (baseRow) {
      const base = sceneStoredDefinitionEntitySchema.parse(baseRow)
      if (
        base.saveId !== header.definitionSaveId ||
        base.value.collection !== target.collection ||
        base.value.entity.id !== target.entityId ||
        base.ordinal >= header.counts[base.value.collection] ||
        base.checksum !== checksumCanonicalJson(base.value)
      )
        throw new Error('Stored Scene entity source is inconsistent.')
      exists = true
      ordinal = base.ordinal
    }
    if (target.value && !exists) ordinal = state.nextOrdinals[target.collection]++
    if (!target.value) ordinal = null
    state.counts[target.collection] += (target.value ? 1 : 0) - (exists ? 1 : 0)
    const fields = {
      sceneId: header.id,
      collection: target.collection,
      entityId: target.entityId,
      value: target.value,
      ordinal,
      version
    }
    change = sceneStoredLiveEntitySchema.parse({
      ...fields,
      checksum: checksumCanonicalJson(fields)
    })
    delta = target.delta
  }
  // Validates the updated counts before any head or receipt can be written.
  const nextState = sceneStoredLiveStateSchema.parse(state)
  const result = sceneCommandResultDtoSchema.parse({
    commandId: input.commandId,
    sceneId: header.id,
    version,
    occurrence: null,
    replayed: false,
    delta
  })
  const receipt = sceneStoredInlineCommandSchema.parse({
    encoding: 'INLINE',
    sceneId: header.id,
    commandId: input.commandId,
    actorUserId: actor.userId,
    input,
    inputChecksum,
    result,
    resultChecksum: checksumCanonicalJson(result)
  })
  return { kind: 'COMMIT', result, state: nextState, change, receipt }
}

function inlineTarget(
  input: Exclude<
    SceneLiveCommandInputDto,
    {
      type: 'SET_SCENE_AMBIENT_ILLUMINATION' | 'SET_SCENE_VISION_REVEAL_MODE' | 'SET_SCENE_FOG_MODE'
    }
  >
): {
  collection: SceneLiveEntity['collection']
  entityId: string
  value: SceneLiveEntity | null
  delta: SceneAtomicDelta
} {
  switch (input.type) {
    case 'UPSERT_SCENE_MEASUREMENT':
      return {
        collection: 'measurements',
        entityId: input.measurement.id,
        value: { collection: 'measurements', entity: input.measurement },
        delta: { kind: 'MEASUREMENT_UPSERTED', measurement: input.measurement }
      }
    case 'REMOVE_SCENE_MEASUREMENT':
      return {
        collection: 'measurements',
        entityId: input.measurementId,
        value: null,
        delta: { kind: 'MEASUREMENT_REMOVED', measurementId: input.measurementId }
      }
    case 'UPSERT_SCENE_ANNOTATION':
      return {
        collection: 'annotations',
        entityId: input.annotation.id,
        value: { collection: 'annotations', entity: input.annotation },
        delta: { kind: 'ANNOTATION_UPSERTED', annotation: input.annotation }
      }
    case 'REMOVE_SCENE_ANNOTATION':
      return {
        collection: 'annotations',
        entityId: input.annotationId,
        value: null,
        delta: { kind: 'ANNOTATION_REMOVED', annotationId: input.annotationId }
      }
    case 'UPSERT_SCENE_LIGHT':
      return {
        collection: 'lights',
        entityId: input.light.id,
        value: { collection: 'lights', entity: input.light },
        delta: { kind: 'LIGHT_UPSERTED', light: input.light }
      }
    case 'REMOVE_SCENE_LIGHT':
      return {
        collection: 'lights',
        entityId: input.lightId,
        value: null,
        delta: { kind: 'LIGHT_REMOVED', lightId: input.lightId }
      }
    case 'UPSERT_SCENE_DARKNESS':
      return {
        collection: 'darknessZones',
        entityId: input.zone.id,
        value: { collection: 'darknessZones', entity: input.zone },
        delta: { kind: 'DARKNESS_UPSERTED', zone: input.zone }
      }
    case 'REMOVE_SCENE_DARKNESS':
      return {
        collection: 'darknessZones',
        entityId: input.zoneId,
        value: null,
        delta: { kind: 'DARKNESS_REMOVED', zoneId: input.zoneId }
      }
  }
}
