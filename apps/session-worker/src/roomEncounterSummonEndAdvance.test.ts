import { describe, expect, it } from 'vitest'
import { createMemoryEncounterStore } from '@artificer-toolkit/encounter-persistence/memoryEncounterStore'
import type { SummonSweep } from '@artificer-toolkit/encounter-persistence/summonRemoval'
import { summonEndAdvanceCommandId } from '@artificer-toolkit/rules-runtime/encounterSystemTrigger'
import { DND5E_SYSTEM_ID } from '@artificer-toolkit/rules-runtime/systems/dnd5e/identity'
import { advanceRoomPastEndedSummon } from './roomEncounterSummonEndAdvance.js'
import { encounterRunFixture } from './testing/encounterRunFixture.js'
import { uuid } from './testing/roomAggregateFixture.js'

const PARENT_ID = uuid(0xb71)
const standing: SummonSweep = { ended: true, currentActorOrphaned: true }
const done: SummonSweep = { ended: true, currentActorOrphaned: false }

/** An ACTIVE Run of one actor, and the advances a room would make of it, each bumping its version. */
async function advancingRun(sweeps: SummonSweep[]) {
  const memory = createMemoryEncounterStore({ idPrefix: 'summon-end-advance' })
  const run = await encounterRunFixture({
    memory,
    campaignId: uuid(0xb72),
    systemId: DND5E_SYSTEM_ID,
    actors: [
      { characterId: uuid(0xb73), current: true },
      { characterId: uuid(0xb74) },
      { characterId: uuid(0xb75) }
    ]
  })
  const advances: { commandId: string; expectedVersion: number }[] = []
  const ctx = { db: memory.store } as Parameters<typeof advanceRoomPastEndedSummon>[0]['ctx']
  const advance = () =>
    advanceRoomPastEndedSummon({
      ctx,
      encounterId: run.encounterId,
      parentCommandId: PARENT_ID,
      sweep: async () => sweeps.shift() ?? done,
      executeTurn: async (turn) => {
        advances.push({ commandId: turn.commandId, expectedVersion: turn.expectedVersion })
        const [row] = memory.documents('encounterRuns')
        await memory.store.patch(row!._id, { version: row!.version + 1 })
      },
      settleTurnStart: async () => undefined
    })
  return { memory, run, advances, advance }
}

describe('advancing past an ended summon (D200)', () => {
  it('advances once, keyed to the originating command and the version it left', async () => {
    const { memory, advances, advance } = await advancingRun([done])
    const version = memory.documents('encounterRuns')[0]!.version

    expect(await advance()).toBe(true)

    expect(advances).toEqual([
      { commandId: summonEndAdvanceCommandId(PARENT_ID, version), expectedVersion: version }
    ])
  })

  it('repeats while the creature the advance lands on is orphaned too, and ends when none is', async () => {
    const { memory, advances, advance } = await advancingRun([standing, standing, done])
    const version = memory.documents('encounterRuns')[0]!.version

    await advance()

    expect(advances.map(({ expectedVersion }) => expectedVersion)).toEqual([
      version,
      version + 1,
      version + 2
    ])
    expect(new Set(advances.map(({ commandId }) => commandId)).size).toBe(3)
  })

  it('stops after as many advances as the Run has actors when a creature always stands', async () => {
    const { advances, advance } = await advancingRun(Array.from({ length: 50 }, () => standing))
    await advance()
    expect(advances).toHaveLength(3)
  })

  it('leaves the creature standing while a decision is pending', async () => {
    const { memory, run, advances, advance } = await advancingRun([done])
    const now = '2026-10-30T00:00:00.000Z'
    await memory.store.insert('encounterRuleOccurrences', {
      id: uuid(0xb76),
      campaignId: uuid(0xb72),
      encounterId: run.encounterId,
      rootCommandId: PARENT_ID,
      state: 'PENDING',
      version: 0,
      expectedEncounterVersion: 0,
      pendingSnapshotChecksum: 'a'.repeat(64),
      completedAt: null,
      createdAt: now,
      updatedAt: now
    })
    expect(await advance()).toBe(false)
    expect(advances).toEqual([])
  })

  it('does nothing in a Run that is not active', async () => {
    const { memory, advances, advance } = await advancingRun([done])
    const [row] = memory.documents('encounterRuns')
    await memory.store.patch(row!._id, { status: 'COMPLETED' })
    expect(await advance()).toBe(false)
    expect(advances).toEqual([])
  })
})
