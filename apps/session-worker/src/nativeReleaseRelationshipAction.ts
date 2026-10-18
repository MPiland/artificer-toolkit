import type { ReleaseRelationshipInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import { liveSessionEncounterReleaseRelationshipCommitInputSchema } from '@artificer-toolkit/schema/api/liveSessionEncounterBasicAction'
import type { LiveSessionEncounterRulesInput } from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import { buildEncounterActorRuleFacts } from '@artificer-toolkit/rules-runtime/encounterActorRuleFacts'
import { reconcileEncounterActorRuleOutput } from '@artificer-toolkit/rules-runtime/encounterActorRuleOutput'
import { EncounterValidationError } from '@artificer-toolkit/rules-runtime/encounterErrors'
import { encounterActorsAfterEscape } from '@artificer-toolkit/rules-runtime/encounterEscapeCheck'
import { encounterSourceRelationships } from '@artificer-toolkit/rules-runtime/encounterRelationshipActionFacts'
import { evaluateInstalledEncounterActors } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import type { LiveCaptureReads } from './nativeEncounterReads.js'
import { readNativeLiveActorsAndEffects } from './nativeEncounterTargets.js'
import { admitNativeLiveHolderCommand } from './nativeHolderActivation.js'

/**
 * Plans a source letting go of the creature it holds (D152): free, so only the actor rules once
 * the held creature has lost the conditions the relationship alone held. Convex re-reads the
 * effect's source, ends it and records the release.
 */
export async function planNativeLiveReleaseRelationship(
  scope: Omit<LiveSessionEncounterRulesInput, 'request'>,
  command: ReleaseRelationshipInputDto,
  executionOptions: { captures: LiveCaptureReads }
) {
  const admitted = await admitNativeLiveHolderCommand(scope, command, executionOptions.captures)
  if (admitted.kind === 'REPLAY') return admitted
  const { reads, ready, state } = admitted
  const root = ready.command
  if (root.type !== 'RELEASE_RELATIONSHIP') throw new Error('The release is unavailable.')
  const { actors, activeEffectsByActorId } = await readNativeLiveActorsAndEffects({
    state,
    capture: reads.capture
  })
  const held = encounterSourceRelationships(activeEffectsByActorId, root.actorId).find(
    ({ actorId, effect }) => actorId === root.heldActorId && effect.id === root.activeEffectId
  )
  if (!held) throw new EncounterValidationError('The creature holds no such relationship.')
  const facts = buildEncounterActorRuleFacts({ actors })
  const nextFacts = buildEncounterActorRuleFacts({
    actors: encounterActorsAfterEscape({
      encounterId: state.id,
      actors,
      holderId: held.actorId,
      holderEffects: activeEffectsByActorId.get(held.actorId) ?? [],
      activeEffectId: held.effect.id
    })
  })
  return {
    kind: 'PLANNED' as const,
    input: liveSessionEncounterReleaseRelationshipCommitInputSchema.parse({
      ...scope,
      command: root,
      revisions: reads.revisions(),
      occurredAt: new Date().toISOString(),
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
