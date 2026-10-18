import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { EncounterSpatialRuleEffectRecord } from '@artificer-toolkit/schema/projections/spatialRuleEffectPersistence'
import type { MeleeRetaliationEvidenceDto } from '@artificer-toolkit/schema/shared/ruleExecutionEffectEvidence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import {
  collectSpatialMeleeRetaliationCandidates,
  type SpatialTokenFootprint
} from '@artificer-toolkit/shared/vtt'

import type { ProjectableCharacterFacts } from './encounterActionProjection.js'
import type { MovementTarget } from './encounterMovementTargets.js'
import {
  settleAutomaticSpatialEvidence,
  spatialCandidateEvidence,
  spatialExecutionInput,
  spatialExecutionOutcome,
  toSpatialInstances,
  toSpatialMovementTarget,
  type SpatialTargetState
} from './encounterSpatialCandidateExecution.js'
import { planNativeSpatialMovementPrefix } from './encounterSpatialMovementPlan.js'
import type { RulesRuntimeService } from './rulesRuntimeService.js'
import { executeTargetBoundActiveRuleEffectWithPause } from './targetBoundActiveRuleEffectExecutor.js'

type MeleeRetaliationExecution = MeleeRetaliationEvidenceDto['executions'][number]

/** One creature's token as an action's Scene context pins it. */
type MeleeRetaliationToken = SpatialTokenFootprint & { actorId: string; tokenId: string }

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
  const contacts = collectSpatialMeleeRetaliationCandidates({
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
    attacker: input.attacker,
    hit: input.hit,
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
 * plan never pauses. `attacker` is the attacker as the action left it.
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
}) {
  const { selected, attacker } = input
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
      random: input.random
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
    commandId: { phase: 'MELEE_RETALIATION', ordinal: 0 }
  })
  const evidence: MeleeRetaliationEvidenceDto = {
    selectionChecksum: selected.selectionChecksum,
    executions
  }
  return {
    evidence,
    /** Null when the zones left the attacker unchanged, so no batch is written. */
    settlement: settled.settlements[0] ?? null,
    projectedAttacker: settled.projectedTargets.get(attacker.actor.id)!
  }
}
