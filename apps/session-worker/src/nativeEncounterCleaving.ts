import type {
  LiveSessionEncounterRulesRequest,
  LiveSessionEncounterRulesResponse
} from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import {
  readCharacterRecord,
  readCharacterSheetState
} from '@artificer-toolkit/schema/projections/characterStoredState'
import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'
import type { StoredRuleExecutionResultDto } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import { rangeDtoSchema } from '@artificer-toolkit/schema/shared/range'
import {
  resolveEncounterActionSource,
  type NativeEncounterActionSource
} from '@artificer-toolkit/rules-runtime/encounterActionSources'
import { buildCompiledActionTargetPolicy } from '@artificer-toolkit/rules-runtime/encounterActionEntryPointCompiler'
import type { MovementTarget } from '@artificer-toolkit/rules-runtime/encounterMovementTargets'
import { projectEncounterActionTarget } from '@artificer-toolkit/rules-runtime/encounterActionProjection'
import {
  buildEncounterCleavingCandidate,
  cleavingTargetArmorClass,
  nativeCleavingSourceCurrentness,
  retainedCleavingDamage,
  type CleavingContext
} from '@artificer-toolkit/rules-runtime/encounterCleavingFacts'
import {
  createNativeCleavingChoice,
  type NativeCleavingCandidate
} from '@artificer-toolkit/rules-runtime/encounterCleavingChoice'
import { resolveEncounterSceneGrid } from '@artificer-toolkit/rules-runtime/sceneGridPolicy'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { PreparedLiveCharacterSheet } from './nativeCharacterRules.js'
import type { planNativeLiveConcentration } from './nativeEncounterConcentration.js'
import { readNativeLiveSpellPins } from './nativeEncounterTargets.js'

type CharacterFacts = PreparedLiveCharacterSheet
type CleavingProjection = Pick<
  Awaited<ReturnType<typeof planNativeLiveConcentration>>,
  'actors' | 'projectedTargets' | 'activeEffectsByActorId' | 'maintenanceOwners'
>
type CleavingReads = {
  state: EncounterRunState
  occurredAt: string
  initialActors: readonly EncounterRunActorState[]
  projection: CleavingProjection
  loadTarget: (actor: EncounterRunActorState) => Promise<MovementTarget<CharacterFacts>>
  capture: (request: LiveSessionEncounterRulesRequest) => Promise<LiveSessionEncounterRulesResponse>
}

async function readNativeLiveCleavingCandidates(
  input: CleavingReads & {
    sourceActorId: string
    action: CleavingContext['action']
    scene: CleavingContext['scene']
    originalAttack: CleavingContext['originalAttack']
    visitedTargetActorIds: readonly string[]
  }
) {
  const { state, scene } = input
  const bindings = await input.capture({ kind: 'ACTOR_TOKEN_BINDINGS' })
  if (bindings.kind !== 'ACTOR_TOKEN_BINDINGS')
    throw new Error('Cleaving bindings are unavailable.')
  const eligible = bindings.bindings.filter(
    (binding) =>
      binding.actorId !== input.sourceActorId &&
      !input.visitedTargetActorIds.includes(binding.actorId)
  )
  const targets = new Map(input.projection.projectedTargets)
  await Promise.all(
    [input.sourceActorId, ...eligible.map((binding) => binding.actorId)].map(async (actorId) => {
      if (targets.has(actorId)) return
      const before = input.initialActors.find((actor) => actor.id === actorId)
      const actor = input.projection.actors.find((actor) => actor.id === actorId)
      if (!before || !actor) throw new Error('Cleaving actor is unavailable.')
      const target = await input.loadTarget(before)
      const owner =
        actor.kind === 'CHARACTER'
          ? input.projection.maintenanceOwners.find(
              (entry) =>
                entry.owner.kind === 'CHARACTER' && entry.owner.characterId === actor.sourceId
            )
          : null
      const row = owner?.character
      const effects = input.projection.activeEffectsByActorId.get(actorId) ?? []
      if (
        !row &&
        target.actor === actor &&
        target.activeEffects.length === effects.length &&
        target.activeEffects.every((effect, index) => effect === effects[index])
      ) {
        targets.set(actorId, target)
        return
      }
      targets.set(
        actorId,
        projectEncounterActionTarget({
          target: { ...target, activeEffects: effects },
          actor,
          plan: row
            ? {
                characterStreamVersion: row.play.streamVersion,
                characterUpdate: {
                  character: readCharacterRecord(row),
                  sheetState: readCharacterSheetState(row)
                }
              }
            : null,
          campaignId: state.campaignId,
          gameSystemId: state.gameSystemId,
          occurredAt: input.occurredAt
        })
      )
    })
  )
  const range = rangeDtoSchema.parse(input.action.range)
  const candidates: NativeCleavingCandidate[] =
    range.rangeKind === 'DISTANCE'
      ? (
          await Promise.all(
            eligible.map(async (binding) => {
              const target = targets.get(binding.actorId)
              if (!target || target.actor.kind === 'CUSTOM') return null
              if (
                cleavingTargetArmorClass(target) == null ||
                (target.actor.kind === 'CREATURE' && target.actor.sourceRevision === null)
              )
                return null
              const captured = await input.capture({
                kind: 'ACTION_SCENE',
                command: {
                  actorId: input.sourceActorId,
                  targetActorId: target.actor.id,
                  sceneContext: {
                    sceneId: scene.sceneId,
                    expectedSceneVersion: scene.sceneVersion,
                    sourceTokenId: scene.sourceTokenId,
                    targetTokenId: binding.tokenId
                  }
                }
              })
              if (captured.kind !== 'ACTION_SCENE')
                throw new Error('Cleaving Scene is unavailable.')
              const geometry = captured.context
                ? {
                    ...captured.context,
                    grid: resolveEncounterSceneGrid({
                      encounter: state,
                      sceneGrid: captured.context.sceneGrid
                    })
                  }
                : null
              return buildEncounterCleavingCandidate({
                target,
                targetTokenId: binding.tokenId,
                action: input.action,
                scene,
                originalAttack: input.originalAttack,
                geometry
              })
            })
          )
        ).filter((candidate) => candidate !== null)
      : []
  return { candidates, targets }
}

/** Builds Cleaving only after its parent mechanics and concentration have settled in the plan. */
export async function planNativeLiveCleaving(input: {
  state: EncounterRunState
  result: Extract<StoredRuleExecutionResultDto, { status: 'COMPLETE' }>
  source: NativeEncounterActionSource
  action: CleavingContext['action']
  scene: CleavingContext['scene'] | null
  occurredAt: string
  initialActors: readonly EncounterRunActorState[]
  projection: Awaited<ReturnType<typeof planNativeLiveConcentration>>
  loadTarget: (actor: EncounterRunActorState) => Promise<MovementTarget<CharacterFacts>>
  capture: (request: LiveSessionEncounterRulesRequest) => Promise<LiveSessionEncounterRulesResponse>
}) {
  const retained = retainedCleavingDamage(input.result)
  const { scene, state } = input
  if (
    !retained ||
    !scene ||
    input.action.attackKind !== 'MELEE' ||
    state.optionalCombatSnapshotChecksum === null
  )
    return null
  const { candidates, targets } = await readNativeLiveCleavingCandidates({
    ...input,
    scene,
    sourceActorId: input.source.actor.id,
    originalAttack: retained.originalAttack,
    visitedTargetActorIds: [retained.initialTargetActorId]
  })
  const source = targets.get(input.source.actor.id)
  if (!source) throw new Error('Cleaving source is unavailable.')
  return createNativeCleavingChoice({
    ...state,
    parentOccurrenceId: input.result.occurrenceId,
    parentResultChecksum: checksumRuleDocument(input.result),
    optionalCombatSnapshotChecksum: state.optionalCombatSnapshotChecksum,
    sourceActorId: source.actor.id,
    sourceControllerCharacterId: source.actor.kind === 'CHARACTER' ? source.actor.sourceId : null,
    sourceCurrentness: nativeCleavingSourceCurrentness(source, input.source),
    action: input.action,
    scene,
    ...retained,
    visitedTargetActorIds: [retained.initialTargetActorId],
    chainStep: 0,
    candidates
  })
}

/**
 * One Cleaving step from current captured facts: its candidates, every loaded target, and the
 * source's current action, which must still have the sealed range.
 */
export async function readNativeLiveCleavingStep(
  input: CleavingReads & {
    context: Pick<
      CleavingContext,
      'sourceActorId' | 'action' | 'scene' | 'originalAttack' | 'visitedTargetActorIds'
    >
    system: SystemAuthoredDto
  }
) {
  const { state, context } = input
  const { candidates, targets } = await readNativeLiveCleavingCandidates({
    ...input,
    sourceActorId: context.sourceActorId,
    action: context.action,
    scene: context.scene,
    originalAttack: context.originalAttack,
    visitedTargetActorIds: context.visitedTargetActorIds
  })
  const sourceFacts = targets.get(context.sourceActorId)
  if (!sourceFacts) throw new Error('Cleaving source is unavailable.')
  const character = sourceFacts.characterReactionSource
  const candidate = character?.mechanics.rulePolicyInput.actionCandidates.find(
    (entry) => entry.actionId === context.action.actionId
  )
  const entry = candidate
    ? character?.mechanics.compiledActionEntryPoints.find(
        (
          entry
        ): entry is NonNullable<
          Parameters<typeof resolveEncounterActionSource>[0]['characterSource']
        >['entry'] =>
          entry.actionId === context.action.actionId &&
          entry.effectId === candidate.effectId &&
          entry.kind === 'CHARACTER_ACTION' &&
          entry.compilation.kind === 'COMPILED'
      )
    : undefined
  const source = resolveEncounterActionSource({
    actor: sourceFacts.actor,
    actionId: context.action.actionId,
    gameSystemId: state.gameSystemId,
    system: input.system,
    spells: await readNativeLiveSpellPins(input.capture),
    ...(character &&
    candidate &&
    entry?.kind === 'CHARACTER_ACTION' &&
    entry.compilation.kind === 'COMPILED' &&
    sourceFacts.effectiveRulePolicyOutput
      ? {
          characterSource: {
            id: character.id,
            streamVersion: character.streamVersion,
            candidate,
            entry,
            effectivePolicyOutput: sourceFacts.effectiveRulePolicyOutput
          }
        }
      : {})
  })
  if (source.kind === 'BASIC_ACTION' || source.kind === 'REPEAT_PATH' || source.kind === 'RULE')
    throw new Error('Cleaving requires a weapon attack action.')
  const range =
    source.kind === 'CREATURE'
      ? buildCompiledActionTargetPolicy(source.capability).range
      : source.entry.targetPolicy?.range
  if (checksumRuleDocument(range) !== checksumRuleDocument(context.action.range))
    throw new Error('Cleaving action is stale.')
  return {
    candidates,
    targets,
    source,
    sourceCurrentness: nativeCleavingSourceCurrentness(sourceFacts, source)
  }
}

/** Rebuilds a sealed choice from current captured facts after its parent proof is read. */
export async function rebuildNativeLiveDeferredCleaving(
  input: CleavingReads & {
    context: CleavingContext
    system: SystemAuthoredDto
  }
) {
  const { state, context } = input
  const { candidates, sourceCurrentness } = await readNativeLiveCleavingStep(input)
  return createNativeCleavingChoice({
    ...state,
    ...context,
    optionalCombatSnapshotChecksum: state.optionalCombatSnapshotChecksum,
    sourceCurrentness,
    chainStep: context.chainStep - 1,
    candidates
  })
}
