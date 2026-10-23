import {
  activeRuleEffectDefinitionDtoSchema,
  activeRuleEffectStateDtoSchema,
  encounterMaintainedEffectDescriptorDtoSchema,
  MAX_ACTIVE_RULE_EFFECTS_PER_OWNER,
  MAX_MAINTAINED_RULE_EFFECT_DEPENDENTS_PER_ACTOR,
  MAX_MAINTAINED_RULE_EFFECT_STATES_PER_ACTOR,
  type ActiveRuleEffectDefinitionDto,
  type EncounterMaintainedEffectDescriptorDto
} from '@artificer-toolkit/schema/shared/activeRuleEffects'
import {
  activeRuleEffectLifecycleDtoSchema,
  type ActiveRuleEffectLifecycleDto
} from '@artificer-toolkit/schema/shared/activeRuleEffectLifecycle'
import { serverUuidIdentityDtoSchema } from '@artificer-toolkit/schema/shared/serverUuidIdentity'
import {
  activeRuleEffectRecordSchema,
  characterActiveRuleEffectStoredSchema,
  encounterActiveRuleEffectStoredSchema,
  encounterMaintainedEffectStateRecordSchema,
  encounterMaintainedEffectStateStoredSchema,
  type ActiveRuleEffectOwner,
  type ActiveRuleEffectRecord,
  type EncounterMaintainedEffectStateRecord
} from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import {
  ownerFor,
  prepareActiveRuleEffectRecord,
  prepareMaintainedEffectStateRecord,
  requireDefinitionOwner,
  sourceEncounterIdForDefinition
} from '@artificer-toolkit/rules-runtime/activeRuleEffectRecords'
import {
  onEndGrantEffect,
  onEndGrantEffectId
} from '@artificer-toolkit/rules-runtime/encounterEffectOnEnd'
import { steppedDownEffectState } from '@artificer-toolkit/rules-runtime/character/restStepDown'
import { turnEffectOwner } from '@artificer-toolkit/rules-runtime/encounterTurnEffectState'
import { z } from 'zod'
import {
  endActorFormHeldBy,
  endCharacterFormHeldBy,
  holdsActorForm
} from './actorFormPersistence.js'
import { readEncounterCharacterPlay } from './characterPlay.js'
import { listStateZones } from './maintainedStateZones.js'
import { playAbsenceContribution, syncPlayAbsence } from './playAbsencePersistence.js'
import type { EncounterDocument, EncounterReadContext, EncounterWriteContext } from './store.js'

const positiveIntegerSchema = z.number().int().positive()

/**
 * Why an effect leaves the store. `ENDED` is the effect running its course (expiry, Concentration
 * dropping, an early-end trigger, a Dispel, damage): the effect's authored `onEnd` grant is left
 * on its holder, for the rest of the Run. `REMOVED` leaves nothing behind: bookkeeping (an undo, an
 * actor or account going away) or an end where no turn can count a follow-on down (outside a Run, a
 * Run completing, a lapse on the Campaign clock).
 */
export type ActiveRuleEffectRemoval = 'ENDED' | 'REMOVED'

function parseJson(value: string, message: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    throw new Error(message)
  }
}

function parseDefinition(value: string): ActiveRuleEffectDefinitionDto {
  return activeRuleEffectDefinitionDtoSchema.parse(
    parseJson(value, 'Active rule-effect definition JSON is invalid.')
  )
}

function parseLifecycle(definition: ActiveRuleEffectDefinitionDto, value: unknown) {
  const lifecycle = activeRuleEffectLifecycleDtoSchema.parse(value)
  return activeRuleEffectStateDtoSchema.parse({ definition, lifecycle }).lifecycle
}

/** The indexed copy of a lifecycle's Concentration caster stamp. */
function concentrationCasterColumn(lifecycle: ActiveRuleEffectLifecycleDto) {
  return lifecycle.concentrationCasterCharacterId ?? null
}

export function readCharacterEffect(
  row: EncounterDocument<'characterActiveRuleEffects'>
): ActiveRuleEffectRecord {
  const { _id, _creationTime, ...stored } = row
  const value = characterActiveRuleEffectStoredSchema.parse(stored)
  const definition = parseDefinition(value.definitionJson)
  const lifecycle = parseLifecycle(definition, value.lifecycle)
  if (checksumCanonicalJson(definition) !== value.definitionChecksum)
    throw new Error(
      'Active rule-effect definition checksum does not match its persisted definition.'
    )
  if (checksumCanonicalJson(lifecycle) !== value.lifecycleChecksum)
    throw new Error('Active rule-effect lifecycle checksum does not match its persisted lifecycle.')
  // D151: a carried grant relinked to a later Run's reinstated Concentration keeps its earlier origin.
  const relinkedCarried =
    value.maintainedEffectStateId !== null &&
    value.sourceEncounterId !== null &&
    concentrationCasterColumn(lifecycle) !== null
  if (
    !relinkedCarried &&
    value.sourceEncounterId !==
      sourceEncounterIdForDefinition(definition, value.maintainedEffectStateId)
  )
    throw new Error(
      'Character active rule-effect source Encounter does not match immutable definition provenance.'
    )
  if (value.concentrationCasterCharacterId !== concentrationCasterColumn(lifecycle))
    throw new Error('Character active rule-effect caster index does not match its lifecycle.')
  return activeRuleEffectRecordSchema.parse({
    id: value.id,
    owner: { kind: 'CHARACTER', characterId: value.characterId },
    sourceEncounterId: value.sourceEncounterId,
    maintainedEffectStateId: value.maintainedEffectStateId,
    createdOrdinal: value.createdOrdinal,
    version: value.version,
    definition,
    definitionChecksum: value.definitionChecksum,
    lifecycle,
    lifecycleChecksum: value.lifecycleChecksum,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt
  })
}

export function readEncounterEffect(
  row: EncounterDocument<'encounterActiveRuleEffects'>
): ActiveRuleEffectRecord {
  const { _id, _creationTime, ...stored } = row
  const value = encounterActiveRuleEffectStoredSchema.parse(stored)
  const definition = parseDefinition(value.definitionJson)
  const lifecycle = parseLifecycle(definition, value.lifecycle)
  if (checksumCanonicalJson(definition) !== value.definitionChecksum)
    throw new Error(
      'Active rule-effect definition checksum does not match its persisted definition.'
    )
  if (checksumCanonicalJson(lifecycle) !== value.lifecycleChecksum)
    throw new Error('Active rule-effect lifecycle checksum does not match its persisted lifecycle.')
  requireDefinitionOwner(
    { kind: 'ENCOUNTER_ACTOR', encounterId: value.encounterId, targetActorId: value.targetActorId },
    definition
  )
  return activeRuleEffectRecordSchema.parse({
    id: value.id,
    owner: {
      kind: 'ENCOUNTER_ACTOR',
      encounterId: value.encounterId,
      targetActorId: value.targetActorId
    },
    sourceEncounterId: null,
    maintainedEffectStateId: value.maintainedEffectStateId,
    createdOrdinal: value.createdOrdinal,
    version: value.version,
    definition,
    definitionChecksum: value.definitionChecksum,
    lifecycle,
    lifecycleChecksum: value.lifecycleChecksum,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt
  })
}

export function readMaintainedState(
  row: EncounterDocument<'encounterMaintainedEffectStates'>
): EncounterMaintainedEffectStateRecord {
  const { _id, _creationTime, ...stored } = row
  const value = encounterMaintainedEffectStateStoredSchema.parse(stored)
  const descriptor = encounterMaintainedEffectDescriptorDtoSchema.parse(
    parseJson(value.descriptorJson, 'Maintained effect descriptor JSON is invalid.')
  )
  if (checksumCanonicalJson(descriptor) !== value.descriptorChecksum)
    throw new Error('Maintained effect descriptor checksum does not match persisted state.')
  if (descriptor.maintenanceDefinitionId !== value.maintenanceDefinitionId)
    throw new Error('Maintained effect definition identity does not match persisted state.')
  if (descriptor.sourceActorId !== value.ownerActorId)
    throw new Error('Maintained effect descriptor source actor does not match its owner.')
  const { descriptorJson: _descriptorJson, ...record } = value
  return encounterMaintainedEffectStateRecordSchema.parse({ ...record, descriptor })
}

async function requireCharacter(ctx: EncounterReadContext, characterId: string) {
  if (!(await readEncounterCharacterPlay(ctx, characterId)))
    throw new Error('Active rule-effect Character owner is unavailable.')
}

async function requireEncounterActor(
  ctx: EncounterReadContext,
  encounterId: string,
  actorId: string
) {
  const run = await ctx.db
    .query('encounterRuns')
    .withIndex('by_publicId', (q) => q.eq('id', encounterId))
    .unique()
  if (!run) throw new Error('Active rule-effect Encounter owner is unavailable.')
  const actor = await ctx.db
    .query('encounterRunActors')
    .withIndex('by_encounterId_id', (q) => q.eq('encounterId', encounterId).eq('id', actorId))
    .unique()
  if (!actor) throw new Error('Active rule-effect Encounter actor is unavailable.')
}

async function requireOwner(ctx: EncounterReadContext, owner: ActiveRuleEffectOwner) {
  if (owner.kind === 'CHARACTER') return requireCharacter(ctx, owner.characterId)
  return requireEncounterActor(ctx, owner.encounterId, owner.targetActorId)
}

async function listOwner(ctx: EncounterReadContext, owner: ActiveRuleEffectOwner) {
  if (owner.kind === 'CHARACTER')
    return (
      await ctx.db
        .query('characterActiveRuleEffects')
        .withIndex('by_characterId_createdOrdinal_id', (q) =>
          q.eq('characterId', owner.characterId)
        )
        .take(MAX_ACTIVE_RULE_EFFECTS_PER_OWNER + 1)
    ).map(readCharacterEffect)
  return (
    await ctx.db
      .query('encounterActiveRuleEffects')
      .withIndex('by_encounterId_targetActorId_createdOrdinal_id', (q) =>
        q.eq('encounterId', owner.encounterId).eq('targetActorId', owner.targetActorId)
      )
      .take(MAX_ACTIVE_RULE_EFFECTS_PER_OWNER + 1)
  ).map(readEncounterEffect)
}

export async function listActiveRuleEffects(
  ctx: EncounterReadContext,
  inputOwner: ActiveRuleEffectOwner,
  /** The caller has read or written the owner in this transaction. */
  options: { ownerVerified?: boolean } = {}
): Promise<ActiveRuleEffectRecord[]> {
  const owner = ownerFor(inputOwner)
  if (!options.ownerVerified) await requireOwner(ctx, owner)
  const effects = await listOwner(ctx, owner)
  if (effects.length > MAX_ACTIVE_RULE_EFFECTS_PER_OWNER)
    throw new Error('Active rule effects exceed the supported bound.')
  return effects
}

/**
 * The active effects of every actor in the Run, keyed by the holding actor's id: the bounded scan
 * for what an actor applied to others, since effects are indexed by holder, not by source.
 */
export async function readActiveEffectsByActorId(
  ctx: EncounterReadContext,
  encounterId: string,
  actors: readonly Parameters<typeof turnEffectOwner>[0][]
): Promise<Map<string, ActiveRuleEffectRecord[]>> {
  return new Map(
    await Promise.all(
      actors.map(
        async (held) =>
          [held.id, await listActiveRuleEffects(ctx, turnEffectOwner(held, encounterId))] as const
      )
    )
  )
}

/** Every Character-held grant carried over from a Concentration the given Character cast (D99). */
export async function listCarriedActiveRuleEffects(
  ctx: EncounterReadContext,
  casterCharacterId: string
): Promise<ActiveRuleEffectRecord[]> {
  const caster = serverUuidIdentityDtoSchema.parse(casterCharacterId)
  // A caster concentrates on one thing at a time, and a new Concentration ends the grants carried
  // from the last, so what they carry cannot outgrow what one Concentration keeps alive.
  const rows = await ctx.db
    .query('characterActiveRuleEffects')
    .withIndex('by_concentrationCaster', (q) => q.eq('concentrationCasterCharacterId', caster))
    .take(MAX_MAINTAINED_RULE_EFFECT_DEPENDENTS_PER_ACTOR + 1)
  if (rows.length > MAX_MAINTAINED_RULE_EFFECT_DEPENDENTS_PER_ACTOR)
    throw new Error('Carried Concentration grants exceed the supported bound.')
  return rows.map(readCharacterEffect)
}

/** The effects a maintained state keeps alive, on Characters and on Encounter actors. */
export async function readDependentEffects(
  ctx: EncounterReadContext,
  encounterId: string,
  stateId: string
) {
  const characters = (
    await ctx.db
      .query('characterActiveRuleEffects')
      .withIndex('by_state_source_owner_order', (q) =>
        q.eq('maintainedEffectStateId', stateId).eq('sourceEncounterId', encounterId)
      )
      .take(MAX_MAINTAINED_RULE_EFFECT_DEPENDENTS_PER_ACTOR + 1)
  ).map(readCharacterEffect)
  const actors = (
    await ctx.db
      .query('encounterActiveRuleEffects')
      .withIndex('by_state_encounter_owner_order', (q) =>
        q.eq('maintainedEffectStateId', stateId).eq('encounterId', encounterId)
      )
      .take(MAX_MAINTAINED_RULE_EFFECT_DEPENDENTS_PER_ACTOR + 1)
  ).map(readEncounterEffect)
  if (characters.length + actors.length > MAX_MAINTAINED_RULE_EFFECT_DEPENDENTS_PER_ACTOR)
    throw new Error('Maintained effect dependents exceed the supported bound.')
  for (const effect of [...characters, ...actors]) await requireOwner(ctx, effect.owner)
  return { characters, actors }
}

/** The maintained state an Encounter actor owns for one maintenance definition, if any. */
export async function readMaintainedStateByDefinition(
  ctx: EncounterReadContext,
  input: { encounterId: string; ownerActorId: string; maintenanceDefinitionId: string }
) {
  const encounterId = serverUuidIdentityDtoSchema.parse(input.encounterId)
  const ownerActorId = serverUuidIdentityDtoSchema.parse(input.ownerActorId)
  const maintenanceDefinitionId = serverUuidIdentityDtoSchema.parse(input.maintenanceDefinitionId)
  const row = await ctx.db
    .query('encounterMaintainedEffectStates')
    .withIndex('by_encounter_owner_definition', (q) =>
      q
        .eq('encounterId', encounterId)
        .eq('ownerActorId', ownerActorId)
        .eq('maintenanceDefinitionId', maintenanceDefinitionId)
    )
    .unique()
  if (!row) return null
  const state = readMaintainedState(row)
  await requireEncounterActor(ctx, state.encounterId, state.ownerActorId)
  return state
}

/** Internal mutation helper. Callers authorize the aggregate and compose all writes in this mutation. */
export function createActiveRuleEffectStore(ctx: EncounterWriteContext) {
  async function findEffectById(owner: ActiveRuleEffectOwner, id: string) {
    if (owner.kind === 'CHARACTER') {
      const row = await ctx.db
        .query('characterActiveRuleEffects')
        .withIndex('by_characterId_id', (q) => q.eq('characterId', owner.characterId).eq('id', id))
        .unique()
      return row ? readCharacterEffect(row) : null
    }
    const row = await ctx.db
      .query('encounterActiveRuleEffects')
      .withIndex('by_encounterId_targetActorId_id', (q) =>
        q.eq('encounterId', owner.encounterId).eq('targetActorId', owner.targetActorId).eq('id', id)
      )
      .unique()
    return row ? readEncounterEffect(row) : null
  }

  async function findStateById(encounterId: string, stateId: string) {
    const row = await ctx.db
      .query('encounterMaintainedEffectStates')
      .withIndex('by_encounterId_id', (q) => q.eq('encounterId', encounterId).eq('id', stateId))
      .unique()
    if (!row) return null
    const state = readMaintainedState(row)
    await requireEncounterActor(ctx, state.encounterId, state.ownerActorId)
    return state
  }

  const dependentEffects = (encounterId: string, stateId: string) =>
    readDependentEffects(ctx, encounterId, stateId)

  async function listStates(encounterId: string, ownerActorId: string) {
    const rows = await ctx.db
      .query('encounterMaintainedEffectStates')
      .withIndex('by_encounter_owner_definition_order', (q) =>
        q.eq('encounterId', encounterId).eq('ownerActorId', ownerActorId)
      )
      .take(MAX_MAINTAINED_RULE_EFFECT_STATES_PER_ACTOR + 1)
    if (rows.length > MAX_MAINTAINED_RULE_EFFECT_STATES_PER_ACTOR)
      throw new Error('Maintained effect states exceed the supported bound.')
    const states = rows.map(readMaintainedState)
    for (const state of states)
      await requireEncounterActor(ctx, state.encounterId, state.ownerActorId)
    return states
  }

  async function maintainedDependentCount(encounterId: string, ownerActorId: string) {
    const states = await listStates(encounterId, ownerActorId)
    let count = 0
    for (const state of states) {
      const dependents = await dependentEffects(encounterId, state.id)
      count += dependents.characters.length + dependents.actors.length
      if (count > MAX_MAINTAINED_RULE_EFFECT_DEPENDENTS_PER_ACTOR)
        throw new Error('Maintained effect dependents exceed the supported bound.')
    }
    return count
  }

  /** Puts the holder of a `PLAY_ABSENCE` effect out of play or back in it, from the effects it holds now (D178). */
  async function syncHolderAbsence(effect: ActiveRuleEffectRecord, owner: ActiveRuleEffectOwner) {
    if (!playAbsenceContribution(effect.definition)) return
    await syncPlayAbsence(ctx, {
      owner,
      sourceEncounterId: effect.sourceEncounterId,
      effects: (await listOwner(ctx, owner)).map(({ definition }) => definition)
    })
  }

  async function removeEffectRow(current: ActiveRuleEffectRecord, owner: ActiveRuleEffectOwner) {
    const { id, version } = current
    if (owner.kind === 'CHARACTER') {
      const row = await ctx.db
        .query('characterActiveRuleEffects')
        .withIndex('by_characterId_id', (q) => q.eq('characterId', owner.characterId).eq('id', id))
        .unique()
      if (!row || row.version !== version)
        throw new Error('Active rule effect changed before deletion.')
      await ctx.db.delete(row._id)
      if (holdsActorForm(current.definition) && current.sourceEncounterId !== null)
        await endCharacterFormHeldBy(ctx, {
          encounterId: current.sourceEncounterId,
          characterId: owner.characterId,
          effectId: id
        })
      await syncHolderAbsence(current, owner)
      return
    }
    const row = await ctx.db
      .query('encounterActiveRuleEffects')
      .withIndex('by_encounterId_targetActorId_id', (q) =>
        q.eq('encounterId', owner.encounterId).eq('targetActorId', owner.targetActorId).eq('id', id)
      )
      .unique()
    if (!row || row.version !== version)
      throw new Error('Active rule effect changed before deletion.')
    await ctx.db.delete(row._id)
    if (holdsActorForm(current.definition))
      await endActorFormHeldBy(ctx, {
        encounterId: owner.encounterId,
        actorId: owner.targetActorId,
        effectId: id
      })
    await syncHolderAbsence(current, owner)
  }

  /** The one place an effect that ended leaves its authored `onEnd` grant behind (Haste's lethargy). */
  async function createOnEndGrant(ended: ActiveRuleEffectRecord): Promise<void> {
    const grant = onEndGrantEffect(ended)
    if (grant) await store.create(grant)
  }

  const store = {
    async list(inputOwner: ActiveRuleEffectOwner): Promise<ActiveRuleEffectRecord[]> {
      return listActiveRuleEffects(ctx, inputOwner)
    },
    async listCarriedByCaster(casterCharacterId: string): Promise<ActiveRuleEffectRecord[]> {
      return listCarriedActiveRuleEffects(ctx, casterCharacterId)
    },
    async findById(inputOwner: ActiveRuleEffectOwner, inputId: string) {
      const owner = ownerFor(inputOwner)
      const id = serverUuidIdentityDtoSchema.parse(inputId)
      await requireOwner(ctx, owner)
      return findEffectById(owner, id)
    },
    async findMaintainedState(input: {
      encounterId: string
      ownerActorId: string
      maintenanceDefinitionId: string
    }) {
      return readMaintainedStateByDefinition(ctx, input)
    },
    async findMaintainedStateById(input: { encounterId: string; stateId: string }) {
      const encounterId = serverUuidIdentityDtoSchema.parse(input.encounterId)
      const stateId = serverUuidIdentityDtoSchema.parse(input.stateId)
      return findStateById(encounterId, stateId)
    },
    async listMaintainedStatesByOwner(input: { encounterId: string; ownerActorId: string }) {
      const encounterId = serverUuidIdentityDtoSchema.parse(input.encounterId)
      const ownerActorId = serverUuidIdentityDtoSchema.parse(input.ownerActorId)
      return listStates(encounterId, ownerActorId)
    },
    async createMaintainedState(input: {
      id: string
      encounterId: string
      ownerActorId: string
      descriptor: EncounterMaintainedEffectDescriptorDto
      occurredAt?: string
    }): Promise<EncounterMaintainedEffectStateRecord> {
      const id = serverUuidIdentityDtoSchema.parse(input.id)
      const encounterId = serverUuidIdentityDtoSchema.parse(input.encounterId)
      const ownerActorId = serverUuidIdentityDtoSchema.parse(input.ownerActorId)
      const descriptor = encounterMaintainedEffectDescriptorDtoSchema.parse(input.descriptor)
      await requireEncounterActor(ctx, encounterId, ownerActorId)
      if (descriptor.sourceActorId !== ownerActorId)
        throw new Error('Maintained effect descriptor source actor does not match its owner.')
      const duplicateId = await ctx.db
        .query('encounterMaintainedEffectStates')
        .withIndex('by_publicId', (q) => q.eq('id', id))
        .unique()
      if (duplicateId) throw new Error('Maintained effect state ID already exists.')
      const existing = await ctx.db
        .query('encounterMaintainedEffectStates')
        .withIndex('by_encounter_owner_definition', (q) =>
          q
            .eq('encounterId', encounterId)
            .eq('ownerActorId', ownerActorId)
            .eq('maintenanceDefinitionId', descriptor.maintenanceDefinitionId)
        )
        .unique()
      if (existing) throw new Error('Maintained effect state already exists for this definition.')
      const states = await listStates(encounterId, ownerActorId)
      if (states.length >= MAX_MAINTAINED_RULE_EFFECT_STATES_PER_ACTOR)
        throw new Error(
          `An Encounter actor may own at most ${MAX_MAINTAINED_RULE_EFFECT_STATES_PER_ACTOR} maintained effect states.`
        )
      const record = prepareMaintainedEffectStateRecord({
        id,
        encounterId,
        ownerActorId,
        descriptor,
        occurredAt: input.occurredAt ?? new Date().toISOString()
      })
      const { descriptor: _descriptor, ...fields } = record
      const stored = encounterMaintainedEffectStateStoredSchema.parse({
        ...fields,
        descriptorJson: JSON.stringify(descriptor)
      })
      const rowId = await ctx.db.insert('encounterMaintainedEffectStates', stored)
      const row = await ctx.db.get(rowId)
      if (!row) throw new Error('Maintained effect state was not created.')
      return readMaintainedState(row)
    },
    /** An undo gives back the exact state it ended: same version, descriptor and timestamps. */
    async restoreMaintainedState(
      input: EncounterMaintainedEffectStateRecord
    ): Promise<EncounterMaintainedEffectStateRecord> {
      const record = encounterMaintainedEffectStateRecordSchema.parse(input)
      await requireEncounterActor(ctx, record.encounterId, record.ownerActorId)
      if (
        (await ctx.db
          .query('encounterMaintainedEffectStates')
          .withIndex('by_publicId', (q) => q.eq('id', record.id))
          .unique()) ||
        (await readMaintainedStateByDefinition(ctx, record))
      )
        throw new Error('Maintained effect state already exists.')
      const { descriptor, ...fields } = record
      const rowId = await ctx.db.insert(
        'encounterMaintainedEffectStates',
        encounterMaintainedEffectStateStoredSchema.parse({
          ...fields,
          descriptorJson: JSON.stringify(descriptor)
        })
      )
      const row = await ctx.db.get(rowId)
      if (!row) throw new Error('Maintained effect state was not restored.')
      return readMaintainedState(row)
    },
    async listDependentEffects(input: { encounterId: string; stateId: string }) {
      const encounterId = serverUuidIdentityDtoSchema.parse(input.encounterId)
      const stateId = serverUuidIdentityDtoSchema.parse(input.stateId)
      const dependents = await dependentEffects(encounterId, stateId)
      return [...dependents.characters, ...dependents.actors]
    },
    /** Whether any effect or zone still depends on the state (D135), which then outlives its last effect. */
    async hasDependents(input: { encounterId: string; stateId: string }) {
      const encounterId = serverUuidIdentityDtoSchema.parse(input.encounterId)
      const stateId = serverUuidIdentityDtoSchema.parse(input.stateId)
      const dependents = await dependentEffects(encounterId, stateId)
      return (
        dependents.characters.length > 0 ||
        dependents.actors.length > 0 ||
        (await listStateZones(ctx, { encounterId, stateId })).length > 0
      )
    },
    async deleteMaintainedStateCas(input: {
      id: string
      encounterId: string
      ownerActorId: string
      expectedVersion: number
      removal: ActiveRuleEffectRemoval
    }): Promise<void> {
      const encounterId = serverUuidIdentityDtoSchema.parse(input.encounterId)
      const ownerActorId = serverUuidIdentityDtoSchema.parse(input.ownerActorId)
      const id = serverUuidIdentityDtoSchema.parse(input.id)
      const expectedVersion = positiveIntegerSchema.parse(input.expectedVersion)
      const row = await ctx.db
        .query('encounterMaintainedEffectStates')
        .withIndex('by_encounterId_id', (q) => q.eq('encounterId', encounterId).eq('id', id))
        .unique()
      if (!row || row.ownerActorId !== ownerActorId || row.version !== expectedVersion)
        throw new Error('Maintained effect state changed before deletion.')
      readMaintainedState(row)
      const dependents = await dependentEffects(encounterId, id)
      if (dependents.characters.length)
        throw new Error('Maintained effect state still has Character dependents.')
      // A zone ends through the cleanup that ends its state, never by being orphaned here (D135).
      if ((await listStateZones(ctx, { encounterId, stateId: id })).length)
        throw new Error('Maintained effect state still has zone dependents.')
      for (const effect of dependents.actors) {
        const actorRow = await ctx.db
          .query('encounterActiveRuleEffects')
          .withIndex('by_encounterId_targetActorId_id', (q) => {
            const owner = effect.owner
            if (owner.kind !== 'ENCOUNTER_ACTOR')
              throw new Error('Stored dependent owner is invalid.')
            return q
              .eq('encounterId', owner.encounterId)
              .eq('targetActorId', owner.targetActorId)
              .eq('id', effect.id)
          })
          .unique()
        if (!actorRow) throw new Error('Maintained effect state changed before deletion.')
        await ctx.db.delete(actorRow._id)
        if (holdsActorForm(effect.definition))
          await endActorFormHeldBy(ctx, {
            encounterId: actorRow.encounterId,
            actorId: actorRow.targetActorId,
            effectId: effect.id
          })
        await syncHolderAbsence(effect, effect.owner)
        if (input.removal === 'ENDED') await createOnEndGrant(effect)
      }
      await ctx.db.delete(row._id)
    },
    async create(input: {
      id: string
      owner: ActiveRuleEffectOwner
      definition: ActiveRuleEffectDefinitionDto
      lifecycle: ActiveRuleEffectLifecycleDto
      maintainedEffectStateId?: string | null
      occurredAt?: string
      /** An undo gives back the exact record it consumed: its ordinal, version and timestamps. */
      restoredFrom?: ActiveRuleEffectRecord
    }): Promise<ActiveRuleEffectRecord> {
      const id = serverUuidIdentityDtoSchema.parse(input.id)
      const owner = ownerFor(input.owner)
      const definition = activeRuleEffectDefinitionDtoSchema.parse(input.definition)
      const lifecycle = activeRuleEffectStateDtoSchema.parse({
        definition,
        lifecycle: activeRuleEffectLifecycleDtoSchema.parse(input.lifecycle)
      }).lifecycle
      requireDefinitionOwner(owner, definition)
      await requireOwner(ctx, owner)
      if (input.restoredFrom) {
        // An undo that gives an effect back also takes back the grant its ending left behind.
        const left = await findEffectById(owner, onEndGrantEffectId(id))
        if (left) await removeEffectRow(left, owner)
      }
      const maintainedEffectStateId =
        input.maintainedEffectStateId == null
          ? null
          : serverUuidIdentityDtoSchema.parse(input.maintainedEffectStateId)
      if (maintainedEffectStateId !== null) {
        const sourceEncounterId = sourceEncounterIdForDefinition(
          definition,
          maintainedEffectStateId
        )
        if (
          sourceEncounterId === null ||
          definition.origin.kind !== 'ENCOUNTER' ||
          !definition.origin.sourceActorId
        )
          throw new Error('Maintained active effects require an Encounter actor source.')
        const state = await findStateById(sourceEncounterId, maintainedEffectStateId)
        if (!state || state.ownerActorId !== definition.origin.sourceActorId)
          throw new Error('Maintained effect state does not match the immutable Encounter source.')
        if (
          (await maintainedDependentCount(state.encounterId, state.ownerActorId)) >=
          MAX_MAINTAINED_RULE_EFFECT_DEPENDENTS_PER_ACTOR
        )
          throw new Error(
            `An Encounter actor may own at most ${MAX_MAINTAINED_RULE_EFFECT_DEPENDENTS_PER_ACTOR} maintained dependent effects.`
          )
      }
      const current = await listOwner(ctx, owner)
      if (current.length >= MAX_ACTIVE_RULE_EFFECTS_PER_OWNER)
        throw new Error(
          `An owner may have at most ${MAX_ACTIVE_RULE_EFFECTS_PER_OWNER} active rule effects.`
        )
      const duplicate =
        owner.kind === 'CHARACTER'
          ? await ctx.db
              .query('characterActiveRuleEffects')
              .withIndex('by_publicId', (q) => q.eq('id', id))
              .unique()
          : await ctx.db
              .query('encounterActiveRuleEffects')
              .withIndex('by_publicId', (q) => q.eq('id', id))
              .unique()
      if (duplicate) throw new Error('Active rule effect ID already exists.')
      const prepared = prepareActiveRuleEffectRecord({
        id,
        owner,
        definition,
        lifecycle,
        maintainedEffectStateId,
        currentEffects: current,
        occurredAt: input.occurredAt ?? new Date().toISOString()
      })
      const effect = input.restoredFrom
        ? {
            ...prepared,
            createdOrdinal: input.restoredFrom.createdOrdinal,
            version: input.restoredFrom.version,
            createdAt: input.restoredFrom.createdAt,
            updatedAt: input.restoredFrom.updatedAt
          }
        : prepared
      const common = {
        id: effect.id,
        maintainedEffectStateId: effect.maintainedEffectStateId,
        createdOrdinal: effect.createdOrdinal,
        version: effect.version,
        definitionJson: JSON.stringify(effect.definition),
        definitionChecksum: effect.definitionChecksum,
        lifecycle: effect.lifecycle,
        lifecycleChecksum: effect.lifecycleChecksum,
        createdAt: effect.createdAt,
        updatedAt: effect.updatedAt
      }
      if (owner.kind === 'CHARACTER') {
        const rowId = await ctx.db.insert(
          'characterActiveRuleEffects',
          characterActiveRuleEffectStoredSchema.parse({
            ...common,
            characterId: owner.characterId,
            sourceEncounterId: effect.sourceEncounterId,
            concentrationCasterCharacterId: concentrationCasterColumn(effect.lifecycle)
          })
        )
        const row = await ctx.db.get(rowId)
        if (!row) throw new Error('Active rule effect was not created.')
        const created = readCharacterEffect(row)
        await syncHolderAbsence(created, owner)
        return created
      }
      const rowId = await ctx.db.insert(
        'encounterActiveRuleEffects',
        encounterActiveRuleEffectStoredSchema.parse({
          ...common,
          encounterId: owner.encounterId,
          targetActorId: owner.targetActorId
        })
      )
      const row = await ctx.db.get(rowId)
      if (!row) throw new Error('Active rule effect was not created.')
      const created = readEncounterEffect(row)
      await syncHolderAbsence(created, owner)
      return created
    },
    async updateLifecycleCas(input: {
      id: string
      owner: ActiveRuleEffectOwner
      expectedVersion: number
      lifecycle: ActiveRuleEffectLifecycleDto
    }): Promise<ActiveRuleEffectRecord> {
      const owner = ownerFor(input.owner)
      const id = serverUuidIdentityDtoSchema.parse(input.id)
      const expectedVersion = positiveIntegerSchema.parse(input.expectedVersion)
      const current = await findEffectById(owner, id)
      if (!current || current.version !== expectedVersion)
        throw new Error('Active rule effect changed before lifecycle update.')
      const lifecycle = activeRuleEffectStateDtoSchema.parse({
        definition: current.definition,
        lifecycle: activeRuleEffectLifecycleDtoSchema.parse(input.lifecycle)
      }).lifecycle
      const now = new Date().toISOString()
      if (owner.kind === 'CHARACTER') {
        const row = await ctx.db
          .query('characterActiveRuleEffects')
          .withIndex('by_characterId_id', (q) =>
            q.eq('characterId', owner.characterId).eq('id', id)
          )
          .unique()
        if (!row || row.version !== expectedVersion)
          throw new Error('Active rule effect changed before lifecycle update.')
        await ctx.db.patch(row._id, {
          concentrationCasterCharacterId: concentrationCasterColumn(lifecycle),
          lifecycle,
          lifecycleChecksum: checksumCanonicalJson(lifecycle),
          version: expectedVersion + 1,
          updatedAt: now
        })
        const updated = await ctx.db.get(row._id)
        if (!updated) throw new Error('Active rule effect changed before lifecycle update.')
        return readCharacterEffect(updated)
      }
      const row = await ctx.db
        .query('encounterActiveRuleEffects')
        .withIndex('by_encounterId_targetActorId_id', (q) =>
          q
            .eq('encounterId', owner.encounterId)
            .eq('targetActorId', owner.targetActorId)
            .eq('id', id)
        )
        .unique()
      if (!row || row.version !== expectedVersion)
        throw new Error('Active rule effect changed before lifecycle update.')
      await ctx.db.patch(row._id, {
        lifecycle,
        lifecycleChecksum: checksumCanonicalJson(lifecycle),
        version: expectedVersion + 1,
        updatedAt: now
      })
      const updated = await ctx.db.get(row._id)
      if (!updated) throw new Error('Active rule effect changed before lifecycle update.')
      return readEncounterEffect(updated)
    },
    /**
     * Steps a Character's rest-decaying grant down one rest: the grants shrink by the authored step
     * and the rests left drop by one, so the definition and its checksum are rewritten with the
     * lifecycle. An effect whose last rest this is ends through `deleteCas` instead.
     */
    async stepDownCas(input: {
      id: string
      characterId: string
      expectedVersion: number
    }): Promise<ActiveRuleEffectRecord> {
      const owner = ownerFor({ kind: 'CHARACTER', characterId: input.characterId })
      if (owner.kind !== 'CHARACTER') throw new Error('Only a Character grant steps down.')
      const id = serverUuidIdentityDtoSchema.parse(input.id)
      const expectedVersion = positiveIntegerSchema.parse(input.expectedVersion)
      const current = await findEffectById(owner, id)
      if (!current || current.version !== expectedVersion)
        throw new Error('Active rule effect changed before stepping down.')
      const next = activeRuleEffectStateDtoSchema.parse(steppedDownEffectState(current))
      const row = await ctx.db
        .query('characterActiveRuleEffects')
        .withIndex('by_characterId_id', (q) => q.eq('characterId', owner.characterId).eq('id', id))
        .unique()
      if (!row || row.version !== expectedVersion)
        throw new Error('Active rule effect changed before stepping down.')
      await ctx.db.patch(row._id, {
        definitionJson: JSON.stringify(next.definition),
        definitionChecksum: checksumCanonicalJson(next.definition),
        lifecycle: next.lifecycle,
        lifecycleChecksum: checksumCanonicalJson(next.lifecycle),
        version: expectedVersion + 1,
        updatedAt: new Date().toISOString()
      })
      const updated = await ctx.db.get(row._id)
      if (!updated) throw new Error('Active rule effect changed before stepping down.')
      return readCharacterEffect(updated)
    },
    /**
     * Detaches a Character's Concentration grant from the Run's maintained state so it outlasts the
     * Run (D99, SPELLS-5.7); `lifecycle` stamps the caster.
     */
    async detachMaintainedCas(input: {
      id: string
      characterId: string
      expectedVersion: number
      lifecycle: ActiveRuleEffectLifecycleDto
    }): Promise<ActiveRuleEffectRecord> {
      const owner = ownerFor({ kind: 'CHARACTER', characterId: input.characterId })
      if (owner.kind !== 'CHARACTER') throw new Error('Only a Character grant detaches from a Run.')
      const id = serverUuidIdentityDtoSchema.parse(input.id)
      const expectedVersion = positiveIntegerSchema.parse(input.expectedVersion)
      const current = await findEffectById(owner, id)
      if (
        !current ||
        current.version !== expectedVersion ||
        current.maintainedEffectStateId === null ||
        current.definition.recurrence.lifetimeScope !== 'OWNER'
      )
        throw new Error('Active rule effect changed before detaching from its Run.')
      const lifecycle = activeRuleEffectStateDtoSchema.parse({
        definition: current.definition,
        lifecycle: activeRuleEffectLifecycleDtoSchema.parse(input.lifecycle)
      }).lifecycle
      const row = await ctx.db
        .query('characterActiveRuleEffects')
        .withIndex('by_characterId_id', (q) => q.eq('characterId', owner.characterId).eq('id', id))
        .unique()
      if (!row || row.version !== expectedVersion)
        throw new Error('Active rule effect changed before detaching from its Run.')
      await ctx.db.patch(row._id, {
        maintainedEffectStateId: null,
        sourceEncounterId: null,
        concentrationCasterCharacterId: concentrationCasterColumn(lifecycle),
        lifecycle,
        lifecycleChecksum: checksumCanonicalJson(lifecycle),
        version: expectedVersion + 1,
        updatedAt: new Date().toISOString()
      })
      const updated = await ctx.db.get(row._id)
      if (!updated) throw new Error('Active rule effect changed before detaching from its Run.')
      return readCharacterEffect(updated)
    },
    /**
     * Relinks a carried Concentration grant to the Concentration a later Run reinstated for its caster
     * (D151, SPELLS-5.12), so that state's ending ends it like any dependent.
     */
    async relinkCarriedCas(input: {
      id: string
      characterId: string
      expectedVersion: number
      state: EncounterMaintainedEffectStateRecord
    }): Promise<ActiveRuleEffectRecord> {
      const owner = ownerFor({ kind: 'CHARACTER', characterId: input.characterId })
      if (owner.kind !== 'CHARACTER') throw new Error('Only a Character grant is carried.')
      const id = serverUuidIdentityDtoSchema.parse(input.id)
      const expectedVersion = positiveIntegerSchema.parse(input.expectedVersion)
      const { provenance } = input.state.descriptor
      const current = await findEffectById(owner, id)
      if (
        !current ||
        current.version !== expectedVersion ||
        current.maintainedEffectStateId !== null ||
        provenance.kind !== 'CARRIED' ||
        current.lifecycle.concentrationCasterCharacterId !== provenance.casterCharacterId
      )
        throw new Error('Active rule effect changed before relinking to its caster.')
      if (
        (await maintainedDependentCount(input.state.encounterId, input.state.ownerActorId)) >=
        MAX_MAINTAINED_RULE_EFFECT_DEPENDENTS_PER_ACTOR
      )
        throw new Error(
          `An Encounter actor may own at most ${MAX_MAINTAINED_RULE_EFFECT_DEPENDENTS_PER_ACTOR} maintained dependent effects.`
        )
      const row = await ctx.db
        .query('characterActiveRuleEffects')
        .withIndex('by_characterId_id', (q) => q.eq('characterId', owner.characterId).eq('id', id))
        .unique()
      if (!row || row.version !== expectedVersion)
        throw new Error('Active rule effect changed before relinking to its caster.')
      await ctx.db.patch(row._id, {
        maintainedEffectStateId: input.state.id,
        sourceEncounterId: input.state.encounterId,
        version: expectedVersion + 1,
        updatedAt: new Date().toISOString()
      })
      const updated = await ctx.db.get(row._id)
      if (!updated) throw new Error('Active rule effect changed before relinking to its caster.')
      return readCharacterEffect(updated)
    },
    async deleteCas(input: {
      id: string
      owner: ActiveRuleEffectOwner
      expectedVersion: number
      removal: ActiveRuleEffectRemoval
    }) {
      const owner = ownerFor(input.owner)
      const id = serverUuidIdentityDtoSchema.parse(input.id)
      const expectedVersion = positiveIntegerSchema.parse(input.expectedVersion)
      const current = await findEffectById(owner, id)
      if (!current || current.version !== expectedVersion)
        throw new Error('Active rule effect changed before deletion.')
      await removeEffectRow(current, owner)
      if (input.removal === 'ENDED') await createOnEndGrant(current)
    }
  }
  return store
}
