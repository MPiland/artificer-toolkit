import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import { sanctuary } from '@artificer-toolkit/source-data/srd/spells/sanctuary.js'
import { describe, expect, it } from 'vitest'

import { heldIncomingGate } from '../encounterIncomingAttackGate.js'
import { ENCOUNTER_ID, testUuid } from '../testing/dnd5eSrdEncounter.js'
import { plannedModifierGrant } from '../testing/modifierGrantFixture.js'

const CASTER_ID = testUuid(0xe001)
const HOLDER_ID = testUuid(0xe002)
const [warding] = sanctuary.effects ?? []

/** Sanctuary as the real planner stores it on its holder, under `id`. */
function heldSanctuary(id: string, sourceActorId: string = CASTER_ID): ActiveRuleEffectRecord {
  if (!warding) throw new Error('The SRD Sanctuary has no effect.')
  const planned = plannedModifierGrant({
    encounterId: ENCOUNTER_ID,
    sourceActorId,
    holderActorId: HOLDER_ID,
    lifecycle: {},
    effect: warding
  })
  return {
    ...planned,
    id,
    owner: { kind: 'ENCOUNTER_ACTOR', encounterId: ENCOUNTER_ID, targetActorId: HOLDER_ID },
    sourceEncounterId: ENCOUNTER_ID,
    maintainedEffectStateId: null,
    createdOrdinal: 1,
    version: 1,
    definitionChecksum: 'a'.repeat(64),
    lifecycleChecksum: 'b'.repeat(64),
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  }
}

describe('incoming attack gate (Sanctuary)', () => {
  it('finds the ward on its holder with the caster whose save DC it uses', () => {
    const held = heldIncomingGate([heldSanctuary(testUuid(0xe010))])
    expect(held?.casterActorId).toBe(CASTER_ID)
    expect(held?.payload.savingThrow.dcMethod).toBe('SOURCE_SAVE_DC')
  })

  it('holds no ward for a holder without the effect', () => {
    expect(heldIncomingGate([])).toBeNull()
  })

  it('answers to the ward with the lowest id when a holder carries several', () => {
    const low = heldSanctuary(testUuid(0xe011), testUuid(0xe003))
    const high = heldSanctuary(testUuid(0xe012), testUuid(0xe004))
    expect(heldIncomingGate([high, low])?.effect.id).toBe(low.id)
    expect(heldIncomingGate([low, high])?.effect.id).toBe(low.id)
  })
})
