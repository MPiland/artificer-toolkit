import { zodToConvex } from 'convex-helpers/server/zod4'
import { v } from 'convex/values'
import {
  sceneLiveCommandInputDtoSchema,
  sceneCommandResultDtoSchema,
  LEGACY_VISUAL_ONLY_DARKNESS_REPLAY_KIND,
  type SceneCommandResultDto
} from '@artificer-toolkit/schema/api/vttScenes'
import {
  sceneStoredLiveStateSchema,
  sceneStoredInlineCommandSchema
} from '@artificer-toolkit/schema/projections/sceneLivePersistence'
import { sceneStoredDefinitionEntitySchema } from '@artificer-toolkit/schema/projections/sceneDefinitionPersistence'
import type { SceneLiveEntity } from '@artificer-toolkit/schema/api/sceneLiveState'
import type { SceneAtomicDelta } from '@artificer-toolkit/shared/vtt/scene'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { mutation } from '../lib/mutations'
import { readLiveScene, parseLiveEntity, advanceLiveState } from './liveDocuments'
import { readPresentedVisionScene } from './sessionVisionDocuments'
import { scenePresentationFenceSchema } from '@artificer-toolkit/schema/api/sceneGeometry'

export const execute = mutation({
  args: {
    input: zodToConvex(sceneLiveCommandInputDtoSchema),
    presentation: v.optional(zodToConvex(scenePresentationFenceSchema))
  },
  returns: zodToConvex(sceneCommandResultDtoSchema),
  handler: async (ctx, args): Promise<SceneCommandResultDto> => {
    const parsed = sceneLiveCommandInputDtoSchema.parse(args.input)
    const fence = args.presentation
      ? scenePresentationFenceSchema.parse(args.presentation)
      : undefined
    const input = {
      ...parsed,
      sceneId: parsed.sceneId.toLowerCase(),
      commandId: parsed.commandId.toLowerCase()
    }
    const isMeasurement =
      input.type === 'UPSERT_SCENE_MEASUREMENT' || input.type === 'REMOVE_SCENE_MEASUREMENT'
    const { header, campaign, membership, userId, liveRow, live } = await readLiveScene(
      ctx,
      input.sceneId,
      isMeasurement ? 'MEMBER' : 'OWNER'
    )
    if (campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns are read-only.')
    const presented = fence
      ? await readPresentedVisionScene(ctx, { campaignId: campaign.id, sceneId: header.id })
      : null
    if (
      membership.role !== 'OWNER' &&
      input.type === 'UPSERT_SCENE_MEASUREMENT' &&
      input.measurement.createdByUserId !== userId
    )
      throw new Error('Players may only save their own measurements.')
    const inputChecksum = checksumCanonicalJson(input)
    const priorRow = await ctx.db
      .query('sceneLiveCommands')
      .withIndex('by_sceneId_commandId', (q) =>
        q.eq('sceneId', input.sceneId).eq('commandId', input.commandId)
      )
      .unique()
    if (priorRow) {
      if (priorRow.encoding !== 'INLINE')
        throw new Error('Command ID was already used with different input.')
      const { _id, _creationTime, ...stored } = priorRow
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
        throw new Error('Command ID was already used with different input.')
      if (membership.role !== 'OWNER' && prior.actorUserId !== userId)
        throw new Error('Players may only replay their own Scene commands.')
      return { ...prior.result, replayed: true }
    }
    if (presented && presented.presentation.version !== fence?.expectedPresentationVersion)
      throw new Error('Scene vision presentation is stale.')
    if (
      input.type === 'UPSERT_SCENE_DARKNESS' &&
      input.legacyReplayKind === LEGACY_VISUAL_ONLY_DARKNESS_REPLAY_KIND
    )
      throw new Error(
        'Legacy visual-only darkness input is valid only for replaying a committed command.'
      )
    if (input.expectedSceneVersion > header.version)
      throw new Error('Scene version is ahead of the authoritative state.')
    const state = advanceLiveState(header, live)
    const version = state.version
    let delta: SceneAtomicDelta
    if (input.type === 'SET_SCENE_AMBIENT_ILLUMINATION') {
      if (state.settings.ambientIllumination.version > input.expectedSceneVersion)
        throw new Error('Scene target changed before this command completed.')
      state.settings.ambientIllumination = { value: input.illumination, version }
      delta = { kind: 'AMBIENT_ILLUMINATION_SET', illumination: input.illumination }
    } else if (input.type === 'SET_SCENE_VISION_REVEAL_MODE') {
      if (state.settings.visionRevealMode.version > input.expectedSceneVersion)
        throw new Error('Scene target changed before this command completed.')
      state.settings.visionRevealMode = { value: input.mode, version }
      delta = { kind: 'VISION_REVEAL_MODE_SET', mode: input.mode }
    } else {
      let target: {
        collection: SceneLiveEntity['collection']
        entityId: string
        value: SceneLiveEntity | null
        delta: SceneAtomicDelta
      }
      switch (input.type) {
        case 'UPSERT_SCENE_MEASUREMENT':
          target = {
            collection: 'measurements',
            entityId: input.measurement.id,
            value: { collection: 'measurements', entity: input.measurement },
            delta: { kind: 'MEASUREMENT_UPSERTED', measurement: input.measurement }
          }
          break
        case 'REMOVE_SCENE_MEASUREMENT':
          target = {
            collection: 'measurements',
            entityId: input.measurementId,
            value: null,
            delta: { kind: 'MEASUREMENT_REMOVED', measurementId: input.measurementId }
          }
          break
        case 'UPSERT_SCENE_ANNOTATION':
          target = {
            collection: 'annotations',
            entityId: input.annotation.id,
            value: { collection: 'annotations', entity: input.annotation },
            delta: { kind: 'ANNOTATION_UPSERTED', annotation: input.annotation }
          }
          break
        case 'REMOVE_SCENE_ANNOTATION':
          target = {
            collection: 'annotations',
            entityId: input.annotationId,
            value: null,
            delta: { kind: 'ANNOTATION_REMOVED', annotationId: input.annotationId }
          }
          break
        case 'UPSERT_SCENE_LIGHT':
          target = {
            collection: 'lights',
            entityId: input.light.id,
            value: { collection: 'lights', entity: input.light },
            delta: { kind: 'LIGHT_UPSERTED', light: input.light }
          }
          break
        case 'REMOVE_SCENE_LIGHT':
          target = {
            collection: 'lights',
            entityId: input.lightId,
            value: null,
            delta: { kind: 'LIGHT_REMOVED', lightId: input.lightId }
          }
          break
        case 'UPSERT_SCENE_DARKNESS':
          target = {
            collection: 'darknessZones',
            entityId: input.zone.id,
            value: { collection: 'darknessZones', entity: input.zone },
            delta: { kind: 'DARKNESS_UPSERTED', zone: input.zone }
          }
          break
        case 'REMOVE_SCENE_DARKNESS':
          target = {
            collection: 'darknessZones',
            entityId: input.zoneId,
            value: null,
            delta: { kind: 'DARKNESS_REMOVED', zoneId: input.zoneId }
          }
          break
      }
      const overrideRow = await ctx.db
        .query('sceneLiveEntities')
        .withIndex('by_sceneId_collection_entityId', (q) =>
          q
            .eq('sceneId', header.id)
            .eq('collection', target.collection)
            .eq('entityId', target.entityId)
        )
        .unique()
      const override = overrideRow ? parseLiveEntity(overrideRow, header.version) : null
      if (membership.role !== 'OWNER' && target.collection === 'measurements') {
        const current =
          override?.value?.collection === 'measurements' ? override.value.entity : null
        if (
          (current && current.createdByUserId !== userId) ||
          (input.type === 'REMOVE_SCENE_MEASUREMENT' && !current)
        )
          throw new Error('Players may only change their own measurements.')
      }
      if (override && override.version > input.expectedSceneVersion)
        throw new Error('Scene target changed before this command completed.')

      // Only the target entity is needed. Its last write is the complete conflict history
      // for these entity commands; unrelated stale edits retain the shared Scene rebase rule.
      const baseCollection = target.collection === 'measurements' ? null : target.collection
      const baseRow =
        override || baseCollection === null
          ? null
          : await ctx.db
              .query('sceneDefinitionEntities')
              .withIndex('by_saveId_collection_entityId', (q) =>
                q
                  .eq('saveId', header.definitionSaveId)
                  .eq('value.collection', baseCollection)
                  .eq('entityId', target.entityId)
              )
              .unique()
      let ordinal = override?.ordinal ?? null
      let exists = override !== null && override.value !== null
      if (baseRow) {
        const { _id, _creationTime, ...stored } = baseRow
        const base = sceneStoredDefinitionEntitySchema.parse(stored)
        if (
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
      const change = {
        sceneId: header.id,
        collection: target.collection,
        entityId: target.entityId,
        value: target.value,
        ordinal,
        version
      }
      const storedChange = { ...change, checksum: checksumCanonicalJson(change) }
      if (overrideRow) await ctx.db.replace(overrideRow._id, storedChange)
      else await ctx.db.insert('sceneLiveEntities', storedChange)
      delta = target.delta
    }
    // Validate updated counts before any head or receipt can commit; a failed parse
    // also rolls back the entity write in this mutation.
    sceneStoredLiveStateSchema.parse(state)
    if (liveRow) await ctx.db.replace(liveRow._id, state)
    else await ctx.db.insert('sceneLiveStates', state)
    const result = sceneCommandResultDtoSchema.parse({
      commandId: input.commandId,
      sceneId: header.id,
      version,
      occurrence: null,
      replayed: false,
      delta
    })
    await ctx.db.insert(
      'sceneLiveCommands',
      sceneStoredInlineCommandSchema.parse({
        encoding: 'INLINE',
        sceneId: header.id,
        commandId: input.commandId,
        actorUserId: userId,
        input,
        inputChecksum,
        result,
        resultChecksum: checksumCanonicalJson(result)
      })
    )
    return result
  }
})
