import { createConvexEncounterStore } from '../../convex/lib/convexEncounterStore'
import { buildSpatialDamageEffect } from '@artificer-toolkit/rules-runtime/testing/spatialDamageEffectFixture'
import { createRulesRuntime } from './rulesRuntime'
import { createSpatialRuleEffectStore } from '@artificer-toolkit/encounter-persistence/spatialEffectStore'
import { setupAutomaticSceneMovement } from './automaticSceneMovement'

type SceneFixture = Awaited<ReturnType<typeof setupAutomaticSceneMovement>>

export async function seedSpatialSaveEffect(
  base: Pick<SceneFixture, 'owner' | 'sceneId'> & { base: Pick<SceneFixture['base'], 'run'> },
  input: { center: { x: number; y: number }; radius: number; targetActorId: string }
) {
  return base.owner.caller.run(async (ctx) => {
    const effect = await buildSpatialDamageEffect({
      runtime: createRulesRuntime(ctx, base.owner.userId),
      encounterId: base.base.run.id,
      targetActorId: input.targetActorId,
      targetHitPoints: 10,
      center: input.center,
      radius: input.radius,
      ids: {
        definitionId: crypto.randomUUID(),
        entryId: crypto.randomUUID(),
        occurrenceId: crypto.randomUUID(),
        rootCommandId: crypto.randomUUID(),
        effectId: crypto.randomUUID()
      },
      save: true,
      remainingTicks: null
    })
    const scope = await createSpatialRuleEffectStore({ db: createConvexEncounterStore(ctx) }).scope(
      {
        encounterId: base.base.run.id,
        sceneId: base.sceneId
      }
    )
    if (!scope) throw new Error('Fixture binding missing')
    return scope.create(effect)
  })
}
