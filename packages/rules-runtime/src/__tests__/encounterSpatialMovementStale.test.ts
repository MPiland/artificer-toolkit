import { beforeAll, describe, expect, it } from 'vitest'
import type { EncounterSpatialRuleEffectRecord } from '@artificer-toolkit/schema/projections/spatialRuleEffectPersistence'
import type { ServerKernelRuleExecutionPendingSnapshotDto } from '@artificer-toolkit/schema/shared/rulesExecution'

import { toSpatialMovementTarget } from '../encounterSpatialCandidateExecution.js'
import {
  evaluateEncounterSpatialMovementRuleBatch,
  type SpatialMovementRuleRoot
} from '../encounterSpatialMovementRuleService.js'
import type { RulesRuntimeService } from '../rulesRuntimeService.js'
import {
  createSrdRulesRuntime,
  srdCreatureTarget,
  srdEncounterState,
  testUuid
} from '../testing/dnd5eSrdEncounter.js'
import {
  actorIdByTokenId,
  actors,
  authoredZone,
  GM_USER_ID,
  GOBLIN_ID,
  GOBLIN_TOKEN_ID,
  OCCURRENCE_ID,
  placedZone,
  SCENE_ID,
  tokens
} from '../testing/encounterTurnZoneFixture.js'

/**
 * A paused spatial movement resumes only against the same contacts it paused on: the zone, the
 * path and the contacted creature are re-derived at resume and compared with what was sealed.
 */

const START_POINT = { x: 50, y: 350 }
const ENTERING_PATH = [START_POINT, { x: 250, y: 350 }]
const MISSING_PATH = [START_POINT, { x: 50, y: 650 }]

const state = srdEncounterState({ actors, currentActorId: GOBLIN_ID, turnSequence: 3 })
const zone = placedZone(0x3a1, authoredZone(['ENTER_SPACE']), 1)

let runtime: RulesRuntimeService
beforeAll(async () => {
  runtime = await createSrdRulesRuntime()
})

function rootOver(path: readonly { x: number; y: number }[]): SpatialMovementRuleRoot {
  return {
    commandId: testUuid(0xb01),
    commandFingerprint: 'a'.repeat(64),
    initiatorUserId: GM_USER_ID,
    correlationId: null,
    encounterId: state.id,
    sceneId: SCENE_ID,
    tokenId: GOBLIN_TOKEN_ID,
    expectedEncounterVersion: state.version,
    expectedSceneVersion: 1,
    movementKind: 'VOLUNTARY',
    originalPath: path
  }
}

type Evaluation = {
  path?: readonly { x: number; y: number }[]
  snapshot?: EncounterSpatialRuleEffectRecord[]
  /** What the row lock returns, keyed by zone id, when it differs from the snapshot. */
  locked?: (zoneRecord: EncounterSpatialRuleEffectRecord) => EncounterSpatialRuleEffectRecord
  goblin?: (typeof actors)[number]
  pendingSnapshot?: ServerKernelRuleExecutionPendingSnapshotDto
}

function evaluate(options: Evaluation = {}) {
  const snapshot = options.snapshot ?? [zone]
  const pending = options.pendingSnapshot
  if (pending && pending.snapshotKind !== 'KERNEL_EVIDENCE')
    throw new Error('Expected a kernel request.')
  const requestId = pending?.request.requestId ?? ''
  return evaluateEncounterSpatialMovementRuleBatch({
    actorUserId: GM_USER_ID,
    autoRoll: {},
    encounter: { ...state, actors },
    sceneId: SCENE_ID,
    sceneVersion: 1,
    actorIdByTokenId,
    sceneTokens: tokens.map((token) =>
      token.id === GOBLIN_TOKEN_ID ? { ...token, position: START_POINT } : token
    ),
    spatialScope: {
      snapshot: async () => snapshot,
      lockById: async ({ id }) => {
        const found = snapshot.find((effect) => effect.id === id) ?? null
        return found && options.locked ? options.locked(found) : found
      }
    },
    loadTargets: async (actorIds) =>
      new Map(
        actorIds.map((actorId) => [
          actorId,
          toSpatialMovementTarget(
            srdCreatureTarget(
              actorId === GOBLIN_ID && options.goblin
                ? options.goblin
                : actors.find((actor) => actor.id === actorId)!
            )
          )
        ])
      ),
    applyTerminal: async () => {
      throw new Error('A stale resume must refuse before any terminal applies.')
    },
    root: rootOver(options.path ?? ENTERING_PATH),
    currentPosition: START_POINT,
    occurrenceId: OCCURRENCE_ID,
    executionCommandId: testUuid(0xb02),
    runtime,
    random: () => 0,
    ...(pending
      ? {
          occurrenceVersion: 1,
          pendingSnapshot: pending,
          resolution: {
            kind: 'ENTER_DICE' as const,
            requestId,
            rawFaces: [1],
            rollMode: 'NORMAL' as const
          },
          resolutionCommand: {
            commandId: testUuid(0xb03),
            commandFingerprint: 'b'.repeat(64),
            actorUserId: GM_USER_ID,
            correlationId: null,
            expectedOccurrenceVersion: 0,
            requestId,
            kind: 'ENTER_DICE' as const
          }
        }
      : {})
  })
}

async function paused() {
  const fresh = await evaluate()
  if (fresh.kind !== 'PENDING') throw new Error('Entering the zone must pause for the save.')
  return fresh.pendingSnapshot
}

describe('resuming a paused spatial movement against changed facts', () => {
  it('refuses the resume when the zone is no longer in the Scene', async () => {
    const pendingSnapshot = await paused()

    await expect(evaluate({ pendingSnapshot, snapshot: [] })).rejects.toThrow(
      'The paused spatial movement root is stale.'
    )
  })

  it('refuses the resume when the path no longer meets the zone', async () => {
    const pendingSnapshot = await paused()

    await expect(evaluate({ pendingSnapshot, path: MISSING_PATH })).rejects.toThrow(
      'The paused spatial movement root is stale.'
    )
  })

  it('refuses the resume when the zone row changed version since the pause', async () => {
    const pendingSnapshot = await paused()

    await expect(
      evaluate({ pendingSnapshot, locked: (found) => ({ ...found, version: found.version + 1 }) })
    ).rejects.toThrow('The paused spatial movement root is stale.')
  })

  it('refuses the resume when the contacted creature changed after the pause', async () => {
    const pendingSnapshot = await paused()
    const goblin = actors.find((actor) => actor.id === GOBLIN_ID)!
    if (goblin.kind === 'CHARACTER') throw new Error('The goblin is a creature.')

    await expect(
      evaluate({
        pendingSnapshot,
        goblin: { ...goblin, currentHitPoints: goblin.currentHitPoints - 1 }
      })
    ).rejects.toThrow('The paused spatial movement root is stale.')
  })
})
