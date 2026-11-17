import type { MoveZoneInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import { liveSessionEncounterMoveZoneCommitInputSchema } from '@artificer-toolkit/schema/api/liveSessionEncounterBasicAction'
import type { LiveSessionEncounterRulesInput } from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { EncounterSpatialRuleEffectRecord } from '@artificer-toolkit/schema/projections/spatialRuleEffectPersistence'
import type { SceneGrid } from '@artificer-toolkit/shared/vtt/scene'
import { buildEncounterActorRuleFacts } from '@artificer-toolkit/rules-runtime/encounterActorRuleFacts'
import { reconcileEncounterActorRuleOutput } from '@artificer-toolkit/rules-runtime/encounterActorRuleOutput'
import {
  sourceZoneMove,
  zoneMoveWithinDistance
} from '@artificer-toolkit/rules-runtime/encounterZoneMove'
import { evaluateInstalledEncounterActors } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import { resolveEncounterSceneGrid } from '@artificer-toolkit/rules-runtime/sceneGridPolicy'
import { LiveSessionDomainRejectionError } from './liveSessionRoutes.js'
import type { LiveCaptureReads } from './nativeEncounterReads.js'
import {
  prepareNativeLiveMovementTarget,
  readNativeLiveActorsAndEffects
} from './nativeEncounterTargets.js'
import {
  admitNativeLiveHolderCommand,
  spendNativeHolderActivation
} from './nativeHolderActivation.js'

const refusal = (reason: 'SOURCE_REQUIREMENTS_NOT_MET' | 'TARGET_UNAVAILABLE', message: string) =>
  new LiveSessionDomainRejectionError(422, { code: 'DOMAIN_REJECTED', reason, message })

/**
 * Plans the current actor moving a zone it maintains by the zone's authored move (QUALITY-15.T3y8):
 * the zone must be the actor's own and still maintained, the destination is held to the move's
 * distance on the Run's Scene grid, and the actor pays the move's activation. Convex re-checks the
 * zone at the version measured here, re-centers it and records the plan; occupancy is read from the
 * moved geometry by the zone rules when a trigger next asks.
 */
export async function planNativeLiveMoveZone(
  scope: Omit<LiveSessionEncounterRulesInput, 'request'>,
  command: MoveZoneInputDto,
  executionOptions: {
    captures: LiveCaptureReads
    random(maximum: number): number
    /** The Run's zone and the grid of the Scene it is placed on; null when either is gone. */
    readZone(
      state: EncounterRunState,
      spatialEffectId: string
    ): Promise<{ zone: EncounterSpatialRuleEffectRecord; sceneGrid: SceneGrid } | null>
  }
) {
  const admitted = await admitNativeLiveHolderCommand(scope, command, executionOptions.captures)
  if (admitted.kind === 'REPLAY') return admitted
  const { initial, reads, ready, state } = admitted
  const { capture } = reads
  const root = ready.command
  if (root.type !== 'MOVE_ZONE') throw new Error('The zone move is unavailable.')
  const { actors, activeEffectsByActorId } = await readNativeLiveActorsAndEffects({
    state,
    capture
  })
  const actor = actors.find((entry) => entry.id === root.actorId)
  if (!actor) throw new Error('Zone-move actor is unavailable.')
  const prepared = await prepareNativeLiveMovementTarget({
    scope: initial,
    state,
    actor,
    activeEffectsByActorId,
    ...executionOptions
  })
  reads.observe(prepared.revisions)
  const read = await executionOptions.readZone(state, root.spatialEffectId)
  const move = read && sourceZoneMove(read.zone, actor.id)
  if (!read || !move) throw refusal('SOURCE_REQUIREMENTS_NOT_MET', "That zone can't be moved.")
  if (
    !zoneMoveWithinDistance({
      zone: read.zone,
      move,
      destination: root.destination,
      grid: resolveEncounterSceneGrid({ encounter: state, sceneGrid: read.sceneGrid })
    })
  )
    throw refusal('TARGET_UNAVAILABLE', 'That is too far to move the zone.')
  const { actionEconomy, warnings, spent } = await spendNativeHolderActivation({
    actor,
    state,
    holder: prepared.target,
    activation: { code: move.activation, amount: 1 },
    acknowledgedWarnings: root.acknowledgedWarnings,
    capture
  })
  const facts = buildEncounterActorRuleFacts({ actors })
  const nextFacts = buildEncounterActorRuleFacts({
    actors: actors.map((entry) => (entry.id === spent.id ? spent : entry))
  })
  return {
    kind: 'PLANNED' as const,
    input: liveSessionEncounterMoveZoneCommitInputSchema.parse({
      ...scope,
      command: root,
      revisions: reads.revisions(),
      occurredAt: new Date().toISOString(),
      zoneVersion: read.zone.version,
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
