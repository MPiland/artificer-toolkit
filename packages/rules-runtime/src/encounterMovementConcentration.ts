import { RULE_GRAPH_LIMITS, checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { SystemVocabularySnapshot } from '@artificer-toolkit/schema/projections/systemVocabulary'
import {
  damageSaveApplicationsAfterRelease,
  damageSaveBinding,
  isMaintainedDamageApplication,
  unboundDamageSaveApplication,
  type DamageSaveApplicationDto
} from '@artificer-toolkit/schema/shared/ruleExecutionConcentration'
import { movementPendingDamageSave } from '@artificer-toolkit/schema/shared/ruleExecutionSpatialPendingContexts'
import type { EncounterEvidenceAnswer } from './encounterEvidenceAnswer.js'
import {
  serverKernelRuleExecutionPendingSnapshotDtoSchema,
  type ServerKernelRuleExecutionPendingSnapshotDto
} from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import {
  movementConcentrationEndDtoSchema,
  movementConcentrationExecutionDtoSchema,
  movementContactDamageEnvelope,
  movementMassiveDamageSaveExecutionDtoSchema,
  movementRepeatSaveExecutionDtoSchema,
  type MovementConcentrationEndDto,
  type MovementConcentrationExecutionDto,
  type MovementMassiveDamageSaveExecutionDto,
  type MovementRepeatSaveExecutionDto
} from '@artificer-toolkit/schema/shared/ruleExecutionMovementConcentration'
import {
  checksumSpatialCurrentness,
  type FrozenMovementReactionRemainder
} from './encounterSpatialMovementRuleService.js'
import { nativeConcentrationDamageApplications } from './encounterConcentrationDamage.js'
import { planDamageSaveChain } from './encounterDamageSaveChain.js'
import {
  createNativeConcentrationContext,
  completeNativeConcentrationResult,
  evaluateNativeConcentrationEvidence,
  type NativeConcentrationContext,
  type prepareEncounterConcentrationState
} from './encounterConcentration.js'
import {
  concentrationEndOccurrenceId,
  concentrationOccurrenceId
} from './encounterConcentrationIdentity.js'
import { deadCharacterIdsOfTargets, isEncounterActorDefeated } from './encounterActorDefeat.js'
import {
  type NativeEffectRepeatSaveContext,
  completeEffectRepeatSaveResult,
  createEffectRepeatSaveContext,
  effectRepeatSaveExecutionInput,
  effectRepeatSaveMade,
  evaluateEffectRepeatSaveEvidence
} from './encounterEffectRepeatSave.js'
import { encounterEscapeEndedConditionIds } from './encounterEscapeCheck.js'
import {
  type NativeMassiveDamageSaveContext,
  completeMassiveDamageSaveResult,
  createMassiveDamageSaveContext,
  encounterMassiveDamageRule,
  evaluateMassiveDamageSaveEvidence
} from './encounterMassiveDamage.js'
import { damagedHitRepeatTrigger } from './events/encounterEventHooks.js'
import { projectSpatialMovementCandidates } from './encounterSpatialMovementCurrentness.js'
import {
  executeTargetBoundActiveRuleEffectWithPause,
  verifyTargetBoundActiveRuleEffectContinuation
} from './targetBoundActiveRuleEffectExecutor.js'
import type { MovementTarget } from './encounterMovementTargets.js'
import type { ProjectableCharacterFacts } from './encounterActionProjection.js'
import type { RulesRuntimeService } from './rulesRuntimeService.js'
import type { EncounterAutoRollByActorId } from './encounterEvidenceMode.js'
import type { ServerRuleExecutionContinuationDto } from '@artificer-toolkit/schema/shared/rulesExecution'

type DamageSource = { executionOrdinal: number }
type DiceResolution = Exclude<EncounterEvidenceAnswer, { kind: 'ENTER_INTEGER' }>
type RetainedD20 = Pick<
  MovementConcentrationExecutionDto['result']['applicationOutputs']['d20'],
  'rawFaces' | 'rollMode'
>

/** The kernel continuation a pending snapshot sealed, without the room's own envelope around it. */
function sealedContinuation(snapshot: ServerKernelRuleExecutionPendingSnapshotDto) {
  const {
    snapshotKind: _kind,
    applicationContext: _context,
    optionalCombatSnapshotChecksum: _policy,
    phaseReceipts: _receipts,
    deferredCleaving: _cleaving,
    ...continuation
  } = snapshot
  return continuation
}

function movementConcentrationDamageSource(
  remainder: FrozenMovementReactionRemainder,
  source: DamageSource
) {
  const execution = remainder.completedSpatialExecutions.at(-1)
  if (!execution || execution.ordinal !== source.executionOrdinal)
    throw new Error('Movement Concentration requires the latest damaging contact.')
  const holderActorId = execution.candidate.candidate.targetActorId
  const damage = nativeConcentrationDamageApplications(
    [{ targetActorId: holderActorId, applications: execution.applications }],
    true
  )
  const offset = (remainder.completedSpatialExecutions.length - 1) * RULE_GRAPH_LIMITS.NODES
  return {
    execution,
    holderActorId,
    /** The zone's source, who dealt this contact's damage. */
    damagerActorId: execution.candidate.candidate.sourceActorId,
    envelopeChecksum: checksumRuleDocument(movementContactDamageEnvelope(execution)),
    applications: damage.map((application) => ({
      ...application,
      ordinal: offset + application.ordinal
    }))
  }
}

/**
 * One contact's damage children settle in order: its Concentration ends first, then each save its
 * damage owes in chain order (a Concentration check, an effect's repeat save, D167, or a
 * massive-damage save, ATTACK-16).
 */
export type MovementConcentrationSettlement =
  | { kind: 'END'; execution: MovementConcentrationEndDto }
  | { kind: 'REPEAT_SAVE'; execution: MovementRepeatSaveExecutionDto }
  | { kind: 'MASSIVE_DAMAGE_SAVE'; execution: MovementMassiveDamageSaveExecutionDto }
  | {
      kind: 'CHECK'
      state: EncounterRunState
      context: NativeConcentrationContext
      continuation: Parameters<typeof evaluateNativeConcentrationEvidence>[0]['continuation']
      execution: MovementConcentrationExecutionDto
      userId: string
      occurredAt: string
    }

type MovementMaintainedStateRef = NativeConcentrationContext['maintainedState']
type MovementConcentrationProjectedEnd<
  TCharacterFacts extends ProjectableCharacterFacts,
  TProjection
> = {
  targets: ReadonlyMap<string, MovementTarget<TCharacterFacts>>
  projection: TProjection
  cleanup: NonNullable<MovementConcentrationExecutionDto['result']['applicationOutputs']['cleanup']>
  ownerTransitions: MovementConcentrationExecutionDto['ownerTransitions']
}

/** Forecast checks between contacts; only the Scene finish mutation applies these plans. */
export async function prepareEncounterMovementConcentration<
  TCharacterFacts extends ProjectableCharacterFacts,
  TProjection
>(
  input: {
    state: EncounterRunState
    occurrenceId: string
    sourceCommandId: string
    userId: string
    /** The roller's auto-roll preference; the initiator rolls Concentration in this slice. */
    autoRoll: EncounterAutoRollByActorId
    occurredAt: string
    remainder: FrozenMovementReactionRemainder
    source: DamageSource
    targets: ReadonlyMap<string, MovementTarget<TCharacterFacts>>
    projection?: TProjection
    /** The saves this contact already settled, replayed from their recorded dice. */
    retainedSaves?: {
      concentrationChecks?: readonly MovementConcentrationExecutionDto[]
      repeatSaves?: readonly MovementRepeatSaveExecutionDto[]
      massiveDamageSaves?: readonly MovementMassiveDamageSaveExecutionDto[]
    }
    resume?: { snapshot: ServerKernelRuleExecutionPendingSnapshotDto; resolution: DiceResolution }
  },
  callbacks: {
    /** Every Concentration state the actor holds after the preceding contact, in casting order. */
    loadStates(
      targetActorId: string,
      targets: ReadonlyMap<string, MovementTarget<TCharacterFacts>>,
      projection?: TProjection
    ): Promise<
      NonNullable<
        Awaited<
          ReturnType<typeof prepareEncounterConcentrationState<MovementTarget<TCharacterFacts>>>
        >
      >[]
    >
    runtime(): Promise<RulesRuntimeService>
    random(max: number): number
    /** Every held state of a holder the contact defeated or left unable to act (D95); none otherwise. */
    findEnds(
      actorId: string,
      targets: ReadonlyMap<string, MovementTarget<TCharacterFacts>>,
      projection?: TProjection
    ): Promise<
      {
        maintainedState: MovementMaintainedStateRef
        reason: MovementConcentrationEndDto['result']['applicationOutputs']['reason']
      }[]
    >
    projectEnd(
      end: { actorId: string; maintainedState: MovementMaintainedStateRef },
      targets: ReadonlyMap<string, MovementTarget<TCharacterFacts>>,
      projection?: TProjection
    ): Promise<MovementConcentrationProjectedEnd<TCharacterFacts, TProjection>>
    readVocabulary(): Promise<SystemVocabularySnapshot | null>
    /** The holder and Character versions once a made repeat save ends its effect. */
    projectRelease(
      effect: ActiveRuleEffectRecord,
      targets: ReadonlyMap<string, MovementTarget<TCharacterFacts>>,
      projection?: TProjection
    ): Promise<{
      targets: ReadonlyMap<string, MovementTarget<TCharacterFacts>>
      projection: TProjection
      characterOwnerTransitions: NonNullable<
        MovementRepeatSaveExecutionDto['release']
      >['characterOwnerTransitions']
      ownerTransitions: MovementRepeatSaveExecutionDto['ownerTransitions']
    }>
  }
) {
  const source = movementConcentrationDamageSource(input.remainder, input.source)
  let remainder = input.remainder
  let targets = input.targets
  let projection = input.projection
  const settlements: MovementConcentrationSettlement[] = []
  const checks = [...(source.execution.concentrationChecks ?? [])]
  const ends = [...(source.execution.concentrationEnds ?? [])]
  const repeatSaves = [...(source.execution.repeatSaves ?? [])]
  const massiveDamageSaves = [...(source.execution.massiveDamageSaves ?? [])]
  // The Encounter's rule as it stands now: a save sealed under another definition is refused.
  const massiveRule = encounterMassiveDamageRule(input.state)
  const phase = input.resume?.snapshot.applicationContext
  const issued =
    phase?.kind === 'ENCOUNTER_MOVEMENT_REACTION' ? movementPendingDamageSave(phase.phase) : null
  if (
    input.resume &&
    (!issued || checksumRuleDocument(issued.damageSource) !== checksumRuleDocument(input.source))
  )
    throw new Error('The issued movement damage-save phase is unavailable.')
  const frozen = issued?.context ?? null
  const dispositions = new Map(
    [...targets.values()].map(({ actor }) => [actor.id, actor.disposition])
  )
  let remaining: DamageSaveApplicationDto[] = []
  /** The projection after a save's cleanup: later saves and contacts observe it. */
  const adoptCleanup = (ended: { targets: typeof targets; projection: TProjection }) => {
    const candidates = projectSpatialMovementCandidates({
      candidates: remainder.remainingSpatialCandidates,
      beforeTargets: targets,
      afterTargets: ended.targets
    })
    targets = ended.targets
    projection = ended.projection
    remainder = {
      ...remainder,
      remainingSpatialCandidates: candidates,
      spatialCurrentnessChecksum: checksumSpatialCurrentness({
        encounter: input.state,
        candidates
      })
    }
  }
  /** A lost Concentration slot owes no later check. */
  const adoptEnd = (
    ended: { targets: typeof targets; projection: TProjection },
    maintainedStateId: string
  ) => {
    adoptCleanup(ended)
    remaining = remaining.filter(
      (entry) =>
        !isMaintainedDamageApplication(entry) || entry.maintainedStateId !== maintainedStateId
    )
  }
  /** The source contact retains its ends and saves beside its (unchanged) damage envelope. */
  const retainChildren = () => {
    const children = {
      ...(ends.length ? { concentrationEnds: [...ends] } : {}),
      ...(checks.length ? { concentrationChecks: [...checks] } : {}),
      ...(repeatSaves.length ? { repeatSaves: [...repeatSaves] } : {}),
      ...(massiveDamageSaves.length ? { massiveDamageSaves: [...massiveDamageSaves] } : {})
    }
    const completedSpatialExecutions = remainder.completedSpatialExecutions.map((entry) =>
      entry.ordinal === input.source.executionOrdinal ? { ...entry, ...children } : entry
    )
    remainder = {
      ...remainder,
      completedSpatialExecutions,
      appliedSpatialPrefix:
        remainder.appliedSpatialPrefix?.status === 'BATCH_COMPLETE' &&
        remainder.appliedSpatialPrefix.batchKind === 'ENCOUNTER_SPATIAL_MOVEMENT'
          ? { ...remainder.appliedSpatialPrefix, executions: completedSpatialExecutions }
          : remainder.appliedSpatialPrefix
    }
  }
  if (frozen) {
    if (
      frozen.parentOccurrenceId !== input.occurrenceId ||
      frozen.parentCommandFingerprint !== remainder.root.commandFingerprint ||
      frozen.finalizedDamageEnvelopeChecksum !== source.envelopeChecksum
    )
      throw new Error('Movement Concentration damage evidence is stale.')
    remaining = [
      frozen.source === 'CONCENTRATION'
        ? {
            ...frozen.application,
            maintainedStateId: frozen.maintainedState.id,
            castAt: frozen.maintainedState.createdAt
          }
        : frozen.source === 'EFFECT_REPEAT_SAVE'
          ? { ...frozen.application, activeEffectId: frozen.activeEffect.id }
          : {
              ...frozen.application,
              optionalCombatDefinitionId: frozen.optionalCombatDefinition.id
            },
      ...frozen.remaining
    ]
    for (const entry of remaining)
      if (
        !source.applications.some(
          (value) =>
            checksumRuleDocument(value) ===
            checksumRuleDocument(unboundDamageSaveApplication(entry))
        )
      )
        throw new Error('Movement Concentration retained damage is unavailable.')
  } else if (input.state.automationMode !== 'MANUAL') {
    // D95: a holder the contact defeated or left unable to act loses Concentration with no check,
    // so the checks below observe the lost slot and roll none for it.
    const found = await callbacks.findEnds(source.holderActorId, targets, projection)
    for (const entry of found) {
      const ended = await callbacks.projectEnd(
        { actorId: source.holderActorId, maintainedState: entry.maintainedState },
        targets,
        projection
      )
      const occurrenceId = concentrationEndOccurrenceId(
        input.occurrenceId,
        entry.maintainedState.id
      )
      const end = movementConcentrationEndDtoSchema.parse({
        sourceCommandId: input.sourceCommandId,
        result: {
          occurrenceId,
          applicationOutputs: {
            kind: 'CONCENTRATION_END',
            schemaVersion: 1,
            occurrenceId,
            parentOccurrenceId: input.occurrenceId,
            ownerActorId: source.holderActorId,
            maintainedStateId: entry.maintainedState.id,
            reason: entry.reason,
            cleanup: ended.cleanup
          }
        },
        ownerTransitions: ended.ownerTransitions
      })
      ends.push(end)
      settlements.push({ kind: 'END', execution: end })
      adoptEnd(ended, entry.maintainedState.id)
    }
    if (found.length) retainChildren()
    const maintainedStates = new Map<string, { id: string; createdAt: string }[]>()
    for (const { targetActorId } of source.applications) {
      if (maintainedStates.has(targetActorId)) continue
      const held = await callbacks.loadStates(targetActorId, targets, projection)
      if (held.length)
        maintainedStates.set(
          targetActorId,
          held.map(({ maintained }) => ({ id: maintained.id, createdAt: maintained.createdAt }))
        )
    }
    remaining.push(
      ...planDamageSaveChain({
        gameSystemId: input.state.gameSystemId,
        applications: source.applications,
        maintainedStates,
        parentOccurrenceId: input.occurrenceId,
        damagerActorId: source.damagerActorId,
        dispositions,
        effectSaves: {
          massiveRule,
          holders: new Map(
            [...targets].map(([actorId, target]) => [
              actorId,
              {
                defeated: isEncounterActorDefeated(
                  target.actor,
                  deadCharacterIdsOfTargets([target])
                ),
                effects: target.activeEffects,
                maximumHitPoints: target.effectiveMaximumHitPoints
              }
            ])
          )
        }
      })
    )
  }
  const runtime = remaining.length ? await callbacks.runtime() : null
  let resume = input.resume
  /** The move waits on one save's d20; the phase names which save. */
  const pendingSave = (
    continuation: ServerRuleExecutionContinuationDto,
    save:
      | { kind: 'CONCENTRATION_EVIDENCE'; concentration: NativeConcentrationContext }
      | { kind: 'REPEAT_SAVE_EVIDENCE'; repeatSave: NativeEffectRepeatSaveContext }
      | { kind: 'MASSIVE_DAMAGE_SAVE_EVIDENCE'; massiveDamageSave: NativeMassiveDamageSaveContext }
  ) => {
    const { currentSpatialCandidate: _candidate, ...movement } = remainder
    return {
      remainder,
      targets,
      projection,
      settlements,
      pendingSnapshot: serverKernelRuleExecutionPendingSnapshotDtoSchema.parse({
        ...continuation,
        snapshotKind: 'KERNEL_EVIDENCE',
        optionalCombatSnapshotChecksum: input.state.optionalCombatSnapshotChecksum,
        applicationContext: {
          kind: 'ENCOUNTER_MOVEMENT_REACTION',
          schemaVersion: 1,
          ...movement,
          reactionSelectionChecksum: checksumRuleDocument(movement.reactionTimeline),
          phase: { ...save, damageSource: input.source }
        }
      })
    }
  }
  /** A save's d20: its recorded dice when the contact replays, else its roller's answer or an auto-roll. */
  const diceResolution = (
    requestId: string,
    retained: { result: { applicationOutputs: { d20: RetainedD20 } } } | undefined
  ): DiceResolution =>
    retained
      ? {
          kind: 'ENTER_DICE',
          requestId,
          rawFaces: retained.result.applicationOutputs.d20.rawFaces,
          rollMode: retained.result.applicationOutputs.d20.rollMode
        }
      : (resume?.resolution ?? { kind: 'AUTO_ROLL', requestId })
  while (remaining.length) {
    const bound = remaining[0]!
    const application = unboundDamageSaveApplication(bound)
    remaining = remaining.slice(1)
    const binding = damageSaveBinding(bound)
    const occurrenceId = concentrationOccurrenceId(input.occurrenceId, bound)
    if (binding?.source === 'EFFECT_REPEAT_SAVE') {
      // The effect's own frozen save, rolled by its damaged holder (D167); a made save ends it.
      const target = targets.get(application.targetActorId)
      const heldEffects = target?.activeEffects ?? []
      const effect = heldEffects.find(({ id }) => id === binding.id)
      const trigger =
        effect &&
        damagedHitRepeatTrigger(
          effect,
          {
            damagerActorId: application.damagerActorId ?? source.damagerActorId,
            damageTypeIds: [application.damageTypeId]
          },
          dispositions
        )
      if (!target || !effect || !trigger)
        throw new Error('The movement repeat save effect changed before its check.')
      const sealed = resume && frozen?.source === 'EFFECT_REPEAT_SAVE' ? frozen : null
      if (resume && !sealed) throw new Error('The movement repeat save occurrence is stale.')
      const effectInput = effectRepeatSaveExecutionInput({
        effect,
        target,
        occurrenceId,
        rollInfluence: trigger.rollInfluence,
        runtime: runtime!
      })
      const started = sealed ? null : await executeTargetBoundActiveRuleEffectWithPause(effectInput)
      const paused = started && 'continuation' in started ? started : null
      const d20Policy = paused?.evidencePolicy ?? sealed?.d20Policy
      const vocabulary = await callbacks.readVocabulary()
      if (!d20Policy || !vocabulary || !('damageTypes' in vocabulary.document))
        throw new Error('The movement repeat save did not request bounded d20 evidence.')
      const context = createEffectRepeatSaveContext({
        effect,
        target,
        systemVocabularySnapshot: {
          id: vocabulary.snapshotId,
          version: vocabulary.snapshotVersion,
          checksum: vocabulary.checksum
        },
        damageTypes: vocabulary.document.damageTypes,
        d20Policy,
        rollInfluence: trigger.rollInfluence,
        parentOccurrenceId: input.occurrenceId,
        parentCommandFingerprint: remainder.root.commandFingerprint,
        application,
        remaining,
        finalizedDamageEnvelopeChecksum: source.envelopeChecksum,
        // Movement contacts carry no display name yet; their saves name only the damage.
        sourceLabels: [],
        damagerActorId: source.damagerActorId
      })
      const retained = input.retainedSaves?.repeatSaves?.find(
        (save) =>
          save.result.occurrenceId === occurrenceId &&
          save.sourceCommandId === input.sourceCommandId
      )
      if (paused && input.autoRoll[application.targetActorId] !== true) {
        if (retained)
          throw new Error('A movement repeat save cannot consume unissued player evidence.')
        return pendingSave(paused.continuation, {
          kind: 'REPEAT_SAVE_EVIDENCE',
          repeatSave: context
        })
      }
      if (input.retainedSaves && !retained)
        throw new Error('Prepared movement repeat save evidence is missing.')
      let continuation = paused?.continuation
      if (resume) {
        const stored = sealedContinuation(resume.snapshot)
        if (
          checksumRuleDocument(context) !== checksumRuleDocument(sealed) ||
          stored.occurrenceId !== occurrenceId
        )
          throw new Error('The movement repeat save facts or sealed check changed.')
        verifyTargetBoundActiveRuleEffectContinuation({
          ...effectInput,
          continuation: stored,
          expectedEvidencePolicy: d20Policy
        })
        continuation = stored
      }
      if (!continuation)
        throw new Error('The movement repeat save did not request bounded d20 evidence.')
      const evidence = await evaluateEffectRepeatSaveEvidence({
        effectInput,
        context,
        continuation,
        resolution: diceResolution(continuation.request.requestId, retained),
        expectedOccurrenceId: occurrenceId,
        random: callbacks.random
      })
      const made = effectRepeatSaveMade(evidence)
      const released = made ? await callbacks.projectRelease(effect, targets, projection) : null
      const execution = movementRepeatSaveExecutionDtoSchema.parse({
        sourceCommandId: input.sourceCommandId,
        result: completeEffectRepeatSaveResult({
          context,
          continuation,
          evidence,
          removedConditionIds: made
            ? encounterEscapeEndedConditionIds(heldEffects, effect.id)
            : null,
          occurrenceVersion: 1,
          initialFactsChecksum: checksumRuleDocument(continuation.facts)
        }),
        release: released && { characterOwnerTransitions: released.characterOwnerTransitions },
        ownerTransitions: released?.ownerTransitions ?? []
      })
      if (retained && checksumRuleDocument(execution) !== checksumRuleDocument(retained))
        throw new Error('A prepared movement repeat save does not match current mechanics.')
      repeatSaves.push(execution)
      settlements.push({ kind: 'REPEAT_SAVE', execution })
      if (released) {
        adoptCleanup(released)
        remaining = damageSaveApplicationsAfterRelease(remaining, effect.id)
      }
      retainChildren()
      resume = undefined
      continue
    }
    if (binding?.source === 'MASSIVE_DAMAGE') {
      // The rule's own save graph (ATTACK-16): the save records its outcome and changes nothing else.
      const target = targets.get(application.targetActorId)
      const vocabulary = await callbacks.readVocabulary()
      if (!massiveRule || massiveRule.pin.definitionId !== binding.id || !target)
        throw new Error('The massive-damage rule changed before its movement save.')
      if (!vocabulary || !('damageTypes' in vocabulary.document))
        throw new Error('The movement massive-damage save vocabulary is unavailable.')
      const { context, facts } = createMassiveDamageSaveContext({
        gameSystemId: input.state.gameSystemId,
        rule: massiveRule,
        target,
        maximumHitPoints: target.effectiveMaximumHitPoints,
        systemVocabularySnapshot: {
          id: vocabulary.snapshotId,
          version: vocabulary.snapshotVersion,
          checksum: vocabulary.checksum
        },
        damageTypes: vocabulary.document.damageTypes,
        parentOccurrenceId: input.occurrenceId,
        parentCommandFingerprint: remainder.root.commandFingerprint,
        application,
        remaining,
        finalizedDamageEnvelopeChecksum: source.envelopeChecksum,
        // Movement contacts carry no display name yet; their saves name only the damage.
        sourceLabels: [],
        damagerActorId: source.damagerActorId
      })
      const started = await runtime!.executeResolved({
        command: { definitionId: massiveRule.published.id, occurrenceId, facts },
        published: massiveRule.published
      })
      if (started.status !== 'PAUSED')
        throw new Error('The movement massive-damage save did not request bounded d20 evidence.')
      if (
        resume &&
        (frozen?.source !== 'MASSIVE_DAMAGE' ||
          checksumRuleDocument(context) !== checksumRuleDocument(frozen) ||
          checksumRuleDocument(sealedContinuation(resume.snapshot)) !==
            checksumRuleDocument(started.continuation))
      )
        throw new Error('The movement massive-damage save facts or sealed check changed.')
      const retained = input.retainedSaves?.massiveDamageSaves?.find(
        (save) =>
          save.result.occurrenceId === occurrenceId &&
          save.sourceCommandId === input.sourceCommandId
      )
      if (input.autoRoll[application.targetActorId] !== true && !resume) {
        if (retained)
          throw new Error('A movement massive-damage save cannot consume unissued player evidence.')
        return pendingSave(started.continuation, {
          kind: 'MASSIVE_DAMAGE_SAVE_EVIDENCE',
          massiveDamageSave: context
        })
      }
      if (input.retainedSaves && !retained)
        throw new Error('Prepared movement massive-damage save evidence is missing.')
      const execution = movementMassiveDamageSaveExecutionDtoSchema.parse({
        sourceCommandId: input.sourceCommandId,
        result: completeMassiveDamageSaveResult({
          context,
          continuation: started.continuation,
          evidence: await evaluateMassiveDamageSaveEvidence({
            gameSystemId: input.state.gameSystemId,
            runtime: runtime!,
            random: callbacks.random,
            context,
            rule: massiveRule,
            continuation: started.continuation,
            resolution: diceResolution(started.continuation.request.requestId, retained),
            expectedOccurrenceId: occurrenceId
          }),
          occurrenceVersion: 1,
          initialFactsChecksum: checksumRuleDocument(facts)
        })
      })
      if (retained && checksumRuleDocument(execution) !== checksumRuleDocument(retained))
        throw new Error('A prepared movement massive-damage save does not match current mechanics.')
      massiveDamageSaves.push(execution)
      settlements.push({ kind: 'MASSIVE_DAMAGE_SAVE', execution })
      retainChildren()
      resume = undefined
      continue
    }
    if (!isMaintainedDamageApplication(bound))
      throw new Error('A movement damage save names nothing it checks.')
    const { maintainedStateId } = bound
    const held = await callbacks.loadStates(application.targetActorId, targets, projection)
    const current = held.find((entry) => entry.maintained.id === maintainedStateId)
    if (!current) throw new Error('The movement Concentration state changed before its check.')
    const { context, facts } = createNativeConcentrationContext({
      gameSystemId: input.state.gameSystemId,
      current,
      heldCount: held.length,
      parentOccurrenceId: input.occurrenceId,
      parentCommandFingerprint: remainder.root.commandFingerprint,
      application,
      remaining,
      finalizedDamageEnvelopeChecksum: source.envelopeChecksum,
      // Movement contacts carry no display name yet; their checks name only the damage.
      sourceLabels: []
    })
    const started = await runtime!.executeResolved({
      command: { definitionId: current.published.id, occurrenceId, facts },
      published: current.published
    })
    if (started.status !== 'PAUSED')
      throw new Error('Movement Concentration did not request bounded d20 evidence.')
    if (
      resume &&
      (frozen?.source !== 'CONCENTRATION' ||
        checksumRuleDocument(context) !== checksumRuleDocument(frozen) ||
        checksumRuleDocument(sealedContinuation(resume.snapshot)) !==
          checksumRuleDocument(started.continuation))
    )
      throw new Error('The movement Concentration facts or sealed check changed.')
    const retained = input.retainedSaves?.concentrationChecks?.find(
      (check) =>
        check.result.occurrenceId === occurrenceId &&
        check.sourceCommandId === input.sourceCommandId
    )
    if (input.autoRoll[context.application.targetActorId] !== true && !resume) {
      if (retained)
        throw new Error('Movement Concentration cannot consume unissued player evidence.')
      return pendingSave(started.continuation, {
        kind: 'CONCENTRATION_EVIDENCE',
        concentration: context
      })
    }
    if (input.retainedSaves && !retained)
      throw new Error('Prepared movement Concentration evidence is missing.')
    const evidence = await evaluateNativeConcentrationEvidence({
      gameSystemId: input.state.gameSystemId,
      context,
      continuation: started.continuation,
      resolution: diceResolution(started.continuation.request.requestId, retained),
      expectedOccurrenceId: occurrenceId,
      runtime: runtime!,
      random: callbacks.random
    })
    const ended = evidence.failed
      ? await callbacks.projectEnd(
          { actorId: application.targetActorId, maintainedState: context.maintainedState },
          targets,
          projection
        )
      : null
    const execution = movementConcentrationExecutionDtoSchema.parse({
      sourceCommandId: input.sourceCommandId,
      result: completeNativeConcentrationResult({
        context,
        continuation: started.continuation,
        ...evidence,
        cleanup: ended?.cleanup ?? null,
        occurrenceVersion: 1,
        initialFactsChecksum: checksumRuleDocument(facts)
      }),
      ownerTransitions: ended?.ownerTransitions ?? []
    })
    if (retained && checksumRuleDocument(execution) !== checksumRuleDocument(retained))
      throw new Error('Prepared movement Concentration does not match current mechanics.')
    checks.push(execution)
    settlements.push({
      kind: 'CHECK',
      state: input.state,
      context,
      continuation: started.continuation,
      execution,
      userId: input.userId,
      occurredAt: input.occurredAt
    })
    if (ended) adoptEnd(ended, maintainedStateId)
    retainChildren()
    resume = undefined
  }
  if (
    [
      ...(input.retainedSaves?.concentrationChecks ?? []),
      ...(input.retainedSaves?.repeatSaves ?? []),
      ...(input.retainedSaves?.massiveDamageSaves ?? [])
    ]
      .filter((save) => save.sourceCommandId === input.sourceCommandId)
      .some(
        (save) =>
          ![...checks, ...repeatSaves, ...massiveDamageSaves].some(
            (value) => value.result.occurrenceId === save.result.occurrenceId
          )
      )
  )
    throw new Error('Prepared movement Concentration contains unused check evidence.')
  return { remainder, targets, projection, settlements, pendingSnapshot: null }
}
