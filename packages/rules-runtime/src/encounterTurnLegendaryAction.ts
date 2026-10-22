import { decoyStrikeEffects, withDecoyStrikeApplied } from './encounterAttackDecoys.js'
import { v5 as uuidv5 } from 'uuid'
import { createLinkedRiders, riderEffectKey } from './encounterActionEffectPlans.js'
import { stageEncounterLegendaryActionRefreshes } from './encounterLegendaryActionDiscovery.js'
import { stageEncounterActionEconomyRefreshes } from './encounterActionEconomy.js'
import { buildEncounterActorRuleFacts } from './encounterActorRuleFacts.js'
import { reconcileEncounterActorRuleOutput } from './encounterActorRuleOutput.js'
import { evaluateInstalledEncounterActors } from './platformRulesRuntime.js'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import {
  activeRuleEffectRecordSchema,
  type ActiveRuleEffectRecord
} from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { MeleeRetaliationEvidenceDto } from '@artificer-toolkit/schema/shared/ruleExecutionEffectEvidence'
import type { TurnCoordinatorRootDto } from '@artificer-toolkit/schema/shared/ruleExecutionTurnPending'
import {
  serverAggregateChoicePendingSnapshotDtoSchema,
  serverKernelRuleExecutionPendingSnapshotDtoSchema,
  type ServerRuleExecutionPendingSnapshotDto
} from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { turnLegendaryActionEvidenceDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionTurnResources'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument, RULE_GRAPH_LIMITS } from '@artificer-toolkit/shared/rules'
import { prepareActiveRuleEffectRecord } from './activeRuleEffectRecords.js'
import { advanceNativeActionGraphs } from './encounterActionExecution.js'
import {
  prepareNativeActionEffectsPlan,
  prepareNativeIncomingDamageGrantTriggers
} from './encounterActionEffects.js'
import { projectNativeActionEffectTransitions } from './encounterActionEffectReceipts.js'
import { planNativeEncounterActionMechanics } from './encounterActionMechanicsPlan.js'
import { preparedCastsSpell } from './encounterPreparedSpellCast.js'
import {
  actionEndedEffects,
  actsAgainstEnemy,
  incomingDamageGrantRecords,
  targetEndedEffects
} from './encounterEndedEffectRelease.js'
import type { prepareEncounterActionMechanics } from './encounterActionMechanicsPreparation.js'
import {
  projectEncounterActionTarget,
  type ProjectableCharacterFacts
} from './encounterActionProjection.js'
import { buildEncounterActionStoredExecution } from './encounterActionReceipt.js'
import {
  resolutionForRetainedEvidence,
  retainedD20Evidence,
  retainedIntegerEvidence
} from './encounterActionRetainedEvidence.js'
import { isMeleeRetaliationHit } from './encounterMeleeRetaliation.js'
import type { discoverTurnLegendaryWindows } from './encounterTurnLegendaryDiscovery.js'
import type { MovementTarget } from './encounterMovementTargets.js'
import type { EncounterWieldConflictAcceptance } from './encounterWieldConflict.js'
import type { CurrentReusableDefinitionSource } from './ruleCapabilityStateService.js'
import type { RulesRuntimeService } from './rulesRuntimeService.js'
import type { EncounterResponseAnswer } from './encounterEvidenceAnswer.js'

type LegendaryEvidence = NonNullable<TurnCoordinatorRootDto['completedLegendaryActions']>[number]
type Choice = LegendaryEvidence['choice']
type TurnLegendaryActionInput<
  TCharacterFacts extends ProjectableCharacterFacts = ProjectableCharacterFacts
> = {
  state: EncounterRunState
  userId: string
  /**
   * Each actor's roller preference: a Creature's controllers roll its Legendary Actions, and the
   * target's controllers roll its saves (ADR 0034).
   */
  autoRollByActorId: Readonly<Record<string, boolean>>
  occurrenceId: string
  root: TurnCoordinatorRootDto
  pending?: ServerRuleExecutionPendingSnapshotDto
  resolution?: EncounterResponseAnswer
  updatedAt: string
  refreshIncoming?: boolean
  actors: readonly EncounterRunActorState[]
  movementTargets?: ReadonlyMap<string, MovementTarget<TCharacterFacts>>
  startOutgoing?: boolean
  discoverWindows(input: {
    state: EncounterRunState
    occurrenceId: string
    outgoingActorId: string
    actors: readonly EncounterRunActorState[]
    movementTargets?: ReadonlyMap<string, MovementTarget<TCharacterFacts>>
  }): ReturnType<typeof discoverTurnLegendaryWindows>
  prepareMechanics(input: {
    actor: EncounterRunActorState
    target: EncounterRunActorState
    actors: readonly EncounterRunActorState[]
    actionId: string
    wieldConflictAcceptance: EncounterWieldConflictAcceptance
    movementTargets?: ReadonlyMap<string, MovementTarget<TCharacterFacts>>
    /** Seeds the target's decoy roll; the turn's occurrence is shared by every window, so it is salted. */
    decoyOccurrenceId: string
  }): Promise<Awaited<ReturnType<typeof prepareEncounterActionMechanics<TCharacterFacts>>>>
  /**
   * Plans the zones a melee hit's target holds around itself against the owner (D153) from the
   * Scene the hit landed in; null when no zone reaches the owner or no Scene is bound.
   */
  meleeRetaliation?(input: {
    /** The Run's actors when the attack was made, so a source the hit defeats still retaliates. */
    initialActors: readonly EncounterRunActorState[]
    /** The owner as the attack left it. */
    attacker: MovementTarget<TCharacterFacts>
    hitActorId: string
    sourceCommandId: string
    occurredAt: string
    retained?: MeleeRetaliationEvidenceDto
  }): Promise<{
    evidence: MeleeRetaliationEvidenceDto
    projectedAttacker: MovementTarget<TCharacterFacts>
  } | null>
  definitions: CurrentReusableDefinitionSource
  createRuntime(): Promise<RulesRuntimeService>
  random(maximum: number): number
}

function same(left: unknown, right: unknown) {
  return checksumCanonicalJson(left) === checksumCanonicalJson(right)
}

/**
 * Reconstructs every completed owner decision before extending a turn; it never writes mechanics.
 * A selected option runs the action it names through the same prepared, phased action path as any
 * other Encounter action (D51 option B), against the target its controller picked.
 */
export async function prepareTurnLegendaryActions<
  TCharacterFacts extends ProjectableCharacterFacts
>(input: TurnLegendaryActionInput<TCharacterFacts>) {
  const { state, occurrenceId, userId } = input
  let root = input.root
  let actors = [...input.actors]
  const targets = new Map(input.movementTargets)
  if (state.automationMode === 'MANUAL') {
    if (root.completedLegendaryActions || root.legendaryActionQueue)
      throw new Error('Manual turns cannot contain Legendary Actions.')
    return { kind: 'COMPLETE' as const, root, actors, movementTargets: targets }
  }
  const discover = (current: {
    actors: readonly EncounterRunActorState[]
    movementTargets?: ReadonlyMap<string, MovementTarget<TCharacterFacts>>
  }) =>
    input.discoverWindows({
      state,
      occurrenceId,
      ...current,
      outgoingActorId:
        state.currentActorId ??
        (() => {
          throw new Error('Outgoing turn is unavailable.')
        })()
    })
  const windows =
    root.commandType === 'ADVANCE_TURN' &&
    (input.startOutgoing ||
      !root.outgoingTurn ||
      root.legendaryActionQueue ||
      root.completedLegendaryActions?.length)
      ? await discover({ actors: input.actors, movementTargets: input.movementTargets })
      : []
  /**
   * Each owner's window as of now: an earlier window this turn may have incapacitated the owner
   * or changed its pool, so eligibility is checked again before every window.
   */
  let current = windows
  let currentIsStale = false
  async function windowFor(ownerActorId: string) {
    if (currentIsStale) {
      current = await discover({ actors, movementTargets: targets })
      currentIsStale = false
    }
    return current.find((entry) => entry.choice.ownerActorId === ownerActorId)
  }
  let runtimePromise: Promise<RulesRuntimeService> | undefined
  const completed = [...(root.completedLegendaryActions ?? [])]
  const seen = new Set<string>()

  async function execute(
    choice: Choice,
    selection: { optionId: string; targetActorId: string },
    ordinal: number,
    retained?: LegendaryEvidence
  ) {
    const window = await windowFor(choice.ownerActorId)
    const option = choice.options.find((entry) => entry.optionId === selection.optionId)
    const candidate = window?.candidatesByOptionId.get(selection.optionId)
    if (!window || !same(window.choice, choice) || !option || !candidate)
      throw new Error('Legendary Action choice is stale.')
    const actor = actors.find((entry) => entry.id === choice.ownerActorId)
    const target = actors.find((entry) => entry.id === selection.targetActorId)
    if (!actor || actor.kind !== 'CREATURE')
      throw new Error('Legendary Action owner is unavailable.')
    if (!target || !option.targetActorIds.includes(target.id))
      throw new Error('Legendary Action target is unavailable.')
    // Earlier windows of this turn may have changed either actor; later stages see what they did.
    const prepared = await input.prepareMechanics({
      actor,
      target,
      actors,
      actionId: option.actionId,
      wieldConflictAcceptance: { kind: 'UNPROMPTED' },
      movementTargets: targets,
      decoyOccurrenceId: `${occurrenceId}:legendary:${ordinal}`
    })
    if (checksumRuleDocument(prepared.plan) !== option.actionSourceChecksum)
      throw new Error('Legendary Action source is stale.')
    const execution = {
      runtime: await (runtimePromise ??= input.createRuntime()),
      adapter: prepared.adapter,
      plan: prepared.plan,
      occurrenceId,
      binding: prepared.binding,
      afterTest: async () => undefined
    }
    let result: Awaited<ReturnType<typeof advanceNativeActionGraphs>>
    if (retained) {
      if (retained.resolution.kind !== 'EXECUTED')
        throw new Error('Retained Legendary Action execution is unavailable.')
      // A settled window replays from its recorded dice and never rolls again.
      const receipt = retained.resolution
      const integers = retainedIntegerEvidence({ receipt })
      const d20 = retainedD20Evidence({ receipt })
      const used = new Set<string>()
      const replay = { ...execution, autoRoll: { SOURCE: false, TARGET: false } }
      result = await advanceNativeActionGraphs(replay)
      for (let count = 0; result.kind === 'PENDING'; count++) {
        if (count >= RULE_GRAPH_LIMITS.NODES)
          throw new Error('Retained Legendary Action evidence is invalid.')
        const resolution = resolutionForRetainedEvidence({
          gameSystemId: state.gameSystemId,
          pending: result,
          integers,
          d20,
          used
        })
        result = await advanceNativeActionGraphs({
          ...replay,
          resume: { pending: result, resolution }
        })
      }
      if ([...integers.keys(), ...d20.keys()].some((requestId) => !used.has(requestId)))
        throw new Error('Retained Legendary Action evidence has unused requests.')
    } else {
      const kernel =
        input.pending?.snapshotKind === 'KERNEL_EVIDENCE' &&
        input.pending.applicationContext.kind === 'ENCOUNTER_TURN_LEGENDARY_ACTION_EVIDENCE'
          ? input.pending
          : null
      const context =
        kernel?.applicationContext.kind === 'ENCOUNTER_TURN_LEGENDARY_ACTION_EVIDENCE'
          ? kernel.applicationContext
          : null
      if (
        context &&
        (!same(context.choice, choice) ||
          context.selectedOption.optionId !== selection.optionId ||
          context.targetActorId !== selection.targetActorId)
      )
        throw new Error('Legendary Action evidence selection is stale.')
      const resolution = input.resolution
      const answer =
        resolution?.kind === 'ENTER_DICE' ||
        resolution?.kind === 'ENTER_INTEGER' ||
        resolution?.kind === 'SYSTEM_ROLL'
          ? resolution
          : null
      if (kernel && !answer) throw new Error('Legendary Action dice are required.')
      result = await advanceNativeActionGraphs({
        ...execution,
        random: input.random,
        autoRoll: {
          SOURCE: input.autoRollByActorId[actor.id] === true,
          TARGET: input.autoRollByActorId[target.id] === true
        },
        ...(kernel && context && answer
          ? {
              resume: {
                pending: {
                  kind: 'PENDING' as const,
                  continuation: (() => {
                    const {
                      snapshotKind: _kind,
                      applicationContext: _context,
                      optionalCombatSnapshotChecksum: _optional,
                      phaseReceipts: _phases,
                      ...value
                    } = kernel
                    return value
                  })(),
                  d20Policy: context.d20Policy,
                  twoPhase: context.twoPhase,
                  ...(kernel.phaseReceipts ? { phaseReceipts: kernel.phaseReceipts } : {})
                },
                resolution: answer
              }
            }
          : {})
      })
    }
    if (result.kind === 'PENDING') {
      if (retained) throw new Error('Retained Legendary Action execution is incomplete.')
      return {
        kind: 'PENDING' as const,
        snapshot: serverKernelRuleExecutionPendingSnapshotDtoSchema.parse({
          ...result.continuation,
          snapshotKind: 'KERNEL_EVIDENCE',
          applicationContext: {
            kind: 'ENCOUNTER_TURN_LEGENDARY_ACTION_EVIDENCE',
            schemaVersion: 1,
            root,
            choice,
            choiceSelectionChecksum: checksumCanonicalJson(choice),
            selectedOption: option,
            selectionChecksum: checksumCanonicalJson(option),
            targetActorId: target.id,
            rollerActorId: result.roller === 'SOURCE' ? actor.id : target.id,
            d20Policy: result.d20Policy,
            twoPhase: result.twoPhase
          },
          ...(result.phaseReceipts ? { phaseReceipts: result.phaseReceipts } : {})
        })
      }
    }
    if (
      prepared.adapter.interpretSpatial?.({
        execution: result.execution,
        occurrenceId,
        published: result.published,
        targetActorId: target.id
      }).length
    )
      throw new Error('Legendary Action requires the complete contextual action coordinator.')
    // An option that starts a grant or state effect creates it on its target. The owner's window
    // falls on another creature's turn, so a timed grant is never given an extra tick.
    const activeEffectsByActorId = new Map(
      [...prepared.movementTargets].map(([actorId, entry]) => [actorId, entry.activeEffects])
    )
    const effects = prepareNativeActionEffectsPlan({
      prepared,
      execution: result,
      occurrenceId,
      commandId: root.rootCommandId,
      activeEffectsByActorId
    })
    if (effects.maintenance)
      throw new Error('Legendary Action effects cannot start a maintained effect.')
    // An attack roll or a spell cast uses up the owner's grants; an ending effect releases its condition.
    // Damage the target takes ends the effects it holds that end on damage, with their conditions.
    const makesAttackRoll = typeof prepared.binding.actionMechanic.attackBonus === 'number'
    const castsSpell = preparedCastsSpell(prepared)
    const dispositions = new Map(actors.map((entry) => [entry.id, entry.disposition]))
    const ownerEnded = actionEndedEffects({
      holderActorId: actor.id,
      held: prepared.movementTargets.get(actor.id)?.activeEffects ?? [],
      makesAttackRoll,
      castsSpell,
      againstEnemy: actsAgainstEnemy({
        actorId: actor.id,
        targetActorIds: [target.id],
        dispositions
      })
    })
    const damageEnded = targetEndedEffects({
      holderActorId: target.id,
      held: prepared.targetFacts.activeEffects.filter(
        ({ id }) => !ownerEnded.consumedGrants.some((ended) => ended.id === id)
      ),
      attacked: makesAttackRoll,
      testEvidence: [result.d20, result.nestedD20],
      turnActorId: prepared.state.currentActorId,
      applications: result.applications,
      damagerActorId: actor.id,
      dispositions,
      grantTriggers: prepareNativeIncomingDamageGrantTriggers({
        encounter: prepared.state,
        holder: prepared.target,
        held: prepared.targetFacts.activeEffects,
        occurrenceId,
        commandId: root.rootCommandId,
        ordinal,
        activeEffectsByActorId
      })
    })
    const plan = planNativeEncounterActionMechanics(
      {
        prepared,
        encounterId: state.id,
        expectedEncounterVersion: state.version,
        occurrenceId,
        sourceCommandId: root.rootCommandId,
        commandId: root.rootCommandId,
        occurredAt: input.updatedAt,
        applications: result.applications,
        sourceReleases: ownerEnded.sourceReleases,
        damageReleases: damageEnded.releases,
        eventPhases: { resource: 'LEGENDARY_ACTION_RESOURCE', outcome: 'LEGENDARY_ACTION_OUTCOME' },
        ordinal,
        forceTargetVersionAdvance:
          target.kind === 'CHARACTER' &&
          Boolean(
            effects.stateEffect || effects.recurringEffect || effects.riderEffects.some(Boolean)
          )
      },
      userId
    )
    // A settled window replays its recorded timestamp, so the same evidence is rebuilt exactly.
    const retainedAt =
      retained?.resolution.kind === 'EXECUTED'
        ? retained.resolution.createdEffects
            .map((effect) => activeRuleEffectRecordSchema.parse(effect))
            .at(0)?.createdAt
        : undefined
    const effectOwner =
      target.kind === 'CHARACTER'
        ? {
            kind: 'CHARACTER' as const,
            characterId:
              target.sourceId ??
              (() => {
                throw new Error('Legendary Action Character effect owner is unavailable.')
              })()
          }
        : { kind: 'ENCOUNTER_ACTOR' as const, encounterId: state.id, targetActorId: target.id }
    // A hit on one of the target's decoys destroys it, so later windows see what is left.
    const targetEffects = withDecoyStrikeApplied(
      prepared.targetFacts.activeEffects,
      decoyStrikeEffects(prepared.attackDecoy, result.d20?.resultPath)
    )
    const createdEffects: ActiveRuleEffectRecord[] = []
    const createEffect = (kind: string, planned: typeof effects.stateEffect) => {
      if (!planned) return null
      const record = prepareActiveRuleEffectRecord({
        id: uuidv5(
          JSON.stringify(['LEGENDARY_ACTION_EFFECT', occurrenceId, ordinal, target.id, kind]),
          root.rootCommandId
        ),
        owner: effectOwner,
        definition: planned.definition,
        lifecycle: planned.lifecycle,
        currentEffects: targetEffects,
        occurredAt: retainedAt ?? input.updatedAt
      })
      targetEffects.push(record)
      createdEffects.push(record)
      return record
    }
    const stateEffect = createEffect('STATE', effects.stateEffect)
    const recurringEffect = createEffect('RECURRING', effects.recurringEffect)
    const riderEffects = createLinkedRiders(effects.riderEffects, recurringEffect, (plan, index) =>
      createEffect(riderEffectKey(index), plan)
    )
    // The target's own damage triggers give it timed grants after the option's effects.
    const grantEffects = incomingDamageGrantRecords({
      grants: damageEnded.grants,
      owner: effectOwner,
      current: targetEffects,
      occurredAt: retainedAt ?? input.updatedAt
    })
    targetEffects.push(...grantEffects)
    createdEffects.push(...grantEffects)
    const settledTarget = target.id === actor.id ? plan.settledSource : plan.mechanics.updatedActor
    const projected = new Map<string, MovementTarget<TCharacterFacts>>()
    for (const [settled, characterPlan] of [
      [plan.settledSource, target.id === actor.id ? plan.targetPlan : null],
      ...(target.id === actor.id ? [] : [[settledTarget, plan.targetPlan] as const])
    ] as const) {
      const current = prepared.movementTargets.get(settled.id)
      if (!current) throw new Error('Legendary Action actor facts are unavailable.')
      projected.set(
        settled.id,
        projectEncounterActionTarget({
          target: settled.id === target.id ? { ...current, activeEffects: targetEffects } : current,
          actor: settled,
          plan: characterPlan,
          campaignId: state.campaignId,
          gameSystemId: state.gameSystemId,
          occurredAt: input.updatedAt
        })
      )
    }
    // A melee hit sets off the zones its target holds around itself against the owner (D153); a
    // settled window replays the retaliation from its recorded dice.
    const retainedApplication =
      retained?.resolution.kind === 'EXECUTED' ? retained.resolution.application : null
    const retainedRetaliation =
      retainedApplication?.kind === 'CHARACTER_MECHANICS_BATCH' ||
      retainedApplication?.kind === 'ENCOUNTER_ACTOR_MECHANICS_BATCH'
        ? retainedApplication.meleeRetaliation
        : undefined
    const retaliation =
      input.meleeRetaliation &&
      isMeleeRetaliationHit({
        gameSystemId: state.gameSystemId,
        prepared,
        // A hit on a decoy does not reach the target.
        resultPath: prepared.attackDecoy ? undefined : result.d20?.resultPath
      })
        ? await input.meleeRetaliation({
            initialActors: actors,
            attacker: projected.get(actor.id)!,
            hitActorId: target.id,
            sourceCommandId: root.rootCommandId,
            occurredAt: input.updatedAt,
            ...(retainedRetaliation ? { retained: retainedRetaliation } : {})
          })
        : null
    if (retainedRetaliation && !retaliation)
      throw new Error('Retained melee retaliation evidence is stale.')
    if (retaliation) projected.set(actor.id, retaliation.projectedAttacker)
    const stored = buildEncounterActionStoredExecution({
      prepared,
      execution: result,
      occurrenceId,
      occurrenceVersion: 0,
      settled: plan,
      effects: projectNativeActionEffectTransitions({
        state: stateEffect,
        recurring: recurringEffect,
        riders: riderEffects,
        targetActorId: target.id
      }),
      maintainedState: null,
      maintenanceTransition: null,
      actionEconomy: null,
      attackAction: null,
      meleeRetaliation: retaliation?.evidence ?? null,
      grantEffectTransitions: grantEffects.flatMap(
        (grant) =>
          projectNativeActionEffectTransitions({
            state: null,
            recurring: grant,
            targetActorId: target.id
          }).activeEffectTransitions
      )
    })
    if (stored.status !== 'COMPLETE') throw new Error('Legendary Action receipt is incomplete.')
    const targetCharacter = prepared.targetFacts.characterFacts
    const evidence = turnLegendaryActionEvidenceDtoSchema.parse({
      choice,
      selectionChecksum: checksumCanonicalJson(choice),
      resolution: {
        kind: 'EXECUTED',
        selectedOptionId: selection.optionId,
        targetActorId: target.id,
        attackRoll: makesAttackRoll,
        castsSpell,
        ...(prepared.attackDecoy ? { decoyEffectId: prepared.attackDecoy.effect.id } : {}),
        execution: result.execution,
        initialFactsChecksum: result.initialFactsChecksum,
        ...(result.phaseReceipts ? { phaseReceipts: result.phaseReceipts } : {}),
        application: stored.applicationOutputs,
        createdEffects,
        characterTransitions:
          target.kind === 'CHARACTER' && targetCharacter && plan.mechanics.characterStreamVersion
            ? [
                {
                  characterId: target.sourceId,
                  beforeStreamVersion: targetCharacter.active.play.streamVersion,
                  afterStreamVersion: plan.mechanics.characterStreamVersion
                }
              ]
            : []
      }
    })
    if (retained && !same(evidence, retained))
      throw new Error('Retained Legendary Action execution is stale.')
    const settledOwner = retaliation?.projectedAttacker.actor ?? plan.settledSource
    actors = actors.map((entry) =>
      entry.id === actor.id ? settledOwner : entry.id === target.id ? settledTarget : entry
    )
    currentIsStale = true
    for (const [actorId, projection] of projected) targets.set(actorId, projection)
    return { kind: 'COMPLETE' as const, evidence }
  }

  for (const [ordinal, evidence] of completed.entries()) {
    const ownerId = evidence.choice.ownerActorId
    const owner = seen.has(ownerId) ? undefined : await windowFor(ownerId)
    if (!owner || !same(owner.choice, evidence.choice))
      throw new Error('Retained Legendary Action owner is stale.')
    seen.add(ownerId)
    const decision = root.resolutionCommands.find(
      (entry) =>
        (entry.kind === 'LEGENDARY_DECLINE' || entry.kind === 'LEGENDARY_OPTION') &&
        entry.selectionChecksum === evidence.selectionChecksum
    )
    if (
      !decision ||
      (evidence.resolution.kind === 'DECLINED'
        ? decision.kind !== 'LEGENDARY_DECLINE'
        : decision.kind !== 'LEGENDARY_OPTION' ||
          decision.optionId !== evidence.resolution.selectedOptionId ||
          decision.targetActorId !== evidence.resolution.targetActorId)
    )
      throw new Error('Retained Legendary Action decision is stale.')
    if (evidence.resolution.kind === 'EXECUTED')
      await execute(
        evidence.choice,
        {
          optionId: evidence.resolution.selectedOptionId,
          targetActorId: evidence.resolution.targetActorId
        },
        ordinal,
        evidence
      )
  }

  if (root.commandType === 'ADVANCE_TURN' && (input.startOutgoing || !root.outgoingTurn)) {
    root = {
      ...root,
      outgoingTurn: root.outgoingTurn ?? { kind: 'NONE' },
      ...(windows.length
        ? {
            legendaryActionQueue: {
              ownerActorIds: windows.map((entry) => entry.choice.ownerActorId),
              nextOwnerIndex: 0
            }
          }
        : {})
    }
  }
  const queue = root.legendaryActionQueue
  if (queue) {
    if (
      completed.some((entry) => {
        const index = queue.ownerActorIds.indexOf(entry.choice.ownerActorId)
        return index < 0 || index >= queue.nextOwnerIndex
      })
    )
      throw new Error('Legendary Action owner queue is stale.')
    let index = queue.nextOwnerIndex
    const context = input.pending?.applicationContext
    if (
      context?.kind === 'ENCOUNTER_TURN_LEGENDARY_ACTION_CHOICE' ||
      context?.kind === 'ENCOUNTER_TURN_LEGENDARY_ACTION_EVIDENCE'
    ) {
      const choice = context.choice
      if (input.pending?.occurrenceId !== occurrenceId)
        throw new Error('Legendary Action pending occurrence is stale.')
      if (!same(context.root, root)) throw new Error('Legendary Action pending turn root is stale.')
      if (choice.ownerActorId !== queue.ownerActorIds[index] || seen.has(choice.ownerActorId))
        throw new Error('Legendary Action pending owner is stale.')
      if (
        input.resolution?.kind === 'DECLINE' &&
        context.kind === 'ENCOUNTER_TURN_LEGENDARY_ACTION_CHOICE'
      ) {
        const owner = await windowFor(choice.ownerActorId)
        if (!owner || !same(owner.choice, choice))
          throw new Error('Legendary Action choice is stale.')
        completed.push({
          choice,
          selectionChecksum: checksumCanonicalJson(choice),
          resolution: { kind: 'DECLINED' }
        })
      } else {
        const selection =
          context.kind === 'ENCOUNTER_TURN_LEGENDARY_ACTION_EVIDENCE'
            ? { optionId: context.selectedOption.optionId, targetActorId: context.targetActorId }
            : input.resolution?.kind === 'LEGENDARY_OPTION'
              ? {
                  optionId: input.resolution.optionId,
                  targetActorId: input.resolution.targetActorId
                }
              : null
        if (!selection) throw new Error('Legendary Action choice is required.')
        const result = await execute(choice, selection, completed.length)
        if (result.kind === 'PENDING') return result
        completed.push(result.evidence)
      }
      index += 1
    }
    root = { ...root, completedLegendaryActions: completed }
    for (; index < queue.ownerActorIds.length; index += 1) {
      const ownerActorId = queue.ownerActorIds[index]
      const window = ownerActorId === undefined ? undefined : await windowFor(ownerActorId)
      if (!window) continue
      root = { ...root, legendaryActionQueue: { ...queue, nextOwnerIndex: index } }
      return {
        kind: 'PENDING' as const,
        snapshot: serverAggregateChoicePendingSnapshotDtoSchema.parse({
          snapshotKind: 'AGGREGATE_CHOICE',
          schemaVersion: 1,
          occurrenceId,
          applicationContext: {
            kind: 'ENCOUNTER_TURN_LEGENDARY_ACTION_CHOICE',
            schemaVersion: 1,
            root,
            choice: window.choice,
            selectionChecksum: checksumCanonicalJson(window.choice)
          }
        })
      }
    }
    root = { ...root, legendaryActionQueue: undefined }
  }
  const currentActorId = root.proposedTerminalTransition.currentActorId
  if (currentActorId && input.refreshIncoming !== false) {
    const facts = buildEncounterActorRuleFacts({ actors })
    const refresh = await stageEncounterLegendaryActionRefreshes({
      actorId: currentActorId,
      encounter: { ...state, actors },
      actorRules: reconcileEncounterActorRuleOutput(
        evaluateInstalledEncounterActors({ gameSystemId: state.gameSystemId, facts }),
        facts
      ),
      definitions: {
        requireCurrent: async (id) => {
          const definition = await input.definitions.requireCurrent(id)
          if (definition.gameSystemId !== state.gameSystemId)
            throw new Error('Legendary Action refresh definition is unavailable.')
          return definition
        }
      }
    })
    if (
      root.stagedLegendaryActionRefreshes &&
      !same(root.stagedLegendaryActionRefreshes, refresh.refreshes)
    )
      throw new Error('Legendary Action refresh is stale.')
    if (refresh.refreshes.length)
      root = { ...root, stagedLegendaryActionRefreshes: [...refresh.refreshes] }
    if (refresh.refreshedActor)
      actors = actors.map((actor) =>
        actor.id === refresh.refreshedActor!.id ? refresh.refreshedActor! : actor
      )
    const entering = actors.find((actor) => actor.id === currentActorId)
    if (!entering) throw new Error('Incoming action-economy actor is unavailable.')
    const actionEconomy = await stageEncounterActionEconomyRefreshes({
      actor: entering,
      state,
      definitions: input.definitions
    })
    if (
      root.stagedActionEconomyRefreshes !== undefined &&
      !same(root.stagedActionEconomyRefreshes, actionEconomy.refreshes)
    )
      throw new Error('Action-economy refresh is stale.')
    if (actionEconomy.refreshes.length)
      root = { ...root, stagedActionEconomyRefreshes: actionEconomy.refreshes }
    if (actionEconomy.refreshedActor)
      actors = actors.map((actor) =>
        actor.id === actionEconomy.refreshedActor!.id ? actionEconomy.refreshedActor! : actor
      )
  }
  return { kind: 'COMPLETE' as const, root, actors, movementTargets: targets }
}
