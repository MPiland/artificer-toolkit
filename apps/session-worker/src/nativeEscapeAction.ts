import type { EscapeRelationshipInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import {
  liveSessionEncounterEscapeCommitInputSchema,
  type LiveSessionEncounterEscapeCommitInput
} from '@artificer-toolkit/schema/api/liveSessionEncounterBasicAction'
import type { LiveSessionEncounterRulesInput } from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
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
  findEncounterHolderContestEscape,
  findEncounterHolderEscape,
  prepareEncounterEscapeCheck
} from '@artificer-toolkit/rules-runtime/encounterEscapeCheck'
import { EncounterValidationError } from '@artificer-toolkit/rules-runtime/encounterErrors'
import { evaluateInstalledEncounterActors } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import type { RulesRuntimeService } from '@artificer-toolkit/rules-runtime/rulesRuntimeService'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { planNativeLiveEscapeContest } from './nativeContest.js'
import type { LiveCaptureReads } from './nativeEncounterReads.js'
import {
  prepareNativeLiveMovementTarget,
  readNativeLiveActorsAndEffects
} from './nativeEncounterTargets.js'
import {
  admitNativeLiveHolderCommand,
  spendNativeHolderActivation
} from './nativeHolderActivation.js'

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
  const admitted = await admitNativeLiveHolderCommand(scope, command, executionOptions.captures)
  if (admitted.kind === 'REPLAY') return admitted
  const { initial, reads, ready, state, system } = admitted
  const { capture } = reads
  const root = ready.command
  if (root.type !== 'ESCAPE') throw new Error('The escape is unavailable.')
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
  // An escape the holder contests rolls through the one contest path (D152).
  if (effect && findEncounterHolderContestEscape(effect)) {
    const { command: _command, ...contestReady } = ready
    const contest = await planNativeLiveEscapeContest({
      scope,
      command: root,
      root,
      ready: contestReady,
      priorContext: null,
      state,
      system,
      actors,
      activeEffectsByActorId,
      loadTarget: async (entry) => {
        const prepared = await prepareNativeLiveMovementTarget({
          scope: initial,
          state,
          actor: entry,
          activeEffectsByActorId,
          captures: executionOptions.captures
        })
        reads.observe(prepared.revisions)
        return prepared.target
      },
      capture,
      runtime: executionOptions.runtime,
      random: executionOptions.random,
      revisions: reads.revisions
    })
    return { kind: 'CONTEST' as const, contest }
  }
  const escape = effect ? findEncounterHolderEscape(effect) : null
  if (!effect || !escape)
    throw new EncounterValidationError('The creature is not held by an effect it can escape.')
  const prepared = await prepareNativeLiveMovementTarget({
    scope: initial,
    state,
    actor,
    activeEffectsByActorId,
    captures: executionOptions.captures
  })
  reads.observe(prepared.revisions)
  const holder = prepared.target
  const context = prepareEncounterEscapeCheck({
    gameSystemId: state.gameSystemId,
    commandId: root.commandId,
    commandFingerprint: ready.fingerprint,
    system,
    holder,
    activeEffectId: effect.id,
    checkDefinitionId: root.checkDefinitionId
  })
  const { actionEconomy, warnings, spent } = await spendNativeHolderActivation({
    actor,
    state,
    holder,
    activation: escape.activation,
    acknowledgedWarnings: root.acknowledgedWarnings,
    capture
  })
  const facts = buildEncounterActorRuleFacts({ actors })
  let nextActors = actors.map((entry) => (entry.id === spent.id ? spent : entry))
  const occurrenceId = crypto.randomUUID()
  const continuation = await startEncounterBasicActionCheck({
    runtime: executionOptions.runtime,
    gameSystemId: state.gameSystemId,
    occurrenceId,
    addedDice: context.d20.addedDice
  })
  let check: LiveSessionEncounterEscapeCommitInput['check']
  // The holder's controller rolls unless their preference rolls for them (ADR 0034 decision 3).
  if (ready.autoRollByActorId[actor.id] !== true)
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
      random: executionOptions.random,
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
