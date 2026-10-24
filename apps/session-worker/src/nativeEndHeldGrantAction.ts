import type { EndHeldGrantInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import { liveSessionEncounterEndHeldGrantCommitInputSchema } from '@artificer-toolkit/schema/api/liveSessionEncounterBasicAction'
import type { LiveSessionEncounterRulesInput } from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import { buildEncounterActorRuleFacts } from '@artificer-toolkit/rules-runtime/encounterActorRuleFacts'
import { revertActorForm } from '@artificer-toolkit/rules-runtime/encounterActorForm'
import { reconcileEncounterActorRuleOutput } from '@artificer-toolkit/rules-runtime/encounterActorRuleOutput'
import { EncounterValidationError } from '@artificer-toolkit/rules-runtime/encounterErrors'
import { evaluateInstalledEncounterActors } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
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
 * Plans the current actor ending a grant it holds (D113): the activation the grant's `holderEnd`
 * names, its warnings and the actor rules after the actor has paid. Convex re-reads the grant's own
 * `holderEnd`, deletes it and records the plan; it evaluates none of it.
 */
export async function planNativeLiveEndHeldGrant(
  scope: Omit<LiveSessionEncounterRulesInput, 'request'>,
  command: EndHeldGrantInputDto,
  executionOptions: { captures: LiveCaptureReads; random(maximum: number): number }
) {
  const admitted = await admitNativeLiveHolderCommand(scope, command, executionOptions.captures)
  if (admitted.kind === 'REPLAY') return admitted
  const { initial, reads, ready, state } = admitted
  const { capture } = reads
  const root = ready.command
  if (root.type !== 'END_HELD_GRANT') throw new Error('The end-grant is unavailable.')
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
    ...executionOptions
  })
  reads.observe(prepared.revisions)
  const { actionEconomy, warnings, spent } = await spendNativeHolderActivation({
    actor,
    state,
    holder: prepared.target,
    activation: { code: holderEnd.activation, amount: 1 },
    acknowledgedWarnings: root.acknowledgedWarnings,
    capture
  })
  // Ending a form's own effect reverts its wearer (D130).
  const ended = spent.form?.effectId === effect.id ? revertActorForm(spent) : spent
  const facts = buildEncounterActorRuleFacts({ actors })
  const nextFacts = buildEncounterActorRuleFacts({
    actors: actors.map((entry) => (entry.id === ended.id ? ended : entry))
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
