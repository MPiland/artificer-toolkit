import type { LiveSessionEncounterRulesResponse } from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { MeleeRetaliationEvidenceDto } from '@artificer-toolkit/schema/shared/ruleExecutionEffectEvidence'
import { deriveEncounterCharacterMechanicsEventCommandId } from '@artificer-toolkit/rules-runtime/encounterCharacterMechanicsBatch'
import type { EncounterMechanicsBatchInput } from '@artificer-toolkit/rules-runtime/encounterMechanicsBatchPlan'
import { selectMeleeRetaliationContacts } from '@artificer-toolkit/rules-runtime/encounterMeleeRetaliation'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { readLiveCharacterStreamVersion } from './liveMovementTargetState.js'
import type { EncounterMechanicsBatchResult } from './mechanicsBatchPersistence.js'
import type { EncounterCharacterWriteTransaction } from './ports.js'
import { createSpatialRuleEffectStore } from './spatialEffectStore.js'

/**
 * Applies the zones a melee hit set off against its attacker (D153) as the attacker's one mechanics
 * batch, after the action's own writes. The zones are derived again from the locked Scene and the
 * action's pinned tokens, so a plan made against an edited zone or a moved token is refused.
 * Returns the attacker as the batch left it, or unchanged when the zones changed nothing.
 */
export async function persistEncounterMeleeRetaliation(
  ctx: EncounterCharacterWriteTransaction,
  input: {
    state: EncounterRunState
    /** The Run's actors before the action, as the plan selected against them. */
    initialActors: readonly EncounterRunActorState[]
    attacker: EncounterRunActorState
    scene: Extract<LiveSessionEncounterRulesResponse, { kind: 'ACTION_SCENE' }>['context']
    evidence: MeleeRetaliationEvidenceDto
    occurrenceId: string
    sourceCommandId: string
    occurredAt: string
  },
  callbacks: {
    applyMechanics(
      batch: Omit<EncounterMechanicsBatchInput, 'expectedCharacterStreamVersion'>
    ): Promise<EncounterMechanicsBatchResult>
  }
): Promise<EncounterRunActorState> {
  const { state, attacker, scene, evidence } = input
  const stale = () => new Error('Melee retaliation selection is stale.')
  const scope =
    scene &&
    (await createSpatialRuleEffectStore(ctx).scope({
      encounterId: state.id,
      sceneId: scene.sceneId
    }))
  if (!scene || !scope || scene.sourceToken.actorId !== attacker.id) throw stale()
  const selected = selectMeleeRetaliationContacts({
    actors: input.initialActors,
    attacker: scene.sourceToken,
    hit: scene.targetToken,
    effects: await scope.list()
  })
  const { executions } = evidence
  if (
    !selected ||
    selected.selectionChecksum !== evidence.selectionChecksum ||
    executions.length !== selected.contacts.length ||
    executions.some(
      ({ candidate }, ordinal) =>
        checksumRuleDocument(candidate.candidate) !==
        checksumRuleDocument(selected.contacts[ordinal])
    )
  )
    throw stale()
  const beforeStreamVersion =
    attacker.kind === 'CHARACTER'
      ? await readLiveCharacterStreamVersion(ctx, state, attacker.sourceId)
      : null
  if (
    executions.some(({ candidate: { target } }) =>
      attacker.kind === 'CHARACTER'
        ? target.kind !== 'CHARACTER' ||
          target.characterId !== attacker.sourceId ||
          target.streamVersion !== beforeStreamVersion
        : target.kind !== 'ENCOUNTER_ACTOR'
    )
  )
    throw new Error('Melee retaliation attacker pin is stale.')
  const first = executions[0]!
  const last = executions.at(-1)!
  const before = first.targetTransition.before
  if (checksumRuleDocument(before) === checksumRuleDocument(last.targetTransition.after))
    return attacker
  const applications = executions.flatMap((execution) =>
    execution.applications.map((application) => ({ ...application, targetActorId: attacker.id }))
  )
  const applied = await callbacks.applyMechanics({
    encounterId: state.id,
    targetActorId: attacker.id,
    expectedEncounterVersion: state.version,
    occurrenceId: input.occurrenceId,
    sourceCommandId: input.sourceCommandId,
    commandId:
      attacker.kind === 'CHARACTER'
        ? deriveEncounterCharacterMechanicsEventCommandId({
            occurrenceId: input.occurrenceId,
            sourceCommandId: input.sourceCommandId,
            phase: 'MELEE_RETALIATION',
            ordinal: 0,
            targetCharacterId: attacker.sourceId
          })
        : input.sourceCommandId,
    occurredAt: input.occurredAt,
    applications,
    effectiveMaximumHitPoints: before.maximumHitPoints,
    effectiveScalarValues: before.scalarValues,
    forceVersionAdvance: attacker.kind === 'CHARACTER'
  })
  if (
    checksumRuleDocument(applied.targetTransition.before) !== checksumRuleDocument(before) ||
    checksumRuleDocument(applied.targetTransition.after) !==
      checksumRuleDocument(last.targetTransition.after) ||
    checksumRuleDocument(applied.receiptApplications) !==
      checksumRuleDocument(
        applications.map(({ targetActorId: _id, ...application }, index) => ({
          ...application,
          ordinal: index
        }))
      ) ||
    (beforeStreamVersion === null
      ? applied.characterStreamVersion !== null
      : applied.characterStreamVersion !== beforeStreamVersion + 1)
  )
    throw new Error('Melee retaliation settlement differs from its plan.')
  return applied.updatedActor
}
