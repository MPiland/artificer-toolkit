/** An owner longer than this is a malformed chain; the walk stops there. */
export const MAX_ACTOR_OWNER_DEPTH = 4

type OwnedActor = { id: string; owner?: { ownerActorId: string } | undefined }

/**
 * The actor followed by its owners, nearest first (a summon, pet, companion or minion is owned by
 * the actor that commands it). The walk stops at an owner `find` cannot see, at a repeat and at
 * `MAX_ACTOR_OWNER_DEPTH`, so a malformed chain never loops. The one home of ownership: control,
 * projection and the room's authorization cache all read it, and control is never copied onto the
 * owned actor.
 */
export function actorOwnerChain<Actor extends OwnedActor>(
  actor: Actor,
  find: (actorId: string) => Actor | undefined
): Actor[] {
  const chain = [actor]
  for (
    let owner = actor.owner;
    owner && chain.length <= MAX_ACTOR_OWNER_DEPTH;
    owner = chain[chain.length - 1]!.owner
  ) {
    const next = find(owner.ownerActorId)
    if (!next || chain.some((seen) => seen.id === next.id)) break
    chain.push(next)
  }
  return chain
}

/** Whether `controls` holds for the actor or any actor in its owner chain. */
export function controlsActorOrOwner<Actor extends OwnedActor>(
  actor: Actor,
  find: (actorId: string) => Actor | undefined,
  controls: (candidate: Actor) => boolean
): boolean {
  return actorOwnerChain(actor, find).some(controls)
}
