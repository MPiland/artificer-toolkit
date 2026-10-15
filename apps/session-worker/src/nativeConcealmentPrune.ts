import type { CampaignSceneStateDto } from '@artificer-toolkit/schema/api/vttScenes'
import { resolveEncounterObserversSeeing } from '@artificer-toolkit/rules-runtime/encounterAttackPerception'
import { encounterConcealmentOf } from '@artificer-toolkit/rules-runtime/encounterConcealment'
import type { prepareNativeLiveMovement } from './nativeEncounterMovement.js'

type MovementPlan = Awaited<ReturnType<typeof prepareNativeLiveMovement>>

/**
 * The observers a committed token move leaves seeing a hidden creature: for each concealment whose
 * holder or one of whose observers is the moved token's actor, the observers in its set that see the
 * holder on the moved-to Scene. They have noticed the holder, so the concealment drops them (ATTACK-10.T1).
 */
export async function planConcealmentPrune(
  planned: Pick<
    MovementPlan,
    'state' | 'system' | 'targets' | 'actorIdByTokenId' | 'spatialEffects' | 'definitions' | 'token'
  >,
  scene: CampaignSceneStateDto
) {
  const input = { ...planned, scene, movedTokenId: planned.token.id }
  const movedActorId = input.actorIdByTokenId.get(input.movedTokenId)
  const tokenOf = (actorId: string) =>
    input.scene.tokens.find((token) => input.actorIdByTokenId.get(token.id) === actorId)
  const prunes: { holderActorId: string; activeEffectId: string; observerActorIds: string[] }[] = []
  for (const holder of input.targets.values()) {
    const concealment = encounterConcealmentOf(holder.activeEffects)
    const holderToken = tokenOf(holder.actor.id)
    if (!concealment || !holderToken) continue
    const candidates = concealment.observerActorIds.filter(
      (id) => holder.actor.id === movedActorId || id === movedActorId
    )
    const observers = candidates.flatMap((id) => {
      const observer = input.targets.get(id)
      const observerToken = tokenOf(id)
      return observer && observerToken
        ? [
            {
              observer,
              placement: {
                scene: input.scene,
                sceneGrid: input.scene.grid,
                observerToken,
                subjectToken: holderToken,
                spatialEffects: input.spatialEffects
              }
            }
          ]
        : []
    })
    if (!observers.length) continue
    const seeing = await resolveEncounterObserversSeeing({
      gameSystemId: input.state.gameSystemId,
      loadDefinition: async (id) => {
        const current = await input.definitions.requireCurrent(id)
        return {
          definitionFamilyKey: current.definitionFamilyKey,
          gameSystemId: current.gameSystemId,
          current
        }
      },
      loadSystem: async () => input.system,
      subject: holder,
      observers
    })
    const observerActorIds = observers.flatMap(({ observer }) =>
      seeing.has(observer.actor.id) ? [observer.actor.id] : []
    )
    if (observerActorIds.length)
      prunes.push({
        holderActorId: holder.actor.id,
        activeEffectId: concealment.effect.id,
        observerActorIds
      })
  }
  return prunes
}
