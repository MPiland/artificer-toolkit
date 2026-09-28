import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { rejectDomain } from './domainRejections.js'
import { readRunActor, readRunState } from './documents.js'
import type { EncounterDocument } from './store.js'
import type { EncounterReadTransaction } from './ports.js'

type ControlledActor = Pick<
  EncounterRunActorState,
  'id' | 'kind' | 'sourceId' | 'controllerUserIds'
>
type ControlInput = {
  campaign: EncounterDocument<'campaigns'>
  membership: EncounterDocument<'campaignMemberships'>
}

/** `GM` for the Campaign owner, `CONTROLLER` for a player who controls the actor. */
export type EncounterActorControl = 'GM' | 'CONTROLLER'

function actorControl(
  membership: EncounterDocument<'campaignMemberships'>,
  assignedCharacterId: string | null,
  actor: ControlledActor
): EncounterActorControl | null {
  if (membership.role === 'OWNER') return 'GM'
  return actor.controllerUserIds.includes(membership.userId) ||
    (actor.kind === 'CHARACTER' && actor.sourceId === assignedCharacterId)
    ? 'CONTROLLER'
    : null
}

async function readAssignedCharacterId(ctx: EncounterReadTransaction, input: ControlInput) {
  return input.membership.role === 'PLAYER'
    ? ((await ctx.ports.readAssignedCharacter(input.campaign, input.membership))?.id ?? null)
    : null
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
  return actorControl(input.membership, await readAssignedCharacterId(ctx, input), input.actor)
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
  const assignedCharacterId = await readAssignedCharacterId(ctx, input)
  return new Set(
    input.actors
      .filter((actor) => actorControl(input.membership, assignedCharacterId, actor) !== null)
      .map((actor) => actor.id)
  )
}

/**
 * The user whose "Auto-roll my dice" preference applies to a roll routed to this actor's
 * controllers: its assigned player, else its first granted controller, else the GM.
 */
export async function readEncounterActorPrimaryController(
  ctx: EncounterReadTransaction,
  campaign: EncounterDocument<'campaigns'>,
  actor: ControlledActor
): Promise<string> {
  const characterId = actor.kind === 'CHARACTER' ? actor.sourceId : null
  if (characterId) {
    const assignment = await ctx.db
      .query('campaignCharacterAssignments')
      .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
      .unique()
    if (assignment?.campaignId === campaign.id) return assignment.userId
  }
  return actor.controllerUserIds[0] ?? campaign.ownerUserId
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
