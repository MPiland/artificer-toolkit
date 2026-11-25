import { resumeCharacterForm } from '@artificer-toolkit/rules-runtime/encounterActorForm'
import { encounterCharacterReplacedInputSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import {
  encounterRunActorStateSchema,
  type EncounterRunActorState,
  type EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { cleanupRemovedActorEffects } from './actorRemovalEffects.js'
import { endCharacterRunEffects } from './characterRunEffects.js'
import { readRunActors, replaceRunActor } from './documents.js'
import { createActiveRuleEffectStore } from './effectStore.js'
import type { EncounterCharacterWriteTransaction } from './ports.js'
import { appendSystemRunEntry } from './systemRunEntries.js'

/** An actor of a benched Character in one open Run, and its owner's Active Character it becomes. */
export type RunCharacterSwap = { actorId: string; characterId: string; userId: string }

/**
 * D236: each unfrozen actor of a benched Character in one open Run, while its owner's Active
 * Character stands in no actor of that Run. A player's first such actor in the Run is the one swapped.
 */
export function selectRunCharacterSwaps(
  actors: readonly EncounterRunActorState[],
  assignments: readonly { userId: string; characterId: string; active: boolean }[]
): RunCharacterSwap[] {
  const activeByUser = new Map(
    assignments
      .filter(({ active }) => active)
      .map(({ userId, characterId }) => [userId, characterId])
  )
  const benchedOwner = new Map(
    assignments
      .filter(({ active }) => !active)
      .map(({ userId, characterId }) => [characterId, userId])
  )
  const present = new Set(
    actors.flatMap((actor) => (actor.kind === 'CHARACTER' ? [actor.sourceId] : []))
  )
  const swapped = new Set<string>()
  const swaps: RunCharacterSwap[] = []
  for (const actor of actors) {
    if (actor.kind !== 'CHARACTER' || actor.frozenState) continue
    const userId = benchedOwner.get(actor.sourceId)
    const characterId = userId && activeByUser.get(userId)
    if (!userId || !characterId || present.has(characterId) || swapped.has(userId)) continue
    swapped.add(userId)
    swaps.push({ actorId: actor.id, characterId, userId })
  }
  return swaps
}

async function hasPendingDecision(
  ctx: Pick<EncounterCharacterWriteTransaction, 'db'>,
  state: EncounterRunState
): Promise<boolean> {
  const pending = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_encounterId_state', (q) => q.eq('encounterId', state.id).eq('state', 'PENDING'))
    .first()
  return pending !== null
}

/**
 * Whether a writer that cannot end a turn may replace the actor: not its turn, and no Encounter
 * decision pending. The room, which can end the turn, replaces on the actor's turn and then ends it.
 */
export async function isRunActorSettled(
  ctx: Pick<EncounterCharacterWriteTransaction, 'db'>,
  state: EncounterRunState,
  actorId: string
): Promise<boolean> {
  return state.currentActorId !== actorId && !(await hasPendingDecision(ctx, state))
}

/**
 * D236: a player's Active Character changed while the one it replaced stands in an open Run. The
 * actor keeps its id, side, place in initiative, concealment, controllers and token binding, and
 * takes the new Character's identity and snapshot with fresh resources and no open consequence
 * offers; a creature form the new Character carries is worn again. In an ACTIVE Run the old
 * Character's effects from this Run and its Concentration end first, as an actor removal ends
 * them. The caller has already settled any pending decision, and ends the actor's turn afterwards
 * when it was the actor's turn. Records one GM-only `CHARACTER_REPLACED` entry, which moves the Run
 * version so an in-flight command reads the Run as changed.
 */
export async function replaceRunCharacterActor(
  ctx: EncounterCharacterWriteTransaction,
  input: {
    state: EncounterRunState
    actorId: string
    characterId: string
    userId: string
    commandId: string
    occurredAt: string
  }
): Promise<void> {
  const { state, actorId, occurredAt } = input
  if (await hasPendingDecision(ctx, state))
    throw new Error('A Character actor is replaced only with no decision pending.')
  const replaced = (await readRunActors(ctx, state)).find(({ id }) => id === actorId)
  if (replaced?.kind !== 'CHARACTER' || replaced.frozenState)
    throw new Error('Encounter Character actor was not found.')
  const row = await ctx.ports.readCharacterRow(input.characterId)
  if (!row || row.status !== 'ACTIVE' || row.systemId !== state.gameSystemId)
    throw new Error('Replacement Character is unavailable.')
  if (state.status === 'ACTIVE') {
    await cleanupRemovedActorEffects(ctx, { state, actorId, occurredAt })
    await endCharacterRunEffects(ctx, {
      characterId: replaced.sourceId,
      classifyRun: async (encounterId) => (encounterId === state.id ? 'TERMINABLE' : null),
      occurredAt
    })
  }
  // Ending effects can settle the actor's row, so the swap starts from what is stored now.
  const before = (await readRunActors(ctx, state)).find(({ id }) => id === actorId)
  if (before?.kind !== 'CHARACTER') throw new Error('Encounter Character actor was not found.')
  const { consequenceRollOffers: _offers, ...kept } = before
  const swapped = encounterRunActorStateSchema.parse({
    ...kept,
    sourceId: row.id,
    label: row.label,
    systemId: row.systemId,
    form: null,
    resources: {},
    snapshot: { kind: 'CHARACTER', id: row.id, label: row.label, systemId: row.systemId },
    updatedAt: occurredAt
  })
  if (swapped.kind !== 'CHARACTER') throw new Error('Encounter Character actor was not found.')
  await replaceRunActor(
    ctx,
    before,
    resumeCharacterForm(
      swapped,
      await createActiveRuleEffectStore(ctx).list({ kind: 'CHARACTER', characterId: row.id })
    )
  )
  await appendSystemRunEntry(ctx, {
    encounterId: state.id,
    userId: input.userId,
    occurredAt,
    command: encounterCharacterReplacedInputSchema.parse({
      type: 'CHARACTER_REPLACED',
      commandId: input.commandId,
      encounterId: state.id,
      actorId,
      fromCharacterId: replaced.sourceId,
      toCharacterId: row.id
    }),
    label: `${replaced.label} swapped for ${row.label}`
  })
}
