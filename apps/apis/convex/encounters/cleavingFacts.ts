import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { rangeDtoSchema } from '@artificer-toolkit/schema/shared/range'
import { snapshotStatBlock } from '@artificer-toolkit/rules-runtime/encounterProjection'
import {
  buildEncounterCleavingCandidate,
  type CleavingContext
} from '@artificer-toolkit/rules-runtime/encounterCleavingFacts'
import type { NativeCleavingCandidate } from '@artificer-toolkit/rules-runtime/encounterCleavingChoice'
import type { MutationCtx } from '../_generated/server'
import { readNativeActionSceneContext } from './actionSceneContext'
import { loadMovementTargets } from './movementTargets'
import { readEncounterCleavingBindings } from './cleavingSceneInputs'

/** Reads current bound tokens and effective actor facts through the native geometry seam. */
export async function nativeCleavingCandidates(
  ctx: MutationCtx,
  input: {
    state: EncounterRunState
    sourceActorId: string
    scene: CleavingContext['scene']
    action: CleavingContext['action']
    originalAttack: CleavingContext['originalAttack']
    visitedTargetActorIds: readonly string[]
    sceneScope?: 'OWNER' | 'MEMBER'
  }
) {
  const bindings = await readEncounterCleavingBindings(ctx, input.state)
  const eligible = bindings.filter(
    (binding) =>
      binding.actorId !== input.sourceActorId &&
      !input.visitedTargetActorIds.includes(binding.actorId)
  )
  const targets = await loadMovementTargets(ctx, {
    encounterId: input.state.id,
    expectedEncounterVersion: input.state.version,
    targetActorIds: [
      ...new Set([input.sourceActorId, ...eligible.map((binding) => binding.actorId)])
    ],
    includeReactionSources: true
  })
  const range = rangeDtoSchema.parse(input.action.range)
  if (range.rangeKind !== 'DISTANCE') return { candidates: [], targets }
  const candidates: NativeCleavingCandidate[] = []
  for (const binding of eligible) {
    const target = targets.get(binding.actorId)
    if (!target || target.actor.kind === 'CUSTOM') continue
    const armorClass =
      target.actor.kind === 'CHARACTER'
        ? target.effectiveRulePolicyOutput?.derivedStats.armorClass?.effective
        : snapshotStatBlock(target.actor)?.armorClass
    if (armorClass == null || target.actor.sourceRevision === null) continue
    const geometry = await readNativeActionSceneContext(
      ctx,
      input.state,
      {
        actorId: input.sourceActorId,
        targetActorId: target.actor.id,
        sceneContext: {
          sceneId: input.scene.sceneId,
          expectedSceneVersion: input.scene.sceneVersion,
          sourceTokenId: input.scene.sourceTokenId,
          targetTokenId: binding.tokenId
        }
      },
      input.sceneScope
    )
    const candidate = buildEncounterCleavingCandidate({
      target,
      targetTokenId: binding.tokenId,
      action: input.action,
      scene: input.scene,
      originalAttack: input.originalAttack,
      geometry
    })
    if (candidate) candidates.push(candidate)
  }
  return { candidates, targets }
}
