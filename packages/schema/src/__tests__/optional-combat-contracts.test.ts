import { describe, expect, it } from 'vitest'

import {
  activeOptionalCombatDefinitions,
  dnd5eOptionalCombatReusableDefinitionDocumentDtoSchema,
  encounterOptionalCombatSnapshotDtoSchema
} from '../shared/optionalCombat.js'

const ids = {
  system: '00000000-0000-4000-8000-000000000001',
  flanking: '00000000-0000-4000-8000-000000000002',
  facing: '00000000-0000-4000-8000-000000000003',
  source: '00000000-0000-4000-8000-000000000004'
}

function facingParameters() {
  return {
    kind: 'FACING' as const,
    facingStepDegrees: 90,
    arcs: [
      { arc: 'FRONT' as const, fromDegrees: -45, toDegrees: 45 },
      { arc: 'RIGHT_SIDE' as const, fromDegrees: 45, toDegrees: 135 },
      { arc: 'REAR' as const, fromDegrees: 135, toDegrees: 225 },
      { arc: 'LEFT_SIDE' as const, fromDegrees: 225, toDegrees: 315 }
    ],
    attackerInTargetArc: [{ arc: 'REAR' as const, influence: 'ADVANTAGE' }],
    sourceCannotTargetInOwnArcs: ['REAR' as const]
  }
}

function document(id: string, kind: 'FLANKING' | 'FACING', group: string | null = null) {
  return {
    schemaVersion: 1 as const,
    kind,
    id,
    gameSystemId: ids.system,
    module: { policyModuleKey: 'scene.grid.square.alternating-diagonals', contractVersion: 1 },
    parameters:
      kind === 'FLANKING'
        ? { kind, participantCapabilityDefinitionId: '00000000-0000-4000-8000-000000000005' }
        : facingParameters(),
    mutuallyExclusiveGroup: group
  }
}

function snapshot() {
  return {
    schemaVersion: 1 as const,
    gameSystemId: ids.system,
    definitions: [
      {
        definitionId: ids.flanking,
        contentSourceId: ids.source,
        definitionVersion: 1,
        definitionChecksum: 'a'.repeat(64),
        contractVersion: 1,
        label: 'Flanking',
        document: document(ids.flanking, 'FLANKING')
      }
    ]
  }
}

describe('optional combat contracts', () => {
  it('accepts one UUID-backed adapter definition and only activates it outside Manual mode', () => {
    const parsed = encounterOptionalCombatSnapshotDtoSchema.parse(snapshot())
    expect(
      activeOptionalCombatDefinitions({ automationMode: 'ASSISTED', snapshot: parsed })
    ).toHaveLength(1)
    expect(activeOptionalCombatDefinitions({ automationMode: 'MANUAL', snapshot: parsed })).toEqual(
      []
    )
    expect(parsed.definitions).toHaveLength(1)
  })

  it('rejects a duplicate kind or incompatible group before it can become an Encounter snapshot', () => {
    const duplicate = snapshot()
    duplicate.definitions.push({
      definitionId: ids.facing,
      contentSourceId: ids.source,
      definitionVersion: 1,
      definitionChecksum: 'b'.repeat(64),
      contractVersion: 1,
      label: 'Second flanking definition',
      document: document(ids.facing, 'FLANKING')
    })
    expect(encounterOptionalCombatSnapshotDtoSchema.safeParse(duplicate).success).toBe(false)

    const incompatible = snapshot()
    incompatible.definitions[0]!.document.mutuallyExclusiveGroup = 'positioning'
    incompatible.definitions.push({
      definitionId: ids.facing,
      contentSourceId: ids.source,
      definitionVersion: 1,
      definitionChecksum: 'b'.repeat(64),
      contractVersion: 1,
      label: 'Facing',
      document: document(ids.facing, 'FACING', 'positioning')
    })
    expect(encounterOptionalCombatSnapshotDtoSchema.safeParse(incompatible).success).toBe(false)
  })

  it('does not accept arbitrary configuration in a D&D adapter definition', () => {
    expect(
      dnd5eOptionalCombatReusableDefinitionDocumentDtoSchema.safeParse({
        ...document(ids.flanking, 'FLANKING'),
        configuration: { rule: 'anything' }
      }).success
    ).toBe(false)
  })

  it('requires an exact kind-matched closed parameter arm', () => {
    expect(
      dnd5eOptionalCombatReusableDefinitionDocumentDtoSchema.safeParse({
        ...document(ids.flanking, 'FLANKING'),
        parameters: facingParameters()
      }).success
    ).toBe(false)
    expect(
      dnd5eOptionalCombatReusableDefinitionDocumentDtoSchema.safeParse({
        ...document(ids.flanking, 'FLANKING'),
        parameters: { kind: 'FLANKING', arbitrary: true }
      }).success
    ).toBe(false)
  })

  it('accepts an authored Facing arc table that tiles the circle, including a homebrew one', () => {
    const facing = (parameters: Record<string, unknown>) =>
      dnd5eOptionalCombatReusableDefinitionDocumentDtoSchema.safeParse({
        ...document(ids.facing, 'FACING'),
        parameters: { ...facingParameters(), ...parameters }
      }).success
    expect(facing({})).toBe(true)
    expect(
      facing({
        facingStepDegrees: 60,
        arcs: [
          { arc: 'FRONT', fromDegrees: 300, toDegrees: 420 },
          { arc: 'RIGHT_SIDE', fromDegrees: 60, toDegrees: 150 },
          { arc: 'REAR', fromDegrees: 150, toDegrees: 210 },
          { arc: 'LEFT_SIDE', fromDegrees: 210, toDegrees: 300 }
        ],
        attackerInTargetArc: [
          { arc: 'LEFT_SIDE', influence: 'ADVANTAGE' },
          { arc: 'RIGHT_SIDE', influence: 'ADVANTAGE' }
        ],
        sourceCannotTargetInOwnArcs: []
      })
    ).toBe(true)
    expect(facing({ facingStepDegrees: 7 })).toBe(false)
    const [front, right, rear, left] = facingParameters().arcs
    expect(facing({ arcs: [front, right, rear] })).toBe(false)
    expect(facing({ arcs: [front, { ...right!, toDegrees: 140 }, rear, left] })).toBe(false)
    expect(facing({ arcs: [front, right, { ...rear!, arc: 'FRONT' }, left] })).toBe(false)
    expect(facing({ sourceCannotTargetInOwnArcs: ['REAR', 'REAR'] })).toBe(false)
  })
})
