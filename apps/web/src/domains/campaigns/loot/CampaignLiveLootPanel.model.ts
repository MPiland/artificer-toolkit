import type { LiveLoot, LootTable } from '@artificer-toolkit/schema/api/lootTables'

export type DefeatedCreatureLoot = { id: string; label: string; tables: LootTable[] }

/**
 * The defeated creatures that carry loot tables, in the Encounter's actor order. A creature still
 * standing, and a Character, never show any (D63).
 */
export function listDefeatedCreatureLoot(
  live: LiveLoot | undefined,
  actors: readonly { id: string; kind: string; label: string; defeated: boolean }[]
): DefeatedCreatureLoot[] {
  const tablesByActorId = new Map(
    (live?.documents ?? []).flatMap(({ owner, tables }) =>
      owner.kind === 'ENCOUNTER_ACTOR' ? [[owner.actorId, tables] as const] : []
    )
  )
  return actors.flatMap(({ id, kind, label, defeated }) => {
    const tables = tablesByActorId.get(id)
    return defeated && kind !== 'CHARACTER' && tables ? [{ id, label, tables }] : []
  })
}

export function listSceneLootTables(live: LiveLoot | undefined): LootTable[] {
  return (
    live?.documents.flatMap(({ owner, tables }) => (owner.kind === 'SCENE' ? tables : [])) ?? []
  )
}
