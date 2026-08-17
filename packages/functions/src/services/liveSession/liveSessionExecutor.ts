import type { DBLike } from '@artificer-toolkit/db'
import {
  liveSessionExecutorRequestDtoSchema,
  liveSessionExecutorResponseDtoSchema,
  type LiveSessionHostTimingDto,
  type LiveSessionExecutorCommandResultDto,
  type LiveSessionExecutorResponseDto
} from '@artificer-toolkit/schema/api/liveSessions'

import {
  claimLiveSessionRoomCommandAuthority,
  deriveLiveSessionCharacterVision,
  executeLiveSessionCommand,
  loadLiveSessionCoordinatorSnapshot,
  releaseLiveSessionRoomCommandAuthority,
  renewLiveSessionRoomCommandAuthority
} from './liveSessionService.js'

function wireExecution(
  execution: Awaited<ReturnType<typeof executeLiveSessionCommand>>,
  hostTiming: LiveSessionHostTimingDto
): LiveSessionExecutorCommandResultDto {
  if (execution.aggregateKind === 'SCENE') return { ...execution, hostTiming }
  if (execution.aggregateKind === 'CHARACTER') {
    const { ruleSnapshot, ...wire } = execution
    return {
      ...wire,
      characterVision: deriveLiveSessionCharacterVision(execution.aggregateId, ruleSnapshot),
      hostTiming
    }
  }
  const { ruleSnapshot: _ruleSnapshot, ...wire } = execution
  return { ...wire, hostTiming }
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
        characterTiming && characterTiming.evaluationLane !== 'NONE'
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
      response = {
        memberships: await renewLiveSessionRoomCommandAuthority(
          db,
          request.userId,
          options,
          request.authorityId
        ),
        ok: true,
        operation: 'RENEW'
      }
      break
    case 'RELEASE':
      await releaseLiveSessionRoomCommandAuthority(db, options, request.authorityId)
      response = { ok: true, operation: 'RELEASE' }
      break
    case 'COMMAND':
      await claimLiveSessionRoomCommandAuthority(db, request.userId, options, request.authorityId)
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
