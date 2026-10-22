import {
  deathSavesAfterRoll,
  isCharacterDying
} from '@artificer-toolkit/schema/shared/characterDeathSaves'
import {
  serverKernelRuleExecutionPendingSnapshotDtoSchema,
  type ServerKernelRuleExecutionPendingSnapshotDto,
  type ServerRuleExecutionPendingSnapshotDto
} from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import type { ServerRuleExecutionContinuationDto } from '@artificer-toolkit/schema/shared/ruleExecutionProtocol'
import type { TurnCoordinatorRootDto } from '@artificer-toolkit/schema/shared/ruleExecutionTurnPending'
import type { TurnDeathSaveExecutionDto } from '@artificer-toolkit/schema/shared/ruleExecutionTurnResources'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import {
  d20AddedDiceTotal,
  type D20RolledAddedDieDto
} from '@artificer-toolkit/schema/shared/d20AddedDice'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { activeSavingThrowDice } from './character/activeEffectGrantTotals.js'
import { applyEncounterConditionMechanics } from './encounterConditionMechanics.js'
import { deriveEncounterCharacterMechanicsEventCommandId } from './encounterCharacterMechanicsBatch.js'
import { rollModeCapabilityRegistry } from './platformPolicyModules.js'
import { settleEncounterD20Answer, settleEncounterD20Test } from './encounterD20Settlement.js'
import { savingThrowSpentEffects } from './encounterEndedEffectRelease.js'
import { encounterEvidenceMode } from './encounterEvidenceMode.js'
import { EncounterConflictError, EncounterValidationError } from './encounterErrors.js'
import type { EncounterEvidenceAnswer, EncounterResponseAnswer } from './encounterEvidenceAnswer.js'
import {
  projectEncounterActionTarget,
  type ProjectableCharacterFacts
} from './encounterActionProjection.js'
import { planEncounterMechanicsBatch } from './encounterMechanicsBatchPlan.js'
import { buildMovementTarget, type MovementTarget } from './encounterMovementTargets.js'
import { requireDeathSavePending } from './encounterTurnPending.js'
import { d20TestDefinitionCapabilityRegistry } from './platformEncounterPolicy.js'
import type { RulesRuntimeService } from './rulesRuntimeService.js'

/** A death save's kept d20 and its added dice with their faces. */
type DeathSaveRoll = { rawDie: number; addedDice: D20RolledAddedDieDto[] }

type DeathSaveCandidate = TurnDeathSaveExecutionDto['candidate']

function same(left: unknown, right: unknown) {
  return checksumCanonicalJson(left) === checksumCanonicalJson(right)
}

function kernelContinuation(snapshot: ServerKernelRuleExecutionPendingSnapshotDto) {
  const {
    snapshotKind: _snapshotKind,
    optionalCombatSnapshotChecksum: _optionalCombatSnapshotChecksum,
    applicationContext: _applicationContext,
    phaseReceipts: _phaseReceipts,
    ...continuation
  } = snapshot
  return continuation
}

/** A dying Character: at 0 hit points, neither stable nor dead (D96). */
function deathSaveCandidate<TCharacterFacts extends ProjectableCharacterFacts>(
  target: MovementTarget<TCharacterFacts>
): DeathSaveCandidate | null {
  const { actor, characterFacts, state } = target
  if (
    actor.kind !== 'CHARACTER' ||
    !characterFacts ||
    !state.deathSaves ||
    !isCharacterDying(state.deathSaves, state.current) ||
    target.effectiveMaximumHitPoints < 1
  )
    return null
  return {
    actorId: actor.id,
    characterId: actor.sourceId,
    streamVersion: characterFacts.active.play.streamVersion,
    effectiveMaximumHitPoints: target.effectiveMaximumHitPoints,
    deathSaves: state.deathSaves,
    addedDice: activeSavingThrowDice(target.activeEffects, null)
  }
}

/** The target as the save leaves it, within this turn's preparation only; the commit applies it. */
function projectDeathSaveTarget<TCharacterFacts extends ProjectableCharacterFacts>(input: {
  state: EncounterRunState
  userId: string
  root: TurnCoordinatorRootDto
  occurrenceId: string
  target: MovementTarget<TCharacterFacts>
  candidate: DeathSaveCandidate
  plan: TurnDeathSaveExecutionDto
}): MovementTarget<TCharacterFacts> {
  const { target, candidate } = input
  const characterFacts = target.characterFacts
  if (!characterFacts) throw new Error('Death save Character facts are unavailable.')
  const occurredAt = characterFacts.active.updatedAt
  const mechanics = planEncounterMechanicsBatch({
    batch: {
      encounterId: input.state.id,
      targetActorId: target.actor.id,
      expectedEncounterVersion: input.state.version,
      occurrenceId: input.occurrenceId,
      sourceCommandId: input.root.rootCommandId,
      commandId: deriveEncounterCharacterMechanicsEventCommandId({
        occurrenceId: input.occurrenceId,
        sourceCommandId: input.root.rootCommandId,
        phase: 'TURN_DEATH_SAVE',
        ordinal: 0,
        targetCharacterId: candidate.characterId
      }),
      occurredAt,
      applications: [],
      expectedCharacterStreamVersion: candidate.streamVersion,
      effectiveMaximumHitPoints: candidate.effectiveMaximumHitPoints,
      effectiveScalarValues: target.effectiveScalarValues,
      forceVersionAdvance: true,
      deathSave: {
        rawDie: input.plan.rawDie,
        addedTotal: d20AddedDiceTotal(input.plan.addedDice)
      }
    },
    actor: target.actor,
    userId: input.userId,
    characterFacts
  })
  const projected = projectEncounterActionTarget({
    target,
    actor: mechanics.updatedActor,
    plan: mechanics,
    campaignId: input.state.campaignId,
    gameSystemId: input.state.gameSystemId,
    occurredAt
  })
  // A death save has no ability: it spends the dice (D156) every saving throw does.
  const spent = new Set(savingThrowSpentEffects(target.activeEffects, null).map(({ id }) => id))
  return applyEncounterConditionMechanics({
    target: {
      ...buildMovementTarget({
        actor: projected.actor,
        activeEffects: projected.activeEffects.filter(({ id }) => !spent.has(id)),
        characterFacts: projected.characterFacts,
        campaignId: input.state.campaignId,
        gameSystemId: input.state.gameSystemId,
        includeReactionSources: target.characterReactionSource !== undefined
      }),
      conditionDefinitions: target.conditionDefinitions
    },
    gameSystemId: input.state.gameSystemId
  })
}

/**
 * Plans the entering Character's turn-start death save (D96) without mutating the Run: a d20 with
 * no modifier plus the Character's added dice (D156), rolled by its controller or auto-rolled. A Manual Run, and any
 * Character that is not dying, makes none.
 */
export async function prepareEncounterTurnDeathSave<
  TCharacterFacts extends ProjectableCharacterFacts
>(input: {
  state: EncounterRunState
  userId: string
  root: TurnCoordinatorRootDto
  occurrenceId: string
  actors: readonly EncounterRunActorState[]
  /** The facts earlier stages already staged; the entering Character is loaded when absent. */
  movementTargets: ReadonlyMap<string, MovementTarget<TCharacterFacts>>
  loadTarget: (actorId: string) => Promise<MovementTarget<TCharacterFacts> | undefined>
  pending?: ServerRuleExecutionPendingSnapshotDto
  /** The answer to the pending save, with an app roll's recorded faces. */
  resolution?: EncounterResponseAnswer
  /** The roller's auto-roll preference; the Character's controllers roll their own save. */
  autoRoll: boolean
  createRuntime(): Promise<RulesRuntimeService>
  random(maxExclusive: number): number
}): Promise<
  | { kind: 'PENDING'; snapshot: ServerKernelRuleExecutionPendingSnapshotDto }
  | {
      kind: 'COMPLETE'
      plan: TurnDeathSaveExecutionDto | null
      /** The entering Character as the save leaves it; null when no save was made. */
      target: MovementTarget<TCharacterFacts> | null
    }
> {
  const { state, root, occurrenceId } = input
  const completedPlan = root.completedDeathSavePlan ?? null
  if (completedPlan && input.pending)
    throw new Error('A death save cannot be both complete and pending.')
  if (!input.pending && input.resolution !== undefined)
    throw new Error('Death save evidence has no pending request.')
  if (input.pending && state.automationMode === 'MANUAL')
    throw new Error('Death save evidence cannot resume in a Manual Encounter.')

  const none = () => {
    if (input.pending || completedPlan) throw new Error('Death save evidence has no candidate.')
    return { kind: 'COMPLETE' as const, plan: null, target: null }
  }
  const actorId = root.proposedTerminalTransition.currentActorId
  const actor = input.actors.find((candidate) => candidate.id === actorId)
  if (state.automationMode === 'MANUAL' || actor?.kind !== 'CHARACTER') return none()
  const system = d20TestDefinitionCapabilityRegistry.require(state.gameSystemId)
  const deathSaveDefinition = system.deathSaveDefinition
  if (!deathSaveDefinition) return none()
  const target = input.movementTargets.get(actor.id) ?? (await input.loadTarget(actor.id))
  if (!target) throw new Error('Death save target facts are unavailable.')
  const candidate = deathSaveCandidate(target)
  if (!candidate) return none()

  const published = deathSaveDefinition()
  const runtime = await input.createRuntime()
  const start = async () => {
    const started = await runtime.executeResolved({
      command: {
        definitionId: published.id,
        occurrenceId,
        facts: system.addedDiceFacts(candidate.addedDice)
      },
      published
    })
    if (started.status === 'COMPLETE')
      throw new EncounterValidationError('The death save graph requested no d20 evidence.')
    requireD20Request(started.continuation)
    return started.continuation
  }
  const roll = (answer: EncounterEvidenceAnswer | EncounterResponseAnswer): DeathSaveRoll => {
    const d20 = settleEncounterD20Answer({
      gameSystemId: published.gameSystemId,
      d20: {
        rollMode: 'NORMAL',
        keep: rollModeCapabilityRegistry.rollModeKeep({
          gameSystemId: published.gameSystemId,
          rollMode: 'NORMAL'
        }),
        addedDice: candidate.addedDice
      },
      answer,
      rollD20: () => input.random(20) + 1,
      random: input.random
    })
    if (d20.rollMode !== 'NORMAL')
      throw new EncounterValidationError('A death save is a single d20 roll.')
    return { rawDie: d20.natural, addedDice: d20.addedDice }
  }
  const settle = async (
    continuation: ServerRuleExecutionContinuationDto,
    { rawDie, addedDice }: DeathSaveRoll
  ): Promise<TurnDeathSaveExecutionDto> => {
    requireD20Request(continuation)
    if (!Number.isInteger(rawDie) || rawDie < 1 || rawDie > 20)
      throw new EncounterValidationError('A death save die must be an integer from 1 to 20.')
    if (
      continuation.occurrenceId !== occurrenceId ||
      continuation.graph.source.definitionId !== published.id ||
      continuation.graph.source.checksum !== published.checksum
    )
      throw new EncounterConflictError('Death save continuation is stale.')
    const execution = await settleEncounterD20Test({
      continuation,
      roll: { natural: rawDie, addedDice },
      resume: (step) => runtime.resume(step),
      outputs: { rawDie: 'rawDie', addedTotal: 'addedTotal' },
      refusal: () =>
        new EncounterValidationError('The death save graph requested more than its dice.')
    })
    const after = deathSavesAfterRoll(candidate.deathSaves, rawDie, d20AddedDiceTotal(addedDice))
    return {
      candidate,
      execution,
      rawDie,
      addedDice,
      afterDeathSaves: after.deathSaves,
      regainsHitPoint: after.regainsHitPoint
    }
  }
  const complete = (plan: TurnDeathSaveExecutionDto) => ({
    kind: 'COMPLETE' as const,
    plan,
    target: projectDeathSaveTarget({
      state,
      userId: input.userId,
      root,
      occurrenceId,
      target,
      candidate,
      plan
    })
  })

  if (completedPlan) {
    // A retained save replays its recorded die against the live candidate; it never re-rolls.
    if (!same(completedPlan.candidate, candidate)) throw new Error('Retained death save is stale.')
    const replayed = await settle(await start(), completedPlan)
    if (!same(replayed, completedPlan)) throw new Error('Retained death save is stale.')
    return complete(completedPlan)
  }
  if (input.pending) {
    const { snapshot, context } = requireDeathSavePending(input.pending)
    if (
      snapshot.occurrenceId !== occurrenceId ||
      context.phase !== 'START_OF_TURN' ||
      !same(context.candidate, candidate)
    )
      throw new Error('Death save evidence is stale.')
    if (input.resolution === undefined)
      throw new EncounterValidationError('Assisted death save evidence is required.')
    return complete(await settle(kernelContinuation(snapshot), roll(input.resolution)))
  }

  const continuation = await start()
  const mode = encounterEvidenceMode(state.automationMode, input.autoRoll)
  if (mode === 'AUTO_ROLL')
    return complete(
      await settle(
        continuation,
        roll({ kind: 'AUTO_ROLL', requestId: continuation.request.requestId })
      )
    )
  return {
    kind: 'PENDING',
    snapshot: serverKernelRuleExecutionPendingSnapshotDtoSchema.parse({
      ...continuation,
      snapshotKind: 'KERNEL_EVIDENCE',
      applicationContext: {
        kind: 'ENCOUNTER_TURN_DEATH_SAVE',
        schemaVersion: 1,
        phase: 'START_OF_TURN',
        root,
        candidate
      }
    })
  }
}

function requireD20Request(continuation: ServerRuleExecutionContinuationDto) {
  if (
    continuation.request.kind !== 'INTEGER_RANGE' ||
    continuation.request.min !== 1 ||
    continuation.request.max !== 20
  )
    throw new EncounterValidationError('The death save graph requested unsupported evidence.')
}
