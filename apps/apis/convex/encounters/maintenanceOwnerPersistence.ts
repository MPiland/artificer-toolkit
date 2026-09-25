import { planEncounterMaintenanceOwner } from '@artificer-toolkit/rules-runtime/encounterActionMaintenance'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { Doc } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { readCharacterRecord } from '../characters/stateDocuments'
import { writeCharacterRecord } from '../characters/characterWrites'
import { createActiveRuleEffectStore } from '../rules/effectStore'

/** Reconciles owners after exact dependent deletion, sharing a preceding mechanics increment. */
export async function reconcileNativeMaintenanceOwners(
  ctx: MutationCtx,
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
    let characterRow: Doc<'characters'> | null = null
    let character: ReturnType<typeof readCharacterRecord> | null = null
    if (owner.kind === 'CHARACTER') {
      const row = await ctx.db
        .query('characters')
        .withIndex('by_publicId', (q) => q.eq('id', owner.characterId))
        .unique()
      const before = maintenance.characterVersions.find(
        (entry) => entry.characterId === owner.characterId
      )?.beforeStreamVersion
      if (!row || before === undefined)
        throw new Error('Maintained-effect Character version changed during settlement.')
      character = readCharacterRecord(row)
      characterRow = row
      characterInput = {
        currentStreamVersion: row.streamVersion,
        beforeStreamVersion: before,
        conditions: character.state.conditions ?? []
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
          conditions: planned.character.conditions
        }
      }
      await writeCharacterRecord(ctx, {
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
      if (!row || row.stateChecksum !== checksumCanonicalJson(actor))
        throw new Error('Maintained-effect Encounter mirror changed during settlement.')
      if (row.stateChecksum !== checksumCanonicalJson(updated))
        await ctx.db.patch(row._id, {
          stateJson: JSON.stringify(updated),
          stateChecksum: checksumCanonicalJson(updated)
        })
      actors.set(actor.id, updated)
    }
  }
  return input.actors.map((actor) => actors.get(actor.id)!)
}
