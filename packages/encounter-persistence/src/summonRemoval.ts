import {
  encounterSummonsEndedInputSchema,
  encounterStoredRunCommandSchema
} from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { turnEffectOwner } from '@artificer-toolkit/rules-runtime/encounterTurnEffectState'
import { deleteRunActor, readRunActors, readRunState } from './documents.js'
import { createActiveRuleEffectStore } from './effectStore.js'
import type { EncounterWritePorts } from './ports.js'
import { encounterReplayReceipt } from './replayReceipts.js'
import type { EncounterWriteContext } from './store.js'
import { insertRunCommand } from './timelineEntries.js'

/**
 * Removes the creatures a cast conjured (D187b): each one's Scene token through the room, then the
 * token binding and the actor. It returns the Run state without them in `actorIds`, which the caller
 * writes with its own version bump, so one removal serves a reverted cast and an effect that ends
 * alike. `commandId` is the command that ends them.
 */
export async function removeConjuredActors(
  ctx: EncounterWriteContext & {
    readonly ports: Pick<EncounterWritePorts<never>, 'removeSummonTokens'>
  },
  input: { state: EncounterRunState; commandId: string; actorIds: readonly string[] }
): Promise<EncounterRunState> {
  if (!ctx.ports.removeSummonTokens)
    throw new Error('Only the Session room can remove a conjured creature from its Scene.')
  const { actorIds } = input
  const encounterId = input.state.id
  const bindings = []
  for (const actorId of actorIds) {
    const binding = await ctx.db
      .query('encounterActorTokenBindings')
      .withIndex('by_encounterId_actorId', (q) =>
        q.eq('encounterId', encounterId).eq('actorId', actorId)
      )
      .unique()
    if (!binding) throw new Error('A conjured creature has no Scene token.')
    bindings.push(binding)
  }
  await ctx.ports.removeSummonTokens({
    encounterId,
    commandId: input.commandId,
    tokens: bindings.map(({ sceneId, tokenId }) => ({ sceneId, tokenId }))
  })
  for (const binding of bindings) await ctx.db.delete(binding._id)
  for (const actorId of actorIds) {
    const row = await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (q) => q.eq('encounterId', encounterId).eq('id', actorId))
      .unique()
    if (!row) throw new Error('A conjured creature was not found.')
    await deleteRunActor(ctx, row)
  }
  return { ...input.state, actorIds: input.state.actorIds.filter((id) => !actorIds.includes(id)) }
}

const SUMMON_ENDED_LABEL = 'Summon ended'

/**
 * Removes the creatures whose carrier effect has ended (D187b). Every path that ends an effect (turn
 * expiry, Concentration, recast, dispel) leaves the carrier absent, so one sweep after the command
 * serves them all. It reads only actors naming a `sourceEffectId`, looks each carrier up directly on
 * its caster, and records the removed ids as one system `SUMMONS_ENDED` Run command.
 * Writes nothing and returns false when every conjured creature still has its carrier.
 */
export async function endOrphanedConjuredActors(
  ctx: EncounterWriteContext & {
    readonly ports: Pick<EncounterWritePorts<never>, 'removeSummonTokens'>
  },
  input: { encounterId: string; userId: string; occurredAt: string }
): Promise<boolean> {
  const run = await ctx.db
    .query('encounterRuns')
    .withIndex('by_publicId', (q) => q.eq('id', input.encounterId))
    .unique()
  if (!run) throw new Error('Encounter is unavailable.')
  const state = readRunState(run)
  const actors = await readRunActors(ctx, state)
  const held = actors.filter((actor) => actor.owner?.sourceEffectId)
  if (held.length === 0) return false
  const effects = createActiveRuleEffectStore(ctx)
  const removedActorIds: string[] = []
  for (const actor of held) {
    const { ownerActorId, sourceEffectId } = actor.owner ?? {}
    const caster = actors.find(({ id }) => id === ownerActorId)
    if (
      !sourceEffectId ||
      (caster && (await effects.findById(turnEffectOwner(caster, state.id), sourceEffectId)))
    )
      continue
    removedActorIds.push(actor.id)
  }
  if (removedActorIds.length === 0) return false
  const commandId = crypto.randomUUID()
  const removed = await removeConjuredActors(ctx, {
    state,
    commandId,
    actorIds: removedActorIds
  })
  const version = run.version + 1
  const nextState = { ...removed, version, updatedAt: input.occurredAt }
  await ctx.db.patch(run._id, {
    version,
    updatedAt: input.occurredAt,
    stateJson: JSON.stringify(nextState),
    stateChecksum: checksumCanonicalJson(nextState)
  })
  const command = encounterSummonsEndedInputSchema.parse({
    type: 'SUMMONS_ENDED',
    commandId,
    encounterId: run.id
  })
  await insertRunCommand(
    ctx,
    encounterStoredRunCommandSchema.parse({
      id: crypto.randomUUID(),
      campaignId: run.campaignId,
      encounterId: run.id,
      commandId: command.commandId,
      commandType: command.type,
      commandFingerprint: checksumCanonicalJson(command),
      actorUserId: input.userId,
      version,
      commandJson: JSON.stringify(command),
      label: SUMMON_ENDED_LABEL,
      receipt: { removedActorIds },
      ...encounterReplayReceipt({ roll: null, occurrence: null }),
      createdAt: input.occurredAt
    })
  )
  return true
}
