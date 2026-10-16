import type { ResolveEncounterActionInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { ServerAggregateChoicePendingSnapshotDto } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import {
  defeatedEncounterActorIds,
  type DeadCharacterIds
} from '@artificer-toolkit/rules-runtime/encounterActorDefeat'
import { attackSquareCandidates } from '@artificer-toolkit/rules-runtime/encounterAttackSquare'
import { prepareCasterSource, type AreaPlanBase } from './nativeEncounterAreaRules.js'
import { LiveSessionDomainRejectionError } from './liveSessionRoutes.js'

type SquareCommand = Extract<ResolveEncounterActionInputDto, { type: 'RESOLVE_ACTION' }> & {
  target: Extract<ResolveEncounterActionInputDto['target'], { kind: 'SQUARE' }>
}

/**
 * Seals an attack on a picked square for the GM, who alone knows who stands there. Nothing about
 * the action is evaluated yet: the GM's answer runs it as an ordinary attack on that creature.
 */
export async function planNativeLiveEncounterAttackSquare(
  input: AreaPlanBase & { command: SquareCommand; deadCharacterIds: DeadCharacterIds }
) {
  const { command, state, actors, capture } = input
  // The square is a creature-targeted action aimed blind, so the action must take a creature.
  const { caster } = await prepareCasterSource(input, 'ACTOR')
  const captured = await capture({
    kind: 'ACTION_AREA_SCENE',
    command: {
      actorId: command.actorId,
      sceneId: command.target.sceneId,
      expectedSceneVersion: command.target.expectedSceneVersion
    }
  })
  if (captured.kind !== 'ACTION_AREA_SCENE') throw new Error('Action Scene context is unavailable.')
  const scene = captured.context
  const candidates = attackSquareCandidates({
    point: command.target.point,
    attackerActorId: caster.id,
    defeatedActorIds: defeatedEncounterActorIds(actors, input.deadCharacterIds),
    tokens: scene.tokens
  })
  // Interim (ATTACK-17.T4a): an empty square is refused until the dedicated empty-square root lands.
  if (candidates.length === 0)
    throw new LiveSessionDomainRejectionError(422, {
      code: 'DOMAIN_REJECTED',
      reason: 'TARGET_UNAVAILABLE',
      message: 'Nobody stands on that square.'
    })
  const occurrenceId = crypto.randomUUID()
  const initiatorUserId = input.initial.expectedUserId
  const snapshot: ServerAggregateChoicePendingSnapshotDto = {
    snapshotKind: 'AGGREGATE_CHOICE',
    schemaVersion: 1,
    occurrenceId,
    optionalCombatSnapshotChecksum: state.optionalCombatSnapshotChecksum,
    applicationContext: {
      kind: 'ENCOUNTER_ATTACK_SQUARE',
      schemaVersion: 1,
      commandJson: JSON.stringify(command),
      commandFingerprint: input.fingerprint,
      initiatorUserId,
      attackerActorId: caster.id,
      scene: { sceneId: scene.sceneId, sceneVersion: scene.sceneVersion },
      sourceTokenId: scene.sourceToken.tokenId,
      candidates
    }
  }
  return {
    kind: 'SQUARE_PENDING' as const,
    command,
    response: null,
    snapshot,
    prepared: { actors },
    fingerprint: input.fingerprint,
    initiatorUserId,
    occurrenceId
  }
}
