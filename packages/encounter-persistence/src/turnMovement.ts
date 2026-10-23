import {
  MAX_ENCOUNTER_ACTORS,
  type EncounterSessionStateDto
} from '@artificer-toolkit/schema/api/encounterData'
import { MAX_TURN_TELEPORT_ALLOWANCES } from '@artificer-toolkit/schema/shared/teleportAllowance'
import {
  encounterStoredTurnMovementSchema,
  type EncounterTeleportAllowance,
  type EncounterTurnLastMove
} from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { readEncounterActorConditionState } from '@artificer-toolkit/rules-runtime/encounterCharacterMechanicsBatch'
import {
  activeEncounterConditionMechanics,
  encounterConditionFleeSources,
  encounterConditionLevels,
  encounterConditionSpeed,
  pinEncounterConditionDefinitions
} from '@artificer-toolkit/rules-runtime/encounterConditionMechanics'
import { snapshotStatBlock } from '@artificer-toolkit/rules-runtime/encounterProjection'
import { withActiveGrantSpeeds } from '@artificer-toolkit/rules-runtime/encounterActiveGrants'
import { turnEffectOwner } from '@artificer-toolkit/rules-runtime/encounterTurnEffectState'
import { resolveSpeedsFeet } from '@artificer-toolkit/rules-runtime/walkingSpeed'
import { readEncounterCharacterPlay } from './characterPlay.js'
import { isDepartedCharacterActor } from './characterStates.js'
import { readEncounterControlledActorIds } from './actorController.js'
import { rejectDomain } from './domainRejections.js'
import { readRunActors, readRunState } from './documents.js'
import { listActiveRuleEffects } from './effectStore.js'
import type { EncounterDocument, EncounterReadContext, EncounterWriteContext } from './store.js'
import type { EncounterReadTransaction } from './ports.js'

type RunTurnState = Pick<EncounterRunState, 'id' | 'status' | 'round' | 'currentActorId'>

/** The turn now running: the Run's round and current actor, or null between turns. */
function currentTurn(state: RunTurnState) {
  return state.status === 'ACTIVE' && state.currentActorId !== null
    ? { encounterId: state.id, round: state.round, turnActorId: state.currentActorId }
    : null
}

type CurrentTurn = NonNullable<ReturnType<typeof currentTurn>>

/** An actor's record for the given turn, if it has one. */
function readTurnRow(ctx: EncounterReadContext, turn: CurrentTurn, actorId: string) {
  return ctx.db
    .query('encounterTurnMovements')
    .withIndex('by_encounterId_round_turnActorId_actorId', (q) =>
      q
        .eq('encounterId', turn.encounterId)
        .eq('round', turn.round)
        .eq('turnActorId', turn.turnActorId)
        .eq('actorId', actorId)
    )
    .unique()
}

/** The command that began the turn of `actorId` in `round` and ran its start-of-turn effects, if any. */
export async function readTurnStartedBy(
  ctx: EncounterReadContext,
  input: { encounterId: string; round: number; actorId: string }
): Promise<string | null> {
  const row = await readTurnRow(
    ctx,
    { encounterId: input.encounterId, round: input.round, turnActorId: input.actorId },
    input.actorId
  )
  return row?.startedByCommandId ?? null
}

/**
 * Records that `commandId` began the turn the Run now holds. A turn that was already begun keeps
 * its first command, so returning to it never runs its start-of-turn effects again.
 */
export async function markTurnStarted(
  ctx: EncounterWriteContext,
  input: { state: RunTurnState; commandId: string }
) {
  const turn = currentTurn(input.state)
  if (!turn) throw new Error('A turn start needs a current turn.')
  const row = await readTurnRow(ctx, turn, turn.turnActorId)
  if (!row)
    await ctx.db.insert(
      'encounterTurnMovements',
      encounterStoredTurnMovementSchema.parse({
        ...turn,
        actorId: turn.turnActorId,
        usedFeet: 0,
        speedId: null,
        speedBonuses: 0,
        startedByCommandId: input.commandId
      })
    )
  else if (row.startedByCommandId === null)
    await ctx.db.patch(row._id, { startedByCommandId: input.commandId })
}

/** Adds to an actor's record for the current turn, creating it at zero (D38). */
async function addTurnMovement(
  ctx: EncounterWriteContext,
  input: {
    state: RunTurnState
    actorId: string
    usedFeet: number
    speedId: string | null
    speedBonuses: number
  }
) {
  const turn = currentTurn(input.state)
  if (!turn) throw new Error('Turn movement needs a current turn.')
  const row = await readTurnRow(ctx, turn, input.actorId)
  if (row)
    await ctx.db.patch(row._id, {
      usedFeet: row.usedFeet + input.usedFeet,
      speedId: input.speedId ?? row.speedId,
      speedBonuses: row.speedBonuses + input.speedBonuses
    })
  else
    await ctx.db.insert(
      'encounterTurnMovements',
      encounterStoredTurnMovementSchema.parse({
        ...turn,
        actorId: input.actorId,
        usedFeet: input.usedFeet,
        speedId: input.speedId,
        speedBonuses: input.speedBonuses
      })
    )
}

/**
 * Adds an actor's voluntary movement to its record for the current turn (D38). It never writes the
 * Run, so it bumps no version and adds no contention to Encounter commands. The speed type it names
 * (null when none) becomes the actor's latest this turn.
 */
export async function recordTurnMovement(
  ctx: EncounterWriteContext,
  input: { state: RunTurnState; actorId: string; feet: number; speedId: string | null }
) {
  if (!currentTurn(input.state) || input.feet <= 0) return
  await addTurnMovement(ctx, {
    state: input.state,
    actorId: input.actorId,
    usedFeet: input.feet,
    speedId: input.speedId,
    speedBonuses: 0
  })
}

/**
 * Replaces an actor's latest voluntary move this turn with the one just made (D164); the record
 * was created by the move's own `recordTurnMovement`.
 */
export async function recordTurnLastMove(
  ctx: EncounterWriteContext,
  input: { state: RunTurnState; actorId: string; lastMove: EncounterTurnLastMove }
) {
  const turn = currentTurn(input.state)
  const row = turn ? await readTurnRow(ctx, turn, input.actorId) : null
  if (row) await ctx.db.patch(row._id, { lastMove: input.lastMove })
}

/** Forgets an actor's latest voluntary move this turn: it was moved some other way since (D164). */
export async function clearTurnLastMove(
  ctx: EncounterWriteContext,
  input: { state: RunTurnState; actorId: string }
) {
  const turn = currentTurn(input.state)
  const row = turn ? await readTurnRow(ctx, turn, input.actorId) : null
  if (row?.lastMove) await ctx.db.patch(row._id, { lastMove: null })
}

/** The actor's latest voluntary move this turn; null off its turn, before moving or once displaced. */
export async function readTurnLastMove(
  ctx: EncounterReadContext,
  input: { state: RunTurnState; actorId: string }
): Promise<EncounterTurnLastMove | null> {
  const turn = currentTurn(input.state)
  const row = turn ? await readTurnRow(ctx, turn, input.actorId) : null
  return row?.lastMove ?? null
}

/** Records a basic action that added the actor's speed to its budget this turn (Dash, D38). */
export async function recordTurnSpeedBonus(
  ctx: EncounterWriteContext,
  input: { state: RunTurnState; actorId: string }
) {
  await addTurnMovement(ctx, { ...input, usedFeet: 0, speedId: null, speedBonuses: 1 })
}

/** Takes back one recorded speed bonus from an actor's turn record (the GM's undo of a Dash). */
export async function removeTurnSpeedBonus(
  ctx: EncounterWriteContext,
  input: { encounterId: string; round: number; turnActorId: string; actorId: string }
) {
  const row = await readTurnRow(ctx, input, input.actorId)
  if (!row || row.speedBonuses < 1) throw new Error('The turn speed bonus record is unavailable.')
  await ctx.db.patch(row._id, { speedBonuses: row.speedBonuses - 1 })
}

/** The teleport allowances an actor's casts granted in the current turn; none between turns. */
export async function readTurnTeleportAllowances(
  ctx: EncounterReadContext,
  input: { state: RunTurnState; actorId: string }
): Promise<EncounterTeleportAllowance[]> {
  const turn = currentTurn(input.state)
  const row = turn ? await readTurnRow(ctx, turn, input.actorId) : null
  return row?.teleportAllowances ?? []
}

/**
 * Records the one-shot teleport a cast granted (Misty Step, SPELLS-28.2) on the actor's record for
 * the current turn. Returns the turn it was recorded in for the command record's undo, or null
 * between turns.
 */
export async function recordTurnTeleportAllowance(
  ctx: EncounterWriteContext,
  input: {
    state: RunTurnState
    actorId: string
    castCommandId: string
    maxFeet: number
    destinationKind: EncounterTeleportAllowance['destinationKind']
  }
) {
  const turn = currentTurn(input.state)
  if (!turn) return null
  const allowance: EncounterTeleportAllowance = {
    castCommandId: input.castCommandId,
    maxFeet: input.maxFeet,
    destinationKind: input.destinationKind,
    consumedByCommandId: null
  }
  const row = await readTurnRow(ctx, turn, input.actorId)
  if (row) {
    // A full list gives up its oldest spent entry; four unspent teleports are more than a turn can hold.
    const oldestSpent =
      row.teleportAllowances.length < MAX_TURN_TELEPORT_ALLOWANCES
        ? -1
        : row.teleportAllowances.findIndex((entry) => entry.consumedByCommandId !== null)
    const kept = row.teleportAllowances.filter((_, index) => index !== oldestSpent)
    if (kept.length >= MAX_TURN_TELEPORT_ALLOWANCES)
      rejectDomain('TELEPORT_UNAVAILABLE', 'This turn already holds the most teleports it can.')
    await ctx.db.patch(row._id, { teleportAllowances: [...kept, allowance] })
  } else
    await ctx.db.insert(
      'encounterTurnMovements',
      encounterStoredTurnMovementSchema.parse({
        ...turn,
        actorId: input.actorId,
        usedFeet: 0,
        speedId: null,
        speedBonuses: 0,
        teleportAllowances: [allowance]
      })
    )
  return { round: turn.round, turnActorId: turn.turnActorId }
}

/**
 * Spends a teleport allowance for the move `commandId`. A named cast must still hold an unspent
 * allowance, or the plan read a stale record and the commit fails. With no cast named (a GM move)
 * it spends any unspent allowance, or none. Returns the cast spent, or null when none was.
 */
export async function consumeTurnTeleportAllowance(
  ctx: EncounterWriteContext,
  input: {
    state: RunTurnState
    actorId: string
    castCommandId: string | null
    commandId: string
  }
) {
  const turn = currentTurn(input.state)
  const row = turn ? await readTurnRow(ctx, turn, input.actorId) : null
  const allowance = row?.teleportAllowances.find(
    (candidate) =>
      candidate.consumedByCommandId === null &&
      (input.castCommandId === null || candidate.castCommandId === input.castCommandId)
  )
  if (!row || !allowance) {
    if (input.castCommandId !== null) throw new Error('The teleport allowance is unavailable.')
    return null
  }
  await ctx.db.patch(row._id, {
    teleportAllowances: row.teleportAllowances.map((candidate) =>
      candidate === allowance ? { ...candidate, consumedByCommandId: input.commandId } : candidate
    )
  })
  return { castCommandId: allowance.castCommandId }
}

/**
 * Gives back the allowance the move `commandId` spent (the GM's undo of that move). The allowance
 * expires with the turn, so only the current turn's records are searched.
 */
export async function restoreTurnTeleportAllowance(
  ctx: EncounterWriteContext,
  input: { state: RunTurnState; commandId: string }
) {
  const turn = currentTurn(input.state)
  if (!turn) return
  const rows = await ctx.db
    .query('encounterTurnMovements')
    .withIndex('by_encounterId_round_turnActorId_actorId', (q) =>
      q
        .eq('encounterId', turn.encounterId)
        .eq('round', turn.round)
        .eq('turnActorId', turn.turnActorId)
    )
    .take(MAX_ENCOUNTER_ACTORS)
  const row = rows.find((candidate) =>
    candidate.teleportAllowances.some((entry) => entry.consumedByCommandId === input.commandId)
  )
  if (!row) return
  await ctx.db.patch(row._id, {
    teleportAllowances: row.teleportAllowances.map((entry) =>
      entry.consumedByCommandId === input.commandId
        ? { ...entry, consumedByCommandId: null }
        : entry
    )
  })
}

/** Takes back an unspent teleport allowance (the undo of its cast); refused once a move spent it. */
export async function removeTurnTeleportAllowance(
  ctx: EncounterWriteContext,
  input: {
    encounterId: string
    round: number
    turnActorId: string
    actorId: string
    castCommandId: string
  }
) {
  const row = await readTurnRow(ctx, input, input.actorId)
  const allowance = row?.teleportAllowances.find(
    (candidate) => candidate.castCommandId === input.castCommandId
  )
  if (!row || !allowance || allowance.consumedByCommandId !== null)
    rejectDomain(
      'REVERT_UNAVAILABLE',
      'The teleport this cast granted is unavailable; undo the move first.'
    )
  await ctx.db.patch(row._id, {
    teleportAllowances: row.teleportAllowances.filter((candidate) => candidate !== allowance)
  })
}

/** The feet an actor has moved in the current turn; 0 off its turn or before moving. */
export async function readTurnMovedFeet(
  ctx: EncounterReadContext,
  input: { state: RunTurnState; actorId: string }
): Promise<number> {
  const turn = currentTurn(input.state)
  const row = turn ? await readTurnRow(ctx, turn, input.actorId) : null
  return row?.usedFeet ?? 0
}

/** The once-per-turn usage keys an actor has spent in the current turn (D119); none between turns. */
export async function readTurnUses(
  ctx: EncounterReadContext,
  input: { state: RunTurnState; actorId: string }
): Promise<string[]> {
  const turn = currentTurn(input.state)
  const row = turn ? await readTurnRow(ctx, turn, input.actorId) : null
  return [...(row?.usedOncePerTurn ?? [])].sort()
}

/**
 * Spends once-per-turn usage keys from an actor's record for the current turn (D119). A key the
 * record already holds means the plan read a stale record, so the commit fails. Returns the turn
 * the keys were spent in for the command record's undo, or null when nothing was spent.
 */
export async function spendTurnUses(
  ctx: EncounterWriteContext,
  input: { state: RunTurnState; actorId: string; keys: readonly string[] }
) {
  const turn = currentTurn(input.state)
  if (!turn || input.keys.length === 0) return null
  const row = await readTurnRow(ctx, turn, input.actorId)
  const spent = row?.usedOncePerTurn ?? []
  if (input.keys.some((key) => spent.includes(key)))
    throw new Error('A once-per-turn use was already spent this turn.')
  const usedOncePerTurn = [...spent, ...input.keys].sort()
  if (row) await ctx.db.patch(row._id, { usedOncePerTurn })
  else
    await ctx.db.insert(
      'encounterTurnMovements',
      encounterStoredTurnMovementSchema.parse({
        ...turn,
        actorId: input.actorId,
        usedFeet: 0,
        speedId: null,
        speedBonuses: 0,
        usedOncePerTurn
      })
    )
  return { round: turn.round, turnActorId: turn.turnActorId, keys: [...input.keys] }
}

/** Gives back the once-per-turn uses an action spent (the GM's undo of it). */
export async function restoreTurnUses(
  ctx: EncounterWriteContext,
  input: {
    encounterId: string
    round: number
    turnActorId: string
    actorId: string
    keys: readonly string[]
  }
) {
  const row = await readTurnRow(ctx, input, input.actorId)
  if (!row || input.keys.some((key) => !row.usedOncePerTurn.includes(key)))
    throw new Error('The once-per-turn record is unavailable.')
  await ctx.db.patch(row._id, {
    usedOncePerTurn: row.usedOncePerTurn.filter((key) => !input.keys.includes(key))
  })
}
/** Each actor's record for the current turn; an actor without one has moved none and has no bonus. */
async function readTurnMovementByActorId(
  ctx: EncounterReadTransaction,
  state: RunTurnState
): Promise<
  ReadonlyMap<
    string,
    {
      usedFeet: number
      speedId: string | null
      speedBonuses: number
      teleportAllowances: readonly EncounterTeleportAllowance[]
    }
  >
> {
  const turn = currentTurn(state)
  if (!turn) return new Map()
  const rows = await ctx.db
    .query('encounterTurnMovements')
    .withIndex('by_encounterId_round_turnActorId_actorId', (q) =>
      q
        .eq('encounterId', turn.encounterId)
        .eq('round', turn.round)
        .eq('turnActorId', turn.turnActorId)
    )
    .take(MAX_ENCOUNTER_ACTORS)
  return new Map(rows.map((row) => [row.actorId, row]))
}

/**
 * The tabletop's movement readout (V07.5, SPELLS-5.6): feet spent this turn, the speed type of the
 * latest move and an allowance per speed type for each actor the member controls, which for the GM
 * is every actor. Characters read the typed speeds their row stores; creatures read their stat
 * block's; custom actors have no allowances. The actor's active speed grants apply next (Longstrider;
 * a Character's "your speed is X" grant replaces its stored speed, after its features; Fly adds a
 * flying speed), then its conditions scale each speed (D94), and each speed bonus this turn (Dash)
 * adds the scaled speed once more.
 */
export async function readTurnMovementView(
  ctx: EncounterReadTransaction,
  input: {
    row: EncounterDocument<'encounterRuns'>
    campaign: EncounterDocument<'campaigns'>
    membership: EncounterDocument<'campaignMemberships'>
  }
): Promise<EncounterSessionStateDto['turnMovement']> {
  const state = readRunState(input.row)
  if (!currentTurn(state)) return []
  const runActors = await readRunActors(ctx, state)
  const controlled = await readEncounterControlledActorIds(ctx, { ...input, actors: runActors })
  const actors = runActors.filter((actor) => controlled.has(actor.id))
  const records = await readTurnMovementByActorId(ctx, state)
  const system = actors.some((actor) => actor.kind !== 'CUSTOM')
    ? await ctx.ports.requireSystem(input.campaign.gameSystemId)
    : null
  const speedDefinitions = system?.speeds ?? []
  const withGrants = async (actor: (typeof actors)[number], actorSpeeds: readonly unknown[]) =>
    resolveSpeedsFeet(
      withActiveGrantSpeeds(
        actorSpeeds,
        await listActiveRuleEffects(ctx, turnEffectOwner(actor, state.id))
      ),
      speedDefinitions
    )
  const { gameSystemId, ownerUserId } = input.campaign
  const definitions = {
    requireCurrent: async (definitionId: string) => {
      const current = await ctx.ports.readCurrentDefinition(definitionId, ownerUserId)
      if (!current) throw new Error('Encounter condition definition is unavailable.')
      return current
    }
  }
  const readSpeedsAndConditions = async (actor: (typeof actors)[number]) => {
    if (actor.kind === 'CHARACTER') {
      const play = await readEncounterCharacterPlay(ctx, actor.sourceId)
      if (!play) return null
      const sheet = ctx.ports.readCharacterPlay(play)
      const campaignConditions = (await isDepartedCharacterActor(ctx, state.campaignId, actor))
        ? []
        : await ctx.ports.readCampaignCharacterConditions(input.campaign, actor.sourceId)
      const conditionIds = [...(sheet.conditions ?? []), ...campaignConditions].map(
        (condition) => condition.conditionTypeId
      )
      return {
        speeds: await withGrants(actor, play.speeds),
        conditionIds,
        conditionLevels: encounterConditionLevels({
          conditionIds,
          conditionRows: [],
          exhaustionLevel: sheet.exhaustion?.level ?? 0,
          gameSystemId
        })
      }
    }
    if (actor.kind !== 'CREATURE') return null
    const conditions = readEncounterActorConditionState(actor.conditions ?? [])
    return {
      speeds: await withGrants(actor, snapshotStatBlock(actor)?.speeds ?? []),
      conditionIds: conditions.ids,
      conditionLevels: encounterConditionLevels({
        conditionIds: conditions.ids,
        conditionRows: conditions.values,
        exhaustionLevel: 0,
        gameSystemId
      })
    }
  }
  return Promise.all(
    actors.map(async (actor) => {
      const record = records.get(actor.id)
      const known = await readSpeedsAndConditions(actor)
      const mechanics =
        known === null
          ? []
          : activeEncounterConditionMechanics({
              conditionDefinitions: await pinEncounterConditionDefinitions({
                conditionLevels: known.conditionLevels,
                gameSystemId,
                definitions
              }),
              conditionLevels: known.conditionLevels
            })
      return {
        actorId: actor.id,
        used: record?.usedFeet ?? 0,
        speedId: record?.speedId ?? null,
        allowances: (known?.speeds ?? []).flatMap(({ speedId, feet }) => {
          const definition = speedDefinitions.find(({ id }) => id === speedId)
          return definition
            ? [
                {
                  speedId,
                  code: definition.code,
                  isDefault: speedId === system?.defaults?.movementTypeId,
                  label: definition.label,
                  budget:
                    encounterConditionSpeed({ mechanics, speed: feet }) *
                    (1 + (record?.speedBonuses ?? 0))
                }
              ]
            : []
        }),
        teleport: (record?.teleportAllowances ?? [])
          .filter(({ consumedByCommandId }) => consumedByCommandId === null)
          .map(({ castCommandId, maxFeet, destinationKind }) => ({
            castCommandId,
            maxFeet,
            destinationKind
          })),
        fleeSourceActorIds: known
          ? encounterConditionFleeSources({
              state: { conditions: known.conditionIds },
              activeEffects: await listActiveRuleEffects(ctx, turnEffectOwner(actor, state.id))
            })
          : []
      }
    })
  )
}
