import { describe, expect, it } from 'vitest'

import type { ManifestAuthored } from '@artificer-toolkit/shared/authored'
import type { SceneGrid } from '@artificer-toolkit/shared/vtt'
import {
  SRD_ABILITIES,
  SRD_CONDITION_TYPES,
  SRD_SYSTEM_ID
} from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { CharacterRuleActionUnsupportedCompilationError } from '../characterRuleActionSystemAdapter.js'
import { evaluateEncounterZoneTarget } from '../encounterAreaAction.js'
import { planEncounterEnvironmentalZone } from '../encounterEnvironmentalZone.js'
import { planEncounterPlacedZone } from '../encounterPlacedZone.js'
import {
  carryingZone,
  environmentalZones,
  zonePlacementOf
} from '../testing/authoredZoneFixture.js'
import { testUuid } from '../testing/dnd5eSrdEncounter.js'

/** MOVE-3.4: a zone manifest's camouflage sets the placed zone's spot DC and who knows of it. */

const GRID: SceneGrid = {
  kind: 'SQUARE',
  cellSize: 100,
  diagonalPolicy: 'EQUAL',
  distancePerCell: 5,
  origin: { x: 0, y: 0 },
  unit: 'FEET'
}
const POINT = { x: 250, y: 150 }
const PLACER_ID = testUuid(0x3b05)
const { caltropField, pit } = environmentalZones()

type Camouflage = NonNullable<
  Extract<ManifestAuthored, { manifestKind: 'ZONE' }>['camouflage']
>['spotDc']

const camouflaged = (spotDc: Camouflage) => ({ ...caltropField, camouflage: { spotDc } })

/** The zone an item carrying `zone` leaves when its Character, whose spell save DC is 13, uses it. */
function placeByItem(zone: Parameters<typeof carryingZone>[0]) {
  const compiled = zonePlacementOf(carryingZone(zone))
  const area = evaluateEncounterZoneTarget({
    zone: compiled,
    range: { id: testUuid(0x3b06), rangeKind: 'UNLIMITED' },
    target: { kind: 'POINT', point: POINT },
    grid: GRID,
    sourceToken: null,
    aimSeen: true
  })
  if ('refusal' in area) throw new Error(`The item zone must place: ${area.refusal}.`)
  return planEncounterPlacedZone({
    id: testUuid(0x3b03),
    zone: compiled,
    maintainedEffectStateId: null,
    encounterId: testUuid(0x3b00),
    occurrenceId: testUuid(0x3b04),
    rootCommandId: testUuid(0x3b04),
    sourceActorId: PLACER_ID,
    point: POINT,
    area: area.shape,
    sourceToken: null,
    saveDc: 13
  })
}

function placeByGm(zone: ManifestAuthored) {
  return planEncounterEnvironmentalZone({
    gameSystemId: SRD_SYSTEM_ID,
    conditionDefinitionIds: SRD_CONDITION_TYPES.map((condition) => condition.id).sort(),
    abilityDefinitions: SRD_ABILITIES.map(({ id, code }) => ({ id, code })),
    zone,
    point: POINT,
    grid: GRID,
    id: testUuid(0x3b01),
    encounterId: testUuid(0x3b00),
    rootCommandId: testUuid(0x3b02)
  })
}

describe('a camouflaged zone (MOVE-3.4)', () => {
  it('is placed in plain sight when its manifest authors no camouflage', () => {
    expect(placeByItem(caltropField).spatialState).toEqual({ schemaVersion: 1, revealed: true })
  })

  it('is placed concealed under its fixed spot DC, known to its placer', () => {
    expect(placeByItem(camouflaged({ kind: 'FIXED', value: 14 })).spatialState).toEqual({
      schemaVersion: 1,
      revealed: true,
      concealment: { spotDc: { value: 14, source: 'FLAT' }, knownByActorIds: [PLACER_ID] }
    })
  })

  it('is placed concealed under its source’s save DC', () => {
    expect(placeByItem(camouflaged({ kind: 'SOURCE_SAVE_DC' })).spatialState.concealment).toEqual({
      spotDc: { value: 13, source: 'FLAT' },
      knownByActorIds: [PLACER_ID]
    })
  })

  it('is placed by the GM concealed under its fixed spot DC, known to no Character', () => {
    expect(
      placeByGm({ ...pit, camouflage: { spotDc: { kind: 'FIXED', value: 15 } } }).spatialState
        .concealment
    ).toEqual({ spotDc: { value: 15, source: 'FLAT' }, knownByActorIds: [] })
  })

  it('is refused for the GM under a source’s save DC: no creature is behind it', () => {
    expect(() => placeByGm({ ...pit, camouflage: { spotDc: { kind: 'SOURCE_SAVE_DC' } } })).toThrow(
      CharacterRuleActionUnsupportedCompilationError
    )
  })
})
