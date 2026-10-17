import { describe, expect, it } from 'vitest'
import {
  authoredZone,
  placedZone,
  SCENE_ID
} from '@artificer-toolkit/rules-runtime/testing/encounterTurnZoneFixture'
import {
  CAMPAIGN_ID,
  ENCOUNTER_ID
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'

import { createMemoryEncounterStore } from '../memoryEncounterStore.js'
import { persistMovementSettlements } from '../movementSettlementPersistence.js'
import type { EncounterCharacterWriteTransaction } from '../ports.js'
import { createSpatialRuleEffectStore } from '../spatialEffectStore.js'

/**
 * A movement's retained spatial contact settles against the zone row as it stands when the
 * movement commits: a zone that ended or was deleted after the contact was planned refuses the
 * commit, and nothing is written.
 */

const COMMAND_ID = '00000000-0000-4000-8000-0000000d0001'
const OCCURRENCE_ID = '00000000-0000-4000-8000-0000000d0002'
const OCCURRED_AT = '2026-10-17T00:00:00.000Z'

type Input = Parameters<typeof persistMovementSettlements>[1]
type Callbacks = Parameters<typeof persistMovementSettlements>[2]

async function boundScene() {
  const memory = createMemoryEncounterStore()
  await memory.store.insert('encounterSceneBindings', {
    encounterId: ENCOUNTER_ID,
    campaignId: CAMPAIGN_ID,
    sceneId: SCENE_ID,
    commandId: COMMAND_ID,
    commandFingerprint: 'a'.repeat(64),
    createdAt: OCCURRED_AT
  })
  // The host ports are the platform and are unused on this path.
  const ctx = { db: memory.store, ports: {} } as unknown as EncounterCharacterWriteTransaction
  const scope = await createSpatialRuleEffectStore(ctx).scope({
    encounterId: ENCOUNTER_ID,
    sceneId: SCENE_ID
  })
  if (!scope) throw new Error('The Scene must be bound.')
  const { id, definition, lifecycle, placement, spatialState } = placedZone(
    0x3a1,
    authoredZone(['ENTER_SPACE']),
    1
  )
  const zone = await scope.create({ id, definition, lifecycle, placement, spatialState })
  return { ctx, scope, zone }
}

/** The retained receipt names the zone by its pin; only the fields the settlement reads are real. */
function settleSpatial(ctx: EncounterCharacterWriteTransaction, effectId: string) {
  const contact = {
    candidate: {
      candidate: { effectId, pathDistance: 1, targetActorId: 'target' },
      effect: { effectId }
    }
  }
  const callbacks = {
    persistSpatial: async () => {
      throw new Error('The zone must be gone before any contact settles.')
    }
  }
  return persistMovementSettlements(
    ctx,
    {
      state: { id: ENCOUNTER_ID, version: 1 },
      actors: [],
      authorizedCharacterIds: new Set<string>(),
      save: { commandId: COMMAND_ID, sceneId: SCENE_ID },
      preparation: {
        occurrenceId: OCCURRENCE_ID,
        occurredAt: OCCURRED_AT,
        outcome: {
          kind: 'TERMINAL',
          result: {
            status: 'BATCH_COMPLETE',
            batchKind: 'ENCOUNTER_SPATIAL_MOVEMENT',
            executions: [contact],
            reactionExecutions: []
          }
        }
      },
      settlements: [{ kind: 'SPATIAL', executions: [contact] }],
      userId: 'user'
    } as unknown as Input,
    callbacks as unknown as Callbacks
  )
}

describe('persistMovementSettlements spatial zone currentness', () => {
  it('refuses a contact whose zone was deleted after planning', async () => {
    const { ctx, scope, zone } = await boundScene()
    await scope.deleteCas({ id: zone.id, expectedVersion: zone.version })

    await expect(settleSpatial(ctx, zone.id)).rejects.toThrow('Movement spatial effect changed.')
  })
})
