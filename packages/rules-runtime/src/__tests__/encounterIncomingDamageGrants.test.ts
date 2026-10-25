import { describe, expect, it } from 'vitest'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import { SRD_DAMAGE_TYPES } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { prepareActiveRuleEffectRecord } from '../activeRuleEffectRecords.js'
import { prepareNativeIncomingDamageGrantTriggers } from '../encounterActionEffects.js'
import { targetEndedEffects } from '../encounterEndedEffectRelease.js'
import type { CharacterRuleActionApplication } from '../characterRuleActionSystemAdapter.js'
import { SRD, srdByLabel } from '../testing/dnd5eSrdCharacter.js'
import {
  ENCOUNTER_ID,
  srdCreatureActor,
  srdCreatureTarget,
  srdEncounterState,
  TIMESTAMP,
  testUuid
} from '../testing/dnd5eSrdEncounter.js'

const FIRE = SRD_DAMAGE_TYPES.find((entry) => entry.code === 'FIRE')!.id
const COLD = SRD_DAMAGE_TYPES.find((entry) => entry.code === 'COLD')!.id
const SLASHING = SRD_DAMAGE_TYPES.find((entry) => entry.code === 'SLASHING')!.id
const HOLDER_ID = testUuid(0xc101)
const ATTACKER_ID = testUuid(0xc102)
const OCCURRENCE_ID = testUuid(0xc1a1)
const NEXT_OCCURRENCE_ID = testUuid(0xc1a2)
const COMMAND_ID = testUuid(0xc1b1)

const damage = (damageTypeId: string): CharacterRuleActionApplication => ({
  kind: 'DAMAGE',
  damageTypeId,
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
  maximumHitPoints: 20,
  targetActorId: HOLDER_ID
})

function triggersFor(label: string, occurrenceId = OCCURRENCE_ID) {
  const actor = srdCreatureActor({ id: HOLDER_ID, creature: srdByLabel(SRD.creatures, label) })
  return prepareNativeIncomingDamageGrantTriggers({
    encounter: srdEncounterState({ actors: [actor], currentActorId: ATTACKER_ID }),
    holder: actor,
    held: srdCreatureTarget(actor).activeEffects,
    occurrenceId,
    commandId: COMMAND_ID,
    activeEffectsByActorId: new Map()
  })
}

function hit(
  triggers: ReturnType<typeof triggersFor>,
  applications: CharacterRuleActionApplication[],
  held: ActiveRuleEffectRecord[] = []
) {
  return targetEndedEffects({
    holderActorId: HOLDER_ID,
    held,
    attacked: false,
    testEvidence: [],
    turnActorId: ATTACKER_ID,
    applications,
    damagerActorId: ATTACKER_ID,
    dispositions: new Map(),
    grantTriggers: triggers
  })
}

function heldGrant(trigger: ReturnType<typeof triggersFor>[number]): ActiveRuleEffectRecord {
  return prepareActiveRuleEffectRecord({
    id: trigger.id,
    owner: { kind: 'ENCOUNTER_ACTOR', encounterId: ENCOUNTER_ID, targetActorId: HOLDER_ID },
    definition: trigger.effect.definition,
    lifecycle: trigger.effect.lifecycle,
    currentEffects: [],
    occurredAt: TIMESTAMP
  })
}

describe('timed self grants a creature passive damage trigger gives (SPELLS-33.T6e3a)', () => {
  // Parity: a roll-mode grant (Flesh Golem) and a speed grant (Water Elemental) are two authorings
  // of the same trigger, with no feature-specific code on the path.
  it.each([
    ['Flesh Golem', FIRE, COLD],
    ['Water Elemental', COLD, FIRE]
  ])('%s: its damage type gives one grant; other damage gives none', (label, own, other) => {
    const triggers = triggersFor(label!)
    expect(triggers).toHaveLength(1)
    expect(hit(triggers, [damage(own!)]).grants.map(({ id }) => id)).toEqual([triggers[0]!.id])
    expect(hit(triggers, [damage(other!)]).grants).toEqual([])
    expect(hit(triggers, [damage(SLASHING)]).grants).toEqual([])
    expect(hit(triggers, []).grants).toEqual([])
  })

  it('refreshes the same feature earlier grant instead of stacking a second', () => {
    const [first] = triggersFor('Flesh Golem')
    const earlier = heldGrant(first!)
    const [next] = triggersFor('Flesh Golem', NEXT_OCCURRENCE_ID)
    expect(next!.id).not.toBe(first!.id)
    const result = hit([next!], [damage(FIRE)], [earlier])
    expect(result.endedEffects).toEqual([earlier])
    expect(result.grants.map(({ id }) => id)).toEqual([next!.id])
  })

  it('leaves the grant alone when the damage is of another type', () => {
    const [first] = triggersFor('Flesh Golem')
    const earlier = heldGrant(first!)
    const result = hit(triggersFor('Flesh Golem', NEXT_OCCURRENCE_ID), [damage(COLD)], [earlier])
    expect(result.endedEffects).toEqual([])
    expect(result.grants).toEqual([])
  })

  it('gives no grant to a creature without the feature', () => {
    expect(triggersFor('Goblin')).toEqual([])
  })
})
