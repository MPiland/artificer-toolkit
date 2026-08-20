import type { DBLike } from '@artificer-toolkit/db'
import {
  liveSessionExecutorRequestDtoSchema,
  liveSessionExecutorResponseDtoSchema,
  type LiveSessionCommandDto,
  type LiveSessionHostTimingDto,
  type LiveSessionExecutorCommandResultDto,
  type LiveSessionExecutorResponseDto
} from '@artificer-toolkit/schema/api/liveSessions'

import {
  claimLiveSessionRoomCommandAuthority,
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
    const { characterVision, ruleSnapshot: _ruleSnapshot, ...wire } = execution
    return {
      ...wire,
      characterVision,
      hostTiming
    }
  }
  const { ruleSnapshot: _ruleSnapshot, ...wire } = execution
  return { ...wire, hostTiming }
}

function requiresLiveSessionCommandAuthorityClaim(command: LiveSessionCommandDto): boolean {
  switch (command.aggregateKind) {
    case 'CHARACTER':
    case 'ENCOUNTER':
      return true
    case 'SCENE':
      switch (command.command.type) {
        case 'ATTACH_SCENE':
          return true
        case 'UPSERT_SCENE_TOKEN':
        case 'REMOVE_SCENE_TOKEN':
        case 'MOVE_SCENE_TOKEN':
        case 'SET_SCENE_DOOR_STATE':
        case 'UPSERT_SCENE_BARRIER':
        case 'REMOVE_SCENE_BARRIER':
        case 'UPSERT_SCENE_LIGHT':
        case 'REMOVE_SCENE_LIGHT':
        case 'UPSERT_SCENE_DARKNESS':
        case 'REMOVE_SCENE_DARKNESS':
        case 'UPSERT_SCENE_ANNOTATION':
        case 'REMOVE_SCENE_ANNOTATION':
        case 'PATCH_SCENE_FOG':
        case 'SET_SCENE_VISION_REVEAL_MODE':
        case 'UNDO_LAST_SCENE_MOVE':
        case 'UPSERT_SCENE_MEASUREMENT':
        case 'REMOVE_SCENE_MEASUREMENT':
          return false
      }
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
      if (requiresLiveSessionCommandAuthorityClaim(request.command)) {
        await claimLiveSessionRoomCommandAuthority(db, request.userId, options, request.authorityId)
      }
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
  requiresLiveSessionCommandAuthorityClaim
}
