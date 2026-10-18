import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import {
  encounterRelationshipsEndedInputSchema,
  encounterStoredRunCommandSchema,
  type EncounterRelationshipEnds
} from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { encounterEndedRelationships } from '@artificer-toolkit/rules-runtime/encounterRelationshipEnds'
import { turnEffectOwner } from '@artificer-toolkit/rules-runtime/encounterTurnEffectState'
import { readHolderEndState } from './concentrationEnd.js'
import { readRunActors, readRunState } from './documents.js'
import { listActiveRuleEffects } from './effectStore.js'
import type {
  EncounterCharacterWriteTransaction,
  EncounterPersistenceTransaction
} from './ports.js'
import { endEncounterRelationshipEffect } from './relationshipEndPersistence.js'
import { encounterReplayReceipt } from './replayReceipts.js'
import { insertRunCommand } from './timelineEntries.js'

const HOLD_ENDED_LABEL = 'Hold ended'

type SweepInput = {
  state: EncounterRunState
  /** The Campaign owner, who reads every actor's conditions. */
  userId: string
  scene: Parameters<typeof encounterEndedRelationships>[0]['scene']
}

/**
 * The Run's relationships whose hold broke on its own (D152). A source can act as Concentration
 * reads it: a defeated or incapacitated source, or one no longer in the Run, holds nothing. It
 * writes nothing.
 */
export async function readEndedEncounterRelationships(
  ctx: EncounterPersistenceTransaction,
  input: SweepInput
) {
  const { state } = input
  const actors = await readRunActors(ctx, state)
  const activeEffectsByActorId = new Map(
    await Promise.all(
      actors.map(
        async (actor) =>
          [actor.id, await listActiveRuleEffects(ctx, turnEffectOwner(actor, state.id))] as const
      )
    )
  )
  const ends = await encounterEndedRelationships({
    activeEffectsByActorId,
    scene: input.scene,
    canAct: async (actorId) => {
      const actor = actors.find((entry) => entry.id === actorId)
      if (!actor) return false
      const { reason } = await readHolderEndState(ctx, { state, actor, userId: input.userId })
      return reason !== 'DEFEATED' && reason !== 'INCAPACITATED'
    }
  })
  return { actors, ends }
}

/**
 * Ends the Run's relationships whose hold broke on its own (D152), stripping the conditions only
 * each held, and records the ends as one Run command keyed on `commandId`. Writes nothing and
 * returns false when no hold broke. An ended relationship is not restored by an undo.
 */
export async function endBrokenEncounterRelationships(
  ctx: EncounterCharacterWriteTransaction,
  input: SweepInput & { commandId: string; occurredAt: string }
): Promise<boolean> {
  const { state, occurredAt } = input
  const found = await readEndedEncounterRelationships(ctx, input)
  if (found.ends.length === 0) return false
  let { actors } = found
  const relationshipEnds: EncounterRelationshipEnds = []
  for (const end of found.ends) {
    const ended = await endEncounterRelationshipEffect(ctx, {
      encounterId: state.id,
      actors,
      holderActorId: end.heldActorId,
      activeEffectId: end.activeEffectId,
      occurredAt
    })
    if (!ended) throw new Error('A broken relationship is unavailable.')
    actors = ended.actors
    relationshipEnds.push({
      heldActorId: end.heldActorId,
      activeEffectId: end.activeEffectId,
      removedConditionIds: ended.endedConditionIds
    })
  }
  const run = await ctx.db
    .query('encounterRuns')
    .withIndex('by_publicId', (query) => query.eq('id', state.id))
    .unique()
  if (!run) throw new Error('Encounter is unavailable.')
  const version = run.version + 1
  const nextState = { ...readRunState(run), version, updatedAt: occurredAt }
  await ctx.db.patch(run._id, {
    version,
    updatedAt: occurredAt,
    stateJson: JSON.stringify(nextState),
    stateChecksum: checksumCanonicalJson(nextState)
  })
  const command = encounterRelationshipsEndedInputSchema.parse({
    type: 'RELATIONSHIPS_ENDED',
    commandId: input.commandId,
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
      label: HOLD_ENDED_LABEL,
      receipt: { relationshipEnds },
      ...encounterReplayReceipt({ roll: null, occurrence: null }),
      createdAt: occurredAt
    })
  )
  return true
}
