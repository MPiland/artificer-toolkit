import { sql } from 'kysely'
import { z } from 'zod'

import {
  activeRuleEffectDefinitionDtoSchema,
  activeRuleEffectLifecycleDtoSchema,
  activeRuleEffectStateDtoSchema,
  serverUuidIdentityDtoSchema,
  type ActiveRuleEffectDefinitionDto,
  type ActiveRuleEffectLifecycleDto
} from '@artificer-toolkit/schema/shared/rulesExecution'
import {
  spatialRuleEffectCurrentStateDtoSchema,
  spatialRuleEffectPlacementDtoSchema,
  spatialRuleEffectStateDtoSchema,
  MAX_SPATIAL_RULE_EFFECTS_PER_SCENE,
  type SpatialRuleEffectPlacementDto,
  type SpatialRuleEffectStateDto
} from '@artificer-toolkit/schema/shared/spatial'

import type { DBLike } from '#types'
import { checksumCanonicalJson } from '../utils/canonicalJson.js'

const checksumSchema = z.string().regex(/^[a-f0-9]{64}$/)
const timestampSchema = z.union([z.string().datetime({ offset: true }), z.date()])
const rowSchema = z.strictObject({
  id: serverUuidIdentityDtoSchema,
  encounter_id: serverUuidIdentityDtoSchema,
  scene_id: serverUuidIdentityDtoSchema,
  created_ordinal: z.number().int().positive(),
  version: z.number().int().positive(),
  definition: z.unknown(),
  definition_checksum: checksumSchema,
  lifecycle: z.unknown(),
  lifecycle_checksum: checksumSchema,
  placement: z.unknown(),
  placement_checksum: checksumSchema,
  spatial_state: z.unknown(),
  spatial_state_checksum: checksumSchema,
  created_at: timestampSchema,
  updated_at: timestampSchema
})
const allocationSchema = z.strictObject({
  active_count: z.number().int().min(0),
  next_ordinal: z.number().int().min(0)
})
const sceneScopeRowSchema = z.strictObject({
  encounter_id: serverUuidIdentityDtoSchema,
  id: serverUuidIdentityDtoSchema
})

export interface EncounterSpatialRuleEffectRecord {
  id: string
  encounterId: string
  sceneId: string
  createdOrdinal: number
  version: number
  definition: ActiveRuleEffectDefinitionDto
  definitionChecksum: string
  lifecycle: ActiveRuleEffectLifecycleDto
  lifecycleChecksum: string
  placement: SpatialRuleEffectPlacementDto
  placementChecksum: string
  spatialState: SpatialRuleEffectStateDto
  spatialStateChecksum: string
  createdAt: string
  updatedAt: string
}

export class SpatialRuleEffectCurrentnessError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SpatialRuleEffectCurrentnessError'
  }
}

export class SpatialRuleEffectLimitError extends Error {
  constructor() {
    super(
      `An Encounter Scene may have at most ${MAX_SPATIAL_RULE_EFFECTS_PER_SCENE} active spatial rule effects.`
    )
    this.name = 'SpatialRuleEffectLimitError'
  }
}

function iso(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value)
  if (!Number.isFinite(date.getTime()))
    throw new Error(`Invalid database timestamp "${String(value)}".`)
  return date.toISOString()
}

function parseDefinition(input: {
  definition: unknown
  encounterId: string
}): ActiveRuleEffectDefinitionDto {
  const definition = activeRuleEffectDefinitionDtoSchema.parse(input.definition)
  if (
    definition.origin.kind !== 'ENCOUNTER' ||
    definition.origin.sourceAggregateId !== input.encounterId ||
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

function fromRow(rawRow: unknown): EncounterSpatialRuleEffectRecord {
  const row = rowSchema.parse(rawRow)
  const definition = parseDefinition({ definition: row.definition, encounterId: row.encounter_id })
  const current = parseCurrentState({
    definition,
    lifecycle: row.lifecycle,
    placement: row.placement,
    spatialState: row.spatial_state
  })
  const checksums: ReadonlyArray<[unknown, string, string]> = [
    [definition, row.definition_checksum, 'definition'],
    [current.lifecycle, row.lifecycle_checksum, 'lifecycle'],
    [current.placement, row.placement_checksum, 'placement'],
    [current.spatialState, row.spatial_state_checksum, 'spatial state']
  ]
  for (const [document, checksum, label] of checksums)
    if (checksumCanonicalJson(document) !== checksum)
      throw new Error(`Spatial rule-effect ${label} checksum does not match persisted state.`)
  return {
    id: row.id,
    encounterId: row.encounter_id,
    sceneId: row.scene_id,
    createdOrdinal: row.created_ordinal,
    version: row.version,
    definition,
    definitionChecksum: row.definition_checksum,
    lifecycle: current.lifecycle,
    lifecycleChecksum: row.lifecycle_checksum,
    placement: current.placement,
    placementChecksum: row.placement_checksum,
    spatialState: current.spatialState,
    spatialStateChecksum: row.spatial_state_checksum,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at)
  }
}

function normalizeScope(input: { encounterId: string; sceneId: string }): {
  encounterId: string
  sceneId: string
} {
  return {
    encounterId: serverUuidIdentityDtoSchema.parse(input.encounterId),
    sceneId: serverUuidIdentityDtoSchema.parse(input.sceneId)
  }
}

export interface LockedSpatialRuleEffectScope {
  /**
   * Read the Scene-scoped child snapshot without taking child-row locks.
   * Callers that subsequently lock other aggregate roots use this only to
   * derive their deterministic lock set, then re-lock exact rows with
   * `lockById` and compare currentness before execution.
   */
  snapshot(): Promise<EncounterSpatialRuleEffectRecord[]>
  list(): Promise<EncounterSpatialRuleEffectRecord[]>
  lockById(input: { id: string }): Promise<EncounterSpatialRuleEffectRecord | null>
  create(input: {
    id: string
    definition: ActiveRuleEffectDefinitionDto
    lifecycle: ActiveRuleEffectLifecycleDto
    placement: SpatialRuleEffectPlacementDto
    spatialState: SpatialRuleEffectStateDto
  }): Promise<EncounterSpatialRuleEffectRecord>
  updateCurrentStateCas(input: {
    id: string
    expectedVersion: number
    lifecycle: ActiveRuleEffectLifecycleDto
    spatialState: SpatialRuleEffectStateDto
  }): Promise<EncounterSpatialRuleEffectRecord>
  deleteCas(input: { id: string; expectedVersion: number }): Promise<void>
}

/**
 * Server-only Encounter/Scene spatial current-state repository. The caller
 * must hold the Encounter root before `lockScope`; that method serializes the
 * exact Scene even when it has no spatial-effect child rows.
 */
export function createSpatialRuleEffectRepository(db: DBLike) {
  async function listByScene(input: {
    encounterId: string
    sceneId: string
  }): Promise<EncounterSpatialRuleEffectRecord[]> {
    const scope = normalizeScope(input)
    const result = await sql<Record<string, unknown>>`
      SELECT id, encounter_id, scene_id, created_ordinal, version, definition, definition_checksum,
             lifecycle, lifecycle_checksum, placement, placement_checksum, spatial_state,
             spatial_state_checksum, created_at, updated_at
      FROM public.encounter_spatial_rule_effects
      WHERE encounter_id = ${scope.encounterId} AND scene_id = ${scope.sceneId}
      ORDER BY created_ordinal ASC, id ASC
    `.execute(db)
    return result.rows.map(fromRow)
  }

  return {
    listByScene,
    async lockScope(input: {
      encounterId: string
      sceneId: string
    }): Promise<LockedSpatialRuleEffectScope | null> {
      const scope = normalizeScope(input)
      const sceneResult = await sql<Record<string, unknown>>`
        SELECT binding.scene_id AS id, binding.encounter_id
        FROM public.encounter_scene_bindings AS binding
        WHERE binding.scene_id = ${scope.sceneId} AND binding.encounter_id = ${scope.encounterId}
        FOR UPDATE
      `.execute(db)
      const scene = sceneResult.rows[0]
      if (!scene) return null
      const lockedScene = sceneScopeRowSchema.parse(scene)
      if (lockedScene.id !== scope.sceneId || lockedScene.encounter_id !== scope.encounterId)
        throw new Error('Locked Scene scope does not match its requested Encounter scope.')

      async function lockById(input: {
        id: string
      }): Promise<EncounterSpatialRuleEffectRecord | null> {
        const id = serverUuidIdentityDtoSchema.parse(input.id)
        const result = await sql<Record<string, unknown>>`
          SELECT id, encounter_id, scene_id, created_ordinal, version, definition, definition_checksum,
                 lifecycle, lifecycle_checksum, placement, placement_checksum, spatial_state,
                 spatial_state_checksum, created_at, updated_at
          FROM public.encounter_spatial_rule_effects
          WHERE id = ${id} AND encounter_id = ${scope.encounterId} AND scene_id = ${scope.sceneId}
          FOR UPDATE
        `.execute(db)
        const row = result.rows[0]
        return row ? fromRow(row) : null
      }

      return {
        async snapshot() {
          const result = await sql<Record<string, unknown>>`
            SELECT id, encounter_id, scene_id, created_ordinal, version, definition, definition_checksum,
                   lifecycle, lifecycle_checksum, placement, placement_checksum, spatial_state,
                   spatial_state_checksum, created_at, updated_at
            FROM public.encounter_spatial_rule_effects
            WHERE encounter_id = ${scope.encounterId} AND scene_id = ${scope.sceneId}
            ORDER BY created_ordinal ASC, id ASC
          `.execute(db)
          return result.rows.map(fromRow)
        },
        async list() {
          const result = await sql<Record<string, unknown>>`
            SELECT id, encounter_id, scene_id, created_ordinal, version, definition, definition_checksum,
                   lifecycle, lifecycle_checksum, placement, placement_checksum, spatial_state,
                   spatial_state_checksum, created_at, updated_at
            FROM public.encounter_spatial_rule_effects
            WHERE encounter_id = ${scope.encounterId} AND scene_id = ${scope.sceneId}
            ORDER BY created_ordinal ASC, id ASC FOR UPDATE
          `.execute(db)
          return result.rows.map(fromRow)
        },
        lockById,
        async create(input) {
          const id = serverUuidIdentityDtoSchema.parse(input.id)
          const definition = parseDefinition({
            definition: input.definition,
            encounterId: scope.encounterId
          })
          const current = parseCurrentState({
            definition,
            lifecycle: input.lifecycle,
            placement: input.placement,
            spatialState: input.spatialState
          })
          const allocationResult = await sql<Record<string, unknown>>`
            SELECT count(*)::integer AS active_count, coalesce(max(created_ordinal), 0)::integer AS next_ordinal
            FROM public.encounter_spatial_rule_effects
            WHERE encounter_id = ${scope.encounterId} AND scene_id = ${scope.sceneId}
          `.execute(db)
          const allocation = allocationSchema.parse(allocationResult.rows[0])
          if (allocation.active_count >= MAX_SPATIAL_RULE_EFFECTS_PER_SCENE)
            throw new SpatialRuleEffectLimitError()
          const result = await sql<Record<string, unknown>>`
            INSERT INTO public.encounter_spatial_rule_effects
              (id, encounter_id, scene_id, created_ordinal, definition, definition_checksum,
               lifecycle, lifecycle_checksum, placement, placement_checksum, spatial_state, spatial_state_checksum)
            VALUES (${id}, ${scope.encounterId}, ${scope.sceneId}, ${allocation.next_ordinal + 1},
                    ${JSON.stringify(definition)}::jsonb, ${checksumCanonicalJson(definition)},
                    ${JSON.stringify(current.lifecycle)}::jsonb, ${checksumCanonicalJson(current.lifecycle)},
                    ${JSON.stringify(current.placement)}::jsonb, ${checksumCanonicalJson(current.placement)},
                    ${JSON.stringify(current.spatialState)}::jsonb, ${checksumCanonicalJson(current.spatialState)})
            RETURNING id, encounter_id, scene_id, created_ordinal, version, definition, definition_checksum,
                      lifecycle, lifecycle_checksum, placement, placement_checksum, spatial_state,
                      spatial_state_checksum, created_at, updated_at
          `.execute(db)
          const row = result.rows[0]
          if (!row) throw new Error('Spatial rule effect was not created.')
          return fromRow(row)
        },
        async updateCurrentStateCas(input) {
          const id = serverUuidIdentityDtoSchema.parse(input.id)
          const expectedVersion = z.number().int().positive().parse(input.expectedVersion)
          const current = await lockById({ id })
          if (!current || current.version !== expectedVersion)
            throw new SpatialRuleEffectCurrentnessError(
              'Spatial rule effect changed before current-state update.'
            )
          const next = parseCurrentState({
            definition: current.definition,
            lifecycle: input.lifecycle,
            placement: current.placement,
            spatialState: input.spatialState
          })
          const result = await sql<Record<string, unknown>>`
            UPDATE public.encounter_spatial_rule_effects
            SET version = version + 1, lifecycle = ${JSON.stringify(next.lifecycle)}::jsonb,
                lifecycle_checksum = ${checksumCanonicalJson(next.lifecycle)},
                spatial_state = ${JSON.stringify(next.spatialState)}::jsonb,
                spatial_state_checksum = ${checksumCanonicalJson(next.spatialState)}, updated_at = now()
            WHERE id = ${id} AND encounter_id = ${scope.encounterId} AND scene_id = ${scope.sceneId}
              AND version = ${expectedVersion}
            RETURNING id, encounter_id, scene_id, created_ordinal, version, definition, definition_checksum,
                      lifecycle, lifecycle_checksum, placement, placement_checksum, spatial_state,
                      spatial_state_checksum, created_at, updated_at
          `.execute(db)
          const row = result.rows[0]
          if (!row)
            throw new SpatialRuleEffectCurrentnessError(
              'Spatial rule effect changed before current-state update.'
            )
          return fromRow(row)
        },
        async deleteCas(input) {
          const result = await sql`
            DELETE FROM public.encounter_spatial_rule_effects
            WHERE id = ${serverUuidIdentityDtoSchema.parse(input.id)}
              AND encounter_id = ${scope.encounterId} AND scene_id = ${scope.sceneId}
              AND version = ${z.number().int().positive().parse(input.expectedVersion)}
          `.execute(db)
          if (result.numAffectedRows !== 1n)
            throw new SpatialRuleEffectCurrentnessError(
              'Spatial rule effect changed before deletion.'
            )
        }
      }
    }
  }
}
