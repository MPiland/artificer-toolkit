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
  runtime = createSrdRulesRuntime()
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
  // The pause moved the token to the contact and advanced the Scene: a resume starts from there.
  const context =
    pending?.applicationContext.kind === 'ENCOUNTER_SPATIAL_MOVEMENT'
      ? pending.applicationContext
      : null
  const paused = context?.root ?? null
  const position = paused?.currentPosition ?? START_POINT
  // Each answer is the next occurrence version after the answers already recorded on the root.
  const answered = paused?.resolutionCommands.length ?? 0
  // A failed save asks for its damage dice as a number; otherwise the answer is the d20 face 1.
  const request = pending?.request
  const resolution =
    context?.currentCandidate.diceStage && request?.kind === 'INTEGER_RANGE'
      ? { kind: 'ENTER_INTEGER' as const, requestId, value: request.min }
      : {
          kind: 'ENTER_DICE' as const,
          requestId,
          rawFaces: [1],
          rollMode: 'NORMAL' as const
        }
  return evaluateEncounterSpatialMovementRuleBatch({
    actorUserId: GM_USER_ID,
    autoRoll: {},
    encounter: { ...state, actors },
    sceneId: SCENE_ID,
    sceneVersion: paused?.currentSceneVersion ?? 1,
    sceneGrid: {
      kind: 'SQUARE',
      cellSize: 100,
      diagonalPolicy: 'EQUAL',
      distancePerCell: 5,
      origin: { x: 0, y: 0 },
      unit: 'FEET'
    },
    actorIdByTokenId,
    sceneTokens: tokens.map((token) =>
      token.id === GOBLIN_TOKEN_ID ? { ...token, position } : token
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
    currentPosition: position,
    occurrenceId: OCCURRENCE_ID,
    executionCommandId: testUuid(0xb02),
    runtime,
    random: () => 0,
    ...(pending
      ? {
          occurrenceVersion: answered + 1,
          pendingSnapshot: pending,
          resolution,
          resolutionCommand: {
            commandId: testUuid(0xb03 + answered),
            commandFingerprint: 'b'.repeat(64),
            actorUserId: GM_USER_ID,
            correlationId: null,
            expectedOccurrenceVersion: answered,
            requestId,
            kind: resolution.kind
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
    ).rejects.toThrow('A spatial root changed before execution.')
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
    ).rejects.toThrow('The current spatial contact is stale.')
  })
})

describe('resuming a paused spatial movement with a second contact queued (SPELLS-20 T4f)', () => {
  /** A second zone on the same space: the walk enters both, each asking for a save. */
  const secondZone = placedZone(0x3a2, authoredZone(['ENTER_SPACE']), 2)

  async function pausedOnFirst() {
    const fresh = await evaluate({ snapshot: [zone, secondZone] })
    if (fresh.kind !== 'PENDING')
      throw new Error('Entering the first zone must pause for the save.')
    const context = fresh.pendingSnapshot.applicationContext
    if (context.kind !== 'ENCOUNTER_SPATIAL_MOVEMENT') throw new Error('Expected a spatial pause.')
    // Real evidence: the pause is on the first zone with the second queued behind it.
    expect(context.currentCandidate.candidate.effectId).toBe(zone.id)
    expect(context.remainingCandidates.map(({ candidate }) => candidate.effectId)).toEqual([
      secondZone.id
    ])
    return fresh.pendingSnapshot
  }

  /** The failed save on the first zone asks for its damage dice, the last answer before the queue. */
  async function pausedOnFirstDamage() {
    const answered = await evaluate({
      pendingSnapshot: await pausedOnFirst(),
      snapshot: [zone, secondZone]
    })
    if (answered.kind !== 'PENDING') throw new Error('The failed save must ask for its damage.')
    const context = answered.pendingSnapshot.applicationContext
    if (context.kind !== 'ENCOUNTER_SPATIAL_MOVEMENT') throw new Error('Expected a spatial pause.')
    expect(context.currentCandidate.candidate.effectId).toBe(zone.id)
    expect(context.currentCandidate.diceStage).not.toBeNull()
    return answered.pendingSnapshot
  }

  it('resumes onto the queued contact when nothing changed since the pause', async () => {
    const pendingSnapshot = await pausedOnFirstDamage()

    const resumed = await evaluate({ pendingSnapshot, snapshot: [zone, secondZone] })

    if (resumed.kind !== 'PENDING') throw new Error('The second zone must pause for its save.')
    const context = resumed.pendingSnapshot.applicationContext
    if (context.kind !== 'ENCOUNTER_SPATIAL_MOVEMENT') throw new Error('Expected a spatial pause.')
    expect(context.currentCandidate.candidate.effectId).toBe(secondZone.id)
  })

  it('refuses the resume when the queued zone’s row advanced since the pause', async () => {
    const pendingSnapshot = await pausedOnFirstDamage()
    const advanced = { ...secondZone, version: secondZone.version + 1 }

    await expect(evaluate({ pendingSnapshot, snapshot: [zone, advanced] })).rejects.toThrow(
      'The remaining spatial contacts changed.'
    )
  })
})
