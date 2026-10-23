import {
  MAX_ACTOR_OWNER_DEPTH,
  actorOwnerChain
} from '@artificer-toolkit/shared/campaign/actorOwnership'
import {
  controlsAssignedCharacter,
  controlsUnboundSceneToken,
  type CharacterControlAssignment
} from '@artificer-toolkit/shared/campaign/characterControl'
import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { readStoredRunActor } from './actorProjectionFacts.js'
import { rejectDomain } from './domainRejections.js'
import { readRunActor, readRunState } from './documents.js'
import type { EncounterDocument } from './store.js'
import type { EncounterReadTransaction } from './ports.js'

type ControlledActor = Pick<
  EncounterRunActorState,
  'id' | 'encounterId' | 'kind' | 'sourceId' | 'controllerUserIds' | 'owner'
>
type ControlInput = {
  campaign: EncounterDocument<'campaigns'>
  membership: EncounterDocument<'campaignMemberships'>
}

/** `GM` for the Campaign owner, `CONTROLLER` for a player who controls the actor. */
type EncounterActorControl = 'GM' | 'CONTROLLER'

/** What a player's control of Character actors rests on besides the Run's own controllers. */
type CharacterControl = {
  assignedCharacterId: string | null
  /** The Campaign assignments of those actors' Characters, with the GM's grants (D162). */
  assignments: readonly CharacterControlAssignment[]
}

type StoredOwner = ReturnType<typeof readStoredRunActor>
/** An actor followed by its owners, nearest first (`actorOwnerChain`). */
type OwnerChain<Actor extends ControlledActor = ControlledActor> = readonly (Actor | StoredOwner)[]

function directlyControls(
  membership: EncounterDocument<'campaignMemberships'>,
  control: CharacterControl,
  actor: ControlledActor
): boolean {
  return (
    actor.controllerUserIds.includes(membership.userId) ||
    (actor.kind === 'CHARACTER' &&
      (actor.sourceId === control.assignedCharacterId ||
        controlsAssignedCharacter(
          control.assignments.find((assignment) => assignment.characterId === actor.sourceId),
          membership.userId
        )))
  )
}

/** Control is derived through the owner chain and never copied onto the owned actor. */
function actorControl(
  membership: EncounterDocument<'campaignMemberships'>,
  control: CharacterControl,
  chain: OwnerChain
): EncounterActorControl | null {
  if (membership.role === 'OWNER') return 'GM'
  return chain.some((actor) => directlyControls(membership, control, actor)) ? 'CONTROLLER' : null
}

/** Reads each actor's owner chain; owners are stored Run actors of the same Encounter. */
async function readOwnerChains<Actor extends ControlledActor>(
  ctx: EncounterReadTransaction,
  actors: readonly Actor[]
): Promise<Map<string, OwnerChain<Actor>>> {
  const known = new Map<string, Actor | StoredOwner>()
  for (const actor of actors) known.set(actor.id, actor)
  const chains = new Map<string, OwnerChain<Actor>>()
  for (const actor of actors) {
    let tail: Actor | StoredOwner = actor
    for (let depth = 0; tail.owner && depth < MAX_ACTOR_OWNER_DEPTH; depth += 1) {
      const ownerActorId: string = tail.owner.ownerActorId
      let next = known.get(ownerActorId)
      if (!next) {
        const row = await ctx.db
          .query('encounterRunActors')
          .withIndex('by_encounterId_id', (q) =>
            q.eq('encounterId', actor.encounterId).eq('id', ownerActorId)
          )
          .unique()
        if (!row) break
        next = readStoredRunActor(row)
        known.set(next.id, next)
      }
      tail = next
    }
    chains.set(
      actor.id,
      actorOwnerChain(actor, (id) => known.get(id))
    )
  }
  return chains
}

/** The member's assigned Character and the Campaign assignments (with grants) of `actors`' Characters. */
async function readCharacterControl(
  ctx: EncounterReadTransaction,
  input: ControlInput & { chains: ReadonlyMap<string, OwnerChain> }
): Promise<CharacterControl> {
  if (input.membership.role !== 'PLAYER') return { assignedCharacterId: null, assignments: [] }
  const characterIds = new Set(
    [...input.chains.values()]
      .flat()
      .flatMap((actor) => (actor.kind === 'CHARACTER' && actor.sourceId ? [actor.sourceId] : []))
  )
  const [assigned, rows] = await Promise.all([
    ctx.ports.readAssignedCharacter(input.campaign, input.membership),
    Promise.all(
      [...characterIds].map((characterId) =>
        ctx.db
          .query('campaignCharacterAssignments')
          .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
          .unique()
      )
    )
  ])
  return {
    assignedCharacterId: assigned?.id ?? null,
    assignments: rows.flatMap((row) => (row?.campaignId === input.campaign.id ? [row] : []))
  }
}

/** The actor followed by its owners, nearest first, for a read that needs their Character grants. */
export async function readActorOwnerChain<Actor extends ControlledActor>(
  ctx: EncounterReadTransaction,
  actor: Actor
): Promise<OwnerChain<Actor>> {
  return (await readOwnerChains(ctx, [actor])).get(actor.id)!
}

/**
 * The one answer to "can this member act for this Run actor" (ADR 0034 decision 1): the Campaign
 * owner always can; a player can when the GM granted them control or the actor is the Character
 * assigned to them in this Campaign.
 */
export async function readEncounterActorControl(
  ctx: EncounterReadTransaction,
  input: ControlInput & { actor: ControlledActor }
): Promise<EncounterActorControl | null> {
  const chains = await readOwnerChains(ctx, [input.actor])
  return actorControl(
    input.membership,
    await readCharacterControl(ctx, { ...input, chains }),
    chains.get(input.actor.id)!
  )
}

/** Refuses a member who does not control the actor with a user-safe domain rejection. */
export async function requireEncounterActorControl(
  ctx: EncounterReadTransaction,
  input: ControlInput & { actor: ControlledActor }
): Promise<EncounterActorControl> {
  return (await readEncounterActorControl(ctx, input)) ?? rejectDomain('NOT_ACTOR_CONTROLLER')
}

/** The actors in `actors` this member may act for, reading the Campaign assignment once. */
export async function readEncounterControlledActorIds(
  ctx: EncounterReadTransaction,
  input: ControlInput & { actors: readonly ControlledActor[] }
): Promise<ReadonlySet<string>> {
  const chains = await readOwnerChains(ctx, input.actors)
  const control = await readCharacterControl(ctx, { ...input, chains })
  return new Set(
    input.actors
      .filter((actor) => actorControl(input.membership, control, chains.get(actor.id)!) !== null)
      .map((actor) => actor.id)
  )
}

/**
 * The user whose "Auto-roll my dice" preference applies to a roll routed to this actor's
 * controllers: its assigned player, else its first granted controller, else its owner's, else the
 * GM.
 */
export async function readEncounterActorPrimaryController(
  ctx: EncounterReadTransaction,
  campaign: EncounterDocument<'campaigns'>,
  actor: ControlledActor
): Promise<string> {
  for (const candidate of (await readOwnerChains(ctx, [actor])).get(actor.id)!) {
    const characterId = candidate.kind === 'CHARACTER' ? candidate.sourceId : null
    if (characterId) {
      const assignment = await ctx.db
        .query('campaignCharacterAssignments')
        .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
        .unique()
      if (assignment?.campaignId === campaign.id) return assignment.userId
    }
    if (candidate.controllerUserIds[0]) return candidate.controllerUserIds[0]
  }
  return campaign.ownerUserId
}

/**
 * Each actor's roller preference for rolls made during one initiator's command (ADR 0034 decision
 * 3, Foundry baseline): a player initiator rolls for actors they control; every other roll goes to
 * the actor's controllers, so its primary controller's "Auto-roll my dice" preference applies. The
 * GM's own command is no exception: a Character's save is its player's roll, and only rolls of
 * actors no player controls stay with the GM. The GM may still answer any prompt.
 */
export async function readEncounterAutoRollByActorId(
  ctx: EncounterReadTransaction,
  input: {
    campaign: EncounterDocument<'campaigns'>
    initiatorUserId: string
    actors: readonly ControlledActor[]
  }
): Promise<Record<string, boolean>> {
  const membership = await ctx.db
    .query('campaignMemberships')
    .withIndex('by_campaignId_userId', (q) =>
      q.eq('campaignId', input.campaign.id).eq('userId', input.initiatorUserId)
    )
    .unique()
  if (membership?.status !== 'ACTIVE') throw new Error('The command initiator left the Campaign.')
  const controlled =
    membership.role === 'PLAYER'
      ? await readEncounterControlledActorIds(ctx, {
          campaign: input.campaign,
          membership,
          actors: input.actors
        })
      : new Set<string>()
  const preferences = new Map<string, Promise<boolean>>()
  const preference = (userId: string) => {
    let read = preferences.get(userId)
    if (!read) {
      read = ctx.ports.readAutoRollDice(userId)
      preferences.set(userId, read)
    }
    return read
  }
  return Object.fromEntries(
    await Promise.all(
      input.actors.map(
        async (actor) =>
          [
            actor.id,
            await preference(
              controlled.has(actor.id)
                ? input.initiatorUserId
                : await readEncounterActorPrimaryController(ctx, input.campaign, actor)
            )
          ] as const
      )
    )
  )
}

/**
 * An Encounter-bound token moves for its bound actor's controllers and the GM; its Scene
 * `controlledByUserIds` does not apply. Unbound tokens keep Scene token control.
 */
export async function requireBoundTokenMoveControl(
  ctx: EncounterReadTransaction,
  input: ControlInput & { encounterId: string; tokenId: string }
): Promise<void> {
  if (input.membership.role === 'OWNER') return
  const [binding, row] = await Promise.all([
    ctx.db
      .query('encounterActorTokenBindings')
      .withIndex('by_encounterId_tokenId', (q) =>
        q.eq('encounterId', input.encounterId).eq('tokenId', input.tokenId)
      )
      .unique(),
    ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', input.encounterId))
      .unique()
  ])
  if (!binding || !row || row.campaignId !== input.campaign.id)
    throw new Error('Members may only move an unlocked token they control.')
  const actor = await readRunActor(ctx, readRunState(row), binding.actorId)
  if (!(await readEncounterActorControl(ctx, { ...input, actor })))
    rejectDomain('NOT_ACTOR_CONTROLLER')
}

/**
 * An unbound token moves for the GM, the players the GM listed on it and the controllers of the
 * Character it represents (assigned player and GM grantees, D162). A locked token never moves.
 */
export async function requireUnboundTokenMoveControl(
  ctx: EncounterReadTransaction,
  input: ControlInput & {
    token: {
      characterId?: string | undefined
      controlledByUserIds: readonly string[]
      locked: boolean
    } | null
  }
): Promise<void> {
  const { token, membership } = input
  if (!token || token.locked)
    throw new Error('Members may only move an unlocked token they control.')
  if (membership.role === 'OWNER') return
  const { characterId } = token
  const assignment = characterId
    ? await ctx.db
        .query('campaignCharacterAssignments')
        .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
        .unique()
    : null
  if (
    !controlsUnboundSceneToken(
      token,
      membership.userId,
      assignment?.campaignId === input.campaign.id ? [assignment] : []
    )
  )
    throw new Error('Members may only move an unlocked token they control.')
}

/** GM-granted controllers must be current players of the Campaign. */
export async function requireEncounterActorControllerCandidates(
  ctx: EncounterReadTransaction,
  campaign: EncounterDocument<'campaigns'>,
  userIds: readonly string[]
): Promise<void> {
  for (const userId of userIds) {
    const membership = await ctx.db
      .query('campaignMemberships')
      .withIndex('by_campaignId_userId', (q) =>
        q.eq('campaignId', campaign.id).eq('userId', userId)
      )
      .unique()
    if (membership?.status !== 'ACTIVE' || membership.role !== 'PLAYER')
      throw new Error('Actor controllers must be current Campaign players.')
  }
}
