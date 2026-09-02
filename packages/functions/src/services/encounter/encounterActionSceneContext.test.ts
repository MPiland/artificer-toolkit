import { describe, expect, it, vi } from 'vitest'

import { checksumCanonicalJson } from '@artificer-toolkit/db'
import {
  DND5E_ALTERNATING_DIAGONALS_DEFINITION_ID,
  DND5E_ALTERNATING_DIAGONALS_OPERATION_KEY
} from '@artificer-toolkit/schema/shared/optionalCombat'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { SceneToken } from '@artificer-toolkit/shared/vtt'

import { DND5E_SYSTEM_ID } from '../rules/systems/dnd5e/characterActionCapabilityDiscovery.js'

const state = vi.hoisted(() => ({
  lockEncounter: vi.fn(),
  findEncounterBinding: vi.fn(),
  lockLiveScene: vi.fn(),
  listActorTokenBindings: vi.fn()
}))

vi.mock('@artificer-toolkit/db', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@artificer-toolkit/db')>()),
  createEncounterRepository: () => ({ lock: state.lockEncounter }),
  createVttSceneRepository: () => ({
    findEncounterBinding: state.findEncounterBinding,
    lockLiveScene: state.lockLiveScene,
    listActorTokenBindings: state.listActorTokenBindings
  })
}))

import {
  createEncounterActionStartIntent,
  lockEncounterActionSceneContext,
  toEncounterActionSceneDependency
} from './encounterActionSceneContext.js'

const ids = {
  encounter: '00000000-0000-4000-8000-000000000001',
  scene: '00000000-0000-4000-8000-000000000002',
  sourceActor: '00000000-0000-4000-8000-000000000003',
  targetActor: '00000000-0000-4000-8000-000000000004',
  sourceToken: '00000000-0000-4000-8000-000000000005',
  targetToken: '00000000-0000-4000-8000-000000000006'
}

function token(id: string): SceneToken {
  return {
    assetId: null,
    controlledByUserIds: ['private-controller'],
    height: 1,
    hidden: true,
    id,
    label: 'private-label',
    locked: true,
    position: { x: 0, y: 0 },
    rotationDegrees: 0,
    vision: {
      angleDegrees: 360,
      brightRange: 30,
      dimRange: 60,
      directionDegrees: 0,
      enabled: true
    },
    width: 1
  }
}

function scene() {
  return {
    state: {
      id: ids.scene,
      version: 4,
      grid: {
        kind: 'SQUARE' as const,
        cellSize: 5,
        unit: 'FEET' as const,
        diagonalPolicy: 'EQUAL' as const,
        distancePerCell: 5,
        origin: { x: 0, y: 0 }
      },
      tokens: [token(ids.sourceToken), token(ids.targetToken)]
    }
  }
}

function encounter() {
  return {
    id: ids.encounter,
    automationMode: 'ASSISTED' as const,
    gameSystemId: '00000000-0000-4000-8000-000000000099',
    optionalCombatSnapshot: null,
    optionalCombatSnapshotChecksum: null
  }
}

function alternatingEncounter() {
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
  const optionalCombatSnapshot = {
    schemaVersion: 1 as const,
    gameSystemId: DND5E_SYSTEM_ID,
    definitions: [
      {
        definitionId: document.id,
        contentSourceId: ids.scene,
        definitionVersion: 1,
        definitionChecksum: checksumRuleDocument(document),
        contractVersion: 1,
        label: 'Alternating diagonals',
        document
      }
    ]
  }
  return {
    ...encounter(),
    gameSystemId: DND5E_SYSTEM_ID,
    optionalCombatSnapshot,
    optionalCombatSnapshotChecksum: checksumCanonicalJson(optionalCombatSnapshot)
  }
}

describe('Encounter action Scene context', () => {
  it('does not read a Scene for a non-positional action', async () => {
    const result = await lockEncounterActionSceneContext({
      db: {} as never,
      encounterId: ids.encounter,
      actorId: ids.sourceActor,
      targetActorId: ids.targetActor,
      request: null
    })
    expect(result).toBeNull()
    expect(state.findEncounterBinding).not.toHaveBeenCalled()
  })

  it('locks and exposes only exact mechanical grid and actor-bound token facts', async () => {
    state.lockEncounter.mockResolvedValueOnce(encounter())
    state.findEncounterBinding.mockResolvedValueOnce({ sceneId: ids.scene })
    state.lockLiveScene.mockResolvedValueOnce(scene())
    state.listActorTokenBindings.mockResolvedValueOnce([
      { actorId: ids.sourceActor, tokenId: ids.sourceToken },
      { actorId: ids.targetActor, tokenId: ids.targetToken }
    ])
    const result = await lockEncounterActionSceneContext({
      db: {} as never,
      encounterId: ids.encounter,
      actorId: ids.sourceActor,
      targetActorId: ids.targetActor,
      request: {
        sceneId: ids.scene,
        expectedSceneVersion: 4,
        sourceTokenId: ids.sourceToken,
        targetTokenId: ids.targetToken
      }
    })
    expect(result).toMatchObject({
      sceneId: ids.scene,
      sceneVersion: 4,
      sourceToken: {
        tokenId: ids.sourceToken,
        actorId: ids.sourceActor,
        position: { x: 0, y: 0 },
        width: 1,
        height: 1,
        rotationDegrees: 0
      },
      targetToken: {
        tokenId: ids.targetToken,
        actorId: ids.targetActor,
        position: { x: 0, y: 0 },
        width: 1,
        height: 1,
        rotationDegrees: 0
      }
    })
    expect(result?.sourceToken).not.toHaveProperty('label')
    expect(result?.sourceToken).not.toHaveProperty('assetId')
    expect(result?.sourceToken).not.toHaveProperty('controlledByUserIds')
    expect(result?.sourceToken).not.toHaveProperty('hidden')
    expect(result?.sourceToken).not.toHaveProperty('locked')
    expect(result?.sourceToken).not.toHaveProperty('vision')
    expect(toEncounterActionSceneDependency(result)).toEqual({
      sceneId: ids.scene,
      sceneVersion: 4,
      sourceTokenId: ids.sourceToken,
      targetTokenId: ids.targetToken
    })
  })

  it('uses the same dependency checksum for raw and locked Scene contexts', () => {
    const request = {
      sceneId: ids.scene,
      expectedSceneVersion: 4,
      sourceTokenId: ids.sourceToken,
      targetTokenId: ids.targetToken
    }
    const locked = {
      sceneId: ids.scene,
      sceneVersion: 4,
      sourceToken: {
        actorId: ids.sourceActor,
        height: 1,
        position: { x: 0, y: 0 },
        rotationDegrees: 0,
        tokenId: ids.sourceToken,
        width: 1
      },
      targetToken: {
        actorId: ids.targetActor,
        height: 1,
        position: { x: 0, y: 0 },
        rotationDegrees: 0,
        tokenId: ids.targetToken,
        width: 1
      },
      grid: scene().state.grid
    }
    const requestIntent = createEncounterActionStartIntent({
      actionId: ids.scene,
      actorId: ids.sourceActor,
      sceneContext: request,
      targetActorId: ids.targetActor
    })
    expect(requestIntent).toEqual(
      createEncounterActionStartIntent({
        actionId: ids.scene,
        actorId: ids.sourceActor,
        sceneContext: locked,
        targetActorId: ids.targetActor
      })
    )
    expect(
      createEncounterActionStartIntent({
        actionId: ids.scene,
        actorId: ids.sourceActor,
        optionalCombatIntent: {
          optionId: 'a'.repeat(64),
          definitionId: ids.encounter,
          selectionContract: 'b'.repeat(64),
          selections: []
        },
        sceneContext: request,
        targetActorId: ids.targetActor
      }).optionalCombatIntentChecksum
    ).not.toBe(requestIntent.optionalCombatIntentChecksum)
  })

  it('uses the frozen Encounter grid policy without mutating the authored Scene grid', async () => {
    const authoredScene = scene()
    state.lockEncounter.mockResolvedValueOnce(alternatingEncounter())
    state.findEncounterBinding.mockResolvedValueOnce({ sceneId: ids.scene })
    state.lockLiveScene.mockResolvedValueOnce(authoredScene)
    state.listActorTokenBindings.mockResolvedValueOnce([
      { actorId: ids.sourceActor, tokenId: ids.sourceToken },
      { actorId: ids.targetActor, tokenId: ids.targetToken }
    ])

    const result = await lockEncounterActionSceneContext({
      db: {} as never,
      encounterId: ids.encounter,
      actorId: ids.sourceActor,
      targetActorId: ids.targetActor,
      request: {
        sceneId: ids.scene,
        expectedSceneVersion: 4,
        sourceTokenId: ids.sourceToken,
        targetTokenId: ids.targetToken
      }
    })

    expect(result?.grid).toMatchObject({ kind: 'SQUARE', diagonalPolicy: 'ALTERNATING' })
    expect(authoredScene.state.grid.diagonalPolicy).toBe('EQUAL')
  })

  it('fails closed when the exact Encounter binding omits a requested token', async () => {
    state.lockEncounter.mockResolvedValueOnce(encounter())
    state.findEncounterBinding.mockResolvedValueOnce({ sceneId: ids.scene })
    state.lockLiveScene.mockResolvedValueOnce(scene())
    state.listActorTokenBindings.mockResolvedValueOnce([
      { actorId: ids.sourceActor, tokenId: ids.sourceToken }
    ])

    await expect(
      lockEncounterActionSceneContext({
        db: {} as never,
        encounterId: ids.encounter,
        actorId: ids.sourceActor,
        targetActorId: ids.targetActor,
        request: {
          sceneId: ids.scene,
          expectedSceneVersion: 4,
          sourceTokenId: ids.sourceToken,
          targetTokenId: ids.targetToken
        }
      })
    ).rejects.toThrow('Action Scene token context is stale.')
  })

  it('rejects a stale version or mismatched token actor before action evaluation', async () => {
    state.lockEncounter.mockResolvedValueOnce(encounter())
    state.findEncounterBinding.mockResolvedValueOnce({ sceneId: ids.scene })
    state.lockLiveScene.mockResolvedValueOnce(scene())
    await expect(
      lockEncounterActionSceneContext({
        db: {} as never,
        encounterId: ids.encounter,
        actorId: ids.sourceActor,
        targetActorId: ids.targetActor,
        request: {
          sceneId: ids.scene,
          expectedSceneVersion: 3,
          sourceTokenId: ids.sourceToken,
          targetTokenId: ids.targetToken
        }
      })
    ).rejects.toThrow('Action Scene context is stale.')
    state.lockEncounter.mockResolvedValueOnce(encounter())
    state.findEncounterBinding.mockResolvedValueOnce({ sceneId: ids.scene })
    state.lockLiveScene.mockResolvedValueOnce({
      state: { ...scene().state, tokens: [token(ids.sourceToken)] }
    })
    state.listActorTokenBindings.mockResolvedValueOnce([
      { actorId: ids.sourceActor, tokenId: ids.sourceToken },
      { actorId: ids.targetActor, tokenId: ids.targetToken }
    ])
    await expect(
      lockEncounterActionSceneContext({
        db: {} as never,
        encounterId: ids.encounter,
        actorId: ids.sourceActor,
        targetActorId: ids.targetActor,
        request: {
          sceneId: ids.scene,
          expectedSceneVersion: 4,
          sourceTokenId: ids.sourceToken,
          targetTokenId: ids.targetToken
        }
      })
    ).rejects.toThrow('Action Scene token context is stale.')
  })
})
