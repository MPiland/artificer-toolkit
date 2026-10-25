import { rejectDomain } from '@artificer-toolkit/encounter-persistence/domainRejections'
import type { ChangeFacingInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import { liveSessionEncounterChangeFacingCommitInputSchema } from '@artificer-toolkit/schema/api/liveSessionEncounterBasicAction'
import type { LiveSessionEncounterRulesInput } from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import { buildEncounterActorRuleFacts } from '@artificer-toolkit/rules-runtime/encounterActorRuleFacts'
import { reconcileEncounterActorRuleOutput } from '@artificer-toolkit/rules-runtime/encounterActorRuleOutput'
import { admitsEncounterFacing } from '@artificer-toolkit/rules-runtime/encounterFacing'
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
 * Plans a creature's Change facing reaction (ATTACK-12): the Encounter's Facing rule must allow the
 * new facing, and the creature pays a reaction. Turning is not movement, so it spends no speed.
 * Convex re-checks the rule and the economy, turns the token and records the plan.
 */
export async function planNativeLiveChangeFacing(
  scope: Omit<LiveSessionEncounterRulesInput, 'request'>,
  command: ChangeFacingInputDto,
  executionOptions: { captures: LiveCaptureReads; random(maximum: number): number }
) {
  const admitted = await admitNativeLiveHolderCommand(scope, command, executionOptions.captures)
  if (admitted.kind === 'REPLAY') return admitted
  const { initial, reads, ready, state } = admitted
  const { capture } = reads
  const root = ready.command
  if (root.type !== 'CHANGE_FACING') throw new Error('The facing change is unavailable.')
  if (!admitsEncounterFacing(state, root.rotationDegrees)) rejectDomain('FACING_UNAVAILABLE')
  const { actors, activeEffectsByActorId } = await readNativeLiveActorsAndEffects({
    state,
    capture
  })
  const actor = actors.find((entry) => entry.id === root.actorId)
  if (!actor) throw new Error('Facing-change actor is unavailable.')
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
    activation: { code: 'REACTION', amount: 1 },
    acknowledgedWarnings: root.acknowledgedWarnings,
    capture
  })
  const facts = buildEncounterActorRuleFacts({ actors })
  const nextFacts = buildEncounterActorRuleFacts({
    actors: actors.map((entry) => (entry.id === spent.id ? spent : entry))
  })
  return {
    kind: 'PLANNED' as const,
    input: liveSessionEncounterChangeFacingCommitInputSchema.parse({
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
