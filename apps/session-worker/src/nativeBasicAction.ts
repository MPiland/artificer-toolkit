import type { UseEncounterBasicActionInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import { liveSessionEncounterBasicActionCommitInputSchema } from '@artificer-toolkit/schema/api/liveSessionEncounterBasicAction'
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
  planEncounterBasicAction,
  requireEncounterBasicActionDefinition
} from '@artificer-toolkit/rules-runtime/encounterBasicActions'
import { evaluateInstalledEncounterActors } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import { LiveSessionDomainRejectionError } from './liveSessionRoutes.js'
import { liveEncounterCaptures, type LiveCaptureReads } from './nativeCaptureCache.js'
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
  captures: LiveCaptureReads
) {
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
  const { state } = await capture({ kind: 'INPUTS' })
  if (state.id !== initial.encounterId || state.version !== initial.expectedVersion)
    throw new Error('Basic action Run inputs changed during capture.')
  const { actors, activeEffectsByActorId } = await readNativeLiveActorsAndEffects({
    state,
    capture
  })
  const actor = actors.find((entry) => entry.id === root.actorId)
  const ally = root.allyActorId
    ? (actors.find((entry) => entry.id === root.allyActorId) ?? null)
    : null
  if (!actor || (root.allyActorId && !ally)) throw new Error('Basic action actors are unavailable.')
  const { definition, document } = requireEncounterBasicActionDefinition(
    state,
    (await capture({ kind: 'DEFINITION', definitionId: root.definitionId })).definition
  )
  const planned = planEncounterBasicAction({ state, actor, ally, document })
  // A custom actor has no System allowance to spend; Characters and Creatures spend theirs.
  const economy =
    actor.kind === 'CUSTOM'
      ? null
      : await (async () => {
          const actorTarget = await prepareNativeLiveMovementTarget({
            scope: initial,
            state,
            actor,
            activeEffectsByActorId,
            captures
          })
          reads.observe(actorTarget.revisions)
          return evaluateEncounterActionEconomy({
            actor,
            state,
            activation: { code: document.actionCost, amount: 1 },
            target: actorTarget.target,
            loadTarget: async () => actorTarget.target,
            definitions: {
              requireCurrent: async (definitionId) => {
                const { definition: current } = await capture({ kind: 'DEFINITION', definitionId })
                if (!current) throw new Error('Action-economy capability is unavailable.')
                return current
              }
            }
          })
        })()
  const warnings = [
    ...encounterActionEconomyWarnings(economy, document.actionCost),
    ...planned.warnings
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
  const nextFacts = buildEncounterActorRuleFacts({
    actors: actors.map((entry) => (entry.id === settled.id ? settled : entry))
  })
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
      speedMovementBonus: planned.speedMovementBonus,
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
