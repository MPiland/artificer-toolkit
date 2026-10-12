import type { EscapeRelationshipInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import {
  liveSessionEncounterEscapeCommitInputSchema,
  type LiveSessionEncounterEscapeCommitInput
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
  encounterBasicActionCheckPendingSnapshot,
  evaluateEncounterBasicActionCheck,
  startEncounterBasicActionCheck
} from '@artificer-toolkit/rules-runtime/encounterBasicActionCheck'
import {
  completeEncounterEscapeCheckResult,
  encounterActorsAfterEscape,
  encounterEscapeEndedConditionIds,
  findEncounterHolderEscape,
  prepareEncounterEscapeCheck
} from '@artificer-toolkit/rules-runtime/encounterEscapeCheck'
import { EncounterValidationError } from '@artificer-toolkit/rules-runtime/encounterErrors'
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
 * Plans one Escape in the room (D105): the activation it spends, its warnings and the holder's d20
 * check against the effect's fixed DC, waiting on the holder's roll or settled by an auto-roll that
 * also frees the holder. Convex records the plan; it evaluates none of it.
 */
export async function planNativeLiveEscape(
  scope: Omit<LiveSessionEncounterRulesInput, 'request'>,
  command: EscapeRelationshipInputDto,
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
    // A player's admitted escape lets its follow-up captures read the rules inputs.
    ...(scope.expectedRole === 'PLAYER' ? { action: request } : {}),
    request
  })
  if (
    command.encounterId.toLowerCase() !== initial.encounterId ||
    command.expectedVersion !== initial.expectedVersion
  )
    throw new Error('Live escape scope mismatch.')
  const reads = liveEncounterCaptures(initial, captures)
  const { capture } = reads
  const admission = await capture(request)
  if (admission.result) return { kind: 'REPLAY' as const, result: admission.result }
  if (!admission.ready) throw new Error('The escape is unavailable.')
  const root = admission.ready.command
  if (root.type !== 'ESCAPE_RELATIONSHIP') throw new Error('The escape is unavailable.')
  const { state, system } = await capture({ kind: 'INPUTS' })
  if (state.id !== initial.encounterId || state.version !== initial.expectedVersion)
    throw new Error('Escape Run inputs changed during capture.')
  const { actors, activeEffectsByActorId } = await readNativeLiveActorsAndEffects({
    state,
    capture
  })
  const actor = actors.find((entry) => entry.id === root.actorId)
  const heldEffects = activeEffectsByActorId.get(root.actorId)
  const effect = heldEffects?.find((entry) => entry.id === root.activeEffectId)
  if (!actor || !heldEffects) throw new Error('Escape actors are unavailable.')
  if (actor.kind === 'CUSTOM')
    throw new EncounterValidationError('A custom actor has no check to make.')
  const escape = effect ? findEncounterHolderEscape(effect) : null
  if (!effect || !escape)
    throw new EncounterValidationError('The creature is not held by an effect it can escape.')
  const prepared = await prepareNativeLiveMovementTarget({
    scope: initial,
    state,
    actor,
    activeEffectsByActorId,
    captures
  })
  reads.observe(prepared.revisions)
  const holder = prepared.target
  const context = prepareEncounterEscapeCheck({
    gameSystemId: state.gameSystemId,
    commandId: root.commandId,
    commandFingerprint: admission.ready.fingerprint,
    system,
    holder,
    activeEffectId: effect.id,
    checkDefinitionId: root.checkDefinitionId
  })
  const { activation } = escape.module
  const economy =
    activation.code === 'FREE'
      ? null
      : await evaluateEncounterActionEconomy({
          actor,
          state,
          activation: { code: activation.code, amount: activation.amount },
          target: holder,
          loadTarget: async () => holder,
          definitions: captureActionEconomyDefinitions(capture)
        })
  const warnings = encounterActionEconomyWarnings(economy, activation.code)
  if (!warnings.every((warning) => root.acknowledgedWarnings.includes(warning.code)))
    throw new LiveSessionDomainRejectionError(422, {
      code: 'DOMAIN_REJECTED',
      reason: 'RULE_WARNINGS',
      message: RULE_WARNINGS_MESSAGE,
      warnings
    })
  const actionEconomy = economy?.consumption ?? null
  const spent = actionEconomy
    ? consumeEncounterActionEconomy({
        actor,
        consumption: actionEconomy,
        overridden: overridesActionEconomy(warnings)
      })
    : actor
  const facts = buildEncounterActorRuleFacts({ actors })
  let nextActors = actors.map((entry) => (entry.id === spent.id ? spent : entry))
  const occurrenceId = crypto.randomUUID()
  const continuation = await startEncounterBasicActionCheck({
    runtime: executionOptions.runtime,
    gameSystemId: state.gameSystemId,
    occurrenceId
  })
  let check: LiveSessionEncounterEscapeCommitInput['check']
  // The holder's controller rolls unless their preference rolls for them (ADR 0034 decision 3).
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
    const removedConditionIds = encounterEscapeEndedConditionIds(heldEffects, effect.id)
    const { result } = completeEncounterEscapeCheckResult({
      context,
      continuation,
      evaluated,
      effectStillHeld: true,
      removedConditionIds,
      occurrenceVersion: 0,
      initialFactsChecksum: checksumRuleDocument(continuation.facts)
    })
    check = { kind: 'SETTLED', settlement: { context, execution: result, appRollId: null } }
    if (evaluated.reachesDc)
      nextActors = encounterActorsAfterEscape({
        encounterId: state.id,
        actors: nextActors,
        holderId: actor.id,
        holderEffects: heldEffects,
        activeEffectId: effect.id
      })
  }
  const nextFacts = buildEncounterActorRuleFacts({ actors: nextActors })
  return {
    kind: 'PLANNED' as const,
    input: liveSessionEncounterEscapeCommitInputSchema.parse({
      ...scope,
      command: root,
      revisions: reads.revisions(),
      occurredAt: new Date().toISOString(),
      actionEconomy,
      ruleOverrides: warnings,
      consumedGrants: context.consumedGrants,
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
