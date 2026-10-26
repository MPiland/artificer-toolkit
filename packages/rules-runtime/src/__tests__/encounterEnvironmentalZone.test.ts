import { describe, expect, it } from 'vitest'

import type { ManifestAuthored } from '@artificer-toolkit/shared/authored'
import type { SpellAuthored } from '@artificer-toolkit/shared/subjects/authored'
import type { SceneGrid } from '@artificer-toolkit/shared/vtt'
import { grease } from '@artificer-toolkit/source-data/srd/spells/grease.js'
import { spiritGuardians } from '@artificer-toolkit/source-data/srd/spells/spirit-guardians.js'
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

/** MOVE-3.2 (ADR 0038): a GM's environmental zone is compiled and placed as an authored zone is. */

const GRID: SceneGrid = {
  kind: 'SQUARE',
  cellSize: 100,
  diagonalPolicy: 'EQUAL',
  distancePerCell: 5,
  origin: { x: 0, y: 0 },
  unit: 'FEET'
}
const POINT = { x: 250, y: 150 }
const ENCOUNTER_ID = testUuid(0x3a00)

function placeByGm(zone: ManifestAuthored) {
  return planEncounterEnvironmentalZone({
    gameSystemId: SRD_SYSTEM_ID,
    conditionDefinitionIds: SRD_CONDITION_TYPES.map((condition) => condition.id).sort(),
    abilityDefinitions: SRD_ABILITIES.map(({ id, code }) => ({ id, code })),
    zone,
    point: POINT,
    grid: GRID,
    id: testUuid(0x3a01),
    encounterId: ENCOUNTER_ID,
    rootCommandId: testUuid(0x3a02)
  })
}

/** The record the same zone gets when an item carrying it is used at the same point. */
function placeByItem(zone: Parameters<typeof carryingZone>[0]) {
  const compiled = zonePlacementOf(carryingZone(zone))
  const area = evaluateEncounterZoneTarget({
    zone: compiled,
    range: { rangeKind: 'UNLIMITED' },
    target: { kind: 'POINT', point: POINT },
    grid: GRID,
    sourceToken: null,
    aimSeen: true
  })
  if ('refusal' in area) throw new Error(`The item zone must place: ${area.refusal}.`)
  return planEncounterPlacedZone({
    id: testUuid(0x3a03),
    zone: compiled,
    maintainedEffectStateId: null,
    encounterId: ENCOUNTER_ID,
    occurrenceId: testUuid(0x3a04),
    rootCommandId: testUuid(0x3a04),
    sourceActorId: testUuid(0x3a05),
    point: POINT,
    area: area.shape,
    sourceToken: null,
    saveDc: null
  })
}

/** The first zone a spell's cast places. */
function spellZone(spell: SpellAuthored): ManifestAuthored {
  const path = spell.effects?.[0]?.paths[0]
  const blocks =
    path?.selectionKind === 'FIXED'
      ? [path.resultBlock]
      : path?.selectionKind === 'CHOICE'
        ? path.options.map((option) => option.resultBlock)
        : []
  const zone = blocks[0]?.outcomes.find(
    (outcome) => outcome.effectKind === 'MANIFEST' && outcome.manifestKind === 'ZONE'
  )
  if (zone?.effectKind !== 'MANIFEST') throw new Error(`${spell.label} must place a zone.`)
  return structuredClone(zone)
}

describe('a GM environmental zone (MOVE-3.2)', () => {
  it.each(Object.entries(environmentalZones()))(
    'places the %s fixed at the point with the triggers and fixed save an item placing it has',
    (_name, zone) => {
      const gm = placeByGm(zone)
      const item = placeByItem(zone)

      expect(gm.placement).toEqual(item.placement)
      expect(gm.placement).toMatchObject({ anchorKind: 'FIXED', sourceTokenId: null })
      expect(gm.definition.adapterFacts).toEqual(item.definition.adapterFacts)
      expect(gm.definition.origin).toEqual({
        kind: 'ENCOUNTER',
        sourceAggregateId: ENCOUNTER_ID,
        sourceOccurrenceId: testUuid(0x3a02),
        rootCommandId: testUuid(0x3a02),
        sourceActorId: null
      })
      expect(gm.maintainedEffectStateId).toBeNull()
    }
  )

  it.each([
    ['a zone that moves with its source (Spirit Guardians)', spellZone(spiritGuardians)],
    ["a zone whose save uses its caster's DC (Grease)", spellZone(grease)]
  ])('refuses %s: no creature is behind an environmental zone', (_name, zone) => {
    expect(() => placeByGm(zone)).toThrow(CharacterRuleActionUnsupportedCompilationError)
  })
})
