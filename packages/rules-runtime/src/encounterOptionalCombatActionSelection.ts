import type { OptionalCombatActionIntentDto } from '@artificer-toolkit/schema/api/encounters'
import type { EncounterOptionalCombatSnapshotDto } from '@artificer-toolkit/schema/shared/optionalCombat'
import { postgresUuidSchema } from '@artificer-toolkit/schema/shared/postgresUuid'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

type OptionalDefinition = EncounterOptionalCombatSnapshotDto['definitions'][number]
type SelectionRole = 'DEFENDER_CHECK' | 'HELD_ITEM' | 'NEXT_TARGET'

interface OptionalCombatActionSelectionField {
  readonly fieldId: string
  readonly kind: 'ENTITY'
  readonly role: SelectionRole
  readonly allowedEntityIds: readonly string[]
}

export interface OptionalCombatActionSelectionDescriptor {
  readonly optionId: string
  readonly definitionId: string
  readonly selectionContract: string
  readonly fields: readonly OptionalCombatActionSelectionField[]
}

interface OptionalCombatActionSelection {
  readonly definition: OptionalDefinition
  readonly entities: Readonly<Partial<Record<SelectionRole, string>>>
}

function canonicalIds(values: readonly string[]): readonly string[] {
  const ids = values.map((value) => postgresUuidSchema.parse(value))
  const unique = [...new Set(ids)].sort((left, right) => left.localeCompare(right))
  if (unique.length !== ids.length) {
    throw new Error('Optional combat selection candidates must be unique.')
  }
  return unique
}

function exactDefinition(definition: OptionalDefinition): void {
  if (
    definition.definitionId !== definition.document.id ||
    checksumRuleDocument(definition.document) !== definition.definitionChecksum
  ) {
    throw new Error('Optional combat selection requires an exact pinned definition.')
  }
}

function fieldId(definitionId: string, role: SelectionRole): string {
  return checksumRuleDocument({ definitionId, role })
}

function entityField(
  definitionId: string,
  role: SelectionRole,
  allowedEntityIds: readonly string[]
): OptionalCombatActionSelectionField {
  const allowed = canonicalIds(allowedEntityIds)
  if (allowed.length === 0) {
    throw new Error('Optional combat entity selection requires at least one candidate.')
  }
  return { fieldId: fieldId(definitionId, role), kind: 'ENTITY', role, allowedEntityIds: allowed }
}

function intersect(
  definitionIds: readonly string[],
  availableIds: readonly string[]
): readonly string[] {
  const available = new Set(canonicalIds(availableIds))
  return canonicalIds(definitionIds).filter((definitionId) => available.has(definitionId))
}

/**
 * Builds the exact server-owned selection contract for one optional action.
 * Only checksums and UUID values cross the Encounter transport boundary.
 */
export function createOptionalCombatActionSelectionDescriptor(input: {
  readonly actionId: string
  readonly actorId: string
  readonly definition: OptionalDefinition
  readonly heldItemIds?: readonly string[]
  readonly eligibleTargetActorIds?: readonly string[]
  readonly targetCheckDefinitionIds?: readonly string[]
  readonly targetActorId: string
}): OptionalCombatActionSelectionDescriptor {
  exactDefinition(input.definition)
  const actorId = postgresUuidSchema.parse(input.actorId)
  const targetActorId = postgresUuidSchema.parse(input.targetActorId)
  if (actorId === targetActorId) throw new Error('Optional combat actions require another target.')
  const parameters = input.definition.document.parameters
  const fields: OptionalCombatActionSelectionField[] = []
  switch (parameters.kind) {
    case 'DISARM':
      fields.push(
        entityField(input.definition.definitionId, 'HELD_ITEM', input.heldItemIds ?? []),
        entityField(
          input.definition.definitionId,
          'DEFENDER_CHECK',
          intersect(parameters.defenderCheckDefinitionIds, input.targetCheckDefinitionIds ?? [])
        )
      )
      break
    case 'OVERRUN':
    case 'TUMBLE':
    case 'CLIMB_ONTO_LARGER_CREATURE':
      break
    case 'CLEAVING':
      // Cleaving is evaluated only after the original attack has terminally
      // settled. Its next-target decision is an Encounter-owned child
      // occurrence, never a speculative action-start selection.
      break
    default:
      throw new Error('Optional combat action selection kind is not executable here.')
  }
  fields.sort((left, right) => left.fieldId.localeCompare(right.fieldId))
  const selectionContract = checksumRuleDocument(
    fields.map((field) => ({
      fieldId: field.fieldId,
      kind: field.kind,
      allowedEntityIds: field.allowedEntityIds
    }))
  )
  return {
    definitionId: input.definition.definitionId,
    selectionContract,
    optionId: checksumRuleDocument({
      actionId: input.actionId,
      actorId,
      targetActorId,
      definitionId: input.definition.definitionId,
      definitionVersion: input.definition.definitionVersion,
      definitionChecksum: input.definition.definitionChecksum,
      selectionContract
    }),
    fields
  }
}

/** Rejects stale, extra, duplicate, or out-of-contract client selections. */
export function resolveOptionalCombatActionSelection(input: {
  readonly definition: OptionalDefinition
  readonly descriptor: OptionalCombatActionSelectionDescriptor
  readonly intent: OptionalCombatActionIntentDto
}): OptionalCombatActionSelection {
  exactDefinition(input.definition)
  if (
    input.intent.definitionId !== input.descriptor.definitionId ||
    input.intent.definitionId !== input.definition.definitionId ||
    input.intent.optionId !== input.descriptor.optionId ||
    input.intent.selectionContract !== input.descriptor.selectionContract ||
    input.intent.selections.length !== input.descriptor.fields.length
  ) {
    throw new Error('Optional combat action selection is stale.')
  }
  const entities: Partial<Record<SelectionRole, string>> = {}
  for (const [index, field] of input.descriptor.fields.entries()) {
    const selection = input.intent.selections[index]
    if (!selection || selection.fieldId !== field.fieldId) {
      throw new Error('Optional combat action selection does not match its issued field.')
    }
    if (!field.allowedEntityIds.includes(selection.value.entityId)) {
      throw new Error('Optional combat action entity selection is unavailable.')
    }
    entities[field.role] = selection.value.entityId
  }
  return { definition: input.definition, entities }
}
