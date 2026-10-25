import type { EncounterCommandInputDto } from '@artificer-toolkit/schema/api/encounters'
import { encounterRunStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { planEncounterMechanicsBatch } from '@artificer-toolkit/rules-runtime/encounterMechanicsBatchPlan'
import type { EncounterWriteTransaction } from '@artificer-toolkit/encounter-persistence/ports'
import { recordEncounterCommand } from '@artificer-toolkit/encounter-persistence/commands'
import {
  persistEncounterMechanicsBatchPlan,
  readEncounterMechanicsBatchTarget
} from '@artificer-toolkit/encounter-persistence/mechanicsBatchPersistence'
import { prepareRuleOccurrenceVoid } from '@artificer-toolkit/encounter-persistence/occurrenceVoid'
import { recordTurnMovement } from '@artificer-toolkit/encounter-persistence/turnMovement'
import { closeRoom } from './localRoomWorker'
import { playerControlFixture, type PlayerControlFixture } from './playerControl'

export type EncounterStoreOperation = (transaction: EncounterWriteTransaction) => Promise<unknown>

/**
 * The Encounter persistence operations the store conformance and projection parity suites run: each
 * scenario builds its fixture, moves it to the operation's starting state, and returns the operation.
 * REVERT_LAST_ACTION is not here: it reads the action's receipts, which the real room holds until
 * the Run ends (D85), so no real room action leaves Convex a Run it can undo. `defeat.test.ts` covers
 * the undo in the room.
 */
export type EncounterConformanceScenario = {
  name: string
  setup: () => Promise<{ base: PlayerControlFixture; operation: EncounterStoreOperation }>
}

async function runState(base: PlayerControlFixture) {
  return base.t.run(async (ctx) => {
    const row = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
      .unique()
    if (!row) throw new Error('Missing conformance Run.')
    return encounterRunStateSchema.parse(JSON.parse(row.stateJson))
  })
}

function gmTool(base: PlayerControlFixture, command: EncounterCommandInputDto) {
  return (transaction: EncounterWriteTransaction) =>
    recordEncounterCommand(transaction, command, base.owner.userId, () => {
      throw new Error('GM tools draw no dice.')
    })
}

export const encounterConformanceCorpus: readonly EncounterConformanceScenario[] = [
  {
    name: 'applies an action mechanics batch to a Creature',
    setup: async () => {
      const base = await playerControlFixture()
      const state = await runState(base)
      const target = base.run.actors.find((actor) => actor.id === base.enemy.id)!
      return {
        base,
        operation: async (transaction) => {
          const read = await readEncounterMechanicsBatchTarget(transaction, {
            encounterId: base.run.id,
            targetActorId: target.id,
            expectedEncounterVersion: state.version,
            effectiveMaximumHitPoints: target.maxHitPoints,
            occurrenceId: '10000000-0000-4000-8000-000000000001',
            sourceCommandId: '10000000-0000-4000-8000-000000000002',
            commandId: '10000000-0000-4000-8000-000000000003',
            occurredAt: '2026-09-27T12:00:00.000Z',
            expectedCharacterStreamVersion: null,
            forceVersionAdvance: false,
            applications: [
              {
                sourceNodeId: 'conformance',
                sourceOperationKey: 'damage',
                authoredPath: null,
                resolvedPath: 'CONFORMANCE',
                kind: 'DAMAGE',
                critical: false,
                targetActorId: target.id,
                requestedAmount: 2,
                resolvedAmount: 2,
                appliedAmount: 2,
                beforeCurrentHitPoints: target.currentHitPoints,
                afterCurrentHitPoints: target.currentHitPoints - 2,
                beforeTemporaryHitPoints: 0,
                afterTemporaryHitPoints: 0,
                maximumHitPoints: target.maxHitPoints,
                damageTypeId: '10000000-0000-4000-8000-000000000004',
                damageDisposition: 'NORMAL',
                incomingHalved: false
              }
            ]
          })
          const plan = planEncounterMechanicsBatch({
            batch: read.input,
            actor: read.actor,
            userId: read.userId
          })
          return persistEncounterMechanicsBatchPlan(transaction, read, {
            actor: read.actor,
            character: null,
            plan
          })
        }
      }
    }
  },
  {
    name: 'corrects the current turn',
    setup: async () => {
      const base = await playerControlFixture()
      const state = await runState(base)
      return {
        base,
        operation: gmTool(base, {
          type: 'SET_CURRENT_ACTOR',
          encounterId: base.run.id,
          commandId: '10000000-0000-4000-8000-000000000011',
          expectedVersion: state.version,
          actorId: base.enemy.id
        })
      }
    }
  },
  {
    name: 'records turn movement',
    setup: async () => {
      const base = await playerControlFixture()
      const state = await runState(base)
      return {
        base,
        operation: async (transaction) => {
          await recordTurnMovement(transaction, {
            state,
            actorId: base.companion.id,
            feet: 15,
            speedId: null
          })
          await recordTurnMovement(transaction, {
            state,
            actorId: base.companion.id,
            feet: 10,
            speedId: null
          })
        }
      }
    }
  },
  {
    name: 'voids a paused action',
    setup: async () => {
      const base = await playerControlFixture({ bite: 'ATTACK', promptRolls: true })
      const started = await base.gm(await base.bite(base.companion.id, base.enemy.id))
      const pending = started.occurrence?.pending
      if (!pending) throw new Error('Expected a paused action.')
      // The operation runs straight in Convex, so the room hands the Run over first (D85).
      await closeRoom(base.campaign.id)
      return {
        base,
        operation: (transaction) =>
          prepareRuleOccurrenceVoid(transaction, {
            type: 'VOID_RULE_OCCURRENCE',
            encounterId: base.run.id,
            commandId: '10000000-0000-4000-8000-000000000021',
            expectedVersion: pending.encounterVersion,
            occurrenceId: pending.occurrenceId,
            expectedOccurrenceVersion: pending.occurrenceVersion
          })
      }
    }
  },
  {
    name: 'removes an actor',
    setup: async () => {
      const base = await playerControlFixture()
      const state = await runState(base)
      return {
        base,
        operation: gmTool(base, {
          type: 'REMOVE_ACTOR',
          encounterId: base.run.id,
          commandId: '10000000-0000-4000-8000-000000000041',
          expectedVersion: state.version,
          actorId: base.lurker.id
        })
      }
    }
  }
]
