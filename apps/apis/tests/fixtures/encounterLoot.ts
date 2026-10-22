import type { LootOwner, LootTable } from '@artificer-toolkit/schema/api/lootTables'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { createEncounterSceneFixture } from './encounterScene'

const coinId = srdSystemRecord.currencies[0]!.id

export function lootTable(): LootTable {
  return {
    id: crypto.randomUUID(),
    name: 'Pockets',
    ranges: [
      { id: crypto.randomUUID(), min: 1, max: 10, entries: [] },
      {
        id: crypto.randomUUID(),
        min: 11,
        max: null,
        entries: [{ kind: 'COIN', denominationId: coinId, amount: 12 }],
        note: 'Sewn into the lining'
      }
    ]
  }
}

/** A prepared Run with two Custom creatures. In this fixture `other` is the Campaign owner (GM). */
export async function setupEncounterLoot() {
  const base = await createEncounterSceneFixture()
  const [first, second] = base.run.actors
  const ownerOf = (actorId: string): Extract<LootOwner, { kind: 'ENCOUNTER_ACTOR' }> => ({
    kind: 'ENCOUNTER_ACTOR',
    campaignId: base.campaign.id,
    encounterId: base.run.id,
    actorId
  })
  const lootRows = () =>
    base.t.run((ctx) =>
      ctx.db
        .query('lootTables')
        .withIndex('by_actor', (q) =>
          q.eq('owner.kind', 'ENCOUNTER_ACTOR').eq('owner.encounterId', base.run.id)
        )
        .collect()
    )
  return { base, gm: base.other.caller, first: first!, second: second!, ownerOf, lootRows }
}
