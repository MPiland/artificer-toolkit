import { checksumRunActorPlayState } from '@artificer-toolkit/rules-runtime/encounterActorStorage'
import { planEncounterMaintenanceOwner } from '@artificer-toolkit/rules-runtime/encounterActionMaintenance'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { EncounterCharacterRow } from './characterPlay.js'
import type { EncounterCharacterWriteTransaction } from './ports.js'
import { readRunActorWithRow, readRunState, writeRunActor } from './documents.js'
import { createActiveRuleEffectStore } from './effectStore.js'

/** Reconciles owners after exact dependent deletion, sharing a preceding mechanics increment. */
export async function reconcileNativeMaintenanceOwners(
  ctx: EncounterCharacterWriteTransaction,
  input: {
    /** Null when no Run is involved (Campaign-clock work): there are no Run actors to mirror. */
    encounterId: string | null
    maintenance: {
      removed: readonly ActiveRuleEffectRecord[]
      characterVersions: { characterId: string; beforeStreamVersion: number }[]
    }
    actors: EncounterRunActorState[]
    occurredAt: string
  }
) {
  const { maintenance } = input
  const store = createActiveRuleEffectStore(ctx)
  const actors = new Map(input.actors.map((actor) => [actor.id, actor]))
  const owners = new Map(
    maintenance.removed.map((effect) => [checksumCanonicalJson(effect.owner), effect.owner])
  )
  for (const owner of owners.values()) {
    const removed = maintenance.removed.filter(
      (effect) => checksumCanonicalJson(effect.owner) === checksumCanonicalJson(owner)
    )
    const remaining = await store.list(owner)
    let characterInput: Parameters<typeof planEncounterMaintenanceOwner>[0]['character'] = null
    let characterRow: EncounterCharacterRow | null = null
    let character: ReturnType<typeof ctx.ports.readCharacterRecord> | null = null
    if (owner.kind === 'CHARACTER') {
      const row = await ctx.ports.readCharacterRow(owner.characterId)
      const before = maintenance.characterVersions.find(
        (entry) => entry.characterId === owner.characterId
      )?.beforeStreamVersion
      if (!row || before === undefined)
        throw new Error('Maintained-effect Character version changed during settlement.')
      character = ctx.ports.readCharacterRecord(row)
      characterRow = row
      characterInput = {
        currentStreamVersion: row.play.streamVersion,
        beforeStreamVersion: before,
        state: character.state,
        maximumHitPoints: row.play.maximumHitPoints
      }
    }
    const planned = planEncounterMaintenanceOwner({
      owner,
      removed,
      remaining,
      actors: [...actors.values()],
      character: characterInput
    })
    if (planned.character && characterRow && character) {
      const nextCharacter = {
        ...character,
        state: {
          ...character.state,
          conditions: planned.character.conditions,
          hitpoints: planned.character.hitpoints
        }
      }
      await ctx.ports.writeCharacterRecord({
        current: characterRow,
        fields: { streamVersion: planned.character.streamVersion, updatedAt: input.occurredAt },
        ...(planned.character.changed ? { document: nextCharacter } : {})
      })
    }
    for (const { before: actor, after: updated } of planned.actors) {
      if (input.encounterId === null)
        throw new Error('Maintained-effect Encounter actors need their Encounter.')
      const encounterId = input.encounterId
      const run = await ctx.db
        .query('encounterRuns')
        .withIndex('by_publicId', (q) => q.eq('id', encounterId))
        .unique()
      if (!run) throw new Error('Encounter is unavailable.')
      // The deletion that preceded this has already returned the holder from a removal effect
      // (D178), so the stored absence, not the caller's copy, is the current one.
      const { row, actor: stored } = await readRunActorWithRow(ctx, readRunState(run), actor.id)
      const current = { ...actor, absence: stored.absence }
      const next = { ...updated, absence: stored.absence }
      if (row.stateChecksum !== checksumRunActorPlayState(current))
        throw new Error('Maintained-effect Encounter mirror changed during settlement.')
      if (row.stateChecksum !== checksumRunActorPlayState(next))
        await writeRunActor(ctx, row._id, next)
      actors.set(actor.id, next)
    }
  }
  return input.actors.map((actor) => actors.get(actor.id)!)
}
