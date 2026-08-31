import type { DBLike } from '@artificer-toolkit/db'
import {
  liveSessionExecutorRequestDtoSchema,
  liveSessionExecutorResponseDtoSchema,
  type LiveSessionExecutorSpatialRefreshDto,
  type LiveSessionHostTimingDto,
  type LiveSessionExecutorCommandResultDto,
  type LiveSessionExecutorResponseDto
} from '@artificer-toolkit/schema/api/liveSessions'

import {
  classifyLiveSessionCommandError,
  claimLiveSessionRoomCommandAuthority,
  executeLiveSessionCommand,
  loadLiveSessionCoordinatorSnapshot,
  releaseLiveSessionRoomCommandAuthority,
  renewLiveSessionRoomCommandAuthority
} from './liveSessionService.js'

function wireSpatialRefresh(
  refresh: Awaited<ReturnType<typeof executeLiveSessionCommand>>['spatialRefresh']
): LiveSessionExecutorSpatialRefreshDto | undefined {
  return refresh
    ? { characterVisions: refresh.characterVisions, sceneState: refresh.sceneState }
    : undefined
}

function wireExecution(
  execution: Awaited<ReturnType<typeof executeLiveSessionCommand>>,
  hostTiming: LiveSessionHostTimingDto
): LiveSessionExecutorCommandResultDto {
  if (execution.aggregateKind === 'SCENE') {
    const { spatialRefresh, ...wire } = execution
    return {
      ...wire,
      hostTiming,
      ...(spatialRefresh ? { spatialRefresh: wireSpatialRefresh(spatialRefresh) } : {})
    }
  }
  if (execution.aggregateKind === 'CHARACTER') {
    const {
      characterVision,
      ruleEvaluationLane: _ruleEvaluationLane,
      ruleSnapshot: _ruleSnapshot,
      spatialRefresh,
      ...wire
    } = execution
    return {
      ...wire,
      characterVision,
      hostTiming,
      ...(spatialRefresh ? { spatialRefresh: wireSpatialRefresh(spatialRefresh) } : {})
    }
  }
  const { ruleSnapshot: _ruleSnapshot, spatialRefresh, ...wire } = execution
  return {
    ...wire,
    hostTiming,
    ...(spatialRefresh ? { spatialRefresh: wireSpatialRefresh(spatialRefresh) } : {})
  }
}

function hostTiming(
  execution: Awaited<ReturnType<typeof executeLiveSessionCommand>>,
  durationMs: number,
  characterTiming: { evaluationLane: 'NONE' | 'CHARACTER_POLICY' | 'CHARACTER_ACTION' } | null,
  encounterTiming: { evaluationLane: 'NONE' | 'ENCOUNTER_ACTOR' | 'ENCOUNTER_ACTION' } | null
): LiveSessionHostTimingDto {
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    throw new Error('Live-session executor produced an invalid host duration.')
  }
  if (execution.aggregateKind === 'SCENE') return { category: 'SCENE_ONLY', durationMs }
  if (execution.aggregateKind === 'CHARACTER') {
    return {
      category:
        execution.ruleEvaluationLane !== undefined ||
        (characterTiming && characterTiming.evaluationLane !== 'NONE')
          ? 'RULE_BOUND'
          : 'NON_RULE_BOUND',
      durationMs
    }
  }
  return {
    category:
      encounterTiming && encounterTiming.evaluationLane !== 'NONE'
        ? 'RULE_BOUND'
        : 'NON_RULE_BOUND',
    durationMs
  }
}

export async function executeLiveSessionExecutorRequest(
  db: DBLike,
  rawRequest: unknown
): Promise<LiveSessionExecutorResponseDto> {
  const request = liveSessionExecutorRequestDtoSchema.parse(rawRequest)
  const options = { campaignId: request.campaignId, sessionId: request.sessionId }
  let response: LiveSessionExecutorResponseDto

  switch (request.operation) {
    case 'CLAIM':
      await claimLiveSessionRoomCommandAuthority(db, request.userId, options, request.authorityId)
      response = { ok: true, operation: 'CLAIM' }
      break
    case 'SNAPSHOT':
      response = {
        operation: 'SNAPSHOT',
        snapshot: await loadLiveSessionCoordinatorSnapshot(db, request.userId, options)
      }
      break
    case 'RENEW':
      {
        const renewal = await renewLiveSessionRoomCommandAuthority(
          db,
          request.userId,
          options,
          request.authorityId
        )
        response = {
          ...renewal,
          ok: true,
          operation: 'RENEW'
        }
      }
      break
    case 'RELEASE':
      await releaseLiveSessionRoomCommandAuthority(db, options, request.authorityId)
      response = { ok: true, operation: 'RELEASE' }
      break
    case 'COMMAND':
      {
        let characterTiming: {
          evaluationLane: 'NONE' | 'CHARACTER_POLICY' | 'CHARACTER_ACTION'
        } | null = null
        let encounterTiming: {
          evaluationLane: 'NONE' | 'ENCOUNTER_ACTOR' | 'ENCOUNTER_ACTION'
        } | null = null
        const startedAt = performance.now()
        const execution = await executeLiveSessionCommand(
          db,
          request.userId,
          options,
          request.command,
          request.authorityId,
          request.sceneVisionContext,
          undefined,
          (timing) => {
            characterTiming = timing
          },
          undefined,
          (timing) => {
            encounterTiming = timing
          }
        )
        const timing = hostTiming(
          execution,
          performance.now() - startedAt,
          characterTiming,
          encounterTiming
        )
        response = {
          execution: wireExecution(execution, timing),
          operation: 'COMMAND'
        }
      }
      break
  }

  return liveSessionExecutorResponseDtoSchema.parse(response)
}

export const liveSessionExecutorInternals = {
  classifyLiveSessionCommandError,
  hostTiming,
  wireExecution
}
