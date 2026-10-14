import type { CreatureAuthoredDto } from '@artificer-toolkit/schema/subjects/creature'
import type { QueryCtx } from '../_generated/server'
import { readDefinitionRoot } from './definitionStore'

/**
 * Refuses a Creature sense the room could not run because its definition is not a published sense
 * definition the author can read. Node-map normalization has already dropped any sense outside the
 * Creature's System vocabulary, range bounds and repeated senses are enforced by the publication
 * schema; only the definition lookup needs the store.
 */
export async function assertCreatureSensesDefined(
  ctx: QueryCtx,
  creature: Pick<CreatureAuthoredDto, 'senses'>,
  userId: string
) {
  for (const { senseDefinitionId } of creature.senses ?? []) {
    const root = await readDefinitionRoot(ctx, senseDefinitionId, userId)
    if (!root?.current || root.definitionFamilyKey !== 'sense')
      throw new Error('Every Creature sense must reference a published sense definition.')
  }
}
