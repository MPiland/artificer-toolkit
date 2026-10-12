import type { UseEncounterBasicActionInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import {
  liveSessionEncounterBasicActionCommitInputSchema,
  type LiveSessionEncounterBasicActionCommitInput
} from '@artificer-toolkit/schema/api/liveSessionEncounterBasicAction'
import {
  liveSessionEncounterRulesInputSchema,
  type LiveSessionEncounterRulesInput
} from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import { evaluateEncounterActionEconomy } from '@artificer-toolkit/rules-runtime/encounterActionEconomy'
import { consumeEncounterActionEconomy } from '@artificer-toolkit/rules-runtime/encounterActionEconomyConsumption'
import {
  encounterActionEconomyWarnings,
  overridesActionEconomy,
  RULE_WARNINGS_MESSAGE
} from '@artificer-toolkit/rules-runtime/encounterActionRuleWarnings'
import { buildEncounterActorRuleFacts } from '@artificer-toolkit/rules-runtime/encounterActorRuleFacts'
import { reconcileEncounterActorRuleOutput } from '@artificer-toolkit/rules-runtime/encounterActorRuleOutput'
import {
  completeEncounterBasicActionCheckResult,
  encounterBasicActionCheckLabel,
  encounterBasicActionCheckPendingSnapshot,
  encounterBasicActionStabilizeApplication,
  encounterBasicActionStabilizeWarnings,
  evaluateEncounterBasicActionCheck,
  prepareEncounterBasicActionCheck,
  startEncounterBasicActionCheck
} from '@artificer-toolkit/rules-runtime/encounterBasicActionCheck'
import {
  planEncounterBasicAction,
  requireEncounterBasicActionDefinition
} from '@artificer-toolkit/rules-runtime/encounterBasicActions'
import { deriveEncounterCharacterMechanicsEventCommandId } from '@artificer-toolkit/rules-runtime/encounterCharacterMechanicsBatch'
import { EncounterValidationError } from '@artificer-toolkit/rules-runtime/encounterErrors'
import { planEncounterMechanicsBatch } from '@artificer-toolkit/rules-runtime/encounterMechanicsBatchPlan'
import { evaluateInstalledEncounterActors } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import type { RulesRuntimeService } from '@artificer-toolkit/rules-runtime/rulesRuntimeService'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { LiveSessionDomainRejectionError } from './liveSessionRoutes.js'
import { captureActionEconomyDefinitions } from './nativeEncounterActionEconomy.js'
import { liveEncounterCaptures, type LiveCaptureReads } from './nativeEncounterReads.js'
import {
  prepareNativeLiveMovementTarget,
  readNativeLiveActorsAndEffects
} from './nativeEncounterTargets.js'

/**
 * Plans one basic action in the room (Q11, D41): its catalogue entry, allowance, Assisted warnings
 * and effects. Convex records the plan; it evaluates none of it.
 */
export async function planNativeLiveBasicAction(
  scope: Omit<LiveSessionEncounterRulesInput, 'request'>,
  command: UseEncounterBasicActionInputDto,
  executionOptions: {
    runtime: RulesRuntimeService
    random(maximum: number): number
    captures: LiveCaptureReads
  }
) {
  const { captures } = executionOptions
  const request = { kind: 'BASIC_ACTION' as const, command }
  const initial = liveSessionEncounterRulesInputSchema.parse({
    ...scope,
    // A player's admitted basic action lets its follow-up captures read the rules inputs.
    ...(scope.expectedRole === 'PLAYER' ? { action: request } : {}),
    request
  })
  if (
    command.encounterId.toLowerCase() !== initial.encounterId ||
    command.expectedVersion !== initial.expectedVersion
  )
    throw new Error('Live basic action scope mismatch.')
  const reads = liveEncounterCaptures(initial, captures)
  const { capture } = reads
  const admission = await capture(request)
  if (admission.result) return { kind: 'REPLAY' as const, result: admission.result }
  if (!admission.ready) throw new Error('The basic action is unavailable.')
  const root = admission.ready.command
  if (root.type !== 'USE_BASIC_ACTION') throw new Error('The basic action is unavailable.')
  const { state, system } = await capture({ kind: 'INPUTS' })
  if (state.id !== initial.encounterId || state.version !== initial.expectedVersion)
    throw new Error('Basic action Run inputs changed during capture.')
  const { actors, activeEffectsByActorId } = await readNativeLiveActorsAndEffects({
    state,
    capture
  })
  const actor = actors.find((entry) => entry.id === root.actorId)
  const target = root.targetActorId
    ? (actors.find((entry) => entry.id === root.targetActorId) ?? null)
    : null
  if (!actor || (root.targetActorId && !target))
    throw new Error('Basic action actors are unavailable.')
  const { definition, document } = requireEncounterBasicActionDefinition(
    state,
    (await capture({ kind: 'DEFINITION', definitionId: root.definitionId })).definition
  )
  const planned = planEncounterBasicAction({ state, actor, target, document })
  if (document.check && actor.kind === 'CUSTOM')
    throw new EncounterValidationError('A custom actor has no check to make.')
  const prepare = async (entry: typeof actor) => {
    const prepared = await prepareNativeLiveMovementTarget({
      scope: initial,
      state,
      actor: entry,
      activeEffectsByActorId,
      captures
    })
    reads.observe(prepared.revisions)
    return prepared.target
  }
  // A custom actor has no System allowance to spend; Characters and Creatures spend theirs.
  const actorTarget = actor.kind === 'CUSTOM' ? null : await prepare(actor)
  const economy = actorTarget
    ? await evaluateEncounterActionEconomy({
        actor,
        state,
        activation: { code: document.actionCost, amount: 1 },
        target: actorTarget,
        loadTarget: async () => actorTarget,
        definitions: captureActionEconomyDefinitions(capture)
      })
    : null
  const stabilizeTarget = document.check && target ? await prepare(target) : null
  const warnings = [
    ...encounterActionEconomyWarnings(economy, document.actionCost),
    ...planned.warnings,
    ...(actorTarget && stabilizeTarget
      ? encounterBasicActionStabilizeWarnings({ actor, target: stabilizeTarget })
      : [])
  ]
  if (!warnings.every((warning) => root.acknowledgedWarnings.includes(warning.code)))
    throw new LiveSessionDomainRejectionError(422, {
      code: 'DOMAIN_REJECTED',
      reason: 'RULE_WARNINGS',
      message: RULE_WARNINGS_MESSAGE,
      warnings
    })
  const actionEconomy = economy?.consumption ?? null
  const settled = actionEconomy
    ? consumeEncounterActionEconomy({
        actor: planned.actor,
        consumption: actionEconomy,
        overridden: overridesActionEconomy(warnings)
      })
    : planned.actor
  const facts = buildEncounterActorRuleFacts({ actors })
  const nextActors = actors.map((entry) => (entry.id === settled.id ? settled : entry))
  const nextFacts = buildEncounterActorRuleFacts({ actors: nextActors })
  const prepared =
    document.check && actorTarget && stabilizeTarget
      ? prepareEncounterBasicActionCheck({
          gameSystemId: state.gameSystemId,
          commandId: root.commandId,
          commandFingerprint: admission.ready.fingerprint,
          definition: {
            id: definition.id,
            version: definition.version,
            checksum: definition.checksum,
            label: definition.label
          },
          check: document.check,
          checkLabel: encounterBasicActionCheckLabel(system, document.check.checkDefinitionId),
          helper: actorTarget,
          target: stabilizeTarget,
          actors
        })
      : null
  let check: LiveSessionEncounterBasicActionCommitInput['check'] = null
  if (prepared && stabilizeTarget) {
    const occurrenceId = crypto.randomUUID()
    const { context } = prepared
    const continuation = await startEncounterBasicActionCheck({
      runtime: executionOptions.runtime,
      gameSystemId: state.gameSystemId,
      occurrenceId
    })
    // The helper's controller rolls unless their preference rolls for them (ADR 0034 decision 3).
    if (admission.ready.autoRollByActorId[actor.id] !== true)
      check = {
        kind: 'PENDING',
        snapshot: encounterBasicActionCheckPendingSnapshot({
          continuation,
          context,
          optionalCombatSnapshotChecksum: state.optionalCombatSnapshotChecksum
        })
      }
    else {
      const evaluated = await evaluateEncounterBasicActionCheck({
        runtime: executionOptions.runtime,
        context,
        continuation,
        answer: { kind: 'AUTO_ROLL', requestId: continuation.request.requestId },
        rollD20: () => executionOptions.random(20) + 1,
        expectedOccurrenceId: occurrenceId
      })
      const stabilized = evaluated.reachesDc
        ? planEncounterMechanicsBatch({
            batch: {
              encounterId: state.id,
              targetActorId: stabilizeTarget.actor.id,
              expectedEncounterVersion: state.version,
              occurrenceId,
              sourceCommandId: root.commandId,
              commandId: deriveEncounterCharacterMechanicsEventCommandId({
                occurrenceId,
                sourceCommandId: root.commandId,
                phase: 'BASIC_ACTION_CHECK',
                ordinal: 0,
                targetCharacterId: context.targetCharacterId
              }),
              occurredAt: new Date().toISOString(),
              applications: [encounterBasicActionStabilizeApplication(context.targetActorId)],
              expectedCharacterStreamVersion:
                stabilizeTarget.characterFacts?.active.play.streamVersion ?? null,
              effectiveMaximumHitPoints: stabilizeTarget.effectiveMaximumHitPoints,
              effectiveScalarValues: stabilizeTarget.effectiveScalarValues,
              forceVersionAdvance: false
            },
            actor: stabilizeTarget.actor,
            userId: initial.expectedUserId,
            ...(stabilizeTarget.characterFacts
              ? { characterFacts: stabilizeTarget.characterFacts }
              : {})
          })
        : null
      const { result } = completeEncounterBasicActionCheckResult({
        context,
        continuation,
        evaluated,
        targetStillDying: true,
        transition: stabilized
          ? {
              before: stabilized.targetTransition.before,
              after: stabilized.targetTransition.after,
              afterStreamVersion: stabilized.characterStreamVersion
            }
          : null,
        occurrenceVersion: 0,
        initialFactsChecksum: checksumRuleDocument(continuation.facts)
      })
      check = { kind: 'SETTLED', settlement: { context, execution: result, appRollId: null } }
    }
  }
  return {
    kind: 'PLANNED' as const,
    input: liveSessionEncounterBasicActionCommitInputSchema.parse({
      ...scope,
      command: root,
      revisions: reads.revisions(),
      occurredAt: new Date().toISOString(),
      definition: {
        id: definition.id,
        version: definition.version,
        checksum: definition.checksum
      },
      actionEconomy,
      ruleOverrides: warnings,
      effects: planned.effects,
      allyAdvantageUses: prepared?.allyAdvantageUses ?? [],
      check,
      rules: reconcileEncounterActorRuleOutput(
        evaluateInstalledEncounterActors({ gameSystemId: state.gameSystemId, facts: nextFacts }),
        nextFacts,
        {
          output: reconcileEncounterActorRuleOutput(
            evaluateInstalledEncounterActors({ gameSystemId: state.gameSystemId, facts }),
            facts
          )
        }
      )
    })
  }
}
