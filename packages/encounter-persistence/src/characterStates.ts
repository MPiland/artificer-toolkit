import { getVisibleCampaignConditions } from '@artificer-toolkit/rules-runtime/character/campaignConditionVisibility'
import type { CampaignCharacterState } from '@artificer-toolkit/schema/projections/campaignCharacterState'
import type {
  EncounterProjectionCharacterState,
  EncounterProjectionCharacterStates
} from '@artificer-toolkit/schema/projections/encounterProjectionInput'
import {
  encounterRunActorStateSchema,
  type EncounterRunActorState,
  type EncounterRunCharacterActorState,
  type EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { clampCharacterCurrentHitPoints } from '@artificer-toolkit/shared/character'
import { isCharacterDead } from '@artificer-toolkit/schema/shared/characterDeathSaves'
import {
  isEncounterActorDefeated,
  type DeadCharacterIds
} from '@artificer-toolkit/rules-runtime/encounterActorDefeat'
import type { CharacterPlayState } from '@artificer-toolkit/schema/projections/characterPlayState'
import { readCharacterMaximumHitPoints } from './characterMaximumHitPoints.js'
import { readEncounterCharacterPlay } from './characterPlay.js'
import { readRunActors, replaceRunActor } from './documents.js'
import type {
  EncounterPersistenceTransaction,
  EncounterProjectionTransaction,
  EncounterReadPorts
} from './ports.js'
import type { EncounterDocument, EncounterReadContext, EncounterWriteContext } from './store.js'

/**
 * Projects a Character's hit points over its effective maximum, as the Sheet shows them, and its
 * Sheet conditions by type ID; web names them from the System vocabulary.
 */
export function characterProjectionState(
  {
    hitpoints,
    conditions = [],
    consequences = []
  }: Pick<CharacterPlayState, 'hitpoints' | 'conditions' | 'consequences'>,
  maximumHitPoints: number
) {
  return {
    current: clampCharacterCurrentHitPoints(hitpoints.current, maximumHitPoints),
    temporary: Math.max(hitpoints.temp, 0),
    maximum: maximumHitPoints,
    deathSaves: hitpoints.deathSaves,
    dead: isCharacterDead(hitpoints.deathSaves),
    conditions: conditions.map(({ conditionTypeId, notes }) => ({
      conditionTypeId,
      ...(notes ? { notes } : {})
    })),
    consequences: consequences.map(({ id, label }) => ({ id, label }))
  }
}

/**
 * The Character's assignment in the Campaign, or `null` when it has none there. An unfrozen Character
 * actor of a room-held Run without one has departed (D74): the room freezes it, and until then
 * readers treat it as frozen.
 */
async function readCampaignCharacterAssignment(
  ctx: EncounterReadContext,
  campaignId: string,
  characterId: string
) {
  const assignment = await ctx.db
    .query('campaignCharacterAssignments')
    .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
    .unique()
  return assignment?.campaignId === campaignId ? assignment : null
}

/**
 * Whether a Character actor has departed (D74): frozen, or unassigned and not yet frozen by the
 * room. A departed actor no longer reads its Character, so commands refuse it and vision skips it.
 */
export async function isDepartedCharacterActor(
  ctx: EncounterReadContext,
  campaignId: string,
  actor: Pick<EncounterRunCharacterActorState, 'sourceId' | 'frozenState'>
): Promise<boolean> {
  if (actor.frozenState) return true
  return !(await readCampaignCharacterAssignment(ctx, campaignId, actor.sourceId))
}

/**
 * Reads each Character actor's current hit points and conditions for a Run projection (ADR 0034
 * decision 4). A completed Run, and an open Run whose Character left the Campaign, show the values
 * frozen when the Run stopped reading it: a detached Character grants no current Sheet access.
 * `campaignConditions` layers the Campaign's own conditions, as the viewer may see them, over each
 * live Character's Sheet conditions. A room-held Run's actor whose assignment is gone and which the
 * room has not yet frozen reads as frozen at the Character's current play values; a deleted
 * Character has no entry (D74).
 */
export async function readEncounterCharacterStates(
  ctx: EncounterProjectionTransaction,
  state: Pick<EncounterRunState, 'campaignId' | 'gameSystemId' | 'status'>,
  actors: readonly (
    | Pick<EncounterRunCharacterActorState, 'kind' | 'sourceId' | 'frozenState'>
    | { kind: 'CREATURE' | 'CUSTOM' }
  )[],
  campaignConditions?: {
    viewer: 'CAMPAIGN_OWNER' | 'CHARACTER_OWNER'
    read(characterId: string): Promise<CampaignCharacterState['conditions']>
  }
): Promise<EncounterProjectionCharacterStates> {
  const states = new Map<string, EncounterProjectionCharacterState>()
  for (const actor of actors) {
    if (actor.kind !== 'CHARACTER') continue
    const characterId = actor.sourceId
    // A frozen actor stays frozen: reassigning its Character does not resume the Run reading it.
    if (actor.frozenState) {
      states.set(characterId, {
        current: actor.frozenState.currentHitPoints,
        temporary: actor.frozenState.tempHitPoints,
        maximum: actor.frozenState.maxHitPoints,
        conditions: actor.frozenState.conditions,
        consequences: [],
        deathSaves: actor.frozenState.deathSaves,
        dead: isCharacterDead(actor.frozenState.deathSaves)
      })
      continue
    }
    const assignment =
      state.status === 'COMPLETED'
        ? null
        : await readCampaignCharacterAssignment(ctx, state.campaignId, characterId)
    const play = await readEncounterCharacterPlay(ctx, characterId)
    if (!assignment) {
      // D74: Convex leaves a room-held Run's departed actors to the room, which freezes them at
      // their current play values, or removes them once the Character is deleted. Until its next
      // checkpoint the read shows what the room converges to, and no Character state for a deleted
      // Character, whose actor the projection leaves out.
      if (state.status === 'COMPLETED' || !(await ctx.ports.isRoomHeldRun(state)))
        throw new Error('Encounter Character state is unavailable.')
      if (play) states.set(characterId, await readCharacterPlayProjection(ctx, play))
      continue
    }
    if (!play || play.userId !== assignment.userId)
      throw new Error('Stored Encounter Character source is unavailable.')
    states.set(
      characterId,
      await readCharacterPlayProjection(
        ctx,
        play,
        campaignConditions
          ? getVisibleCampaignConditions({
              conditions: await campaignConditions.read(characterId),
              viewer: campaignConditions.viewer
            })
          : []
      )
    )
  }
  return states
}

/**
 * The Characters among `actors` that are dead (D96), read live from their play records: the Run keeps
 * no copy (ADR 0034). A frozen actor no longer reads its Character, and a deleted Character is not dead.
 */
export async function readDeadCharacterIds(
  ctx: EncounterReadContext & { readonly ports: Pick<EncounterReadPorts, 'readCharacterPlay'> },
  actors: readonly (
    | Pick<EncounterRunCharacterActorState, 'kind' | 'sourceId' | 'frozenState'>
    | { kind: 'CREATURE' | 'CUSTOM' }
  )[]
): Promise<DeadCharacterIds> {
  const dead = new Set<string>()
  for (const actor of actors) {
    if (actor.kind !== 'CHARACTER' || actor.frozenState) continue
    const play = await readEncounterCharacterPlay(ctx, actor.sourceId)
    if (play && isCharacterDead(ctx.ports.readCharacterPlay(play).hitpoints.deathSaves))
      dead.add(actor.sourceId)
  }
  return dead
}

/** Whether the actor is defeated (D63, D96): a Creature's flag, or a Character's live death. */
export async function readEncounterActorDefeated(
  ctx: Parameters<typeof readDeadCharacterIds>[0],
  actor: EncounterRunActorState
): Promise<boolean> {
  return isEncounterActorDefeated(actor, await readDeadCharacterIds(ctx, [actor]))
}

/**
 * The ids of the actors at 0 hit points, whether defeated or not (a dying Character is at 0): a
 * Creature's or custom actor's own pool, a Character's play record, or its frozen values. A Character
 * whose play record is gone is not at 0.
 */
export async function readZeroHitPointActorIds(
  ctx: Parameters<typeof readDeadCharacterIds>[0],
  actors: readonly EncounterRunActorState[]
): Promise<Set<string>> {
  const zero = new Set<string>()
  for (const actor of actors) {
    if (actor.kind !== 'CHARACTER') {
      if (actor.currentHitPoints === 0) zero.add(actor.id)
      continue
    }
    if (actor.frozenState) {
      if (actor.frozenState.currentHitPoints === 0) zero.add(actor.id)
      continue
    }
    const play = await readEncounterCharacterPlay(ctx, actor.sourceId)
    if (play && ctx.ports.readCharacterPlay(play).hitpoints.current === 0) zero.add(actor.id)
  }
  return zero
}

/** A Character's current projected values, read from its play record alone. */
export async function readCharacterPlayProjection(
  ctx: EncounterProjectionTransaction,
  play: EncounterDocument<'characterPlayStates'>,
  campaignConditions: Array<{ conditionTypeId: string; notes?: string }> = []
) {
  const sheet = ctx.ports.readCharacterPlay(play)
  return characterProjectionState(
    { ...sheet, conditions: [...(sheet.conditions ?? []), ...campaignConditions] },
    await readCharacterMaximumHitPoints(ctx, play)
  )
}

/**
 * Freezes Character actors' current projected values into the actors, for an open Run that stops
 * reading those Characters: every Character when the Run completes, or `characterId` alone when it
 * leaves the Campaign. The Run version is unchanged: the projection shows the same values before
 * and after.
 */
export async function freezeEncounterCharacterStates(
  ctx: EncounterPersistenceTransaction,
  state: EncounterRunState,
  characterId?: string
): Promise<void> {
  const targets = (await readRunActors(ctx, state)).flatMap((actor) =>
    actor.kind === 'CHARACTER' && (characterId === undefined || actor.sourceId === characterId)
      ? [actor]
      : []
  )
  const current = await readEncounterCharacterStates(ctx, state, targets)
  for (const actor of targets)
    await freezeEncounterCharacterActor(ctx, actor, current.get(actor.sourceId)!)
}

/** Writes the Character actor's frozen values; an actor already holding them is left untouched. */
export async function freezeEncounterCharacterActor(
  ctx: EncounterWriteContext,
  actor: EncounterRunCharacterActorState,
  values: Omit<EncounterProjectionCharacterState, 'dead'>
): Promise<void> {
  const frozen = encounterRunActorStateSchema.parse({
    ...actor,
    frozenState: {
      currentHitPoints: values.current,
      maxHitPoints: values.maximum,
      tempHitPoints: values.temporary,
      conditions: values.conditions,
      deathSaves: values.deathSaves
    }
  })
  if (checksumCanonicalJson(frozen) !== checksumCanonicalJson(actor))
    await replaceRunActor(ctx, actor, frozen)
}
