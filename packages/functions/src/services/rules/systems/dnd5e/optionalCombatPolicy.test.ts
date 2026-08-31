import { checksumCanonicalJson } from '@artificer-toolkit/db'
import {
  DND5E_ALTERNATING_DIAGONALS_DEFINITION_ID,
  DND5E_ALTERNATING_DIAGONALS_OPERATION_KEY,
  type EncounterOptionalCombatSnapshotDto
} from '@artificer-toolkit/schema/shared/optionalCombat'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { measureScenePathDistance, type SceneGrid } from '@artificer-toolkit/shared/vtt'
import { describe, expect, it } from 'vitest'

import { resolveEncounterCombatPerception } from '../../../encounter/encounterCombatPerception.js'
import { encounterSceneGridPolicyRegistry } from '../../sceneGridPolicyRegistry.js'
import { DND5E_SYSTEM_ID } from './characterActionCapabilityDiscovery.js'
import { dnd5eEffectActionCapability } from './effectActionCompiler.js'

const grid = {
  kind: 'SQUARE' as const,
  cellSize: 100,
  diagonalPolicy: 'EQUAL' as const,
  distancePerCell: 5,
  origin: { x: 0, y: 0 },
  unit: 'FEET' as const
}

function snapshot(): EncounterOptionalCombatSnapshotDto {
  const document = {
    schemaVersion: 1 as const,
    kind: 'ALTERNATING_DIAGONALS' as const,
    id: DND5E_ALTERNATING_DIAGONALS_DEFINITION_ID,
    gameSystemId: DND5E_SYSTEM_ID,
    module: {
      policyModuleKey: DND5E_ALTERNATING_DIAGONALS_OPERATION_KEY,
      contractVersion: 1
    },
    parameters: { kind: 'ALTERNATING_DIAGONALS' as const },
    mutuallyExclusiveGroup: null
  }
  return {
    schemaVersion: 1,
    gameSystemId: DND5E_SYSTEM_ID,
    definitions: [
      {
        definitionId: document.id,
        contentSourceId: '00000000-0000-4000-8000-0000000000f2',
        definitionVersion: 1,
        definitionChecksum: checksumRuleDocument(document),
        contractVersion: 1,
        label: 'Alternating Diagonals',
        document
      }
    ]
  }
}

function encounter(input: {
  automationMode?: 'AUTOMATIC' | 'ASSISTED' | 'MANUAL'
  optionalCombatSnapshot?: EncounterOptionalCombatSnapshotDto | null
  gameSystemId?: string
}) {
  const resolvedSnapshot =
    input.optionalCombatSnapshot === undefined ? snapshot() : input.optionalCombatSnapshot
  return {
    automationMode: input.automationMode ?? 'ASSISTED',
    gameSystemId: input.gameSystemId ?? DND5E_SYSTEM_ID,
    optionalCombatSnapshot: resolvedSnapshot,
    optionalCombatSnapshotChecksum:
      resolvedSnapshot === null ? null : checksumCanonicalJson(resolvedSnapshot)
  }
}

function rangeSatisfied(sceneGrid: SceneGrid): boolean {
  return resolveEncounterCombatPerception({
    requirement: 'SEE',
    observerActorId: '00000000-0000-4000-8000-0000000000f3',
    scene: {
      ambientIllumination: 'BRIGHT',
      barriers: [],
      darknessZones: [],
      doorStates: {},
      grid,
      lights: []
    },
    sceneGrid,
    observerToken: { height: 1, position: { x: 50, y: 50 }, width: 1 },
    subjectToken: { height: 1, position: { x: 250, y: 250 }, width: 1 },
    pinnedSenseDefinitions: [
      {
        senseDefinitionId: '00000000-0000-4000-8000-0000000000f4',
        definitionVersion: 1,
        definitionContractVersion: 1,
        definitionChecksum: 'a'.repeat(64),
        document: {
          schemaVersion: 1,
          kind: 'SENSE',
          id: '00000000-0000-4000-8000-0000000000f4',
          gameSystemId: DND5E_SYSTEM_ID,
          capabilities: [
            {
              channel: 'VISUAL',
              accessGrade: 'PRECISE',
              satisfies: ['SEE'],
              illuminationAccess: 'BRIGHT_ONLY',
              obscurementAccess: 'NONE',
              perceivesInvisible: false,
              physicalConstraints: ['LINE_OF_EFFECT']
            }
          ]
        },
        range: {
          id: '00000000-0000-4000-8000-0000000000f4',
          amount: 10,
          unit: 'FEET',
          calculation: { base: 10, effective: 10, contributions: [], override: null }
        }
      }
    ],
    observerEffects: [],
    subjectEffects: [],
    localAreaEffects: [],
    sharedSurface: true,
    invisibleChannels: [],
    suppressedChannels: []
  }).satisfied
}

describe('D&D optional alternating-diagonal Scene policy', () => {
  it('pins the canonical UUID definition to the exact installed capability contract', () => {
    const definition = snapshot().definitions[0]!

    expect(definition.definitionId).toBe(DND5E_ALTERNATING_DIAGONALS_DEFINITION_ID)
    expect(definition.definitionChecksum).toBe(checksumRuleDocument(definition.document))
    expect(definition.document.module).toEqual({
      policyModuleKey: DND5E_ALTERNATING_DIAGONALS_OPERATION_KEY,
      contractVersion: 1
    })
    expect(dnd5eEffectActionCapability.operationContracts).not.toContainEqual({
      key: DND5E_ALTERNATING_DIAGONALS_OPERATION_KEY,
      contractVersion: 1
    })
  })

  it('uses only the locked Encounter snapshot for full-path and footprint-range measurement', () => {
    const effective = encounterSceneGridPolicyRegistry.resolveEffectiveGrid({
      encounter: encounter({}),
      sceneGrid: grid
    })
    const path = [
      { x: 0, y: 0 },
      { x: 100, y: 100 },
      { x: 200, y: 100 },
      { x: 300, y: 200 }
    ]

    expect(grid.diagonalPolicy).toBe('EQUAL')
    expect(effective).toMatchObject({ kind: 'SQUARE', diagonalPolicy: 'ALTERNATING' })
    expect(measureScenePathDistance(grid, path)).toBe(15)
    expect(measureScenePathDistance(effective, path)).toBe(20)
    expect(rangeSatisfied(grid)).toBe(true)
    expect(rangeSatisfied(effective)).toBe(false)
  })

  it('normalizes inactive D&D square grids to core EQUAL while leaving non-D&D grids unchanged', () => {
    const authoredAlternating = { ...grid, diagonalPolicy: 'ALTERNATING' as const }
    const authoredEuclidean = { ...grid, diagonalPolicy: 'EUCLIDEAN' as const }
    expect(
      encounterSceneGridPolicyRegistry.resolveEffectiveGrid({
        encounter: encounter({ optionalCombatSnapshot: null }),
        sceneGrid: authoredAlternating
      })
    ).toMatchObject({ diagonalPolicy: 'EQUAL' })
    expect(
      encounterSceneGridPolicyRegistry.resolveEffectiveGrid({
        encounter: {
          ...encounter({}),
          optionalCombatSnapshot: {
            ...snapshot(),
            gameSystemId: '00000000-0000-4000-8000-0000000000f5'
          },
          optionalCombatSnapshotChecksum: checksumCanonicalJson({
            ...snapshot(),
            gameSystemId: '00000000-0000-4000-8000-0000000000f5'
          })
        },
        sceneGrid: authoredEuclidean
      })
    ).toMatchObject({ diagonalPolicy: 'EQUAL' })
    expect(
      encounterSceneGridPolicyRegistry.resolveEffectiveGrid({
        encounter: encounter({ automationMode: 'MANUAL' }),
        sceneGrid: authoredEuclidean
      })
    ).toMatchObject({ diagonalPolicy: 'EQUAL' })
    expect(
      encounterSceneGridPolicyRegistry.resolveEffectiveGrid({
        encounter: {
          ...encounter({}),
          optionalCombatSnapshotChecksum: 'b'.repeat(64)
        },
        sceneGrid: authoredAlternating
      })
    ).toMatchObject({ diagonalPolicy: 'EQUAL' })
    const customGrid = { ...grid, diagonalPolicy: 'EUCLIDEAN' as const }
    expect(
      encounterSceneGridPolicyRegistry.resolveEffectiveGrid({
        encounter: encounter({
          gameSystemId: '00000000-0000-4000-8000-0000000000f5',
          optionalCombatSnapshot: null
        }),
        sceneGrid: customGrid
      })
    ).toBe(customGrid)
  })
})
