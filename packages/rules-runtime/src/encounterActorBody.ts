import {
  summonBodyDtoSchema,
  type SummonStatBlockDto
} from '@artificer-toolkit/schema/effects/manifest'
import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { z } from 'zod'

type SummonBody = z.infer<typeof summonBodyDtoSchema>

/**
 * The body a stat block gives the creature it conjures: damageable unless authored otherwise, and
 * filling its space only when the stat block says it does (the placement check reads the same).
 */
export function summonBody(
  statBlock: Pick<SummonStatBlockDto, 'damageabilityKind' | 'occupiesSpace'>,
  cannotAttack = false
): SummonBody {
  return {
    damageabilityKind: statBlock.damageabilityKind ?? 'NORMAL',
    occupiesSpace: statBlock.occupiesSpace === true,
    ...(cannotAttack ? { cannotAttack: true as const } : {})
  }
}

/** Every actor no stat block conjured: a Character or Creature takes damage and fills its space. */
const DEFAULT_BODY: SummonBody = { damageabilityKind: 'NORMAL', occupiesSpace: true }

function storedBody({ snapshot }: { snapshot: unknown }): SummonBody {
  return typeof snapshot === 'object' && snapshot !== null && 'body' in snapshot
    ? summonBodyDtoSchema.parse(snapshot.body)
    : DEFAULT_BODY
}

/**
 * The body rules a Run actor plays by, from the `body` its snapshot keeps (`buildEncounterSummon`).
 * The one reader of them: the damage settlement fold, movement passage and the overlap checks
 * read this, never the snapshot. System-neutral; SPECIAL damage is the GM's to adjudicate.
 */
export function encounterActorBody(actor: { snapshot: unknown }): {
  invulnerable: boolean
  occupiesSpace: boolean
} {
  const stored = storedBody(actor)
  return {
    invulnerable: stored.damageabilityKind === 'INVULNERABLE',
    occupiesSpace: stored.occupiesSpace
  }
}

/**
 * Whether the actor's summon says it makes no attack of its own. Reaction discovery and the
 * opportunity-attack facts leave its attacks out on this; a delegated attack is its owner's.
 */
export function encounterActorCannotAttack(actor: { snapshot: unknown }): boolean {
  return storedBody(actor).cannotAttack === true
}

/**
 * Whether a Scene token fills its space, by the body of the Run actor it binds; a token bound to
 * no actor does. Every check of an end position against other tokens asks this.
 */
export function encounterTokenOccupiesSpace(
  actors: readonly Pick<EncounterRunActorState, 'id' | 'snapshot'>[],
  actorIdByTokenId: ReadonlyMap<string, string>
): (tokenId: string) => boolean {
  return (tokenId) => {
    const actor = actors.find((entry) => entry.id === actorIdByTokenId.get(tokenId))
    return !actor || encounterActorBody(actor).occupiesSpace
  }
}
