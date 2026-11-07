import {
  activeRuleEffectDefinitionDtoSchema,
  activeRuleEffectStateDtoSchema,
  encounterMaintainedEffectDescriptorDtoSchema,
  MAX_ACTIVE_RULE_EFFECTS_PER_OWNER,
  MAX_MAINTAINED_RULE_EFFECT_DEPENDENTS_PER_ACTOR,
  MAX_MAINTAINED_RULE_EFFECT_STATES_PER_ACTOR,
  type ActiveRuleEffectDefinitionDto
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
  requireDefinitionOwner,
  sourceEncounterIdForDefinition
} from '@artificer-toolkit/rules-runtime/activeRuleEffectRecords'
import { readEncounterCharacterPlay } from './characterPlay.js'
import type { EncounterDocument, EncounterReadContext } from './store.js'

// Effect reads live apart from the effect store's write path, so a query that only reads effects
// (the Character Sheet) does not evaluate the Encounter turn machinery the writes need (RELIABILITY-21).

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
export function concentrationCasterColumn(lifecycle: ActiveRuleEffectLifecycleDto) {
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

export async function requireEncounterActor(
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

export async function requireOwner(ctx: EncounterReadContext, owner: ActiveRuleEffectOwner) {
  if (owner.kind === 'CHARACTER') return requireCharacter(ctx, owner.characterId)
  return requireEncounterActor(ctx, owner.encounterId, owner.targetActorId)
}

export async function listOwner(ctx: EncounterReadContext, owner: ActiveRuleEffectOwner) {
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

/**
 * Every maintained state an Encounter actor owns for one maintenance definition, oldest first. An
 * actor holds as many as its capacity for the definition allows (Concentration capacity, SPELLS-12).
 */
export async function readMaintainedStatesByDefinition(
  ctx: EncounterReadContext,
  input: { encounterId: string; ownerActorId: string; maintenanceDefinitionId: string }
) {
  const encounterId = serverUuidIdentityDtoSchema.parse(input.encounterId)
  const ownerActorId = serverUuidIdentityDtoSchema.parse(input.ownerActorId)
  const maintenanceDefinitionId = serverUuidIdentityDtoSchema.parse(input.maintenanceDefinitionId)
  const rows = await ctx.db
    .query('encounterMaintainedEffectStates')
    .withIndex('by_encounter_owner_definition', (q) =>
      q
        .eq('encounterId', encounterId)
        .eq('ownerActorId', ownerActorId)
        .eq('maintenanceDefinitionId', maintenanceDefinitionId)
    )
    .take(MAX_MAINTAINED_RULE_EFFECT_STATES_PER_ACTOR + 1)
  if (rows.length > MAX_MAINTAINED_RULE_EFFECT_STATES_PER_ACTOR)
    throw new Error('Maintained effect states exceed the supported bound.')
  const states = rows.map(readMaintainedState)
  for (const state of states)
    await requireEncounterActor(ctx, state.encounterId, state.ownerActorId)
  return states
}

/** The oldest maintained state an Encounter actor owns for one maintenance definition, if any. */
export async function readMaintainedStateByDefinition(
  ctx: EncounterReadContext,
  input: { encounterId: string; ownerActorId: string; maintenanceDefinitionId: string }
) {
  return (await readMaintainedStatesByDefinition(ctx, input))[0] ?? null
}
