import {
  activeRuleEffectDefinitionDtoSchema,
  activeRuleEffectStateDtoSchema,
  encounterMaintainedEffectDescriptorDtoSchema,
  MAX_ACTIVE_RULE_EFFECTS_PER_OWNER,
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
  activeRuleEffectOwnerSchema,
  encounterMaintainedEffectStateRecordSchema,
  type ActiveRuleEffectOwner,
  type ActiveRuleEffectRecord,
  type EncounterMaintainedEffectStateRecord
} from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'

export function ownerFor(input: ActiveRuleEffectOwner): ActiveRuleEffectOwner {
  const owner = activeRuleEffectOwnerSchema.parse(input)
  if (owner.kind === 'CHARACTER')
    return { kind: 'CHARACTER', characterId: serverUuidIdentityDtoSchema.parse(owner.characterId) }
  return {
    kind: 'ENCOUNTER_ACTOR',
    encounterId: serverUuidIdentityDtoSchema.parse(owner.encounterId),
    targetActorId: serverUuidIdentityDtoSchema.parse(owner.targetActorId)
  }
}

export function sourceEncounterIdForDefinition(
  definition: ActiveRuleEffectDefinitionDto
): string | null {
  if (definition.recurrence.lifetimeScope === 'OWNER') return null
  if (definition.origin.kind !== 'ENCOUNTER')
    throw new Error('Encounter-lifetime active effects require an Encounter origin.')
  return definition.origin.sourceAggregateId
}

export function requireDefinitionOwner(
  owner: ActiveRuleEffectOwner,
  definition: ActiveRuleEffectDefinitionDto
) {
  if (
    owner.kind === 'ENCOUNTER_ACTOR' &&
    definition.recurrence.lifetimeScope === 'ENCOUNTER' &&
    (definition.origin.kind !== 'ENCOUNTER' ||
      definition.origin.sourceAggregateId !== owner.encounterId)
  )
    throw new Error('Encounter-actor active effects must retain their owning Encounter provenance.')
}

export function prepareActiveRuleEffectRecord(input: {
  id: string
  owner: ActiveRuleEffectOwner
  definition: ActiveRuleEffectDefinitionDto
  lifecycle: ActiveRuleEffectLifecycleDto
  maintainedEffectStateId?: string | null
  currentEffects: readonly ActiveRuleEffectRecord[]
  occurredAt: string
}): ActiveRuleEffectRecord {
  const id = serverUuidIdentityDtoSchema.parse(input.id)
  const owner = ownerFor(input.owner)
  const definition = activeRuleEffectDefinitionDtoSchema.parse(input.definition)
  const lifecycle = activeRuleEffectStateDtoSchema.parse({
    definition,
    lifecycle: activeRuleEffectLifecycleDtoSchema.parse(input.lifecycle)
  }).lifecycle
  requireDefinitionOwner(owner, definition)
  const maintainedEffectStateId =
    input.maintainedEffectStateId == null
      ? null
      : serverUuidIdentityDtoSchema.parse(input.maintainedEffectStateId)
  const currentEffects = input.currentEffects.map((effect) =>
    activeRuleEffectRecordSchema.parse(effect)
  )
  if (currentEffects.length >= MAX_ACTIVE_RULE_EFFECTS_PER_OWNER)
    throw new Error(
      `An owner may have at most ${MAX_ACTIVE_RULE_EFFECTS_PER_OWNER} active rule effects.`
    )
  for (const effect of currentEffects) {
    const currentOwner = ownerFor(effect.owner)
    if (currentOwner.kind !== owner.kind) {
      throw new Error('Current active rule effects must share the requested owner.')
    }
    if (
      owner.kind === 'CHARACTER' &&
      currentOwner.kind === 'CHARACTER' &&
      currentOwner.characterId !== owner.characterId
    )
      throw new Error('Current active rule effects must share the requested owner.')
    if (
      owner.kind === 'ENCOUNTER_ACTOR' &&
      currentOwner.kind === 'ENCOUNTER_ACTOR' &&
      (currentOwner.encounterId !== owner.encounterId ||
        currentOwner.targetActorId !== owner.targetActorId)
    )
      throw new Error('Current active rule effects must share the requested owner.')
  }
  return activeRuleEffectRecordSchema.parse({
    id,
    owner,
    sourceEncounterId:
      owner.kind === 'CHARACTER' ? sourceEncounterIdForDefinition(definition) : null,
    maintainedEffectStateId,
    createdOrdinal: Math.max(0, ...currentEffects.map((effect) => effect.createdOrdinal)) + 1,
    version: 1,
    definition,
    definitionChecksum: checksumCanonicalJson(definition),
    lifecycle,
    lifecycleChecksum: checksumCanonicalJson(lifecycle),
    createdAt: input.occurredAt,
    updatedAt: input.occurredAt
  })
}

/** Same immutable record for movement forecasting and authorized store creation. */
export function prepareMaintainedEffectStateRecord(input: {
  id: string
  encounterId: string
  ownerActorId: string
  descriptor: EncounterMaintainedEffectDescriptorDto
  occurredAt: string
}): EncounterMaintainedEffectStateRecord {
  const descriptor = encounterMaintainedEffectDescriptorDtoSchema.parse(input.descriptor)
  const record = encounterMaintainedEffectStateRecordSchema.parse({
    id: serverUuidIdentityDtoSchema.parse(input.id),
    encounterId: serverUuidIdentityDtoSchema.parse(input.encounterId),
    ownerActorId: serverUuidIdentityDtoSchema.parse(input.ownerActorId),
    maintenanceDefinitionId: descriptor.maintenanceDefinitionId,
    descriptor,
    descriptorChecksum: checksumCanonicalJson(descriptor),
    version: 1,
    createdAt: input.occurredAt,
    updatedAt: input.occurredAt
  })
  if (descriptor.sourceActorId !== record.ownerActorId)
    throw new Error('Maintained effect descriptor source actor does not match its owner.')
  return record
}
