import {
  activeRuleEffectDefinitionDtoSchema,
  activeRuleEffectLifecycleDtoSchema,
  activeRuleEffectStateDtoSchema,
  type ActiveRuleEffectDefinitionDto,
  type ActiveRuleEffectLifecycleDto
} from '@artificer-toolkit/schema/shared/activeRuleEffects'
import { serverUuidIdentityDtoSchema } from '@artificer-toolkit/schema/shared/serverUuidIdentity'
import {
  MAX_SPATIAL_RULE_EFFECTS_PER_SCENE,
  spatialRuleEffectCurrentStateDtoSchema,
  spatialRuleEffectPlacementDtoSchema,
  spatialRuleEffectStateDtoSchema,
  type SpatialRuleEffectPlacementDto,
  type SpatialRuleEffectStateDto
} from '@artificer-toolkit/schema/shared/spatial'
import {
  encounterSpatialRuleEffectRecordSchema,
  encounterSpatialRuleEffectStoredSchema,
  type EncounterSpatialRuleEffectRecord
} from '@artificer-toolkit/schema/projections/spatialRuleEffectPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { z } from 'zod'
import type { EncounterDocument, EncounterWriteContext } from './store.js'

const positiveIntegerSchema = z.number().int().positive()

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    throw new Error('Spatial rule-effect definition JSON is invalid.')
  }
}

function parseDefinition(value: string, encounterId: string): ActiveRuleEffectDefinitionDto {
  const definition = activeRuleEffectDefinitionDtoSchema.parse(parseJson(value))
  if (
    definition.origin.kind !== 'ENCOUNTER' ||
    definition.origin.sourceAggregateId !== encounterId ||
    definition.recurrence.lifetimeScope !== 'ENCOUNTER' ||
    definition.recurrence.recurrenceStage !== 'NONE'
  )
    throw new Error(
      'Encounter/Scene spatial effects require same-Encounter origin, Encounter lifetime, and recurrence stage NONE.'
    )
  return definition
}

function parseCurrentState(input: {
  definition: ActiveRuleEffectDefinitionDto
  lifecycle: unknown
  placement: unknown
  spatialState: unknown
}): {
  lifecycle: ActiveRuleEffectLifecycleDto
  placement: SpatialRuleEffectPlacementDto
  spatialState: SpatialRuleEffectStateDto
} {
  const lifecycle = activeRuleEffectLifecycleDtoSchema.parse(input.lifecycle)
  const placement = spatialRuleEffectPlacementDtoSchema.parse(input.placement)
  const spatialState = spatialRuleEffectStateDtoSchema.parse(input.spatialState)
  activeRuleEffectStateDtoSchema.parse({ definition: input.definition, lifecycle })
  spatialRuleEffectCurrentStateDtoSchema.parse({
    definition: input.definition,
    lifecycle,
    placement,
    spatialState
  })
  return { lifecycle, placement, spatialState }
}

export function readSpatialEffect(
  row: EncounterDocument<'encounterSpatialRuleEffects'>
): EncounterSpatialRuleEffectRecord {
  const { _id, _creationTime, ...stored } = row
  const value = encounterSpatialRuleEffectStoredSchema.parse(stored)
  const { definitionJson, ...record } = value
  const definition = parseDefinition(definitionJson, value.encounterId)
  const current = parseCurrentState({
    definition,
    lifecycle: value.lifecycle,
    placement: value.placement,
    spatialState: value.spatialState
  })
  const checksums: ReadonlyArray<[unknown, string, string]> = [
    [definition, value.definitionChecksum, 'definition'],
    [current.lifecycle, value.lifecycleChecksum, 'lifecycle'],
    [current.placement, value.placementChecksum, 'placement'],
    [current.spatialState, value.spatialStateChecksum, 'spatial state']
  ]
  for (const [document, checksum, label] of checksums)
    if (checksumCanonicalJson(document) !== checksum)
      throw new Error(`Spatial rule-effect ${label} checksum does not match persisted state.`)
  return encounterSpatialRuleEffectRecordSchema.parse({
    ...record,
    definition,
    lifecycle: current.lifecycle,
    placement: current.placement,
    spatialState: current.spatialState
  })
}

function normalizeScope(input: { encounterId: string; sceneId: string }) {
  return {
    encounterId: serverUuidIdentityDtoSchema.parse(input.encounterId),
    sceneId: serverUuidIdentityDtoSchema.parse(input.sceneId)
  }
}

/** Internal mutation helper. Callers authorize the aggregate and compose all writes in this mutation. */
export function createSpatialRuleEffectStore(ctx: EncounterWriteContext) {
  return {
    async scope(input: { encounterId: string; sceneId: string }) {
      const scope = normalizeScope(input)
      const binding = await ctx.db
        .query('encounterSceneBindings')
        .withIndex('by_encounterId', (q) => q.eq('encounterId', scope.encounterId))
        .unique()
      if (!binding || binding.sceneId !== scope.sceneId) return null

      async function list() {
        const effects = (
          await ctx.db
            .query('encounterSpatialRuleEffects')
            .withIndex('by_encounterId_sceneId_createdOrdinal_id', (q) =>
              q.eq('encounterId', scope.encounterId).eq('sceneId', scope.sceneId)
            )
            .take(MAX_SPATIAL_RULE_EFFECTS_PER_SCENE + 1)
        ).map(readSpatialEffect)
        if (effects.length > MAX_SPATIAL_RULE_EFFECTS_PER_SCENE)
          throw new Error(
            `An Encounter Scene may have at most ${MAX_SPATIAL_RULE_EFFECTS_PER_SCENE} active spatial rule effects.`
          )
        return effects
      }

      async function get(idInput: string) {
        const id = serverUuidIdentityDtoSchema.parse(idInput)
        const row = await ctx.db
          .query('encounterSpatialRuleEffects')
          .withIndex('by_encounterId_sceneId_id', (q) =>
            q.eq('encounterId', scope.encounterId).eq('sceneId', scope.sceneId).eq('id', id)
          )
          .unique()
        return row ? readSpatialEffect(row) : null
      }

      return {
        list,
        get,
        async create(input: {
          id: string
          definition: ActiveRuleEffectDefinitionDto
          lifecycle: ActiveRuleEffectLifecycleDto
          placement: SpatialRuleEffectPlacementDto
          spatialState: SpatialRuleEffectStateDto
        }) {
          const id = serverUuidIdentityDtoSchema.parse(input.id)
          const definition = parseDefinition(JSON.stringify(input.definition), scope.encounterId)
          const current = parseCurrentState({ ...input, definition })
          const existing = await ctx.db
            .query('encounterSpatialRuleEffects')
            .withIndex('by_publicId', (q) => q.eq('id', id))
            .unique()
          if (existing) throw new Error('Spatial rule-effect ID already exists.')
          const currentEffects = await list()
          if (currentEffects.length >= MAX_SPATIAL_RULE_EFFECTS_PER_SCENE)
            throw new Error(
              `An Encounter Scene may have at most ${MAX_SPATIAL_RULE_EFFECTS_PER_SCENE} active spatial rule effects.`
            )
          const now = new Date().toISOString()
          const stored = encounterSpatialRuleEffectStoredSchema.parse({
            id,
            ...scope,
            createdOrdinal:
              Math.max(0, ...currentEffects.map((effect) => effect.createdOrdinal)) + 1,
            version: 1,
            definitionJson: JSON.stringify(definition),
            definitionChecksum: checksumCanonicalJson(definition),
            lifecycle: current.lifecycle,
            lifecycleChecksum: checksumCanonicalJson(current.lifecycle),
            placement: current.placement,
            placementChecksum: checksumCanonicalJson(current.placement),
            spatialState: current.spatialState,
            spatialStateChecksum: checksumCanonicalJson(current.spatialState),
            createdAt: now,
            updatedAt: now
          })
          const rowId = await ctx.db.insert('encounterSpatialRuleEffects', stored)
          const row = await ctx.db.get(rowId)
          if (!row) throw new Error('Spatial rule effect was not created.')
          return readSpatialEffect(row)
        },
        async updateCurrentStateCas(input: {
          id: string
          expectedVersion: number
          lifecycle: ActiveRuleEffectLifecycleDto
          spatialState: SpatialRuleEffectStateDto
        }) {
          const id = serverUuidIdentityDtoSchema.parse(input.id)
          const expectedVersion = positiveIntegerSchema.parse(input.expectedVersion)
          const current = await get(id)
          if (!current || current.version !== expectedVersion)
            throw new Error('Spatial rule effect changed before current-state update.')
          const next = parseCurrentState({
            definition: current.definition,
            lifecycle: input.lifecycle,
            placement: current.placement,
            spatialState: input.spatialState
          })
          const row = await ctx.db
            .query('encounterSpatialRuleEffects')
            .withIndex('by_encounterId_sceneId_id', (q) =>
              q.eq('encounterId', scope.encounterId).eq('sceneId', scope.sceneId).eq('id', id)
            )
            .unique()
          if (!row || row.version !== expectedVersion)
            throw new Error('Spatial rule effect changed before current-state update.')
          await ctx.db.patch(row._id, {
            lifecycle: next.lifecycle,
            lifecycleChecksum: checksumCanonicalJson(next.lifecycle),
            spatialState: next.spatialState,
            spatialStateChecksum: checksumCanonicalJson(next.spatialState),
            version: expectedVersion + 1,
            updatedAt: new Date().toISOString()
          })
          const updated = await ctx.db.get(row._id)
          if (!updated) throw new Error('Spatial rule effect changed before current-state update.')
          return readSpatialEffect(updated)
        },
        async deleteCas(input: { id: string; expectedVersion: number }) {
          const id = serverUuidIdentityDtoSchema.parse(input.id)
          const expectedVersion = positiveIntegerSchema.parse(input.expectedVersion)
          const row = await ctx.db
            .query('encounterSpatialRuleEffects')
            .withIndex('by_encounterId_sceneId_id', (q) =>
              q.eq('encounterId', scope.encounterId).eq('sceneId', scope.sceneId).eq('id', id)
            )
            .unique()
          if (!row || row.version !== expectedVersion)
            throw new Error('Spatial rule effect changed before deletion.')
          await ctx.db.delete(row._id)
        }
      }
    }
  }
}
