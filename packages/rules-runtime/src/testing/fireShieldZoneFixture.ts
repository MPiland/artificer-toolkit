import type { EncounterSpatialRuleEffectRecord } from '@artificer-toolkit/schema/projections/spatialRuleEffectPersistence'
import type { EquipmentAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { caltropsBagOf20 } from '@artificer-toolkit/source-data/srd/equipment/caltrops-bag-of-20.js'
import { fireShield } from '@artificer-toolkit/source-data/srd/spells/fire-shield.js'

import { planEncounterPlacedZone, plannedSpatialEffectRecord } from '../encounterPlacedZone.js'
import { chosenZonePlacement } from '../encounterZonePlacement.js'
import { compileItemEntry, extraId } from './authoredZoneFixture.js'
import { ENCOUNTER_ID, testUuid, TIMESTAMP } from './dnd5eSrdEncounter.js'

type AuthoredEffects = NonNullable<EquipmentAuthored['effects']>

/** An item carrying Fire Shield's authored effects, gripless as an item's effects are, edited by `change`. */
export function carryingFireShield(change: (effects: AuthoredEffects) => void = () => {}) {
  const effects = structuredClone(fireShield.effects ?? []).map((effect) => ({
    ...effect,
    grip: null
  }))
  change(effects)
  return { ...structuredClone(caltropsBagOf20), id: extraId(0x1a0), label: 'Shield charm', effects }
}

/** The outcomes of each shield the cast offers. */
export function shieldOutcomes(effects: AuthoredEffects) {
  const path = effects[0]?.paths[0]
  if (path?.selectionKind !== 'CHOICE') throw new Error('Fire Shield must author a cast choice.')
  return path.options.map((option) => option.resultBlock.outcomes)
}

/** Each shield the cast offers, by label, with its compiled zone. */
export function shields(equipment: EquipmentAuthored) {
  const path = equipment.effects?.[0]?.paths[0]
  if (path?.selectionKind !== 'CHOICE') throw new Error('Fire Shield must author a cast choice.')
  const entry = compileItemEntry(equipment)
  const placement =
    entry.schemaVersion === 4 &&
    entry.compilation.kind === 'COMPILED' &&
    entry.compilation.zonePlacement
  if (!placement) throw new Error('Fire Shield must place a zone.')
  return path.options.map(({ id, label }) => {
    const zone = chosenZonePlacement(placement, id)
    if (!zone) throw new Error(`The ${label} must compile a zone.`)
    return { label, zone }
  })
}

/**
 * A shield the real planner leaves on its caster's 100 px token: the warm shield (2d8 fire) unless
 * `shield` picks the chill one.
 */
export function placedFireShieldZone(input: {
  seed: number
  sourceActorId: string
  sourceTokenId: string
  encounterId?: string
  shield?: 'WARM' | 'CHILL'
}) {
  const [warm, chill] = shields(carryingFireShield())
  return planEncounterPlacedZone({
    zone: (input.shield === 'CHILL' ? chill : warm)!.zone,
    id: testUuid(input.seed),
    maintainedEffectStateId: null,
    encounterId: input.encounterId ?? ENCOUNTER_ID,
    occurrenceId: testUuid(input.seed + 1),
    rootCommandId: testUuid(input.seed + 2),
    sourceActorId: input.sourceActorId,
    point: { x: 0, y: 0 },
    area: { kind: 'RADIUS', radius: 100 },
    sourceToken: { tokenId: input.sourceTokenId, width: 100 },
    saveDc: null
  })
}

/** The `placedFireShieldZone` stored as the Scene effect store keeps it. */
export function placedFireShield(input: {
  seed: number
  sourceActorId: string
  sourceTokenId: string
  sceneId: string
  shield?: 'WARM' | 'CHILL'
  createdOrdinal?: number
}): EncounterSpatialRuleEffectRecord {
  return plannedSpatialEffectRecord(placedFireShieldZone(input), {
    encounterId: ENCOUNTER_ID,
    sceneId: input.sceneId,
    createdOrdinal: input.createdOrdinal ?? 1,
    createdAt: TIMESTAMP
  })
}
