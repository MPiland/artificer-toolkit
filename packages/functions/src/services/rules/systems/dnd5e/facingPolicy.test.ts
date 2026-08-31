import { checksumCanonicalJson } from '@artificer-toolkit/db'
import {
  DND5E_FACING_DEFINITION_ID,
  DND5E_FACING_OPERATION_KEY,
  type EncounterOptionalCombatSnapshotDto
} from '@artificer-toolkit/schema/shared/optionalCombat'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { type SceneGrid } from '@artificer-toolkit/shared/vtt'
import { describe, expect, it } from 'vitest'

import { DND5E_SYSTEM_ID } from './characterActionCapabilityDiscovery.js'
import { resolveDnd5eFacingArcs } from './facingPolicy.js'

type FacingToken = NonNullable<Parameters<typeof resolveDnd5eFacingArcs>[0]['sourceToken']>

const grid: SceneGrid = {
  kind: 'SQUARE',
  cellSize: 100,
  diagonalPolicy: 'EQUAL',
  distancePerCell: 5,
  origin: { x: 0, y: 0 },
  unit: 'FEET'
}

const sourceToken: FacingToken = {
  height: 100,
  id: '00000000-0000-4000-8000-000000000002',
  position: { x: 50, y: 50 },
  rotationDegrees: 0,
  width: 100
}

function snapshot(
  input: {
    moduleKey?: string
    contractVersion?: number
  } = {}
): EncounterOptionalCombatSnapshotDto {
  const document = {
    schemaVersion: 1 as const,
    kind: 'FACING' as const,
    id: DND5E_FACING_DEFINITION_ID,
    gameSystemId: DND5E_SYSTEM_ID,
    module: {
      policyModuleKey: input.moduleKey ?? DND5E_FACING_OPERATION_KEY,
      contractVersion: input.contractVersion ?? 1
    },
    parameters: { kind: 'FACING' as const },
    mutuallyExclusiveGroup: null
  }
  return {
    schemaVersion: 1,
    gameSystemId: DND5E_SYSTEM_ID,
    definitions: [
      {
        definitionId: document.id,
        contentSourceId: '00000000-0000-4000-8000-000000000003',
        definitionVersion: 1,
        definitionChecksum: checksumRuleDocument(document),
        contractVersion: 1,
        label: 'Facing',
        document
      }
    ]
  }
}

function baseInput(
  input: {
    automationMode?: 'AUTOMATIC' | 'ASSISTED' | 'MANUAL'
    gameSystemId?: string
    grid?: SceneGrid | null
    optionalCombatSnapshot?: unknown
    optionalCombatSnapshotChecksum?: string | null
    sourceToken?: FacingToken | null
    targetToken?: FacingToken | null
  } = {}
) {
  const optionalCombatSnapshot =
    input.optionalCombatSnapshot === undefined ? snapshot() : input.optionalCombatSnapshot
  return {
    automationMode: input.automationMode ?? ('ASSISTED' as const),
    gameSystemId: input.gameSystemId ?? DND5E_SYSTEM_ID,
    grid: input.grid === undefined ? grid : input.grid,
    optionalCombatSnapshot,
    optionalCombatSnapshotChecksum:
      input.optionalCombatSnapshotChecksum === undefined
        ? optionalCombatSnapshot === null
          ? null
          : checksumCanonicalJson(optionalCombatSnapshot)
        : input.optionalCombatSnapshotChecksum,
    sourceToken: input.sourceToken === undefined ? sourceToken : input.sourceToken,
    targetToken:
      input.targetToken === undefined
        ? {
            ...sourceToken,
            id: '00000000-0000-4000-8000-000000000005',
            position: { x: 50, y: -50 }
          }
        : input.targetToken
  }
}

describe('D&D FACING policy', () => {
  it.each([
    [{ x: 50, y: -50 }, 'FRONT', 'REAR'],
    [{ x: 150, y: 50 }, 'RIGHT_SIDE', 'LEFT_SIDE'],
    [{ x: 50, y: 150 }, 'REAR', 'FRONT'],
    [{ x: -50, y: 50 }, 'LEFT_SIDE', 'RIGHT_SIDE']
  ] as const)('resolves the source-facing arc at %j', (position, arc, reverseArc) => {
    const result = resolveDnd5eFacingArcs(
      baseInput({ targetToken: { ...baseInput().targetToken!, position } })
    )
    expect(result.sourceToTarget).toEqual({ arc })
    expect(result.targetToSource).toEqual({ arc: reverseArc })
  })

  it('normalizes rotations and applies boundary sectors', () => {
    const result = resolveDnd5eFacingArcs(
      baseInput({
        sourceToken: { ...sourceToken, rotationDegrees: 360 + 45 },
        targetToken: {
          ...sourceToken,
          id: '00000000-0000-4000-8000-000000000005',
          position: { x: 150, y: 50 }
        }
      })
    )
    expect(result.sourceToTarget).toEqual({ arc: 'FRONT' })
  })

  it('uses exact closest occupied cells rather than large-token centers', () => {
    const result = resolveDnd5eFacingArcs(
      baseInput({
        sourceToken: { ...sourceToken, height: 400, position: { x: 200, y: 200 }, width: 400 },
        targetToken: {
          ...sourceToken,
          height: 600,
          id: '00000000-0000-4000-8000-000000000005',
          position: { x: 450, y: -200 },
          rotationDegrees: 180,
          width: 100
        }
      })
    )
    expect(result.sourceToTarget).toEqual({ arc: 'RIGHT_SIDE' })
  })

  it.each([
    ['MANUAL mode', baseInput({ automationMode: 'MANUAL' })],
    ['null Scene facts', baseInput({ grid: null })],
    [
      'non-square grid',
      baseInput({ grid: { kind: 'GRIDLESS', pixelsPerUnit: 100, unit: 'FEET' } })
    ],
    [
      'invalid geometry',
      baseInput({ sourceToken: { ...sourceToken, rotationDegrees: Number.NaN } })
    ],
    ['malformed checksum', baseInput({ optionalCombatSnapshotChecksum: 'a'.repeat(64) })],
    [
      'wrong module',
      baseInput({
        optionalCombatSnapshot: snapshot({ moduleKey: 'scene.grid.square.other' })
      })
    ],
    [
      'wrong version',
      baseInput({
        optionalCombatSnapshot: snapshot({ contractVersion: 2 })
      })
    ]
  ] as const)('fails closed for %s', (_label, input) => {
    expect(resolveDnd5eFacingArcs(input)).toEqual({
      sourceToTarget: null,
      targetToSource: null
    })
  })
})
