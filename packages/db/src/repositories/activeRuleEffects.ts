import { sql } from 'kysely'
import { z } from 'zod'

import {
  activeRuleEffectDefinitionDtoSchema,
  activeRuleEffectLifecycleDtoSchema,
  activeRuleEffectStateDtoSchema,
  encounterMaintainedEffectDescriptorDtoSchema,
  MAX_ACTIVE_RULE_EFFECTS_PER_OWNER,
  MAX_MAINTAINED_RULE_EFFECT_DEPENDENTS_PER_ACTOR,
  MAX_MAINTAINED_RULE_EFFECT_STATES_PER_ACTOR,
  serverUuidIdentityDtoSchema,
  type ActiveRuleEffectDefinitionDto,
  type ActiveRuleEffectLifecycleDto,
  type EncounterMaintainedEffectDescriptorDto
} from '@artificer-toolkit/schema/shared/rulesExecution'

import type { DBLike } from '#types'
import { checksumCanonicalJson } from '../utils/canonicalJson.js'

export type ActiveRuleEffectOwner =
  | { kind: 'CHARACTER'; characterId: string }
  | { kind: 'ENCOUNTER_ACTOR'; encounterId: string; targetActorId: string }

export interface ActiveRuleEffectRecord {
  id: string
  owner: ActiveRuleEffectOwner
  sourceEncounterId: string | null
  maintainedEffectStateId: string | null
  createdOrdinal: number
  version: number
  definition: ActiveRuleEffectDefinitionDto
  definitionChecksum: string
  lifecycle: ActiveRuleEffectLifecycleDto
  lifecycleChecksum: string
  createdAt: string
  updatedAt: string
}

export interface EncounterMaintainedEffectStateRecord {
  id: string
  encounterId: string
  ownerActorId: string
  maintenanceDefinitionId: string
  descriptor: EncounterMaintainedEffectDescriptorDto
  descriptorChecksum: string
  version: number
  createdAt: string
  updatedAt: string
}

export class ActiveRuleEffectCurrentnessError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ActiveRuleEffectCurrentnessError'
  }
}

export class ActiveRuleEffectLimitError extends Error {
  constructor() {
    super(`An owner may have at most ${MAX_ACTIVE_RULE_EFFECTS_PER_OWNER} active rule effects.`)
    this.name = 'ActiveRuleEffectLimitError'
  }
}

export class MaintainedRuleEffectStateLimitError extends Error {
  constructor() {
    super(
      `An Encounter actor may own at most ${MAX_MAINTAINED_RULE_EFFECT_STATES_PER_ACTOR} maintained effect states.`
    )
    this.name = 'MaintainedRuleEffectStateLimitError'
  }
}

export class MaintainedRuleEffectDependentLimitError extends Error {
  constructor() {
    super(
      `An Encounter actor may own at most ${MAX_MAINTAINED_RULE_EFFECT_DEPENDENTS_PER_ACTOR} maintained dependent effects.`
    )
    this.name = 'MaintainedRuleEffectDependentLimitError'
  }
}

const checksumSchema = z.string().regex(/^[a-f0-9]{64}$/)
const timestampSchema = z.union([z.string().datetime({ offset: true }), z.date()])
const rowSchema = z.strictObject({
  id: serverUuidIdentityDtoSchema,
  created_ordinal: z.number().int().positive(),
  version: z.number().int().positive(),
  definition: z.unknown(),
  definition_checksum: checksumSchema,
  lifecycle: z.unknown(),
  lifecycle_checksum: checksumSchema,
  source_encounter_id: serverUuidIdentityDtoSchema.nullable().optional(),
  maintained_effect_state_id: serverUuidIdentityDtoSchema.nullable().optional(),
  created_at: timestampSchema,
  updated_at: timestampSchema
})
const maintainedStateRowSchema = z.strictObject({
  id: serverUuidIdentityDtoSchema,
  encounter_id: serverUuidIdentityDtoSchema,
  owner_actor_id: serverUuidIdentityDtoSchema,
  maintenance_definition_id: serverUuidIdentityDtoSchema,
  descriptor: z.unknown(),
  descriptor_checksum: checksumSchema,
  version: z.number().int().positive(),
  created_at: timestampSchema,
  updated_at: timestampSchema
})
const allocationSchema = z.strictObject({
  active_count: z.number().int().min(0),
  next_ordinal: z.number().int().min(0)
})
const maintainedAllocationSchema = z.strictObject({
  state_count: z.number().int().min(0),
  dependent_effect_count: z.number().int().min(0)
})
const characterOwnerLocatorRowSchema = z.strictObject({
  character_id: serverUuidIdentityDtoSchema
})

function normalizeOwner(owner: ActiveRuleEffectOwner): ActiveRuleEffectOwner {
  if (owner.kind === 'CHARACTER') {
    return {
      kind: 'CHARACTER',
      characterId: serverUuidIdentityDtoSchema.parse(owner.characterId)
    }
  }
  return {
    kind: 'ENCOUNTER_ACTOR',
    encounterId: serverUuidIdentityDtoSchema.parse(owner.encounterId),
    targetActorId: serverUuidIdentityDtoSchema.parse(owner.targetActorId)
  }
}

function iso(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value)
  if (!Number.isFinite(date.getTime())) {
    throw new Error(`Invalid database timestamp "${String(value)}".`)
  }
  return date.toISOString()
}

function sourceEncounterIdForDefinition(definition: ActiveRuleEffectDefinitionDto): string | null {
  if (definition.recurrence.lifetimeScope === 'OWNER') return null
  if (definition.origin.kind !== 'ENCOUNTER') {
    throw new Error('Encounter-lifetime active effects require an Encounter origin.')
  }
  return definition.origin.sourceAggregateId
}

function parseDefinition(value: unknown): ActiveRuleEffectDefinitionDto {
  return activeRuleEffectDefinitionDtoSchema.parse(value)
}

function parseLifecycle(
  definition: ActiveRuleEffectDefinitionDto,
  lifecycle: unknown
): ActiveRuleEffectLifecycleDto {
  const parsedLifecycle = activeRuleEffectLifecycleDtoSchema.parse(lifecycle)
  return activeRuleEffectStateDtoSchema.parse({
    definition,
    lifecycle: parsedLifecycle
  }).lifecycle
}

function definitionForWrite(definition: unknown): {
  definition: ActiveRuleEffectDefinitionDto
  checksum: string
  sourceEncounterId: string | null
} {
  const parsed = parseDefinition(definition)
  return {
    definition: parsed,
    checksum: checksumCanonicalJson(parsed),
    sourceEncounterId: sourceEncounterIdForDefinition(parsed)
  }
}

function requireDefinitionOwner(
  owner: ActiveRuleEffectOwner,
  definition: ActiveRuleEffectDefinitionDto
): void {
  if (
    owner.kind === 'ENCOUNTER_ACTOR' &&
    definition.recurrence.lifetimeScope === 'ENCOUNTER' &&
    (definition.origin.kind !== 'ENCOUNTER' ||
      definition.origin.sourceAggregateId !== owner.encounterId)
  ) {
    throw new Error('Encounter-actor active effects must retain their owning Encounter provenance.')
  }
}

function lifecycleForWrite(
  definition: ActiveRuleEffectDefinitionDto,
  lifecycle: unknown
): { lifecycle: ActiveRuleEffectLifecycleDto; checksum: string } {
  const parsed = parseLifecycle(definition, lifecycle)
  return { lifecycle: parsed, checksum: checksumCanonicalJson(parsed) }
}

function fromRow(owner: ActiveRuleEffectOwner, rawRow: unknown): ActiveRuleEffectRecord {
  const row = rowSchema.parse(rawRow)
  const definition = parseDefinition(row.definition)
  const lifecycle = parseLifecycle(definition, row.lifecycle)
  if (checksumCanonicalJson(definition) !== row.definition_checksum) {
    throw new Error(
      'Active rule-effect definition checksum does not match its persisted definition.'
    )
  }
  if (checksumCanonicalJson(lifecycle) !== row.lifecycle_checksum) {
    throw new Error('Active rule-effect lifecycle checksum does not match its persisted lifecycle.')
  }
  const sourceEncounterId = row.source_encounter_id ?? null
  const maintainedEffectStateId = row.maintained_effect_state_id ?? null
  if (owner.kind === 'CHARACTER') {
    if (sourceEncounterId !== sourceEncounterIdForDefinition(definition)) {
      throw new Error(
        'Character active rule-effect source Encounter does not match immutable definition provenance.'
      )
    }
  } else if (sourceEncounterId !== null) {
    throw new Error('Encounter active rule effects must not retain Character cleanup source.')
  }
  requireDefinitionOwner(owner, definition)
  return {
    id: row.id,
    owner,
    sourceEncounterId,
    maintainedEffectStateId,
    createdOrdinal: row.created_ordinal,
    version: row.version,
    definition,
    definitionChecksum: row.definition_checksum,
    lifecycle,
    lifecycleChecksum: row.lifecycle_checksum,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at)
  }
}

function maintainedStateFromRow(rawRow: unknown): EncounterMaintainedEffectStateRecord {
  const row = maintainedStateRowSchema.parse(rawRow)
  const descriptor = encounterMaintainedEffectDescriptorDtoSchema.parse(row.descriptor)
  if (checksumCanonicalJson(descriptor) !== row.descriptor_checksum)
    throw new Error('Maintained effect descriptor checksum does not match persisted state.')
  if (descriptor.maintenanceDefinitionId !== row.maintenance_definition_id)
    throw new Error('Maintained effect definition identity does not match persisted state.')
  if (descriptor.sourceActorId !== row.owner_actor_id)
    throw new Error('Maintained effect descriptor source actor does not match its owner.')
  return {
    id: row.id,
    encounterId: row.encounter_id,
    ownerActorId: row.owner_actor_id,
    maintenanceDefinitionId: row.maintenance_definition_id,
    descriptor,
    descriptorChecksum: row.descriptor_checksum,
    version: row.version,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at)
  }
}

/** Server-only aggregate-scoped active-effect repository. Callers hold aggregate root locks. */
export function createActiveRuleEffectRepository(db: DBLike) {
  async function findMaintainedState(input: {
    encounterId: string
    ownerActorId: string
    maintenanceDefinitionId: string
  }): Promise<EncounterMaintainedEffectStateRecord | null> {
    const encounterId = serverUuidIdentityDtoSchema.parse(input.encounterId)
    const ownerActorId = serverUuidIdentityDtoSchema.parse(input.ownerActorId)
    const maintenanceDefinitionId = serverUuidIdentityDtoSchema.parse(input.maintenanceDefinitionId)
    const result = await sql<Record<string, unknown>>`
      SELECT id, encounter_id, owner_actor_id, maintenance_definition_id, descriptor,
             descriptor_checksum, version, created_at, updated_at
      FROM public.encounter_maintained_effect_states
      WHERE encounter_id = ${encounterId} AND owner_actor_id = ${ownerActorId}
        AND maintenance_definition_id = ${maintenanceDefinitionId}
    `.execute(db)
    const row = result.rows[0]
    return row ? maintainedStateFromRow(row) : null
  }

  async function dependentEffects(input: {
    stateId: string
    encounterId: string
    lock: boolean
  }): Promise<ActiveRuleEffectRecord[]> {
    const stateId = serverUuidIdentityDtoSchema.parse(input.stateId)
    const encounterId = serverUuidIdentityDtoSchema.parse(input.encounterId)
    const lockClause = input.lock ? sql` FOR UPDATE` : sql``
    const characterRows = await sql<Record<string, unknown>>`
      SELECT id, character_id, created_ordinal, version, definition, definition_checksum, lifecycle, lifecycle_checksum,
             source_encounter_id, maintained_effect_state_id, created_at, updated_at
      FROM public.character_active_rule_effects
      WHERE maintained_effect_state_id = ${stateId} AND source_encounter_id = ${encounterId}
      ORDER BY character_id ASC, created_ordinal ASC, id ASC${lockClause}
    `.execute(db)
    const actorRows = await sql<Record<string, unknown>>`
      SELECT id, created_ordinal, version, definition, definition_checksum, lifecycle, lifecycle_checksum,
             maintained_effect_state_id, created_at, updated_at, target_actor_id
      FROM public.encounter_active_rule_effects
      WHERE maintained_effect_state_id = ${stateId} AND encounter_id = ${encounterId}
      ORDER BY target_actor_id ASC, created_ordinal ASC, id ASC${lockClause}
    `.execute(db)
    const characters = characterRows.rows.map((row) => {
      const parsed = z
        .object({ character_id: serverUuidIdentityDtoSchema })
        .passthrough()
        .parse(row)
      return fromRow({ kind: 'CHARACTER', characterId: parsed.character_id }, row)
    })
    const actors = actorRows.rows.map((row) => {
      const parsed = z
        .object({ target_actor_id: serverUuidIdentityDtoSchema })
        .passthrough()
        .parse(row)
      return fromRow(
        { kind: 'ENCOUNTER_ACTOR', encounterId, targetActorId: parsed.target_actor_id },
        row
      )
    })
    return [...characters, ...actors]
  }

  async function lockMaintainedState(input: {
    encounterId: string
    ownerActorId: string
    maintenanceDefinitionId: string
  }): Promise<EncounterMaintainedEffectStateRecord | null> {
    const encounterId = serverUuidIdentityDtoSchema.parse(input.encounterId)
    const ownerActorId = serverUuidIdentityDtoSchema.parse(input.ownerActorId)
    const maintenanceDefinitionId = serverUuidIdentityDtoSchema.parse(input.maintenanceDefinitionId)
    const result = await sql<Record<string, unknown>>`
      SELECT id, encounter_id, owner_actor_id, maintenance_definition_id, descriptor,
             descriptor_checksum, version, created_at, updated_at
      FROM public.encounter_maintained_effect_states
      WHERE encounter_id = ${encounterId} AND owner_actor_id = ${ownerActorId}
        AND maintenance_definition_id = ${maintenanceDefinitionId}
      FOR UPDATE
    `.execute(db)
    const row = result.rows[0]
    return row ? maintainedStateFromRow(row) : null
  }

  async function lockMaintainedStatesByOwner(input: {
    encounterId: string
    ownerActorId: string
  }): Promise<EncounterMaintainedEffectStateRecord[]> {
    const encounterId = serverUuidIdentityDtoSchema.parse(input.encounterId)
    const ownerActorId = serverUuidIdentityDtoSchema.parse(input.ownerActorId)
    const result = await sql<Record<string, unknown>>`
      SELECT id, encounter_id, owner_actor_id, maintenance_definition_id, descriptor,
             descriptor_checksum, version, created_at, updated_at
      FROM public.encounter_maintained_effect_states
      WHERE encounter_id = ${encounterId} AND owner_actor_id = ${ownerActorId}
      ORDER BY maintenance_definition_id ASC, id ASC
      FOR UPDATE
    `.execute(db)
    return result.rows.map(maintainedStateFromRow)
  }

  async function lockMaintainedStateById(input: {
    encounterId: string
    stateId: string
  }): Promise<EncounterMaintainedEffectStateRecord | null> {
    const encounterId = serverUuidIdentityDtoSchema.parse(input.encounterId)
    const stateId = serverUuidIdentityDtoSchema.parse(input.stateId)
    const result = await sql<Record<string, unknown>>`
      SELECT id, encounter_id, owner_actor_id, maintenance_definition_id, descriptor,
             descriptor_checksum, version, created_at, updated_at
      FROM public.encounter_maintained_effect_states
      WHERE encounter_id = ${encounterId} AND id = ${stateId}
      FOR UPDATE
    `.execute(db)
    const row = result.rows[0]
    return row ? maintainedStateFromRow(row) : null
  }

  async function list(inputOwner: ActiveRuleEffectOwner): Promise<ActiveRuleEffectRecord[]> {
    const owner = normalizeOwner(inputOwner)
    const result =
      owner.kind === 'CHARACTER'
        ? await sql<Record<string, unknown>>`
          SELECT id, created_ordinal, version, definition, definition_checksum, lifecycle, lifecycle_checksum,
                 source_encounter_id, maintained_effect_state_id, created_at, updated_at
          FROM public.character_active_rule_effects
          WHERE character_id = ${owner.characterId}
          ORDER BY created_ordinal ASC, id ASC
        `.execute(db)
        : await sql<Record<string, unknown>>`
          SELECT id, created_ordinal, version, definition, definition_checksum, lifecycle, lifecycle_checksum,
                 maintained_effect_state_id, created_at, updated_at
          FROM public.encounter_active_rule_effects
          WHERE encounter_id = ${owner.encounterId} AND target_actor_id = ${owner.targetActorId}
          ORDER BY created_ordinal ASC, id ASC
        `.execute(db)
    return result.rows.map((row) => fromRow(owner, row))
  }

  async function lockById(
    inputOwner: ActiveRuleEffectOwner,
    inputEffectId: string
  ): Promise<ActiveRuleEffectRecord | null> {
    const owner = normalizeOwner(inputOwner)
    const effectId = serverUuidIdentityDtoSchema.parse(inputEffectId)
    const result =
      owner.kind === 'CHARACTER'
        ? await sql<Record<string, unknown>>`
          SELECT id, created_ordinal, version, definition, definition_checksum, lifecycle, lifecycle_checksum,
                 source_encounter_id, maintained_effect_state_id, created_at, updated_at
          FROM public.character_active_rule_effects
          WHERE id = ${effectId} AND character_id = ${owner.characterId} FOR UPDATE
        `.execute(db)
        : await sql<Record<string, unknown>>`
          SELECT id, created_ordinal, version, definition, definition_checksum, lifecycle, lifecycle_checksum,
                 maintained_effect_state_id, created_at, updated_at
          FROM public.encounter_active_rule_effects
          WHERE id = ${effectId} AND encounter_id = ${owner.encounterId}
            AND target_actor_id = ${owner.targetActorId} FOR UPDATE
        `.execute(db)
    const row = result.rows[0]
    return row ? fromRow(owner, row) : null
  }

  async function allocationFor(
    owner: ActiveRuleEffectOwner
  ): Promise<{ activeCount: number; nextOrdinal: number }> {
    const result =
      owner.kind === 'CHARACTER'
        ? await sql<Record<string, unknown>>`
          SELECT count(*)::integer AS active_count, coalesce(max(created_ordinal), 0)::integer AS next_ordinal
          FROM public.character_active_rule_effects
          WHERE character_id = ${owner.characterId}
        `.execute(db)
        : await sql<Record<string, unknown>>`
          SELECT count(*)::integer AS active_count, coalesce(max(created_ordinal), 0)::integer AS next_ordinal
          FROM public.encounter_active_rule_effects
          WHERE encounter_id = ${owner.encounterId} AND target_actor_id = ${owner.targetActorId}
        `.execute(db)
    const row = allocationSchema.parse(result.rows[0])
    return { activeCount: row.active_count, nextOrdinal: row.next_ordinal }
  }

  async function maintainedAllocationFor(input: {
    encounterId: string
    ownerActorId: string
  }): Promise<{ stateCount: number; dependentEffectCount: number }> {
    const encounterId = serverUuidIdentityDtoSchema.parse(input.encounterId)
    const ownerActorId = serverUuidIdentityDtoSchema.parse(input.ownerActorId)
    const result = await sql<Record<string, unknown>>`
      SELECT
        (
          SELECT count(*)::integer
          FROM public.encounter_maintained_effect_states state
          WHERE state.encounter_id = ${encounterId} AND state.owner_actor_id = ${ownerActorId}
        ) AS state_count,
        (
          SELECT count(*)::integer
          FROM public.character_active_rule_effects dependent
          INNER JOIN public.encounter_maintained_effect_states state
            ON state.id = dependent.maintained_effect_state_id
          WHERE state.encounter_id = ${encounterId} AND state.owner_actor_id = ${ownerActorId}
        ) + (
          SELECT count(*)::integer
          FROM public.encounter_active_rule_effects dependent
          INNER JOIN public.encounter_maintained_effect_states state
            ON state.id = dependent.maintained_effect_state_id
          WHERE state.encounter_id = ${encounterId} AND state.owner_actor_id = ${ownerActorId}
        ) AS dependent_effect_count
    `.execute(db)
    const row = maintainedAllocationSchema.parse(result.rows[0])
    return { stateCount: row.state_count, dependentEffectCount: row.dependent_effect_count }
  }

  return {
    list,
    findMaintainedState,
    lockMaintainedState,
    lockMaintainedStatesByOwner,
    lockMaintainedStateById,
    async createMaintainedState(input: {
      id: string
      encounterId: string
      ownerActorId: string
      descriptor: EncounterMaintainedEffectDescriptorDto
    }): Promise<EncounterMaintainedEffectStateRecord> {
      const id = serverUuidIdentityDtoSchema.parse(input.id)
      const encounterId = serverUuidIdentityDtoSchema.parse(input.encounterId)
      const ownerActorId = serverUuidIdentityDtoSchema.parse(input.ownerActorId)
      const descriptor = encounterMaintainedEffectDescriptorDtoSchema.parse(input.descriptor)
      if (descriptor.sourceActorId !== ownerActorId)
        throw new Error('Maintained effect descriptor source actor does not match its owner.')
      const allocation = await maintainedAllocationFor({ encounterId, ownerActorId })
      if (allocation.stateCount >= MAX_MAINTAINED_RULE_EFFECT_STATES_PER_ACTOR)
        throw new MaintainedRuleEffectStateLimitError()
      const result = await sql<Record<string, unknown>>`
        INSERT INTO public.encounter_maintained_effect_states
          (id, encounter_id, owner_actor_id, maintenance_definition_id, descriptor, descriptor_checksum)
        VALUES (${id}, ${encounterId}, ${ownerActorId}, ${descriptor.maintenanceDefinitionId},
                ${JSON.stringify(descriptor)}::jsonb, ${checksumCanonicalJson(descriptor)})
        RETURNING id, encounter_id, owner_actor_id, maintenance_definition_id, descriptor,
                  descriptor_checksum, version, created_at, updated_at
      `.execute(db)
      const row = result.rows[0]
      if (!row) throw new Error('Maintained effect state was not created.')
      return maintainedStateFromRow(row)
    },
    async deleteMaintainedStateCas(input: {
      id: string
      encounterId: string
      ownerActorId: string
      expectedVersion: number
    }): Promise<void> {
      const result = await sql`
        DELETE FROM public.encounter_maintained_effect_states
        WHERE id = ${serverUuidIdentityDtoSchema.parse(input.id)}
          AND encounter_id = ${serverUuidIdentityDtoSchema.parse(input.encounterId)}
          AND owner_actor_id = ${serverUuidIdentityDtoSchema.parse(input.ownerActorId)}
          AND version = ${z.number().int().positive().parse(input.expectedVersion)}
      `.execute(db)
      if (result.numAffectedRows !== 1n)
        throw new ActiveRuleEffectCurrentnessError(
          'Maintained effect state changed before deletion.'
        )
    },
    async lockDependentEffects(input: {
      stateId: string
      encounterId: string
    }): Promise<ActiveRuleEffectRecord[]> {
      return dependentEffects({ ...input, lock: true })
    },
    async listDependentEffects(input: { stateId: string; encounterId: string }) {
      return dependentEffects({ ...input, lock: false })
    },
    /**
     * Locks an owner's complete effect set in the same deterministic order used
     * for recurrence. Callers must already hold the owning aggregate root.
     */
    async lockByOwner(inputOwner: ActiveRuleEffectOwner): Promise<ActiveRuleEffectRecord[]> {
      const owner = normalizeOwner(inputOwner)
      const result =
        owner.kind === 'CHARACTER'
          ? await sql<Record<string, unknown>>`
            SELECT id, created_ordinal, version, definition, definition_checksum, lifecycle, lifecycle_checksum,
                   source_encounter_id, maintained_effect_state_id, created_at, updated_at
            FROM public.character_active_rule_effects
            WHERE character_id = ${owner.characterId}
            ORDER BY created_ordinal ASC, id ASC FOR UPDATE
          `.execute(db)
          : await sql<Record<string, unknown>>`
            SELECT id, created_ordinal, version, definition, definition_checksum, lifecycle, lifecycle_checksum,
                   maintained_effect_state_id, created_at, updated_at
            FROM public.encounter_active_rule_effects
            WHERE encounter_id = ${owner.encounterId} AND target_actor_id = ${owner.targetActorId}
            ORDER BY created_ordinal ASC, id ASC FOR UPDATE
          `.execute(db)
      return result.rows.map((row) => fromRow(owner, row))
    },
    lockById,
    async listCharacterOwnersForEncounterCleanup(
      inputSourceEncounterId: string
    ): Promise<string[]> {
      const sourceEncounterId = serverUuidIdentityDtoSchema.parse(inputSourceEncounterId)
      const result = await sql<Record<string, unknown>>`
        SELECT DISTINCT character_id
        FROM public.character_active_rule_effects
        WHERE source_encounter_id = ${sourceEncounterId}
        ORDER BY character_id ASC
      `.execute(db)
      return [
        ...new Set(result.rows.map((row) => characterOwnerLocatorRowSchema.parse(row).character_id))
      ].sort()
    },
    /**
     * Non-locking owner discovery for actor removal. The caller must lock every
     * returned Character root before taking any maintained-state/effect lock.
     */
    async listCharacterOwnersForActorRemovalCleanup(input: {
      encounterId: string
      removedActorId: string
    }): Promise<string[]> {
      const encounterId = serverUuidIdentityDtoSchema.parse(input.encounterId)
      const removedActorId = serverUuidIdentityDtoSchema.parse(input.removedActorId)
      const result = await sql<Record<string, unknown>>`
        SELECT DISTINCT dependent.character_id
        FROM public.character_active_rule_effects dependent
        INNER JOIN public.encounter_maintained_effect_states owned_state
          ON owned_state.id = dependent.maintained_effect_state_id
        WHERE owned_state.encounter_id = ${encounterId}
          AND owned_state.owner_actor_id = ${removedActorId}
        UNION
        SELECT DISTINCT dependent.character_id
        FROM public.character_active_rule_effects dependent
        INNER JOIN public.encounter_maintained_effect_states foreign_state
          ON foreign_state.id = dependent.maintained_effect_state_id
        INNER JOIN public.encounter_active_rule_effects actor_effect
          ON actor_effect.maintained_effect_state_id = foreign_state.id
        WHERE foreign_state.encounter_id = ${encounterId}
          AND actor_effect.encounter_id = ${encounterId}
          AND actor_effect.target_actor_id = ${removedActorId}
        ORDER BY character_id ASC
      `.execute(db)
      return result.rows.map((row) => characterOwnerLocatorRowSchema.parse(row).character_id)
    },
    async lockCharacterEffectsForEncounterCleanup(input: {
      characterId: string
      sourceEncounterId: string
    }): Promise<ActiveRuleEffectRecord[]> {
      const characterId = serverUuidIdentityDtoSchema.parse(input.characterId)
      const sourceEncounterId = serverUuidIdentityDtoSchema.parse(input.sourceEncounterId)
      const owner: ActiveRuleEffectOwner = { kind: 'CHARACTER', characterId }
      const result = await sql<Record<string, unknown>>`
        SELECT id, created_ordinal, version, definition, definition_checksum, lifecycle, lifecycle_checksum,
               source_encounter_id, maintained_effect_state_id, created_at, updated_at
        FROM public.character_active_rule_effects
        WHERE character_id = ${characterId} AND source_encounter_id = ${sourceEncounterId}
        ORDER BY created_ordinal ASC, id ASC FOR UPDATE
      `.execute(db)
      return result.rows.map((row) => fromRow(owner, row))
    },
    async create(input: {
      id: string
      owner: ActiveRuleEffectOwner
      definition: ActiveRuleEffectDefinitionDto
      lifecycle: ActiveRuleEffectLifecycleDto
      maintainedEffectStateId?: string | null
    }): Promise<ActiveRuleEffectRecord> {
      const owner = normalizeOwner(input.owner)
      const id = serverUuidIdentityDtoSchema.parse(input.id)
      const definition = definitionForWrite(input.definition)
      requireDefinitionOwner(owner, definition.definition)
      const lifecycle = lifecycleForWrite(definition.definition, input.lifecycle)
      const maintainedEffectStateId =
        input.maintainedEffectStateId == null
          ? null
          : serverUuidIdentityDtoSchema.parse(input.maintainedEffectStateId)
      if (maintainedEffectStateId !== null && definition.sourceEncounterId === null) {
        throw new Error('Maintained active effects require Encounter lifetime provenance.')
      }
      if (maintainedEffectStateId !== null) {
        if (definition.definition.origin.kind !== 'ENCOUNTER')
          throw new Error('Maintained active effects require an Encounter actor source.')
        const sourceEncounterId = serverUuidIdentityDtoSchema.parse(
          definition.definition.origin.sourceAggregateId
        )
        const sourceActorId = serverUuidIdentityDtoSchema.parse(
          definition.definition.origin.sourceActorId
        )
        const state = await lockMaintainedStateById({
          encounterId: sourceEncounterId,
          stateId: maintainedEffectStateId
        })
        if (!state)
          throw new ActiveRuleEffectCurrentnessError(
            'Maintained effect state changed before dependent creation.'
          )
        if (state.encounterId !== sourceEncounterId || state.ownerActorId !== sourceActorId)
          throw new ActiveRuleEffectCurrentnessError(
            'Maintained effect state does not match the immutable Encounter source.'
          )
        const maintainedAllocation = await maintainedAllocationFor({
          encounterId: state.encounterId,
          ownerActorId: state.ownerActorId
        })
        if (
          maintainedAllocation.dependentEffectCount >=
          MAX_MAINTAINED_RULE_EFFECT_DEPENDENTS_PER_ACTOR
        )
          throw new MaintainedRuleEffectDependentLimitError()
      }
      const allocation = await allocationFor(owner)
      if (allocation.activeCount >= MAX_ACTIVE_RULE_EFFECTS_PER_OWNER) {
        throw new ActiveRuleEffectLimitError()
      }
      const createdOrdinal = allocation.nextOrdinal + 1
      const result =
        owner.kind === 'CHARACTER'
          ? await sql<Record<string, unknown>>`
            INSERT INTO public.character_active_rule_effects
              (id, character_id, source_encounter_id, maintained_effect_state_id, created_ordinal, definition, definition_checksum, lifecycle, lifecycle_checksum)
            VALUES (${id}, ${owner.characterId}, ${definition.sourceEncounterId}, ${maintainedEffectStateId}, ${createdOrdinal},
                    ${JSON.stringify(definition.definition)}::jsonb, ${definition.checksum},
                    ${JSON.stringify(lifecycle.lifecycle)}::jsonb, ${lifecycle.checksum})
            RETURNING id, created_ordinal, version, definition, definition_checksum, lifecycle, lifecycle_checksum,
                      source_encounter_id, maintained_effect_state_id, created_at, updated_at
          `.execute(db)
          : await sql<Record<string, unknown>>`
            INSERT INTO public.encounter_active_rule_effects
              (id, encounter_id, target_actor_id, maintained_effect_state_id, created_ordinal, definition, definition_checksum, lifecycle, lifecycle_checksum)
            VALUES (${id}, ${owner.encounterId}, ${owner.targetActorId}, ${maintainedEffectStateId}, ${createdOrdinal},
                    ${JSON.stringify(definition.definition)}::jsonb, ${definition.checksum},
                    ${JSON.stringify(lifecycle.lifecycle)}::jsonb, ${lifecycle.checksum})
            RETURNING id, created_ordinal, version, definition, definition_checksum, lifecycle, lifecycle_checksum,
                      maintained_effect_state_id, created_at, updated_at
          `.execute(db)
      const row = result.rows[0]
      if (!row) throw new Error('Active rule effect was not created.')
      return fromRow(owner, row)
    },
    async updateLifecycleCas(input: {
      id: string
      owner: ActiveRuleEffectOwner
      expectedVersion: number
      lifecycle: ActiveRuleEffectLifecycleDto
    }): Promise<ActiveRuleEffectRecord> {
      const owner = normalizeOwner(input.owner)
      const id = serverUuidIdentityDtoSchema.parse(input.id)
      const expectedVersion = z.number().int().positive().parse(input.expectedVersion)
      const current = await lockById(owner, id)
      if (!current || current.version !== expectedVersion) {
        throw new ActiveRuleEffectCurrentnessError(
          'Active rule effect changed before lifecycle update.'
        )
      }
      const lifecycle = lifecycleForWrite(current.definition, input.lifecycle)
      const result =
        owner.kind === 'CHARACTER'
          ? await sql<Record<string, unknown>>`
            UPDATE public.character_active_rule_effects
            SET version = version + 1, lifecycle = ${JSON.stringify(lifecycle.lifecycle)}::jsonb,
                lifecycle_checksum = ${lifecycle.checksum}, updated_at = now()
            WHERE id = ${id} AND character_id = ${owner.characterId} AND version = ${expectedVersion}
            RETURNING id, created_ordinal, version, definition, definition_checksum, lifecycle, lifecycle_checksum,
                      source_encounter_id, maintained_effect_state_id, created_at, updated_at
          `.execute(db)
          : await sql<Record<string, unknown>>`
            UPDATE public.encounter_active_rule_effects
            SET version = version + 1, lifecycle = ${JSON.stringify(lifecycle.lifecycle)}::jsonb,
                lifecycle_checksum = ${lifecycle.checksum}, updated_at = now()
            WHERE id = ${id} AND encounter_id = ${owner.encounterId}
              AND target_actor_id = ${owner.targetActorId} AND version = ${expectedVersion}
            RETURNING id, created_ordinal, version, definition, definition_checksum, lifecycle, lifecycle_checksum,
                      maintained_effect_state_id, created_at, updated_at
          `.execute(db)
      const row = result.rows[0]
      if (!row) {
        throw new ActiveRuleEffectCurrentnessError(
          'Active rule effect changed before lifecycle update.'
        )
      }
      return fromRow(owner, row)
    },
    async deleteCas(input: {
      id: string
      owner: ActiveRuleEffectOwner
      expectedVersion: number
    }): Promise<void> {
      const owner = normalizeOwner(input.owner)
      const id = serverUuidIdentityDtoSchema.parse(input.id)
      const expectedVersion = z.number().int().positive().parse(input.expectedVersion)
      const result =
        owner.kind === 'CHARACTER'
          ? await sql`
            DELETE FROM public.character_active_rule_effects
            WHERE id = ${id} AND character_id = ${owner.characterId} AND version = ${expectedVersion}
          `.execute(db)
          : await sql`
            DELETE FROM public.encounter_active_rule_effects
            WHERE id = ${id} AND encounter_id = ${owner.encounterId}
              AND target_actor_id = ${owner.targetActorId} AND version = ${expectedVersion}
          `.execute(db)
      if (result.numAffectedRows !== 1n) {
        throw new ActiveRuleEffectCurrentnessError('Active rule effect changed before deletion.')
      }
    }
  }
}
