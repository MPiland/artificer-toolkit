import {
  encounterSpatialRuleEffectRecordSchema,
  type EncounterSpatialRuleEffectRecord
} from '@artificer-toolkit/schema/projections/spatialRuleEffectPersistence'
import { turnCoordinatorRootDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionTurnPending'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { EquipmentAuthored } from '@artificer-toolkit/shared/subjects/authored'

import { planEncounterPlacedZone } from '../encounterPlacedZone.js'
import { ENCOUNTER_ID, srdCreatureActor, testUuid, TIMESTAMP } from './dnd5eSrdEncounter.js'
import { diceDamage, variantEquipment, zonePlacementOf } from './authoredZoneFixture.js'
import { SRD, srdByLabel } from './dnd5eSrdCharacter.js'

const GOBLIN = srdByLabel(SRD.creatures, 'Goblin')

export const GOBLIN_ID = testUuid(0x301)
export const SOURCE_ID = testUuid(0x302)
export const GOBLIN_TOKEN_ID = testUuid(0x303)
export const SOURCE_TOKEN_ID = testUuid(0x304)
export const SCENE_ID = testUuid(0x305)
export const OCCURRENCE_ID = testUuid(0x306)
export const GM_USER_ID = testUuid(0x9a)
export const ZONE_POINT = { x: 250, y: 350 }
export const START = { ordinal: 1, stage: 'START_OF_TURN', actorId: GOBLIN_ID } as const
export const END = { ordinal: 0, stage: 'END_OF_TURN', actorId: GOBLIN_ID } as const

export const goblin = srdCreatureActor({ id: GOBLIN_ID, creature: GOBLIN })
export const source = srdCreatureActor({ id: SOURCE_ID, creature: GOBLIN })
export const actors = [goblin, source]
export const tokens = [
  { id: GOBLIN_TOKEN_ID, position: ZONE_POINT, width: 100, height: 100 },
  { id: SOURCE_TOKEN_ID, position: { x: 1000, y: 350 }, width: 100, height: 100 }
]
export const actorIdByTokenId = new Map([
  [GOBLIN_TOKEN_ID, GOBLIN_ID],
  [SOURCE_TOKEN_ID, SOURCE_ID]
])

export const root = turnCoordinatorRootDtoSchema.parse({
  rootCommandId: testUuid(0x307),
  commandFingerprint: 'f'.repeat(64),
  commandType: 'ADVANCE_TURN',
  initiatorUserId: GM_USER_ID,
  requestedByUserId: GM_USER_ID,
  correlationId: null,
  expectedEncounterVersion: 7,
  proposedTerminalTransition: { status: 'ACTIVE', round: 1, currentActorId: GOBLIN_ID },
  resolutionCommands: []
})

/** A 5-foot Caltrops-shaped zone whose failed Dexterity save (DC 15) deals 1d4, acting at the given boundaries. */
export function authoredZone(
  interactionKinds: ('ENTER_SPACE' | 'START_TURN_IN_SPACE' | 'END_TURN_IN_SPACE')[],
  maxApplicationsPerTurn?: number
): EquipmentAuthored {
  return variantEquipment((parts) => {
    diceDamage('1d4')(parts)
    parts.component.interactionKinds = interactionKinds
    if (maxApplicationsPerTurn !== undefined)
      Object.assign(parts.component, { maxApplicationsPerTurn })
  })
}

/** The zone the real planner leaves at the goblin's space, stored as the Scene effect store keeps it. */
export function placedZone(
  seed: number,
  equipment: EquipmentAuthored,
  createdOrdinal: number
): EncounterSpatialRuleEffectRecord {
  const placed = planEncounterPlacedZone({
    zone: zonePlacementOf(equipment),
    id: testUuid(seed),
    maintainedEffectStateId: null,
    encounterId: ENCOUNTER_ID,
    occurrenceId: testUuid(0x308),
    rootCommandId: testUuid(0x309),
    sourceActorId: SOURCE_ID,
    point: ZONE_POINT,
    area: { kind: 'CUBE', edgeLength: 100 },
    sourceToken: null,
    saveDc: null
  })
  return encounterSpatialRuleEffectRecordSchema.parse({
    id: placed.id,
    encounterId: ENCOUNTER_ID,
    sceneId: SCENE_ID,
    createdOrdinal,
    version: 1,
    maintainedEffectStateId: null,
    definition: placed.definition,
    definitionChecksum: checksumCanonicalJson(placed.definition),
    lifecycle: placed.lifecycle,
    lifecycleChecksum: checksumCanonicalJson(placed.lifecycle),
    placement: placed.placement,
    placementChecksum: checksumCanonicalJson(placed.placement),
    spatialState: placed.spatialState,
    spatialStateChecksum: checksumCanonicalJson(placed.spatialState),
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP
  })
}

/** Who auto-rolls; both creatures. The scripted roll is always the lowest face. */
export const AUTO_ROLL = { [GOBLIN_ID]: true, [SOURCE_ID]: true }
