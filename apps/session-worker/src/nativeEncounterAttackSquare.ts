import type { ServerAggregateChoicePendingSnapshotDto } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import {
  defeatedEncounterActorIds,
  type DeadCharacterIds
} from '@artificer-toolkit/rules-runtime/encounterActorDefeat'
import {
  attackSquareCandidates,
  attackSquareIsAttackersOwn
} from '@artificer-toolkit/rules-runtime/encounterAttackSquare'
import type { AreaPlanBase } from './nativeEncounterAreaRules.js'
import { LiveSessionDomainRejectionError } from './liveSessionRoutes.js'
import {
  prepareEmptySquareAttack,
  prepareSquareScene,
  type SquareCommand
} from './nativeEncounterAttackEmptySquare.js'

/**
 * Seals an attack on a picked square for the GM, who alone knows who stands there. The attack is
 * held to the warnings gate here, as an attack on an unknown stranger, so the attacker acknowledges
 * what it raises before the GM is asked; the GM's answer then runs it on that creature, or rolls it
 * as a miss on an empty square.
 */
export async function planNativeLiveEncounterAttackSquare(
  input: AreaPlanBase & { command: SquareCommand; deadCharacterIds: DeadCharacterIds }
) {
  const { command, state, actors } = input
  const base = await prepareSquareScene(input)
  const { caster, scene } = base
  if (
    attackSquareIsAttackersOwn({
      point: command.target.point,
      attackerActorId: caster.id,
      tokens: scene.tokens
    })
  )
    throw new LiveSessionDomainRejectionError(422, {
      code: 'DOMAIN_REJECTED',
      reason: 'TARGET_UNAVAILABLE',
      message: 'You cannot attack your own space.'
    })
  const candidates = attackSquareCandidates({
    point: command.target.point,
    attackerActorId: caster.id,
    defeatedActorIds: defeatedEncounterActorIds(actors, input.deadCharacterIds),
    tokens: scene.tokens
  })
  await prepareEmptySquareAttack(input, base, candidates.length === 0)
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
