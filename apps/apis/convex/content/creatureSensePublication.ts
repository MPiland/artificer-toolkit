import type { CreatureAuthoredDto } from '@artificer-toolkit/schema/subjects/creature'
import type { QueryCtx } from '../_generated/server'
import { readDefinitionRoot } from './definitionStore'
import { requireSystem } from './systemDocuments'

/**
 * Refuses a Creature sense the room could not run: one that does not name a published sense
 * definition the author can read, one of another System, or one the Creature's System does not
 * list. Range bounds and repeated senses are enforced by the publication schema; only the
 * definition and System lookups need the store.
 */
export async function assertCreatureSensesDefined(
  ctx: QueryCtx,
  creature: Pick<CreatureAuthoredDto, 'senses' | 'systemId'>,
  userId: string
) {
  if (!creature.senses?.length) return
  const vocabulary = new Set(
    (await requireSystem(ctx, creature.systemId)).senses.map(({ id }) => id)
  )
  for (const { senseDefinitionId } of creature.senses) {
    const root = await readDefinitionRoot(ctx, senseDefinitionId, userId)
    if (!root?.current || root.definitionFamilyKey !== 'sense')
      throw new Error('Every Creature sense must reference a published sense definition.')
    if (root.gameSystemId !== creature.systemId)
      throw new Error("A Creature sense must reference a sense definition of the Creature's System.")
    if (!vocabulary.has(senseDefinitionId))
      throw new Error("A Creature sense must be one of its System's senses.")
  }
}
