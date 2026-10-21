import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import {
  convertSceneDistance,
  measureSceneTokenFootprintDistance,
  type SceneGrid,
  type SceneToken
} from '@artificer-toolkit/shared/vtt'
import { encounterActorRelationship } from './encounterActionTargetPolicy.js'

/**
 * Who stands near an attack's target, from the Scene: the distance in feet to the nearest creature
 * hostile to the target and able to act, or `null` when there is none.
 */
export type EnemyProximity = { nearestFeet: number | null }

type PlacedActor = { actorId: string } & Pick<
  SceneToken,
  'position' | 'height' | 'width' | 'rotationDegrees'
>

/**
 * How near an enemy stands to an attack's target on the Scene: the distance in feet from the
 * target's token to the nearest creature hostile to the target that is able to act. The attacker
 * and the target are not "another" creature, so neither counts. Candidates are asked whether they
 * can act nearest first, so only those that could set the answer are loaded.
 */
export async function nearestAbleEnemyProximity(input: {
  grid: SceneGrid
  /** Every actor of the Run, which holds the dispositions the tokens' creatures are judged by. */
  actors: readonly Pick<EncounterRunActorState, 'id' | 'disposition'>[]
  attackerActorId: string
  targetActorId: string
  /** The Scene's tokens bound to the Run's actors, the target's and the attacker's included. */
  tokens: readonly PlacedActor[]
  canAct: (actorId: string) => Promise<boolean>
}): Promise<EnemyProximity> {
  const target = input.actors.find((actor) => actor.id === input.targetActorId)
  const targetToken = input.tokens.find((token) => token.actorId === input.targetActorId)
  if (!target || !targetToken) throw new Error('Encounter action facts are stale.')
  const enemies = input.tokens
    .flatMap((token) => {
      if (token.actorId === input.attackerActorId || token.actorId === input.targetActorId)
        return []
      const actor = input.actors.find((candidate) => candidate.id === token.actorId)
      return actor &&
        encounterActorRelationship(target.disposition, actor.disposition) === 'HOSTILE'
        ? [
            {
              actorId: token.actorId,
              feet: convertSceneDistance(
                measureSceneTokenFootprintDistance(input.grid, targetToken, token),
                input.grid.unit,
                'FEET'
              )
            }
          ]
        : []
    })
    .sort((left, right) => left.feet - right.feet)
  for (const enemy of enemies)
    if (await input.canAct(enemy.actorId)) return { nearestFeet: enemy.feet }
  return { nearestFeet: null }
}
