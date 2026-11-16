import { describe, expect, it } from 'vitest'
import { oilFlask } from '@artificer-toolkit/source-data/srd/equipment/oil-flask.js'

import { equipmentAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/equipment'
import { compileEffect } from '@artificer-toolkit/shared/compilers'

import { planEncounterPlacedZone } from '../encounterPlacedZone.js'
import { toSpatialInstances } from '../encounterSpatialCandidateExecution.js'
import { withZoneDcs } from '../encounterZoneConcealment.js'
import { chosenZonePlacement, placedSpaceZone } from '../encounterZonePlacement.js'
import { compileItemEntry, extraId } from '../testing/authoredZoneFixture.js'
import { ENCOUNTER_ID, testUuid } from '../testing/dnd5eSrdEncounter.js'

// QUALITY-15.T3w: poured oil is a zone that waits for the GM to light it. Its one component burns a
// creature entering it or ending its turn there, at most once per turn.

const POUR_EFFECT_ID = oilFlask.effects![1]!.id

function placedPour() {
  const entry = compileItemEntry(oilFlask, POUR_EFFECT_ID)
  if (entry.schemaVersion !== 4) throw new Error('The pour must compile to a v4 action entry.')
  const { compilation } = entry
  const zone =
    compilation.kind === 'COMPILED' && compilation.zonePlacement
      ? chosenZonePlacement(compilation.zonePlacement, undefined)
      : null
  if (!zone) throw new Error('The pour must place one zone.')
  return {
    zone,
    record: planEncounterPlacedZone({
      zone,
      id: testUuid(0x1e01),
      maintainedEffectStateId: null,
      encounterId: ENCOUNTER_ID,
      occurrenceId: testUuid(0x1e02),
      rootCommandId: testUuid(0x1e03),
      sourceActorId: testUuid(0x1e04),
      point: { x: 250, y: 350 },
      area: { kind: 'CUBE', edgeLength: 100 },
      sourceToken: null,
      saveDc: null
    })
  }
}

describe('real SRD Oil (flask) poured on the ground (QUALITY-15.T3w)', () => {
  it('compiles to a 5-foot zone that needs lighting and burns on entry or at the end of a turn, once per turn', () => {
    const { zone } = placedPour()
    expect(zone).toMatchObject({
      label: 'Poured oil',
      shape: { shapeKind: 'CUBE', edgeLength: { amount: 5, unit: 'FEET' } },
      triggerModes: ['ENTER', 'CROSS'],
      turnTriggers: ['END_OF_TURN'],
      maxApplicationsPerTurn: 1,
      requiresIgnition: true
    })
    expect(zone).not.toHaveProperty('regionComponents')
  })

  it('is placed unlit, and an unlit zone catches no one until it is lit', () => {
    const { record } = placedPour()
    expect(record.spatialState).toEqual({ schemaVersion: 1, revealed: true, unlit: true })
    expect(record.placement.maxApplicationsPerTurn).toBe(1)
    const lit = { ...record, spatialState: { schemaVersion: 1 as const, revealed: true } }
    expect(toSpatialInstances([record, lit], []).map(({ suppressed }) => suppressed)).toEqual([
      true,
      false
    ])
  })

  it('stays unlit when the GM sets its DCs', () => {
    const { record } = placedPour()
    expect(
      withZoneDcs(record.spatialState, {
        spotDc: null,
        disarmDc: { value: 12, source: 'FLAT' },
        placerActorId: null
      })
    ).toEqual({
      schemaVersion: 1,
      revealed: true,
      unlit: true,
      disarmDc: { value: 12, source: 'FLAT' }
    })
  })

  it('refuses a zone that needs lighting beside a region component, since lighting is the zone’s own', () => {
    const banded = structuredClone(oilFlask)
    const pour = banded.effects![1]!
    const path = pour.paths[0]
    const zone = path?.selectionKind === 'FIXED' ? path.resultBlock.outcomes[0] : undefined
    if (zone?.effectKind !== 'MANIFEST' || zone.manifestKind !== 'ZONE' || !zone.components)
      throw new Error('The pour must author a zone.')
    expect(() => placedSpaceZone(compileEffect(pour))).not.toThrow()
    zone.components.push({
      ...structuredClone(zone.components[0]!),
      id: extraId(0x60),
      order: 2,
      label: 'Beside the oil',
      region: { kind: 'SIDE_BAND', distance: { amount: 5, unit: 'FEET' } }
    })
    expect(equipmentAuthoredDtoSchema.safeParse(banded).success).toBe(true)
    expect(() => placedSpaceZone(compileEffect(pour))).toThrow(
      'A zone that needs lighting has one component.'
    )
  })
})
