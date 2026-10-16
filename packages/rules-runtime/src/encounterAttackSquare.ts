import { v5 as uuidv5 } from 'uuid'
import type { ResolveEncounterActionInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { EncounterAttackSquarePendingContextDto } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import {
  spatialTokensAtPoint,
  type ScenePoint,
  type SpatialSceneToken
} from '@artificer-toolkit/shared/vtt'

const NAMESPACE = '3b8a6e1c-52d4-5f0a-9c7e-1d2b4a6f8e03'

/** The command an answered square attack runs as: the attack, aimed at the creature the GM named. */
export function attackSquareChildCommandId(occurrenceId: string) {
  return uuidv5(`${occurrenceId}:attack-square`, NAMESPACE)
}

/** Whether the picked point lies in the attacker's own space, which cannot be attacked. */
export function attackSquareIsAttackersOwn(input: {
  point: ScenePoint
  attackerActorId: string
  tokens: readonly (Omit<SpatialSceneToken, 'id'> & { tokenId: string; actorId: string })[]
}): boolean {
  const own = new Set(
    input.tokens.filter((token) => token.actorId === input.attackerActorId).map((t) => t.tokenId)
  )
  const tokens = input.tokens.map((token) => ({ ...token, id: token.tokenId }))
  return spatialTokensAtPoint(input.point, tokens).some((tokenId) => own.has(tokenId))
}

/**
 * The creatures an attack on a picked square could hit, once each in token-id order: every actor
 * with a token holding the point, hidden ones included, never the attacker and never the defeated.
 */
export function attackSquareCandidates(input: {
  point: ScenePoint
  attackerActorId: string
  defeatedActorIds: ReadonlySet<string>
  tokens: readonly (Omit<SpatialSceneToken, 'id'> & { tokenId: string; actorId: string })[]
}): { actorId: string; tokenId: string }[] {
  const actorByTokenId = new Map(input.tokens.map((token) => [token.tokenId, token.actorId]))
  const seen = new Set<string>([input.attackerActorId, ...input.defeatedActorIds])
  const candidates: { actorId: string; tokenId: string }[] = []
  const tokens = input.tokens.map((token) => ({ ...token, id: token.tokenId }))
  for (const tokenId of spatialTokensAtPoint(input.point, tokens)) {
    const actorId = actorByTokenId.get(tokenId)!
    if (seen.has(actorId)) continue
    seen.add(actorId)
    candidates.push({ actorId, tokenId })
  }
  return candidates
}

/**
 * The attack on a square the GM ruled empty: the stored command under the derived command id,
 * still aimed at the square it was picked on, so the attacker's roll flows on the command they sent.
 */
export function attackSquareEmptyCommand(input: {
  command: ResolveEncounterActionInputDto
  occurrenceId: string
  expectedVersion: number
}): ResolveEncounterActionInputDto {
  return {
    ...input.command,
    commandId: attackSquareChildCommandId(input.occurrenceId),
    expectedVersion: input.expectedVersion
  }
}

/**
 * The ordinary single-target attack an answered square becomes: the stored command with its target
 * replaced by the GM's ruling, under the derived command id, fenced to the Scene the square was
 * picked in.
 */
export function attackSquareChildCommand(input: {
  command: ResolveEncounterActionInputDto
  context: Pick<EncounterAttackSquarePendingContextDto, 'scene' | 'sourceTokenId' | 'candidates'>
  occurrenceId: string
  occupantActorId: string
  expectedVersion: number
}): ResolveEncounterActionInputDto {
  const occupant = input.context.candidates.find(
    (candidate) => candidate.actorId === input.occupantActorId
  )
  if (!occupant) throw new Error('The named creature does not stand on the square.')
  return {
    ...input.command,
    commandId: attackSquareChildCommandId(input.occurrenceId),
    expectedVersion: input.expectedVersion,
    target: { kind: 'ACTOR', actorId: occupant.actorId },
    sceneContext: {
      sceneId: input.context.scene.sceneId,
      expectedSceneVersion: input.context.scene.sceneVersion,
      sourceTokenId: input.context.sourceTokenId,
      targetTokenId: occupant.tokenId
    }
  }
}
