import {
  actionTargetActorId,
  castChoiceOptionId,
  type ResolveEncounterActionInputDto
} from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type {
  LiveSessionEncounterRulesRequest,
  LiveSessionEncounterRulesResponse
} from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'
import { prepareEncounterActionMechanics } from '@artificer-toolkit/rules-runtime/encounterActionMechanicsPreparation'
import { resolveEncounterActionSource } from '@artificer-toolkit/rules-runtime/encounterActionSources'
import { readEncounterBasicActionEntries } from '@artificer-toolkit/rules-runtime/encounterBasicActionCapabilityDiscovery'
import { lockedRelationshipActionFacts } from '@artificer-toolkit/rules-runtime/encounterRelationshipActionFacts'
import { resolveEncounterSceneGrid } from '@artificer-toolkit/rules-runtime/sceneGridPolicy'
import {
  readNativeLiveAttackPerception,
  readNativeLiveSourcesSeen
} from './nativeAttackPerception.js'
import { captureActionEconomyDefinitions } from './nativeEncounterActionEconomy.js'
import {
  readNativeLiveActorsAndEffects,
  readNativeLiveSpellPins,
  type prepareNativeLiveMovementTarget
} from './nativeEncounterTargets.js'

type LiveActors = Awaited<ReturnType<typeof readNativeLiveActorsAndEffects>>
type LiveTarget = Awaited<ReturnType<typeof prepareNativeLiveMovementTarget>>['target']

/**
 * Prepares a paused root action's mechanics again from the room's current inputs: its actor and
 * target, the Scene it named, and its basic action source. A contest or check action that resumes
 * runs its outcome on these, never on the facts it paused under.
 */
export async function prepareNativeLiveRootActionMechanics(input: {
  root: ResolveEncounterActionInputDto
  state: EncounterRunState
  system: SystemAuthoredDto
  actors: LiveActors['actors']
  activeEffectsByActorId: LiveActors['activeEffectsByActorId']
  loadTarget(entry: LiveActors['actors'][number]): Promise<LiveTarget>
  capture(request: LiveSessionEncounterRulesRequest): Promise<LiveSessionEncounterRulesResponse>
}) {
  const { root, state, system, actors, activeEffectsByActorId, loadTarget, capture } = input
  const targetActorId = actionTargetActorId(root.target)
  const actor = actors.find((entry) => entry.id === root.actorId)
  const target = actors.find((entry) => entry.id === targetActorId)
  if (!actor || !target) throw new Error('The action actors are unavailable.')
  const movementTargets = new Map(
    await Promise.all(
      [actor, target].map(async (entry) => [entry.id, await loadTarget(entry)] as const)
    )
  )
  const capturedScene = root.sceneContext
    ? await capture({
        kind: 'ACTION_SCENE',
        command: { actorId: root.actorId, targetActorId, sceneContext: root.sceneContext }
      })
    : null
  if (capturedScene && capturedScene.kind !== 'ACTION_SCENE')
    throw new Error('Action Scene context is unavailable.')
  const scene = capturedScene?.context ?? null
  const sceneContext = scene
    ? {
        sceneId: scene.sceneId,
        sceneVersion: scene.sceneVersion,
        sourceToken: scene.sourceToken,
        targetToken: scene.targetToken,
        grid: resolveEncounterSceneGrid({ encounter: state, sceneGrid: scene.sceneGrid })
      }
    : null
  const definitions = captureActionEconomyDefinitions(capture)
  const prepared = await prepareEncounterActionMechanics({
    state,
    actor,
    target,
    actors,
    actionId: root.actionId,
    // A resumed action runs as the outcome its root picked (Shove, D105).
    choiceOptionId: castChoiceOptionId(root.target),
    wieldConflictAcceptance: { kind: 'UNPROMPTED' },
    overridable: false,
    movementTargets,
    sceneContext,
    loadAttackPerception: ({ sourceFacts, targetFacts, roller }) =>
      readNativeLiveAttackPerception({
        state,
        system,
        attacker: sourceFacts,
        target: targetFacts,
        roller,
        sceneContext,
        capture
      }),
    loadSourcesSeen: ({ holder, sourceActorIds }) =>
      readNativeLiveSourcesSeen({
        state,
        system,
        holder,
        sourceActorIds,
        actors,
        loadTarget: async (entry) => movementTargets.get(entry.id) ?? loadTarget(entry),
        sceneContext,
        capture
      }),
    loadSource: async (source) =>
      resolveEncounterActionSource({
        ...source,
        system,
        spells: await readNativeLiveSpellPins(capture),
        basicActions: await readEncounterBasicActionEntries({
          actorId: source.actor.id,
          actionId: source.actionId,
          gameSystemId: source.gameSystemId,
          definitions
        })
      }),
    loadRelationshipFacts: async (facts) =>
      lockedRelationshipActionFacts({
        actionEffectId: facts.actionEffectId,
        sourceActorId: facts.sourceActorId,
        targetActorId: facts.targetActorId,
        targets: { activeEffectsByActorId }
      })
  })
  return { actor, target, movementTargets, sceneContext, definitions, prepared }
}
