import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { EncounterSpatialRuleEffectRecord } from '@artificer-toolkit/schema/projections/spatialRuleEffectPersistence'
import type { MeleeRetaliationEvidenceDto } from '@artificer-toolkit/schema/shared/ruleExecutionEffectEvidence'
import { rangeDtoSchema } from '@artificer-toolkit/schema/shared/range'
import { ENDED_EFFECT_RELEASE_OPERATION_KEY } from '@artificer-toolkit/schema/shared/ruleExecutionMechanics'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { SpatialTokenFootprint } from '@artificer-toolkit/shared/vtt'

import { projectNativeActionEffectTransitions } from './encounterActionEffectReceipts.js'
import type { ProjectableCharacterFacts } from './encounterActionProjection.js'
import { isMeleeAttackSource, type NativeEncounterActionSource } from './encounterActionSources.js'
import type { MovementTarget } from './encounterMovementTargets.js'
import {
  settleAutomaticSpatialEvidence,
  spatialCandidateEvidence,
  spatialExecutionInput,
  spatialExecutionRecordedFaces,
  spatialExecutionOutcome,
  toSpatialInstances,
  toSpatialMovementTarget,
  type SpatialTargetState
} from './encounterSpatialCandidateExecution.js'
import { planNativeSpatialMovementPrefix } from './encounterSpatialMovementPlan.js'
import { zoneMeleeRetaliationContacts } from './encounterZoneContacts.js'
import type { RulesRuntimeService } from './rulesRuntimeService.js'
import { executeTargetBoundActiveRuleEffectWithPause } from './targetBoundActiveRuleEffectExecutor.js'

type MeleeRetaliationExecution = MeleeRetaliationEvidenceDto['executions'][number]

/** One creature's token as an action's Scene context pins it. */
export type MeleeRetaliationToken = SpatialTokenFootprint & { actorId: string; tokenId: string }

/**
 * Whether a completed attack is a melee hit that sets off the zones its target holds (D153): an
 * installed melee attack trigger with a target-policy range, against another creature, that hit.
 */
export function isMeleeRetaliationHit(input: {
  gameSystemId: string
  prepared: {
    actor: { id: string }
    target: { id: string }
    source: NativeEncounterActionSource
    targetPolicy: { range: unknown }
  }
  resultPath: string | undefined
}) {
  const { prepared } = input
  return (
    prepared.actor.id !== prepared.target.id &&
    (input.resultPath === 'ON_HIT' || input.resultPath === 'ON_CRIT') &&
    rangeDtoSchema.safeParse(prepared.targetPolicy.range).success &&
    isMeleeAttackSource(input.gameSystemId, prepared.source)
  )
}

/** The footprint fields that pin a token, so every reader of the same token checksums it equally. */
function tokenPin({ actorId, tokenId, position, width, height }: MeleeRetaliationToken) {
  return { actorId, tokenId, position, width, height }
}

/**
 * The zones a melee hit sets off against its attacker (D153): those the hit creature holds on its
 * own token that contain the attacker, in effect-id order, with the checksum that pins them. The
 * action plans against them and its terminal transaction re-derives them from the locked Scene.
 * `actors` are the Run's actors when the attack was made, so a source the hit defeats still
 * retaliates. Null when no zone answers the hit.
 */
export function selectMeleeRetaliationContacts(input: {
  actors: readonly EncounterRunActorState[]
  attacker: MeleeRetaliationToken
  hit: MeleeRetaliationToken
  effects: readonly EncounterSpatialRuleEffectRecord[]
}) {
  const tokens = [input.attacker, input.hit]
  const contacts = zoneMeleeRetaliationContacts({
    actorIdByTokenId: new Map(tokens.map(({ tokenId, actorId }) => [tokenId, actorId])),
    effects: toSpatialInstances(input.effects, input.actors),
    attackerTokenId: input.attacker.tokenId,
    hitTokenId: input.hit.tokenId,
    tokens: tokens.map(({ tokenId, position, width, height }) => ({
      id: tokenId,
      position,
      width,
      height
    }))
  })
  if (!contacts.length) return null
  const effects = contacts.map(({ effectId }) => {
    const effect = input.effects.find((candidate) => candidate.id === effectId)
    if (!effect) throw new Error('Melee retaliation zone is unavailable.')
    return effect
  })
  const selectionChecksum = checksumCanonicalJson({
    attacker: tokenPin(input.attacker),
    hit: tokenPin(input.hit),
    zones: contacts.map((contact, index) => ({
      contact,
      version: effects[index]!.version,
      placementChecksum: effects[index]!.placementChecksum
    }))
  })
  return { contacts, effects, selectionChecksum }
}

/**
 * Executes the selected zones against the attacker, each from the state the last left, and plans
 * the attacker's one mechanics batch. The system rolls every save and damage die (D153), so the
 * plan never pauses. `attacker` is the attacker as the action left it. With `retained`, the plan
 * replays its recorded dice and must rebuild the same evidence.
 */
export async function planEncounterMeleeRetaliation<
  TCharacterFacts extends ProjectableCharacterFacts
>(input: {
  selected: NonNullable<ReturnType<typeof selectMeleeRetaliationContacts>>
  attacker: MovementTarget<TCharacterFacts>
  encounter: { id: string; version: number; campaignId: string; gameSystemId: string }
  occurrenceId: string
  sourceCommandId: string
  occurredAt: string
  userId: string
  runtime: RulesRuntimeService
  random: (maxExclusive: number) => number
  /** What the zones' damage ends on the attacker: the actor whose turn it is and every actor's side. */
  damageEnds: NonNullable<Parameters<typeof planNativeSpatialMovementPrefix>[0]['damageEnds']>
  retained?: MeleeRetaliationEvidenceDto
}) {
  const { selected, attacker, retained } = input
  const replayFaces = retained?.executions.flatMap(spatialExecutionRecordedFaces)
  const random = replayFaces
    ? () => {
        const face = replayFaces.shift()
        if (face === undefined)
          throw new Error('Retained melee retaliation evidence is missing a recorded die.')
        return face - 1
      }
    : input.random
  const spatialTarget = toSpatialMovementTarget(attacker)
  let state: SpatialTargetState = spatialTarget.state
  const executions: MeleeRetaliationExecution[] = []
  for (const [ordinal, contact] of selected.contacts.entries()) {
    const effect = selected.effects[ordinal]!
    const candidate = {
      ordinal,
      candidate: contact,
      ...spatialCandidateEvidence({
        effect,
        target: spatialTarget,
        state,
        d20Policy: null,
        diceStage: null
      })
    }
    const effectInput = spatialExecutionInput({
      effect,
      target: spatialTarget,
      state,
      occurrenceId: input.occurrenceId,
      runtime: input.runtime
    })
    const { result } = await settleAutomaticSpatialEvidence({
      effectInput,
      candidate: contact,
      result: await executeTargetBoundActiveRuleEffectWithPause(effectInput),
      d20: null,
      autoRoll: { [contact.sourceActorId]: true, [contact.targetActorId]: true },
      random
    })
    if ('continuation' in result)
      throw new Error('Melee retaliation requested evidence the system cannot roll.')
    const outcome = spatialExecutionOutcome({
      target: spatialTarget,
      state,
      targetStateChecksum: candidate.target.targetStateChecksum,
      result
    })
    const after = outcome.targetTransition.after
    state = {
      current: after.currentHitPoints,
      temporary: after.temporaryHitPoints,
      conditions: [...after.conditionIds],
      deathSaves: after.deathSaves
    }
    executions.push({ ordinal, candidate, ...outcome })
  }
  const settled = planNativeSpatialMovementPrefix<TCharacterFacts>({
    targets: new Map([[attacker.actor.id, attacker]]),
    executions,
    encounterId: input.encounter.id,
    expectedEncounterVersion: input.encounter.version,
    campaignId: input.encounter.campaignId,
    gameSystemId: input.encounter.gameSystemId,
    occurrenceId: input.occurrenceId,
    sourceCommandId: input.sourceCommandId,
    occurredAt: input.occurredAt,
    userId: input.userId,
    commandId: { phase: 'MELEE_RETALIATION', ordinal: 0 },
    damageEnds: { ...input.damageEnds, incomingDamageGrants: true }
  })
  const settlement = settled.settlements[0] ?? null
  const evidence: MeleeRetaliationEvidenceDto = {
    selectionChecksum: selected.selectionChecksum,
    executions,
    grantEffectTransitions: (settlement?.grants ?? []).flatMap(
      (grant) =>
        projectNativeActionEffectTransitions({
          state: null,
          recurring: grant,
          targetActorId: attacker.actor.id
        }).activeEffectTransitions
    ),
    releasedConditionIds: (settlement?.batch.applications ?? []).flatMap((application) =>
      application.kind === 'CONDITION_REMOVE' &&
      application.sourceOperationKey === ENDED_EFFECT_RELEASE_OPERATION_KEY
        ? [application.conditionId]
        : []
    )
  }
  if (
    retained &&
    (replayFaces?.length || checksumCanonicalJson(evidence) !== checksumCanonicalJson(retained))
  )
    throw new Error('Retained melee retaliation evidence is stale.')
  return {
    evidence,
    /** Null when the zones left the attacker unchanged, so no batch is written. */
    settlement,
    projectedAttacker: settled.projectedTargets.get(attacker.actor.id)!
  }
}

/** The attacker's Character span its retaliation batch advances, when the zones changed a Character. */
export function meleeRetaliationCharacterTransition(
  evidence: MeleeRetaliationEvidenceDto | undefined
) {
  const first = evidence?.executions[0]
  const last = evidence?.executions.at(-1)
  if (
    !first ||
    !last ||
    first.candidate.target.kind !== 'CHARACTER' ||
    checksumCanonicalJson(first.targetTransition.before) ===
      checksumCanonicalJson(last.targetTransition.after)
  )
    return null
  const { characterId, streamVersion } = first.candidate.target
  return { characterId, beforeStreamVersion: streamVersion, afterStreamVersion: streamVersion + 1 }
}
