import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import { canonicalActiveEffectEndTriggers } from '@artificer-toolkit/schema/shared/activeRuleEffects'
import { characterMechanicsApplicationDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionMechanics'
import { hideousLaughter } from '@artificer-toolkit/source-data/srd/spells/hideous-laughter.js'
import {
  SRD_CONDITION_TYPES,
  SRD_DAMAGE_TYPES
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { describe, expect, it } from 'vitest'

import { nativeConcentrationDamageApplications } from '../encounterConcentrationDamage.js'
import { planDamageSaveChain, committedDamagedDiscovery } from '../encounterDamageSaveChain.js'
import { targetEndedEffects } from '../encounterEndedEffectRelease.js'
import { spatialDamageEnds } from '../encounterSpatialDamageEnds.js'
import { DND5E_SYSTEM_ID } from '../systems/dnd5e/identity.js'
import { ENCOUNTER_ID, testUuid } from '../testing/dnd5eSrdEncounter.js'
import { plannedTimedCondition } from '../testing/plannedTimedCondition.js'
import { activeEffect } from './encounterActiveEffectFixtures.js'

/**
 * QUALITY-14.T2e2b3 (D220, D132, D167): the ends stage raises the holder's one `DAMAGED(AFTER)` and
 * its discovery is what the damage-save chain consumes. The room's chain once re-discovered from the
 * post-command projection, which still held the effects the damage ended, so an effect that both ends
 * on damage and repeats its save on damage was owed a save in the room and none in persistence, whose
 * committed rows no longer hold it. An action's or area's persistence re-derives the discovery from
 * those rows (`committedDamagedDiscovery`), and the two must agree.
 */

const FIRE = SRD_DAMAGE_TYPES.find((entry) => entry.code === 'FIRE')!.id
const PRONE = SRD_CONDITION_TYPES.find((entry) => entry.code === 'PRONE')!.id
const CASTER_ID = testUuid(0xe2d0)
const HOLDER_ID = testUuid(0xe2d1)
const DAMAGER_ID = testUuid(0xe2d2)
const LAUGHTER_ID = testUuid(0xe2d3)
const ENDS_ON_DAMAGE_ID = testUuid(0xe2d4)
const PLACED_ID = testUuid(0xe2d5)
const COMMAND_OCCURRENCE_ID = testUuid(0xe2d6)
const ZONE_SOURCE_ID = testUuid(0xe2d7)
const owner = {
  kind: 'ENCOUNTER_ACTOR',
  encounterId: ENCOUNTER_ID,
  targetActorId: HOLDER_ID
} as const

/**
 * SRD Hideous Laughter on the holder, which repeats its save whenever the holder takes damage. With
 * `endsOnDamage`, it is authored to end outright on damage as well (`endOnTriggers DAMAGE_TAKEN`);
 * with `repeatBy`, its repeat save answers only that damager (`SOURCE_SIDE`: the caster's side).
 */
function laughter(
  id: string,
  options: {
    endsOnDamage: boolean
    sourceOccurrenceId?: string
    repeatBy?: 'SOURCE_SIDE'
  } = { endsOnDamage: false }
) {
  const { definition } = plannedTimedCondition({
    encounterId: ENCOUNTER_ID,
    sourceActorId: CASTER_ID,
    holderActorId: HOLDER_ID,
    spell: hideousLaughter,
    lifetimeScope: 'ENCOUNTER'
  })
  const { repeatTriggers } = definition.recurrence
  if (!repeatTriggers) throw new Error('Hideous Laughter repeats its save on damage.')
  const { repeatBy } = options
  return {
    ...activeEffect({
      id,
      owner,
      createdOrdinal: 1,
      sourceActorId: CASTER_ID,
      stateContributions: [
        { kind: 'CONDITION_OWNERSHIP', conditionId: PRONE, baselinePresent: false }
      ]
    }),
    definition: {
      ...definition,
      origin: {
        ...definition.origin,
        sourceOccurrenceId: options.sourceOccurrenceId ?? definition.origin.sourceOccurrenceId
      },
      recurrence: {
        ...definition.recurrence,
        repeatTriggers: repeatBy
          ? repeatTriggers.map((trigger) => ({ ...trigger, by: repeatBy }))
          : repeatTriggers,
        endTriggers: canonicalActiveEffectEndTriggers([
          ...definition.recurrence.endTriggers,
          ...(options.endsOnDamage
            ? [{ event: 'DAMAGE_TAKEN', by: 'ANYONE', damageTypeIds: null } as const]
            : [])
        ])
      }
    }
  }
}

/** A 6-damage fire blow the holder takes in full, leaving it at 24 of 40 hit points. */
const blow = characterMechanicsApplicationDtoSchema.parse({
  ordinal: 0,
  kind: 'DAMAGE',
  requestedAmount: 6,
  resolvedAmount: 6,
  appliedAmount: 6,
  beforeCurrentHitPoints: 30,
  afterCurrentHitPoints: 24,
  beforeTemporaryHitPoints: 0,
  afterTemporaryHitPoints: 0,
  maximumHitPoints: 40,
  damageTypeId: FIRE,
  damageDisposition: 'NORMAL',
  incomingHalved: false,
  critical: false,
  sourceNodeId: 'damage',
  sourceOperationKey: 'effect.damage',
  authoredPath: null,
  resolvedPath: null
})

const held = [laughter(LAUGHTER_ID), laughter(ENDS_ON_DAMAGE_ID, { endsOnDamage: true })]
const applications = nativeConcentrationDamageApplications([
  { targetActorId: HOLDER_ID, applications: [blow], damagerActorId: DAMAGER_ID }
])

function plan(repeatSaveEffects: readonly ActiveRuleEffectRecord[]) {
  return planDamageSaveChain({
    gameSystemId: DND5E_SYSTEM_ID,
    applications,
    maintainedStates: new Map(),
    damagerActorId: null,
    dispositions: new Map(),
    effectSaves: {
      massiveRule: null,
      holders: new Map([[HOLDER_ID, { defeated: false, repeatSaveEffects, maximumHitPoints: 40 }]])
    }
  })
}

describe("the damage-save chain consumes the ends stage's discovery (QUALITY-14.T2e2b3)", () => {
  const ends = targetEndedEffects({
    holderActorId: HOLDER_ID,
    held,
    attack: null,
    testEvidence: [],
    turnActorId: null,
    applications: [{ ...blow, targetActorId: HOLDER_ID }],
    damagerActorId: DAMAGER_ID,
    dispositions: new Map()
  })

  it('owes no repeat save for an effect the same damage ended', () => {
    expect(ends.endedEffects.map(({ id }) => id)).toEqual([ENDS_ON_DAMAGE_ID])
    expect(ends.repeatSaveEffects.map(({ id }) => id)).toEqual([LAUGHTER_ID])
    expect(plan(ends.repeatSaveEffects)).toEqual([
      { ...applications[0], activeEffectId: LAUGHTER_ID }
    ])
  })

  it("agrees with persistence's re-derivation from the committed rows", () => {
    // The rows once the command commits: what it ended is gone and what it placed is there.
    const committed = [
      ...held.filter((effect) => !ends.endedEffects.includes(effect)),
      laughter(PLACED_ID, { endsOnDamage: false, sourceOccurrenceId: COMMAND_OCCURRENCE_ID })
    ]
    const settled = committedDamagedDiscovery({
      holderActorId: HOLDER_ID,
      effects: committed,
      commandOccurrenceIds: [COMMAND_OCCURRENCE_ID],
      applications,
      damagerActorId: null,
      dispositions: new Map()
    })
    expect(settled.map(({ id }) => id)).toEqual(ends.repeatSaveEffects.map(({ id }) => id))
    expect(plan(settled)).toEqual(plan(ends.repeatSaveEffects))
  })
})

describe("the zones' ends stage and the chain name the zone's source as the damager (QUALITY-14.T2e2b4)", () => {
  // The caster and the zone's source share a side; the attacker the zone burns for its melee hit,
  // whose command the action root names, does not.
  const dispositions = new Map([
    [CASTER_ID, 'HOSTILE'],
    [ZONE_SOURCE_ID, 'HOSTILE'],
    [DAMAGER_ID, 'FRIENDLY'],
    [HOLDER_ID, 'FRIENDLY']
  ] as const)
  const sideHeld = [
    laughter(LAUGHTER_ID, { endsOnDamage: false, repeatBy: 'SOURCE_SIDE' }),
    laughter(ENDS_ON_DAMAGE_ID, { endsOnDamage: true })
  ]
  const ends = spatialDamageEnds({
    holderActorId: HOLDER_ID,
    held: sideHeld,
    executions: [
      { candidate: { candidate: { sourceActorId: ZONE_SOURCE_ID } }, applications: [blow] }
    ],
    turnActorId: null,
    dispositions
  })
  const committed = sideHeld.filter((effect) => !ends.endedEffects.includes(effect))
  const settledFrom = (zoneApplications: typeof applications) =>
    committedDamagedDiscovery({
      holderActorId: HOLDER_ID,
      effects: committed,
      commandOccurrenceIds: [COMMAND_OCCURRENCE_ID],
      applications: zoneApplications,
      damagerActorId: DAMAGER_ID,
      dispositions
    }).map(({ id }) => id)

  it("owes the side-bound repeat save to the zone source's damage, less the effect it ended", () => {
    expect(ends.endedEffects.map(({ id }) => id)).toEqual([ENDS_ON_DAMAGE_ID])
    expect(ends.repeatSaveEffects.map(({ id }) => id)).toEqual([LAUGHTER_ID])
  })

  it("agrees with persistence's re-derivation once the chain's hit names the zone's source", () => {
    expect(
      settledFrom(
        nativeConcentrationDamageApplications([
          { targetActorId: HOLDER_ID, applications: [blow], damagerActorId: ZONE_SOURCE_ID }
        ])
      )
    ).toEqual(ends.repeatSaveEffects.map(({ id }) => id))
    // Named after the attacking command instead, the hit meets no side-bound trigger.
    expect(
      settledFrom(
        nativeConcentrationDamageApplications([{ targetActorId: HOLDER_ID, applications: [blow] }])
      )
    ).toEqual([])
  })
})
