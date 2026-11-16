import { describe, expect, it } from 'vitest'
import { compileSpellEffect } from '@artificer-toolkit/shared/compilers'
import type { SpellAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { grease } from '@artificer-toolkit/source-data/srd/spells/grease.js'
import { guardianOfFaith } from '@artificer-toolkit/source-data/srd/spells/guardian-of-faith.js'
import { moonbeam } from '@artificer-toolkit/source-data/srd/spells/moonbeam.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { compileActionPlacement } from '../encounterActionEntryPointCompiler.js'
import { planEncounterZoneTicks } from '../encounterGrantLifetimes.js'
import { planEncounterPlacedZone } from '../encounterPlacedZone.js'
import { chosenZonePlacement } from '../encounterZonePlacement.js'
import { dnd5eCharacterRuleActionSystemAdapter } from '../systems/dnd5e/effectActionCompiler.js'
import { characterActionDescriptor } from '../testing/characterActionDescriptor.js'
import { ENCOUNTER_ID, testUuid } from '../testing/dnd5eSrdEncounter.js'

/**
 * QUALITY-15.T3ag: a placed zone no Concentration holds lasts its authored duration from its
 * placement, counted on its source's turns (or in Campaign minutes past the turn bound, D222), and
 * a Concentration zone stays until its Concentration ends.
 */

const SOURCE_ID = testUuid(0x3a01)

/** The zone the real compiler places for the spell's first Effect, cast at the spell's level. */
function compiledZone(spell: SpellAuthored) {
  const [effect, ...others] = spell.effects ?? []
  if (!effect) throw new Error(`${spell.label} authors no Effect.`)
  const action = {
    ...characterActionDescriptor(
      compileSpellEffect(
        { attributes: spell.attributes ?? [], effects: [effect, ...others] },
        effect
      ),
      spell.level
    ),
    conditionDefinitionIds: srdSystemRecord.conditionTypes.map(({ id }) => id)
  }
  const placement = compileActionPlacement(dnd5eCharacterRuleActionSystemAdapter, action)
  if (placement?.kind !== 'ZONE') throw new Error(`${spell.label} places no zone.`)
  return chosenZonePlacement(placement.zonePlacement, undefined)
}

/** The record the real planner leaves at a point for the zone, as its source's cast places it. */
function placed(zone: ReturnType<typeof compiledZone>, campaignClockMinute?: number | null) {
  return planEncounterPlacedZone({
    zone,
    id: testUuid(0x3a02),
    maintainedEffectStateId: zone.maintenance ? testUuid(0x3a03) : null,
    encounterId: ENCOUNTER_ID,
    occurrenceId: testUuid(0x3a04),
    rootCommandId: testUuid(0x3a05),
    sourceActorId: SOURCE_ID,
    point: { x: 500, y: 500 },
    area: { kind: 'CUBE', edgeLength: 200 },
    sourceToken: null,
    saveDc: 13,
    campaignClockMinute
  })
}

describe('the duration a placed zone no Concentration holds (QUALITY-15.T3ag)', () => {
  it.each([
    // 1 minute: 10 of its source's turns.
    { spell: grease, turns: 10 },
    // 8 hours: 4,800 of its source's turns.
    { spell: guardianOfFaith, turns: 4800 }
  ])(
    'compiles $spell.label to last $turns of its source’s turns from placement',
    ({ spell, turns }) => {
      const zone = compiledZone(spell)
      expect(zone.maintenance).toBeNull()
      expect(zone.duration).toEqual({
        startsAt: 'PLACEMENT',
        expiration: { kind: 'TICKS', initialRemaining: turns }
      })

      const record = placed(zone)

      expect(record.definition.recurrence).toMatchObject({
        anchor: 'SOURCE',
        expiration: { kind: 'TICKS', initialRemaining: turns, decrementStage: 'START_OF_TURN' }
      })
      expect(record.lifecycle).toEqual({ schemaVersion: 1, remainingTicks: turns })
    }
  )

  it('leaves a Concentration zone (Moonbeam) until its Concentration ends', () => {
    const zone = compiledZone(moonbeam)
    expect(zone.maintenance).not.toBeNull()
    expect(zone).not.toHaveProperty('duration')

    const record = placed(zone)

    expect(record.definition.recurrence).toMatchObject({
      anchor: 'HOLDER',
      expiration: { kind: 'INDEFINITE' }
    })
    expect(record.lifecycle).toEqual({ schemaVersion: 1, remainingTicks: null })
  })

  it('stamps a zone lasting past the turn bound with the Campaign minute it ends (D222)', () => {
    // Guardian of Faith authored to last 30 days: past the 24-hour turn bound.
    const authored = structuredClone(guardianOfFaith)
    const block = authored.effects?.[0]?.paths?.find(
      ({ resultBlock }) => resultBlock?.duration
    )?.resultBlock
    if (!block?.duration) throw new Error('Guardian of Faith authors its duration.')
    block.duration = { ...block.duration, durationKind: 'DAY', amount: 30 }
    const zone = compiledZone(authored)
    expect(zone.duration).toEqual({
      startsAt: 'PLACEMENT',
      expiration: { kind: 'CAMPAIGN_MINUTES', minutes: 43_200 }
    })

    expect(placed(zone, 1000).lifecycle).toEqual({
      schemaVersion: 1,
      remainingTicks: null,
      expiresAtCampaignMinute: 44_200
    })
    // A Campaign with no clock keeps the zone until the GM ends it.
    expect(placed(zone, null).lifecycle).toEqual({
      schemaVersion: 1,
      remainingTicks: null,
      expiresAtCampaignMinute: null
    })
  })
})

describe('the turn starts a timed zone counts (QUALITY-15.T3ag)', () => {
  const grease10 = placed(compiledZone(grease))
  const moonbeamZone = placed(compiledZone(moonbeam))

  it('counts its source’s turn start off a timed zone and ends it with its last tick', () => {
    const ticks = (remainingTicks: number) =>
      planEncounterZoneTicks({
        stage: 'START_OF_TURN',
        turnActorId: SOURCE_ID,
        zones: [{ ...grease10, lifecycle: { schemaVersion: 1, remainingTicks } }, moonbeamZone]
      }).map(({ kind, zone, ...rest }) => ({ kind, id: zone.id, ...rest }))

    expect(ticks(10)).toEqual([{ kind: 'UPDATE', id: grease10.id, remainingTicks: 9 }])
    expect(ticks(1)).toEqual([{ kind: 'EXPIRE', id: grease10.id }])
  })

  it('counts no other actor’s turn and no turn end', () => {
    expect(
      planEncounterZoneTicks({
        stage: 'START_OF_TURN',
        turnActorId: testUuid(0x3a06),
        zones: [grease10]
      })
    ).toEqual([])
    expect(
      planEncounterZoneTicks({ stage: 'END_OF_TURN', turnActorId: SOURCE_ID, zones: [grease10] })
    ).toEqual([])
  })
})
