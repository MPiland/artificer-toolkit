import { checksumRunActorPlayState } from '@artificer-toolkit/rules-runtime/encounterActorStorage'
import { planEncounterMaintenanceOwner } from '@artificer-toolkit/rules-runtime/encounterActionMaintenance'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { EncounterCharacterRow } from './characterPlay.js'
import type { EncounterCharacterWriteTransaction } from './ports.js'
import { writeRunActor } from './documents.js'
import { createActiveRuleEffectStore } from './effectStore.js'

/** Reconciles owners after exact dependent deletion, sharing a preceding mechanics increment. */
export async function reconcileNativeMaintenanceOwners(
  ctx: EncounterCharacterWriteTransaction,
  input: {
    encounterId: string
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
      const row = await ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) =>
          q.eq('encounterId', input.encounterId).eq('id', actor.id)
        )
        .unique()
      if (!row || row.stateChecksum !== checksumRunActorPlayState(actor))
        throw new Error('Maintained-effect Encounter mirror changed during settlement.')
      if (row.stateChecksum !== checksumRunActorPlayState(updated))
        await writeRunActor(ctx, row._id, updated)
      actors.set(actor.id, updated)
    }
  }
  return input.actors.map((actor) => actors.get(actor.id)!)
}
