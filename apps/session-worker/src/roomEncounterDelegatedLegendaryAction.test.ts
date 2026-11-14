import { describe, expect, it } from 'vitest'
import { readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import { createMemoryEncounterStore } from '@artificer-toolkit/encounter-persistence/memoryEncounterStore'
import { delegatedLegendaryContinuationCommandId } from '@artificer-toolkit/rules-runtime/encounterSystemTrigger'
import { DND5E_SYSTEM_ID } from '@artificer-toolkit/rules-runtime/systems/dnd5e/identity'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { raiseRoomDelegatedLegendaryAction } from './roomEncounterDelegatedLegendaryAction.js'
import { encounterRunFixture } from './testing/encounterRunFixture.js'
import { uuid } from './testing/roomAggregateFixture.js'

const CAMPAIGN_ID = uuid(0xc71)
const TURN_ROOT_ID = uuid(0xc72)

type Raise = Parameters<typeof raiseRoomDelegatedLegendaryAction>[0]

/**
 * An ACTIVE Run whose turn end waits on a delegated Legendary Action that was already raised (its
 * turn root is not the command settled here), so only the continuation that finishes the turn end is
 * left; and what a room would run of it. The continuation clears the delegation as the commit does.
 */
async function delegatingRun() {
  const memory = createMemoryEncounterStore({ idPrefix: 'delegated-legendary-action' })
  const run = await encounterRunFixture({
    memory,
    campaignId: CAMPAIGN_ID,
    systemId: DND5E_SYSTEM_ID,
    actors: [{ characterId: uuid(0xc73), current: true }, { characterId: uuid(0xc74) }]
  })
  const writeState = async (
    change: (state: ReturnType<typeof readRunState>) => ReturnType<typeof readRunState>
  ) => {
    const [row] = memory.documents('encounterRuns')
    const state = change(readRunState(row!))
    await memory.store.patch(row!._id, {
      version: state.version,
      stateJson: JSON.stringify(state),
      stateChecksum: checksumCanonicalJson(state)
    })
  }
  await writeState((state) => ({
    ...state,
    delegatedLegendaryAction: {
      parentCommandId: TURN_ROOT_ID,
      holderActorId: run.actorIds[1]!,
      actionId: 'legendary-option',
      settledOwnerActorIds: [run.actorIds[1]!]
    }
  }))
  const raised: string[] = []
  const turns: { commandId: string; expectedVersion: number }[] = []
  const raise = () =>
    raiseRoomDelegatedLegendaryAction({
      ctx: { db: memory.store } as Raise['ctx'],
      transaction: {} as Raise['transaction'],
      encounterId: run.encounterId,
      // The option's own commit, or an answer to it: not the turn that delegated it.
      turnRootCommandId: uuid(0xc75),
      execute: async (command) => {
        raised.push(command.commandId)
      },
      executeTurn: async (turn) => {
        turns.push({ commandId: turn.commandId, expectedVersion: turn.expectedVersion })
        await writeState((state) => ({
          ...state,
          delegatedLegendaryAction: undefined,
          version: state.version + 1
        }))
      }
    })
  return { memory, run, raised, turns, raise }
}

describe('finishing a turn end split around a delegated Legendary Action', () => {
  it('runs the continuation once the option has committed and the Run waits on nothing', async () => {
    const { memory, raised, turns, raise } = await delegatingRun()
    const version = memory.documents('encounterRuns')[0]!.version
    const continuationCommandId = delegatedLegendaryContinuationCommandId(TURN_ROOT_ID)

    expect(await raise()).toEqual({ committed: true, continuationCommandId })

    expect(raised).toEqual([])
    expect(turns).toEqual([{ commandId: continuationCommandId, expectedVersion: version }])
  })

  it('neither raises the option again nor ends its turn while it is held behind a reaction child (QUALITY-18.T3d, D219)', async () => {
    const { memory, run, raised, turns, raise } = await delegatingRun()
    const now = '2026-11-14T00:00:00.000Z'
    // The held option after its reaction child committed: suspended, the Run waiting on no decision.
    await memory.store.insert('encounterRuleOccurrences', {
      id: uuid(0xc76),
      campaignId: CAMPAIGN_ID,
      encounterId: run.encounterId,
      rootCommandId: uuid(0xc77),
      state: 'SUSPENDED',
      version: 1,
      expectedEncounterVersion: memory.documents('encounterRuns')[0]!.version,
      pendingSnapshotChecksum: 'a'.repeat(64),
      completedAt: null,
      createdAt: now,
      updatedAt: now
    })

    expect(await raise()).toEqual({ committed: false, continuationCommandId: null })

    expect(raised).toEqual([])
    expect(turns).toEqual([])
  })
})
