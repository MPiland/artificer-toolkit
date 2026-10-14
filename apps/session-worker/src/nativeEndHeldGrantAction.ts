import type { EndHeldGrantInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import { liveSessionEncounterEndHeldGrantCommitInputSchema } from '@artificer-toolkit/schema/api/liveSessionEncounterBasicAction'
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
import { EncounterValidationError } from '@artificer-toolkit/rules-runtime/encounterErrors'
import { evaluateInstalledEncounterActors } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import { LiveSessionDomainRejectionError } from './liveSessionRoutes.js'
import { captureActionEconomyDefinitions } from './nativeEncounterActionEconomy.js'
import { liveEncounterCaptures, type LiveCaptureReads } from './nativeEncounterReads.js'
import {
  prepareNativeLiveMovementTarget,
  readNativeLiveActorsAndEffects
} from './nativeEncounterTargets.js'

/**
 * Plans the current actor ending a grant it holds (D113): the activation the grant's `holderEnd`
 * names, its warnings and the actor rules after the actor has paid. Convex re-reads the grant's own
 * `holderEnd`, deletes it and records the plan; it evaluates none of it.
 */
export async function planNativeLiveEndHeldGrant(
  scope: Omit<LiveSessionEncounterRulesInput, 'request'>,
  command: EndHeldGrantInputDto,
  executionOptions: { captures: LiveCaptureReads }
) {
  const { captures } = executionOptions
  const request = { kind: 'BASIC_ACTION' as const, command }
  const initial = liveSessionEncounterRulesInputSchema.parse({
    ...scope,
    // A player's admitted command lets its follow-up captures read the rules inputs.
    ...(scope.expectedRole === 'PLAYER' ? { action: request } : {}),
    request
  })
  if (
    command.encounterId.toLowerCase() !== initial.encounterId ||
    command.expectedVersion !== initial.expectedVersion
  )
    throw new Error('Live end-grant scope mismatch.')
  const reads = liveEncounterCaptures(initial, captures)
  const { capture } = reads
  const admission = await capture(request)
  if (admission.result) return { kind: 'REPLAY' as const, result: admission.result }
  if (!admission.ready) throw new Error('The end-grant command is unavailable.')
  const root = admission.ready.command
  if (root.type !== 'END_HELD_GRANT') throw new Error('The end-grant command is unavailable.')
  const { state } = await capture({ kind: 'INPUTS' })
  if (state.id !== initial.encounterId || state.version !== initial.expectedVersion)
    throw new Error('End-grant Run inputs changed during capture.')
  const { actors, activeEffectsByActorId } = await readNativeLiveActorsAndEffects({
    state,
    capture
  })
  const actor = actors.find((entry) => entry.id === root.actorId)
  const effect = activeEffectsByActorId
    .get(root.actorId)
    ?.find((entry) => entry.id === root.activeEffectId)
  if (!actor) throw new Error('End-grant actor is unavailable.')
  const holderEnd = effect?.definition.recurrence.holderEnd
  if (!effect || !holderEnd)
    throw new EncounterValidationError('The creature holds no effect it can end.')
  const prepared = await prepareNativeLiveMovementTarget({
    scope: initial,
    state,
    actor,
    activeEffectsByActorId,
    captures
  })
  reads.observe(prepared.revisions)
  const holder = prepared.target
  const activation = { code: holderEnd.activation, amount: 1 }
  const economy =
    activation.code === 'FREE'
      ? null
      : await evaluateEncounterActionEconomy({
          actor,
          state,
          activation,
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
  const nextFacts = buildEncounterActorRuleFacts({
    actors: actors.map((entry) => (entry.id === spent.id ? spent : entry))
  })
  return {
    kind: 'PLANNED' as const,
    input: liveSessionEncounterEndHeldGrantCommitInputSchema.parse({
      ...scope,
      command: root,
      revisions: reads.revisions(),
      occurredAt: new Date().toISOString(),
      actionEconomy,
      ruleOverrides: warnings,
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
