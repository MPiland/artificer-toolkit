import { SRD_DAMAGE_TYPES } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { prepareEncounterMovementConcentration } from '../encounterMovementConcentration.js'
import type { EncounterEvent } from '../events/encounterEventTable.js'
import {
  characterActor,
  srdCreatureActor,
  srdEncounterState,
  testUuid
} from '../testing/dnd5eSrdEncounter.js'
import { SRD, srdByLabel } from '../testing/dnd5eSrdCharacter.js'

/**
 * QUALITY-14.T2: movement damage plans its Concentration chain through the one planner an action's
 * damage does, so the damage event it raises names who dealt the damage (the zone's source) and every
 * actor's disposition. The 5e maintenance hook meets damage from anyone, so the chain itself is the
 * same either way; the event is where a source-gated hook would tell the two apart.
 */

const raised = vi.hoisted(() => ({ events: [] as EncounterEvent[] }))

vi.mock('../events/encounterEventHooks.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../events/encounterEventHooks.js')>()
  return {
    ...original,
    discoverEncounterEventHooks: (
      input: Parameters<typeof original.discoverEncounterEventHooks>[0]
    ) => {
      raised.events.push(...input.events)
      return original.discoverEncounterEventHooks(input)
    }
  }
})

const FIRE = SRD_DAMAGE_TYPES.find((entry) => entry.code === 'FIRE')!.id
const HOLDER_ID = testUuid(0x3101)
const ZONE_SOURCE_ID = testUuid(0x3102)
const STATE_ID = testUuid(0x3103)
const CAST_AT = '2026-01-01T00:00:00.000Z'
const PLANNED = 'planned'

beforeEach(() => {
  raised.events.length = 0
})

type Input = Parameters<typeof prepareEncounterMovementConcentration>[0]
type Callbacks = Parameters<typeof prepareEncounterMovementConcentration>[1]

describe('a movement contact plans its Concentration chain like an action (QUALITY-14.T2)', () => {
  const holder = characterActor({ id: HOLDER_ID, characterId: testUuid(0x3104) })
  const zoneSource = srdCreatureActor({
    id: ZONE_SOURCE_ID,
    creature: srdByLabel(SRD.creatures, 'Ogre'),
    disposition: 'HOSTILE'
  })
  const state = srdEncounterState({ actors: [holder, zoneSource], currentActorId: HOLDER_ID })
  const remainder = {
    completedSpatialExecutions: [
      {
        ordinal: 0,
        candidate: { candidate: { targetActorId: HOLDER_ID, sourceActorId: ZONE_SOURCE_ID } },
        applications: [
          {
            ordinal: 0,
            kind: 'DAMAGE',
            damageTypeId: FIRE,
            damageDisposition: 'NORMAL',
            incomingHalved: false,
            critical: false,
            sourceNodeId: 'damage',
            sourceOperationKey: 'damage',
            authoredPath: null,
            resolvedPath: null,
            requestedAmount: 4,
            resolvedAmount: 4,
            appliedAmount: 4,
            beforeCurrentHitPoints: 20,
            afterCurrentHitPoints: 16,
            beforeTemporaryHitPoints: 0,
            afterTemporaryHitPoints: 0,
            maximumHitPoints: 20
          }
        ]
      }
    ]
  }

  it('raises DAMAGED for the zone damager and every disposition, not an anonymous hit', async () => {
    const callbacks = {
      loadStates: async () => [{ maintained: { id: STATE_ID, createdAt: CAST_AT } }],
      findEnds: async () => [],
      runtime: async () => {
        throw new Error(PLANNED)
      }
    }
    await expect(
      prepareEncounterMovementConcentration(
        {
          state,
          occurrenceId: testUuid(0x3105),
          sourceCommandId: testUuid(0x3106),
          userId: testUuid(0x3107),
          autoRoll: {},
          occurredAt: CAST_AT,
          remainder,
          source: { executionOrdinal: 0 },
          targets: new Map([
            [HOLDER_ID, { actor: holder }],
            [ZONE_SOURCE_ID, { actor: zoneSource }]
          ])
        } as unknown as Input,
        callbacks as unknown as Callbacks
      )
    ).rejects.toThrow(PLANNED)
    const [damaged] = raised.events.filter(
      (event) => event.kind === 'DAMAGED' && event.phase === 'AFTER'
    )
    if (damaged?.kind !== 'DAMAGED' || damaged.phase !== 'AFTER')
      throw new Error('The contact raised no DAMAGED(AFTER) event.')
    expect(damaged.hits).toEqual([{ damagerActorId: ZONE_SOURCE_ID, damageTypeIds: [FIRE] }])
    expect([...damaged.dispositions]).toEqual([
      [HOLDER_ID, 'FRIENDLY'],
      [ZONE_SOURCE_ID, 'HOSTILE']
    ])
  })
})
