import { describe, expect, it } from 'vitest'

import {
  DND5E_CLEAVING_DEFINITION_ID,
  DND5E_CLEAVING_OPERATION_KEY,
  DND5E_DISARM_DEFINITION_ID,
  DND5E_DISARM_OPERATION_KEY,
  DND5E_SHOVE_ASIDE_DEFINITION_ID,
  DND5E_SHOVE_ASIDE_OPERATION_KEY,
  type EncounterOptionalCombatSnapshotDto
} from '@artificer-toolkit/schema/shared/optionalCombat'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import {
  createDnd5eOptionalCombatActionSelectionDescriptor,
  resolveDnd5eOptionalCombatActionSelection
} from './optionalCombatActionSelection.js'

const ids = {
  actor: '00000000-0000-4000-8000-000000000001',
  target: '00000000-0000-4000-8000-000000000002',
  item: '00000000-0000-4000-8000-000000000003',
  athletics: '00000000-0000-4000-8000-000000000004',
  acrobatics: '00000000-0000-4000-8000-000000000005'
} as const

function definition(
  kind: 'DISARM' | 'SHOVE_ASIDE' | 'CLEAVING'
): EncounterOptionalCombatSnapshotDto['definitions'][number] {
  const document = {
    schemaVersion: 1 as const,
    kind,
    id:
      kind === 'DISARM'
        ? DND5E_DISARM_DEFINITION_ID
        : kind === 'SHOVE_ASIDE'
          ? DND5E_SHOVE_ASIDE_DEFINITION_ID
          : DND5E_CLEAVING_DEFINITION_ID,
    gameSystemId: '00000000-0000-4000-8000-000000000006',
    module: {
      policyModuleKey:
        kind === 'DISARM'
          ? DND5E_DISARM_OPERATION_KEY
          : kind === 'SHOVE_ASIDE'
            ? DND5E_SHOVE_ASIDE_OPERATION_KEY
            : DND5E_CLEAVING_OPERATION_KEY,
      contractVersion: 1
    },
    parameters:
      kind === 'DISARM'
        ? {
            kind: 'DISARM' as const,
            defenderCheckDefinitionIds: [ids.athletics, ids.acrobatics]
          }
        : kind === 'SHOVE_ASIDE'
          ? {
              kind: 'SHOVE_ASIDE' as const,
              initiatorCheckDefinitionId: ids.athletics,
              defenderCheckDefinitionIds: [ids.athletics, ids.acrobatics]
            }
          : {
              kind: 'CLEAVING' as const,
              qualifyingAttackKind: 'MELEE' as const,
              requiresUndamagedInitialTarget: true as const
            },
    mutuallyExclusiveGroup: null
  }
  return {
    definitionId: document.id,
    contentSourceId: ids.actor,
    definitionVersion: 1,
    definitionChecksum: checksumRuleDocument(document),
    contractVersion: 1,
    label: kind,
    document
  }
}

describe('D&D optional combat action selection', () => {
  it('issues and resolves only the exact Disarm item and defender-check choices', () => {
    const pinned = definition('DISARM')
    const descriptor = createDnd5eOptionalCombatActionSelectionDescriptor({
      actionId: 'attack',
      actorId: ids.actor,
      targetActorId: ids.target,
      definition: pinned,
      heldItemIds: [ids.item],
      targetCheckDefinitionIds: [ids.acrobatics, ids.athletics]
    })
    const selections = descriptor.fields.map((field) => ({
      fieldId: field.fieldId,
      value:
        field.role === 'HELD_ITEM'
          ? ({ kind: 'ENTITY' as const, entityId: ids.item } as const)
          : ({ kind: 'ENTITY' as const, entityId: ids.acrobatics } as const)
    }))
    const resolved = resolveDnd5eOptionalCombatActionSelection({
      definition: pinned,
      descriptor,
      intent: {
        optionId: descriptor.optionId,
        definitionId: descriptor.definitionId,
        selectionContract: descriptor.selectionContract,
        selections
      }
    })
    expect(resolved.entities).toEqual({
      HELD_ITEM: ids.item,
      DEFENDER_CHECK: ids.acrobatics
    })
    expect(() =>
      resolveDnd5eOptionalCombatActionSelection({
        definition: pinned,
        descriptor,
        intent: {
          optionId: descriptor.optionId,
          definitionId: descriptor.definitionId,
          selectionContract: descriptor.selectionContract,
          selections: selections.map((selection) =>
            selection.value.entityId === ids.item
              ? { ...selection, value: { kind: 'ENTITY', entityId: ids.target } }
              : selection
          )
        }
      })
    ).toThrow(/unavailable/)
  })

  it('binds Shove Aside to one exact defender check and a finite destination', () => {
    const pinned = definition('SHOVE_ASIDE')
    const descriptor = createDnd5eOptionalCombatActionSelectionDescriptor({
      actionId: 'shove',
      actorId: ids.actor,
      targetActorId: ids.target,
      definition: pinned,
      targetCheckDefinitionIds: [ids.athletics],
      allowedDestinationPositions: [
        { x: 5, y: 5 },
        { x: 4, y: 5 }
      ]
    })
    expect(descriptor.fields.find((field) => field.kind === 'POSITION')?.allowedPositions).toEqual([
      { x: 4, y: 5 },
      { x: 5, y: 5 }
    ])
    const selections = descriptor.fields.map((field) => ({
      fieldId: field.fieldId,
      value:
        field.kind === 'ENTITY'
          ? ({ kind: 'ENTITY' as const, entityId: ids.athletics } as const)
          : ({ kind: 'POSITION' as const, position: { x: 4, y: 5 } } as const)
    }))
    const resolved = resolveDnd5eOptionalCombatActionSelection({
      definition: pinned,
      descriptor,
      intent: {
        optionId: descriptor.optionId,
        definitionId: descriptor.definitionId,
        selectionContract: descriptor.selectionContract,
        selections
      }
    })
    expect(resolved.entities.DEFENDER_CHECK).toBe(ids.athletics)
    expect(resolved.positions.DESTINATION).toEqual({ x: 4, y: 5 })
    expect(() =>
      resolveDnd5eOptionalCombatActionSelection({
        definition: pinned,
        descriptor,
        intent: {
          optionId: descriptor.optionId,
          definitionId: descriptor.definitionId,
          selectionContract: descriptor.selectionContract,
          selections: selections.map((selection) =>
            selection.value.kind === 'POSITION'
              ? { ...selection, value: { kind: 'POSITION', position: { x: 6, y: 5 } } }
              : selection
          )
        }
      })
    ).toThrow(/unavailable/)
  })

  it('does not issue a speculative Cleaving target at action start', () => {
    const pinned = definition('CLEAVING')
    const descriptor = createDnd5eOptionalCombatActionSelectionDescriptor({
      actionId: 'attack',
      actorId: ids.actor,
      targetActorId: ids.target,
      definition: pinned,
      eligibleTargetActorIds: [ids.item]
    })
    expect(descriptor.fields).toEqual([])
    expect(
      resolveDnd5eOptionalCombatActionSelection({
        definition: pinned,
        descriptor,
        intent: {
          optionId: descriptor.optionId,
          definitionId: descriptor.definitionId,
          selectionContract: descriptor.selectionContract,
          selections: []
        }
      }).entities.NEXT_TARGET
    ).toBeUndefined()
  })
})
