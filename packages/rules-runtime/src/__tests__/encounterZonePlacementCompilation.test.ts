import { describe, expect, it } from 'vitest'
import {
  SRD_ABILITY_DEFINITION_IDS,
  SRD_CONDITION_TYPES,
  srdSystemRecord
} from '@artificer-toolkit/source-data/srd/vocabulary.js'

import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { CompiledActionZonePlacement } from '@artificer-toolkit/schema/projections/characterMechanics'
import { equipmentAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/equipment'
import type { EquipmentAuthored } from '@artificer-toolkit/shared/subjects/authored'

import { prepareActiveRuleEffectRecord } from '../activeRuleEffectRecords.js'
import { encounterActionTargetKind } from '../encounterAreaAction.js'
import { discoverEncounterFeatureActions } from '../encounterFeatureActionCapabilityDiscoveryRegistry.js'
import { planEncounterPlacedZone } from '../encounterPlacedZone.js'
import { chosenZonePlacement } from '../encounterZonePlacement.js'
import { planSpatialEntryGrant } from '../encounterSpatialEntryGrant.js'
import {
  DND5E_ACTIVE_EFFECT_SAVE_ABILITY_DEFINITION_FACT_KEY,
  DND5E_SAVE_DAMAGE_MULTIPLIER_FACT_KEYS,
  DND5E_SAVE_DC_FACT_KEY
} from '../systems/dnd5e/effectActionContracts.js'
import { SRD, srdByLabel } from '../testing/dnd5eSrdCharacter.js'
import {
  ENCOUNTER_ID,
  TIMESTAMP,
  srdCreatureActor,
  testUuid
} from '../testing/dnd5eSrdEncounter.js'
import {
  compileCaltropsEntry,
  compileItemEntry,
  creatureAuraFeature,
  diceDamage,
  extraId,
  failedSaveOnly,
  losesAction,
  lostActionOutcome,
  noSave,
  variantEquipment,
  withFeature,
  zonePlacementOf,
  type ZoneParts
} from '../testing/authoredZoneFixture.js'
import { discoverEncounterEventHooks } from '../events/encounterEventHooks.js'

describe('placed-space zone compilation from real SRD Caltrops', () => {
  it('compiles the manifest zone to a point-placed 5-foot square that triggers on entering or passing through', () => {
    const { entry, compilation } = compileCaltropsEntry()
    expect(compilation.activeEffectPlan).toBeNull()
    const zone =
      compilation.zonePlacement && chosenZonePlacement(compilation.zonePlacement, undefined)
    expect(zone?.maintenance).toBeNull()
    expect(zone).toMatchObject({
      label: 'Caltrop field',
      shape: { shapeKind: 'CUBE', edgeLength: { amount: 5, unit: 'FEET' } },
      triggerModes: ['ENTER', 'CROSS'],
      bypassAtHalfSpeed: true
    })
    expect(entry.targetPolicy?.shape).toMatchObject({ shapeKind: 'CUBE' })
    expect(entry.targetPolicy && encounterActionTargetKind(entry.targetPolicy)).toBe('POINT')
  })

  it('freezes the authored Dexterity save, stop, damage and speed penalty as the zone entry', () => {
    const zone = zonePlacementOf()
    expect(zone.entry.frozenGraph.definition.nodes.map((node) => node.id)).toEqual([
      'd20',
      'd20-added-dice',
      'test',
      'proposal-on_save_fail',
      'movement-interruption'
    ])
    expect(zone.entry.frozenGraph.definition.outputs).toHaveProperty('movementInterruption')
    expect(zone.entry.adapterFacts).toMatchObject({
      [DND5E_ACTIVE_EFFECT_SAVE_ABILITY_DEFINITION_FACT_KEY]: SRD_ABILITY_DEFINITION_IDS.DEXTERITY,
      [DND5E_SAVE_DC_FACT_KEY]: 15
    })
    expect(zone.grant).toMatchObject({
      modifiers: [expect.objectContaining({ modifierKind: 'PENALTY' })],
      endOnEvents: ['ON_HIT_POINTS_REGAINED']
    })
    expect(zone.grant?.modifiers[0]).toMatchObject({
      payload: { amount: 10, unit: 'FEET' }
    })
  })
})

const ZONE_ID = testUuid(0x1701)
const SOURCE_ID = testUuid(0x1702)
const MOVER_ID = testUuid(0x1703)
const OCCURRENCE_ID = testUuid(0x1704)
const SPREAD_COMMAND_ID = testUuid(0x1705)
const MOVE_COMMAND_ID = testUuid(0x1706)

/** The zone the real planner leaves at a point for real Caltrops, with 5 feet as 100 Scene units. */
function placedCaltropsZone() {
  const zone = zonePlacementOf()
  return planEncounterPlacedZone({
    zone,
    id: ZONE_ID,
    maintainedEffectStateId: null,
    encounterId: ENCOUNTER_ID,
    occurrenceId: OCCURRENCE_ID,
    rootCommandId: SPREAD_COMMAND_ID,
    sourceActorId: SOURCE_ID,
    point: { x: 250, y: 350 },
    area: { kind: 'CUBE', edgeLength: 100 },
    sourceToken: null,
    saveDc: null
  })
}

/** What a failed entry save leaves on the mover: the zone's grant under the movement's origin. */
function plannedEntryGrant(input: {
  resultPath: string
  holderEffects?: ActiveRuleEffectRecord[]
}) {
  return planSpatialEntryGrant({
    zoneDefinition: placedCaltropsZone().definition,
    holderEffects: input.holderEffects ?? [],
    execution: { outputs: { resultPath: input.resultPath } },
    encounterId: ENCOUNTER_ID,
    occurrenceId: OCCURRENCE_ID,
    sourceCommandId: MOVE_COMMAND_ID,
    ordinal: 0,
    targetActorId: MOVER_ID
  })
}

function grantRecordFor(grant: Pick<ActiveRuleEffectRecord, 'id' | 'definition' | 'lifecycle'>) {
  return prepareActiveRuleEffectRecord({
    id: grant.id,
    owner: { kind: 'ENCOUNTER_ACTOR', encounterId: ENCOUNTER_ID, targetActorId: MOVER_ID },
    definition: grant.definition,
    lifecycle: grant.lifecycle,
    currentEffects: [],
    occurredAt: TIMESTAMP
  })
}

describe('the zone an area action leaves at its chosen point', () => {
  it('is one fixed, visible, repeatable 5-foot square around the point, labeled and half-speed passable', () => {
    expect(placedCaltropsZone().placement).toMatchObject({
      anchorKind: 'FIXED',
      sourceTokenId: null,
      geometry: {
        frame: 'SCENE_ABSOLUTE',
        shape: {
          kind: 'POLYGON',
          points: [
            { x: 200, y: 300 },
            { x: 300, y: 300 },
            { x: 300, y: 400 },
            { x: 200, y: 400 }
          ]
        }
      },
      triggerModes: ['ENTER', 'CROSS'],
      activation: 'REPEATABLE',
      visibility: 'PUBLIC',
      revealOnTrigger: false,
      label: 'Caltrop field',
      bypassAtHalfSpeed: true
    })
  })

  it('freezes the authored entry and carries the speed penalty template that names its end event', () => {
    const { definition } = placedCaltropsZone()
    expect(definition).toMatchObject({
      schemaVersion: 2,
      origin: { kind: 'ENCOUNTER', sourceAggregateId: ENCOUNTER_ID, sourceActorId: SOURCE_ID },
      recurrence: { endOnEvents: [], expiration: { kind: 'INDEFINITE' } },
      stateContributions: [
        {
          kind: 'MODIFIER_GRANT',
          sourceLabel: 'Caltrop field',
          endOnEvents: ['ON_HIT_POINTS_REGAINED']
        }
      ]
    })
  })

  it('leaves the zone itself standing when hit points are regained: only the grant it hands out ends', () => {
    expect(
      discoverEncounterEventHooks({
        effects: [grantRecordFor(placedCaltropsZone())],
        events: [{ kind: 'HIT_POINTS_REGAINED' }]
      }).ended
    ).toEqual([])
  })
})

describe('a creature that fails the zone’s entry save', () => {
  it('keeps the zone’s speed penalty under the movement’s origin', () => {
    const grant = plannedEntryGrant({ resultPath: 'ON_SAVE_FAIL' })
    expect(grant?.definition).toMatchObject({
      origin: { sourceAggregateId: ENCOUNTER_ID, rootCommandId: MOVE_COMMAND_ID },
      recurrence: { endOnEvents: ['ON_HIT_POINTS_REGAINED'] }
    })
  })

  it('keeps nothing when it succeeds', () => {
    expect(plannedEntryGrant({ resultPath: 'ON_SAVE_SUCCESS' })).toBeNull()
  })

  it('holds a grant of its own whose end event the grant carries, not the zone definition', () => {
    const grant = plannedEntryGrant({ resultPath: 'ON_SAVE_FAIL' })
    expect(grant?.definition.schemaVersion).toBe(2)
    expect(
      grant?.definition.stateContributions.every(
        (contribution) => contribution.kind !== 'MODIFIER_GRANT' || !('endOnEvents' in contribution)
      )
    ).toBe(true)
  })

  it('does not stack the same field’s penalty', () => {
    const grant = plannedEntryGrant({ resultPath: 'ON_SAVE_FAIL' })
    if (!grant) throw new Error('A failed save must grant the penalty.')
    expect(
      plannedEntryGrant({ resultPath: 'ON_SAVE_FAIL', holderEffects: [grantRecordFor(grant)] })
    ).toBeNull()
  })

  it('loses the penalty when it regains hit points, and only then', () => {
    const grant = plannedEntryGrant({ resultPath: 'ON_SAVE_FAIL' })
    if (!grant) throw new Error('A failed save must grant the penalty.')
    const held = [grantRecordFor(grant)]
    expect(
      discoverEncounterEventHooks({ effects: held, events: [{ kind: 'HIT_POINTS_REGAINED' }] })
        .ended
    ).toEqual(held)
    expect(
      discoverEncounterEventHooks({
        effects: held,
        events: [{ kind: 'ACTION', attackRoll: true, spellCast: false, againstEnemy: false }]
      }).ended
    ).toEqual([])
    expect(
      discoverEncounterEventHooks({
        effects: held,
        events: [{ kind: 'ACTION', attackRoll: false, spellCast: true, againstEnemy: false }]
      }).ended
    ).toEqual([])
  })
})

describe('a zone whose caster designates unaffected creatures (SPELLS-20 T4c)', () => {
  const authored = variantEquipment(({ component }) => {
    Object.assign(component, { choosesUnaffected: true })
  })

  it('passes the equipment publication contract', () => {
    expect(equipmentAuthoredDtoSchema.safeParse(authored).success).toBe(true)
  })

  it('compiles the choice onto the zone, which the SRD Caltrops zone does not offer', () => {
    expect(zonePlacementOf(authored).choosesUnaffected).toBe(true)
    expect(zonePlacementOf().choosesUnaffected).toBeUndefined()
  })

  it('stores the designated creatures on the placed zone, and nothing when none are named', () => {
    const place = (unaffectedActorIds: readonly string[]) =>
      planEncounterPlacedZone({
        zone: zonePlacementOf(authored),
        id: ZONE_ID,
        maintainedEffectStateId: null,
        encounterId: ENCOUNTER_ID,
        occurrenceId: OCCURRENCE_ID,
        rootCommandId: SPREAD_COMMAND_ID,
        sourceActorId: SOURCE_ID,
        point: { x: 250, y: 350 },
        area: { kind: 'CUBE', edgeLength: 100 },
        sourceToken: null,
        saveDc: null,
        unaffectedActorIds
      }).placement
    expect(place([SOURCE_ID]).unaffectedActorIds).toEqual([SOURCE_ID])
    expect(place([])).not.toHaveProperty('unaffectedActorIds')
  })
})

describe('a zone that applies once per turn (SPELLS-20 T4b1)', () => {
  const authored = variantEquipment(({ component }) => {
    Object.assign(component, { maxApplicationsPerTurn: 1 })
  })

  it('passes the equipment publication contract', () => {
    expect(equipmentAuthoredDtoSchema.safeParse(authored).success).toBe(true)
  })

  it('compiles the limit onto the zone and its placement, which the SRD Caltrops zone does not offer', () => {
    expect(zonePlacementOf(authored).maxApplicationsPerTurn).toBe(1)
    expect(zonePlacementOf().maxApplicationsPerTurn).toBeUndefined()
    const place = (zone: ReturnType<typeof zonePlacementOf>) =>
      planEncounterPlacedZone({
        zone,
        id: ZONE_ID,
        maintainedEffectStateId: null,
        encounterId: ENCOUNTER_ID,
        occurrenceId: OCCURRENCE_ID,
        rootCommandId: SPREAD_COMMAND_ID,
        sourceActorId: SOURCE_ID,
        point: { x: 250, y: 350 },
        area: { kind: 'CUBE', edgeLength: 100 },
        sourceToken: null,
        saveDc: null
      }).placement
    expect(place(zonePlacementOf(authored)).maxApplicationsPerTurn).toBe(1)
    expect(place(zonePlacementOf())).not.toHaveProperty('maxApplicationsPerTurn')
  })
})

describe('a zone that catches only creatures fully within it (SPELLS-20 T4b3a)', () => {
  const authored = variantEquipment(({ component }) => {
    component.interactionKinds = ['START_TURN_IN_SPACE']
    component.requiresFullyWithin = true
  })

  it('compiles the rule onto the zone and its placement, which the SRD Caltrops zone does not offer', () => {
    expect(zonePlacementOf(authored).requiresFullyWithin).toBe(true)
    expect(zonePlacementOf()).not.toHaveProperty('requiresFullyWithin')
    const place = (zone: ReturnType<typeof zonePlacementOf>) =>
      planEncounterPlacedZone({
        zone,
        id: ZONE_ID,
        maintainedEffectStateId: null,
        encounterId: ENCOUNTER_ID,
        occurrenceId: OCCURRENCE_ID,
        rootCommandId: SPREAD_COMMAND_ID,
        sourceActorId: SOURCE_ID,
        point: { x: 250, y: 350 },
        area: { kind: 'CUBE', edgeLength: 100 },
        sourceToken: null,
        saveDc: null
      }).placement
    expect(place(zonePlacementOf(authored)).requiresFullyWithin).toBe(true)
    expect(place(zonePlacementOf())).not.toHaveProperty('requiresFullyWithin')
  })
})

describe('a zone that triggers at turn boundaries (SPELLS-20 T4b2a)', () => {
  const withInteractions = (
    interactionKinds: NonNullable<ZoneParts['component']['interactionKinds']>
  ) =>
    variantEquipment(({ component }) => {
      component.interactionKinds = interactionKinds
    })

  it('compiles entering and starting the turn in the space to an ENTER and a START_OF_TURN trigger', () => {
    const authored = withInteractions(['ENTER_SPACE', 'START_TURN_IN_SPACE'])
    expect(equipmentAuthoredDtoSchema.safeParse(authored).success).toBe(true)
    expect(zonePlacementOf(authored)).toMatchObject({
      triggerModes: ['ENTER'],
      turnTriggers: ['START_OF_TURN']
    })
  })

  it('compiles a zone that only acts at turn boundaries to no movement trigger, in canonical order', () => {
    const zone = zonePlacementOf(withInteractions(['END_TURN_IN_SPACE', 'START_TURN_IN_SPACE']))
    expect(zone.triggerModes).toEqual([])
    expect(zone.turnTriggers).toEqual(['START_OF_TURN', 'END_OF_TURN'])
  })

  it('compiles leaving the space to an EXIT trigger (RULES-2.T5d)', () => {
    const authored = withInteractions(['ENTER_SPACE', 'LEAVE_SPACE', 'END_TURN_IN_SPACE'])
    expect(equipmentAuthoredDtoSchema.safeParse(authored).success).toBe(true)
    expect(zonePlacementOf(authored)).toMatchObject({
      triggerModes: ['ENTER', 'EXIT'],
      turnTriggers: ['END_OF_TURN']
    })
  })

  it('leaves a movement-only zone without turn triggers, as the SRD Caltrops zone is', () => {
    expect(zonePlacementOf().turnTriggers).toBeUndefined()
    expect(zonePlacementOf().triggerModes).toEqual(['ENTER', 'CROSS'])
  })

  it('stores the turn triggers on the placed zone, and nothing when there are none', () => {
    const place = (equipment?: EquipmentAuthored) =>
      planEncounterPlacedZone({
        zone: zonePlacementOf(equipment),
        id: ZONE_ID,
        maintainedEffectStateId: null,
        encounterId: ENCOUNTER_ID,
        occurrenceId: OCCURRENCE_ID,
        rootCommandId: SPREAD_COMMAND_ID,
        sourceActorId: SOURCE_ID,
        point: { x: 250, y: 350 },
        area: { kind: 'CUBE', edgeLength: 100 },
        sourceToken: null,
        saveDc: null
      }).placement
    expect(place(withInteractions(['START_TURN_IN_SPACE'])).turnTriggers).toEqual(['START_OF_TURN'])
    expect(place()).not.toHaveProperty('turnTriggers')
  })

  it('stays manual for an interaction the System does not model', () => {
    expect(
      compileItemEntry(withInteractions(['ENTER_SPACE', 'SOURCE_HIT'])).compilation
    ).toMatchObject({ kind: 'MANUAL', reasonCode: 'NOT_NORMALIZED' })
  })
})

describe('a zone authored with another save DC and a circle shape', () => {
  const authored = variantEquipment(({ zone, invocation }) => {
    zone.label = 'Spike field'
    zone.shape = { id: extraId(1), shapeKind: 'CIRCLE', radius: { amount: 10, unit: 'FEET' } }
    invocation.savingThrow = {
      id: invocation.savingThrow.id,
      abilityDefinitionId: invocation.savingThrow.abilityDefinitionId,
      dcMethod: 'FIXED_DC',
      baseDc: 13
    }
  })

  it('passes the equipment publication contract', () => {
    expect(equipmentAuthoredDtoSchema.safeParse(authored).success).toBe(true)
  })

  it('compiles like the SRD shape, with its own circle, label and save DC', () => {
    const srd = zonePlacementOf()
    const zone = zonePlacementOf(authored)
    expect(zone).toMatchObject({
      label: 'Spike field',
      shape: { shapeKind: 'CIRCLE', radius: { amount: 10, unit: 'FEET' } },
      triggerModes: srd.triggerModes,
      bypassAtHalfSpeed: srd.bypassAtHalfSpeed,
      grant: { endOnEvents: srd.grant?.endOnEvents }
    })
    expect(zone.entry.adapterFacts).toMatchObject({ [DND5E_SAVE_DC_FACT_KEY]: 13 })
    expect(zone.entry.frozenGraph.definition.nodes.map((node) => node.id)).toEqual(
      srd.entry.frozenGraph.definition.nodes.map((node) => node.id)
    )
    const { entry } = compileCaltropsEntry(authored)
    expect(entry.targetPolicy && encounterActionTargetKind(entry.targetPolicy)).toBe('POINT')
  })

  it('is placed as a circle around the chosen point', () => {
    const placed = planEncounterPlacedZone({
      zone: zonePlacementOf(authored),
      id: ZONE_ID,
      maintainedEffectStateId: null,
      encounterId: ENCOUNTER_ID,
      occurrenceId: OCCURRENCE_ID,
      rootCommandId: SPREAD_COMMAND_ID,
      sourceActorId: SOURCE_ID,
      point: { x: 250, y: 350 },
      area: { kind: 'RADIUS', radius: 200 },
      sourceToken: null,
      saveDc: null
    })
    expect(placed.placement).toMatchObject({
      geometry: { shape: { kind: 'CIRCLE', center: { x: 250, y: 350 }, radius: 200 } },
      label: 'Spike field',
      bypassAtHalfSpeed: true
    })
  })
})

describe('a zone whose failed entry save deals dice damage (D133)', () => {
  const authored = variantEquipment(diceDamage('2d6'))

  it('passes the equipment publication contract', () => {
    expect(equipmentAuthoredDtoSchema.safeParse(authored).success).toBe(true)
  })

  it('rolls its dice inside the one frozen entry graph, only for the failed save', () => {
    const { nodes, outputs } = zonePlacementOf(authored).entry.frozenGraph.definition
    expect(nodes.map((node) => node.id)).toEqual([
      'd20',
      'd20-added-dice',
      'test',
      'damage-enabled',
      'damage-die-1',
      'damage-die-2',
      'damage-sum-1',
      'proposal-on_save_fail',
      'movement-interruption'
    ])
    expect(nodes.find((node) => node.id === 'damage-enabled')?.inputs).toMatchObject({
      resultPath: { kind: 'NODE_OUTPUT', nodeId: 'test', port: 'resultPath' },
      authoredPath: { kind: 'LITERAL', value: 'ON_SAVE_FAIL' }
    })
    for (const dieId of ['damage-die-1', 'damage-die-2'])
      expect(nodes.find((node) => node.id === dieId)).toMatchObject({
        operation: { key: 'evidence.optional-integer-range' },
        inputs: {
          min: { value: 1 },
          max: { value: 6 },
          enabled: { kind: 'NODE_OUTPUT', nodeId: 'damage-enabled', port: 'authorized' }
        }
      })
    expect(nodes.find((node) => node.id === 'proposal-on_save_fail')?.inputs.amount).toEqual({
      kind: 'NODE_OUTPUT',
      nodeId: 'damage-sum-1',
      port: 'value'
    })
    expect(outputs).toHaveProperty('movementInterruption')
  })

  it('keeps the zone shape, trigger modes and grant of the fixed-damage zone', () => {
    expect(zonePlacementOf(authored)).toMatchObject({
      label: zonePlacementOf().label,
      triggerModes: zonePlacementOf().triggerModes,
      grant: { endOnEvents: zonePlacementOf().grant?.endOnEvents }
    })
  })

  it.each([
    ['a flat modifier', diceDamage('1d4+1')],
    [
      'a bonus',
      diceDamage('1d4', (damage) =>
        Object.assign(damage, { bonuses: [{ bonusKind: 'PROFICIENCY_BONUS', order: 1 }] })
      )
    ],
    ['half damage', diceDamage('1d4', (damage) => Object.assign(damage, { amountKind: 'HALF' }))],
    [
      'damage that scales per level',
      diceDamage('1d4', (damage) =>
        Object.assign(damage, {
          scalingKind: 'PER_LEVEL',
          scalingSource: 'CHARACTER_LEVEL',
          levels: [{ id: extraId(5), level: 1, order: 1, diceConfig: '1d4' }]
        })
      )
    ]
  ] as const)('refuses %s instead of partly honoring it', (_name, change) => {
    expect(compileItemEntry(variantEquipment(change)).compilation).toMatchObject({
      kind: 'MANUAL',
      reasonCode: 'NOT_NORMALIZED'
    })
  })
})

/** The made save deals the failed save's dice again, halved. */
function halvedOnMadeSave(diceConfig: string, change?: (outcome: Record<string, unknown>) => void) {
  return (parts: ZoneParts) => {
    diceDamage(diceConfig)(parts)
    const { behavior, savePath } = parts
    const damage = savePath.resultBlock.outcomes.find((outcome) => outcome.effectKind === 'DAMAGE')
    if (!damage) throw new Error('The zone must author damage.')
    const made: Record<string, unknown> = { ...structuredClone(damage), id: extraId(7) }
    Object.assign(made, { amountKind: 'HALF' })
    change?.(made)
    behavior.paths.push({
      ...savePath,
      id: extraId(6),
      order: 2,
      pathCode: 'ON_SAVE_SUCCESS',
      resultBlock: {
        id: `${extraId(6)}__result`,
        resultKind: 'SINGLE',
        outcomes: [made as typeof damage]
      }
    })
  }
}

describe('a zone whose made entry save deals half the dice (SPELLS-20 T4a)', () => {
  const authored = variantEquipment(halvedOnMadeSave('2d6'))

  it('passes the equipment publication contract', () => {
    expect(equipmentAuthoredDtoSchema.safeParse(authored).success).toBe(true)
  })

  it('rolls the dice of each save result in a gate of its own and halves the made save�s roll', () => {
    const { nodes } = zonePlacementOf(authored).entry.frozenGraph.definition
    expect(nodes.map((node) => node.id)).toEqual([
      'd20',
      'd20-added-dice',
      'test',
      'damage-enabled',
      'damage-die-1',
      'damage-die-2',
      'damage-sum-1',
      'damage-save-multiplied',
      'proposal-on_save_fail',
      'damage-success-enabled',
      'damage-success-die-1',
      'damage-success-die-2',
      'damage-success-sum-1',
      'damage-success-multiplied',
      'damage-success-save-multiplied',
      'proposal-on_save_success',
      'movement-interruption'
    ])
    expect(nodes.find((node) => node.id === 'damage-success-enabled')?.inputs).toMatchObject({
      resultPath: { kind: 'NODE_OUTPUT', nodeId: 'test', port: 'resultPath' },
      authoredPath: { kind: 'LITERAL', value: 'ON_SAVE_SUCCESS' }
    })
    expect(nodes.find((node) => node.id === 'damage-success-multiplied')?.inputs).toMatchObject({
      amount: { kind: 'NODE_OUTPUT', nodeId: 'damage-success-sum-1', port: 'value' },
      multiplier: { kind: 'LITERAL', value: 0.5 }
    })
    // Each result's damage is then multiplied by the target's own save-damage multiplier (Evasion).
    expect(nodes.find((node) => node.id === 'damage-success-save-multiplied')?.inputs).toEqual({
      amount: { kind: 'NODE_OUTPUT', nodeId: 'damage-success-multiplied', port: 'value' },
      multiplier: {
        kind: 'FACT',
        factKey: DND5E_SAVE_DAMAGE_MULTIPLIER_FACT_KEYS.ON_SAVE_SUCCESS
      }
    })
    expect(nodes.find((node) => node.id === 'damage-save-multiplied')?.inputs).toEqual({
      amount: { kind: 'NODE_OUTPUT', nodeId: 'damage-sum-1', port: 'value' },
      multiplier: { kind: 'FACT', factKey: DND5E_SAVE_DAMAGE_MULTIPLIER_FACT_KEYS.ON_SAVE_FAIL }
    })
    expect(nodes.find((node) => node.id === 'proposal-on_save_success')?.inputs.amount).toEqual({
      kind: 'NODE_OUTPUT',
      nodeId: 'damage-success-save-multiplied',
      port: 'value'
    })
    expect(nodes.find((node) => node.id === 'proposal-on_save_fail')?.inputs.amount).toEqual({
      kind: 'NODE_OUTPUT',
      nodeId: 'damage-save-multiplied',
      port: 'value'
    })
  })

  it('still stops the mover only on the failed save', () => {
    const { outputs, nodes } = zonePlacementOf(authored).entry.frozenGraph.definition
    expect(outputs).toHaveProperty('movementInterruption')
    expect(nodes.find((node) => node.id === 'movement-interruption')?.inputs).toMatchObject({
      authoredPath: { kind: 'LITERAL', value: 'ON_SAVE_FAIL' }
    })
  })

  it.each([
    [
      'a made save that applies a grant',
      ({ behavior, savePath }: ZoneParts) => {
        const grant = savePath.resultBlock.outcomes.find(
          (outcome) => outcome.effectKind === 'APPLY_GRANT'
        )
        if (!grant) throw new Error('The zone must author a grant.')
        behavior.paths.push({
          ...savePath,
          id: extraId(8),
          order: 2,
          pathCode: 'ON_SAVE_SUCCESS',
          resultBlock: { id: `${extraId(8)}__result`, resultKind: 'SINGLE', outcomes: [grant] }
        })
      }
    ],
    [
      'a made save that deals more than the failed save',
      halvedOnMadeSave('2d6', (outcome) => {
        Object.assign(outcome, { amountKind: 'DOUBLE' })
      })
    ]
  ] as const)('refuses %s instead of partly honoring it', (_name, change) => {
    expect(compileItemEntry(variantEquipment(change)).compilation).toMatchObject({
      kind: 'MANUAL',
      reasonCode: 'NOT_NORMALIZED'
    })
  })
})

/** The outcome of an effect kind the real SRD Caltrops failed save authors. */
function caltropsOutcome(parts: ZoneParts, effectKind: 'MOVEMENT_RULE' | 'DAMAGE' | 'APPLY_GRANT') {
  const outcome = parts.savePath.resultBlock.outcomes.find((each) => each.effectKind === effectKind)
  if (!outcome) throw new Error(`Caltrops must author a ${effectKind} outcome.`)
  return outcome
}

const conditionId = (code: string) => SRD_CONDITION_TYPES.find((each) => each.code === code)!.id
const conditionOutcome = (id = conditionId('POISONED'), offset = 21) => ({
  id: extraId(offset),
  effectKind: 'CONDITION' as const,
  conditionId: id
})

/** The zone acts at the start of a turn, then `changes` edit it in order. */
const startOfTurnZone = (...changes: ((parts: ZoneParts) => void)[]) =>
  variantEquipment((parts) => {
    parts.component.interactionKinds = ['START_TURN_IN_SPACE']
    for (const change of changes) change(parts)
  })

/** The zone's save also has a made-save path with only `outcome`. */
const madeSave =
  (outcome: (parts: ZoneParts) => ZoneParts['savePath']['resultBlock']['outcomes'][number]) =>
  (parts: ZoneParts) => {
    parts.behavior.paths.push({
      ...parts.savePath,
      id: extraId(27),
      order: 2,
      pathCode: 'ON_SAVE_SUCCESS',
      resultBlock: {
        id: `${extraId(27)}__result`,
        resultKind: 'SINGLE',
        outcomes: [outcome(parts)]
      }
    })
  }

describe('a zone failure composed from core outcomes (D141, D142)', () => {
  it('compiles a failure that only costs the Action, binding the save itself', () => {
    const authored = startOfTurnZone(failedSaveOnly(lostActionOutcome()))
    expect(equipmentAuthoredDtoSchema.safeParse(authored).success).toBe(true)
    const zone = zonePlacementOf(authored)
    expect(zone).toMatchObject({ failedSaveLosesAction: true, turnTriggers: ['START_OF_TURN'] })
    expect(zone.grant).toBeNull()
    const { nodes, sourceEntryBindings } = zone.entry.frozenGraph.definition
    expect(nodes.map((node) => node.id)).toEqual(['d20', 'd20-added-dice', 'test'])
    expect(zone.entry.frozenGraphNodeId).toBe('test')
    expect(sourceEntryBindings).toEqual([
      { sourceEntryId: zone.entry.compiledEntryId, nodeId: 'test' }
    ])
  })

  it('stores the lost Action on the placed zone, which the SRD Caltrops zone does not cost', () => {
    const place = (equipment?: EquipmentAuthored) =>
      planEncounterPlacedZone({
        zone: zonePlacementOf(equipment),
        id: ZONE_ID,
        maintainedEffectStateId: null,
        encounterId: ENCOUNTER_ID,
        occurrenceId: OCCURRENCE_ID,
        rootCommandId: SPREAD_COMMAND_ID,
        sourceActorId: SOURCE_ID,
        point: { x: 250, y: 350 },
        area: { kind: 'CUBE', edgeLength: 100 },
        sourceToken: null,
        saveDc: null
      }).placement
    expect(place(startOfTurnZone(losesAction)).failedSaveLosesAction).toBe(true)
    expect(zonePlacementOf()).not.toHaveProperty('failedSaveLosesAction')
    expect(place()).not.toHaveProperty('failedSaveLosesAction')
  })

  it('composes damage, a stop, a grant and a lost Action, proposing the damage', () => {
    const zone = zonePlacementOf(startOfTurnZone(losesAction))
    const withoutLostAction = zonePlacementOf(startOfTurnZone())
    expect(zone.failedSaveLosesAction).toBe(true)
    expect(zone.entry.frozenGraphNodeId).toBe('proposal-on_save_fail')
    expect(zone.entry.frozenGraph.definition.nodes.map((node) => node.id)).toEqual(
      withoutLostAction.entry.frozenGraph.definition.nodes.map((node) => node.id)
    )
    expect(zone.grant).toEqual(withoutLostAction.grant)
  })

  it('compiles a failure that only applies a System condition, proposing the condition', () => {
    const zone = zonePlacementOf(startOfTurnZone(failedSaveOnly(conditionOutcome())))
    expect(zone).not.toHaveProperty('failedSaveLosesAction')
    const { nodes } = zone.entry.frozenGraph.definition
    expect(nodes.map((node) => node.id)).toEqual([
      'd20',
      'd20-added-dice',
      'test',
      'proposal-on_save_fail'
    ])
    expect(zone.entry.frozenGraphNodeId).toBe('proposal-on_save_fail')
  })

  it('composes a condition with a lost Action', () => {
    const zone = zonePlacementOf(
      startOfTurnZone(failedSaveOnly(conditionOutcome(), lostActionOutcome()))
    )
    expect(zone.failedSaveLosesAction).toBe(true)
    expect(zone.entry.frozenGraphNodeId).toBe('proposal-on_save_fail')
  })

  it('proposes a condition beside the damage from a proposal node of its own (SPELLS-4.T1e)', () => {
    const authored = startOfTurnZone((parts) =>
      parts.savePath.resultBlock.outcomes.push(conditionOutcome())
    )
    expect(equipmentAuthoredDtoSchema.safeParse(authored).success).toBe(true)
    const zone = zonePlacementOf(authored)
    const { nodes, sourceEntryBindings } = zone.entry.frozenGraph.definition
    const withoutCondition = zonePlacementOf(startOfTurnZone())
    // The condition's proposal follows the test graph's own; the stop's interruption comes last.
    expect(nodes.map((node) => node.id)).toEqual(
      withoutCondition.entry.frozenGraph.definition.nodes.flatMap((node) =>
        node.id === 'proposal-on_save_fail'
          ? [node.id, 'proposal-on_save_fail-condition']
          : [node.id]
      )
    )
    expect(nodes.find((node) => node.id === 'proposal-on_save_fail-condition')).toMatchObject({
      inputs: { conditionId: { kind: 'LITERAL', value: conditionId('POISONED') } }
    })
    expect(sourceEntryBindings).toContainEqual({
      sourceEntryId: extraId(21),
      nodeId: 'proposal-on_save_fail-condition'
    })
    expect(zone.entry.frozenGraphNodeId).toBe('proposal-on_save_fail')
    expect(zone).not.toHaveProperty('heldCondition')
  })

  it.each<readonly [string, EquipmentAuthored]>([
    [
      'a zone-held condition on a zone that Concentration does not maintain',
      startOfTurnZone(failedSaveOnly(conditionOutcome()), ({ savePath }) => {
        savePath.resultBlock.lifecycle = { heldBySource: true }
      })
    ],
    [
      'a lifecycle on a condition the zone does not hold',
      startOfTurnZone(failedSaveOnly(conditionOutcome()), ({ savePath }) => {
        savePath.resultBlock.lifecycle = { endOnEvents: ['ON_LEAVING_AREA'] }
      })
    ],
    [
      'a zone-held condition that ends on another event',
      startOfTurnZone(failedSaveOnly(conditionOutcome()), ({ savePath }) => {
        savePath.resultBlock.lifecycle = { heldBySource: true, endOnEvents: ['ON_ATTACK_ROLL'] }
      })
    ],
    [
      'a zone-held condition with a further lifecycle',
      startOfTurnZone(failedSaveOnly(conditionOutcome()), ({ savePath }) => {
        savePath.resultBlock.lifecycle = {
          heldBySource: true,
          holderEnd: { activation: 'ACTION' }
        }
      })
    ],
    [
      'two conditions',
      startOfTurnZone(
        failedSaveOnly(conditionOutcome(), conditionOutcome(conditionId('BLINDED'), 22))
      )
    ],
    [
      'a condition outside the pinned System vocabulary',
      startOfTurnZone(failedSaveOnly(conditionOutcome(extraId(30))))
    ],
    [
      'two lost Actions',
      startOfTurnZone(losesAction, (parts) =>
        parts.savePath.resultBlock.outcomes.push(lostActionOutcome(23))
      )
    ],
    [
      'two stops',
      startOfTurnZone((parts) =>
        parts.savePath.resultBlock.outcomes.push({
          ...caltropsOutcome(parts, 'MOVEMENT_RULE'),
          id: extraId(24)
        })
      )
    ],
    [
      'two grants',
      startOfTurnZone((parts) =>
        parts.savePath.resultBlock.outcomes.push({
          ...caltropsOutcome(parts, 'APPLY_GRANT'),
          id: extraId(25)
        })
      )
    ],
    [
      'an outcome kind the set does not hold',
      startOfTurnZone((parts) =>
        parts.savePath.resultBlock.outcomes.push({
          id: extraId(26),
          effectKind: 'ACTION_ECONOMY_RULE',
          ruleKind: 'MAX_ATTACKS_PER_TURN',
          maximum: 1
        })
      )
    ],
    [
      'a save whose only outcome is the made save’s damage',
      startOfTurnZone((parts) => {
        failedSaveOnly(caltropsOutcome(parts, 'DAMAGE'))(parts)
        parts.savePath.pathCode = 'ON_SAVE_SUCCESS'
      })
    ],
    [
      'a made save that costs the Action',
      startOfTurnZone(
        losesAction,
        madeSave(() => lostActionOutcome(31))
      )
    ],
    [
      'a lost Action on a zone a mover enters',
      variantEquipment((parts) => {
        parts.component.interactionKinds = ['ENTER_SPACE', 'START_TURN_IN_SPACE']
        losesAction(parts)
      })
    ],
    [
      'a lost Action at the end of a turn',
      variantEquipment((parts) => {
        parts.component.interactionKinds = ['END_TURN_IN_SPACE']
        losesAction(parts)
      })
    ]
  ])('refuses %s instead of partly honoring it', (_name, equipment) => {
    expect(compileItemEntry(equipment).compilation).toMatchObject({
      kind: 'MANUAL',
      reasonCode: 'NOT_NORMALIZED'
    })
  })
})

const PRONE_ID = conditionId('PRONE')

/** The failed save applies `conditionId` and nothing else: no stop, damage or grant. */
function conditionOnFailedSave(id = PRONE_ID) {
  return ({ savePath }: ZoneParts) => {
    savePath.resultBlock.outcomes = [{ id: extraId(9), effectKind: 'CONDITION', conditionId: id }]
  }
}

describe('a zone a mover enters whose failed save applies a condition alone (SPELLS-4.T1d)', () => {
  const authored = variantEquipment(conditionOnFailedSave())

  it('passes the equipment publication contract', () => {
    expect(equipmentAuthoredDtoSchema.safeParse(authored).success).toBe(true)
  })

  it('applies the condition from the one frozen entry graph, only on the failed save', () => {
    const zone = zonePlacementOf(authored)
    const { nodes, outputs } = zone.entry.frozenGraph.definition
    expect(nodes.map((node) => node.id)).toEqual([
      'd20',
      'd20-added-dice',
      'test',
      'proposal-on_save_fail'
    ])
    expect(nodes.find((node) => node.id === 'proposal-on_save_fail')).toMatchObject({
      inputs: { conditionId: { kind: 'LITERAL', value: PRONE_ID } }
    })
    expect(outputs).not.toHaveProperty('movementInterruption')
    expect(zone.entry.compiledEntryId).toBe(extraId(9))
    expect(zone.grant).toBeNull()
  })

  it('refuses a condition on the made save instead of partly honoring it', () => {
    const change = (parts: ZoneParts) => {
      conditionOnFailedSave()(parts)
      parts.behavior.paths.push({
        ...parts.savePath,
        id: extraId(12),
        order: 2,
        pathCode: 'ON_SAVE_SUCCESS',
        resultBlock: {
          id: `${extraId(12)}__result`,
          resultKind: 'SINGLE',
          outcomes: [{ id: extraId(13), effectKind: 'CONDITION', conditionId: PRONE_ID }]
        }
      })
    }
    expect(compileItemEntry(variantEquipment(change)).compilation).toMatchObject({
      kind: 'MANUAL',
      reasonCode: 'NOT_NORMALIZED'
    })
  })
})

describe('a zone outcome with no save, at the start of its source’s turn (D144)', () => {
  const authored = variantEquipment((parts) => {
    diceDamage('2d6')(parts)
    noSave()(parts)
  })

  it('passes the equipment publication contract', () => {
    expect(equipmentAuthoredDtoSchema.safeParse(authored).success).toBe(true)
  })

  it('maps the interaction to a START_OF_SOURCE_TURN trigger and no movement trigger', () => {
    expect(zonePlacementOf(authored)).toMatchObject({
      triggerModes: [],
      turnTriggers: ['START_OF_SOURCE_TURN'],
      grant: null
    })
  })

  it('applies its damage directly: plain damage dice and a proposal, with no d20 or test node', () => {
    const { entry } = zonePlacementOf(authored)
    const { nodes } = entry.frozenGraph.definition
    expect(nodes.map((node) => node.id)).toEqual(['die-1', 'die-2', 'sum-1', 'proposal-on_use'])
    for (const dieId of ['die-1', 'die-2'])
      expect(nodes.find((node) => node.id === dieId)).toMatchObject({
        operation: { key: 'evidence.integer-range' },
        inputs: { min: { value: 1 }, max: { value: 6 } }
      })
    expect(entry).toMatchObject({
      frozenGraphNodeId: 'proposal-on_use',
      adapterFacts: {},
      castSaveDcFactKey: null
    })
  })
})

describe('a zone outcome with no save that a mover enters (D154)', () => {
  const authored = variantEquipment((parts) => {
    diceDamage('2d6')(parts)
    noSave(['ENTER_SPACE', 'END_TURN_IN_SPACE'])(parts)
  })

  it('passes the equipment publication contract', () => {
    expect(equipmentAuthoredDtoSchema.safeParse(authored).success).toBe(true)
  })

  it('maps the interactions to an ENTER trigger and the creature’s own turn end, dealing dice with no save', () => {
    const zone = zonePlacementOf(authored)
    expect(zone).toMatchObject({
      triggerModes: ['ENTER'],
      turnTriggers: ['END_OF_TURN'],
      grant: null
    })
    expect(zone.entry.frozenGraph.definition.nodes.map((node) => node.id)).toEqual([
      'die-1',
      'die-2',
      'sum-1',
      'proposal-on_use'
    ])
  })
})

describe('a zone’s movement cost and blocking rules (D154)', () => {
  const authored = (movementCostMultiplier: number) =>
    variantEquipment(({ component }) => {
      Object.assign(component, {
        movementCostMultiplier,
        blockingRules: ['BLOCKS_SIGHT', 'NONMAGICAL_RANGED_ATTACKS']
      })
    })

  it('passes the equipment publication contract', () => {
    expect(equipmentAuthoredDtoSchema.safeParse(authored(4)).success).toBe(true)
  })

  it('carries the authored movement cost and blocking rules onto the placed zone', () => {
    expect(zonePlacementOf(authored(4))).toMatchObject({
      movementCostMultiplier: 4,
      blockingRules: ['BLOCKS_SIGHT', 'NONMAGICAL_RANGED_ATTACKS']
    })
  })

  it.each([0.5, 1, 101])(
    'refuses a movement cost multiplier of %s instead of partly honoring it',
    (multiplier) => {
      expect(compileItemEntry(authored(multiplier)).compilation).toMatchObject({
        kind: 'MANUAL',
        reasonCode: 'NOT_NORMALIZED'
      })
    }
  )
})

describe('a creature’s passive zone (D144)', () => {
  const aura = creatureAuraFeature('2d6', 10)
  const discover = (feature = aura) =>
    discoverEncounterFeatureActions({
      spells: new Map(),
      actor: srdCreatureActor({
        id: testUuid(0x1950),
        creature: withFeature(srdByLabel(SRD.creatures, 'Goblin'), feature)
      }),
      conditionDefinitionIds: srdSystemRecord.conditionTypes.map(({ id }) => id),
      abilityDefinitions: (srdSystemRecord.abilities ?? []).map(({ id, code }) => ({ id, code }))
    })

  it('compiles to a source-anchored zone acting at its source’s turn start, never offered as an action', () => {
    const discovery = discover()
    expect(discovery.available.some(({ ownerFeatureId }) => ownerFeatureId === aura.id)).toBe(false)
    expect(discovery.unavailable.some(({ ownerFeatureId }) => ownerFeatureId === aura.id)).toBe(
      false
    )
    expect(discovery.passiveZones).toHaveLength(1)
    const [{ capability, zone }] = discovery.passiveZones
    expect(capability).toMatchObject({ ownerFeatureId: aura.id, effectId: aura.effects![0]!.id })
    expect(zone).toMatchObject({
      attachment: 'SOURCE',
      turnTriggers: ['START_OF_SOURCE_TURN'],
      triggerModes: []
    })
  })

  it('shows a passive zone the System cannot honor as unavailable, with no zone', () => {
    const mover = structuredClone(aura)
    const path = mover.effects![0]!.paths[0]!
    const outcome = path.selectionKind === 'FIXED' ? path.resultBlock.outcomes[0] : undefined
    if (outcome?.effectKind !== 'MANIFEST' || outcome.manifestKind !== 'ZONE')
      throw new Error('The aura is a manifest zone.')
    // A fully-within rule on a zone a mover enters, which acts only at turn boundaries.
    Object.assign(outcome.components![0]!, {
      interactionKinds: ['ENTER_SPACE'],
      requiresFullyWithin: true
    })
    const discovery = discover(mover)
    expect(discovery.passiveZones).toEqual([])
    expect(discovery.unavailable).toContainEqual(
      expect.objectContaining({ ownerFeatureId: aura.id })
    )
  })
})

describe('a source zone that burns a melee attacker standing in it (SPELLS-20 T6d1, D153)', () => {
  const passiveZoneOf = (creature: Parameters<typeof srdCreatureActor>[0]['creature']) => {
    const { passiveZones } = discoverEncounterFeatureActions({
      spells: new Map(),
      actor: srdCreatureActor({ id: testUuid(0x1951), creature }),
      conditionDefinitionIds: srdSystemRecord.conditionTypes.map(({ id }) => id),
      abilityDefinitions: (srdSystemRecord.abilities ?? []).map(({ id, code }) => ({ id, code }))
    })
    const [passive, ...others] = passiveZones
    if (!passive || others.length) throw new Error('The creature must keep exactly one zone.')
    return passive.zone
  }
  const goblinWith = (feature: ReturnType<typeof creatureAuraFeature>) =>
    passiveZoneOf(withFeature(srdByLabel(SRD.creatures, 'Goblin'), feature))

  it('compiles the melee-hit interaction beside the turn trigger of the same component', () => {
    expect(
      goblinWith(creatureAuraFeature('2d6', 5, ['START_OF_SOURCE_TURN', 'MELEE_HIT_ON_SOURCE']))
    ).toMatchObject({
      attachment: 'SOURCE',
      triggerModes: [],
      turnTriggers: ['START_OF_SOURCE_TURN'],
      retaliatesMeleeHits: true
    })
  })

  it('compiles a zone that only answers melee hits, with no movement or turn trigger', () => {
    const zone = goblinWith(creatureAuraFeature('2d6', 5, ['MELEE_HIT_ON_SOURCE']))
    expect(zone).toMatchObject({ triggerModes: [], retaliatesMeleeHits: true, grant: null })
    expect(zone).not.toHaveProperty('turnTriggers')
  })

  it('leaves the flag off a zone that does not answer melee hits', () => {
    expect(goblinWith(creatureAuraFeature('2d6'))).not.toHaveProperty('retaliatesMeleeHits')
  })

  it('compiles the SRD Balor’s Fire Aura as the same zone a core-options aura of 3d6 fire answering melee hits is (ADR 0038)', () => {
    const comparable = ({ label: _label, shape, entry, ...rest }: CompiledActionZonePlacement) => ({
      ...rest,
      shape: { ...shape, id: null },
      nodes: entry.frozenGraph.definition.nodes.map(({ id, operation }) => ({ id, operation }))
    })
    const balor = passiveZoneOf(srdByLabel(SRD.creatures, 'Balor'))
    const homebrew = goblinWith(
      creatureAuraFeature('3d6', 5, ['START_OF_SOURCE_TURN', 'MELEE_HIT_ON_SOURCE'])
    )
    expect(balor).toMatchObject({ label: 'Fire Aura', retaliatesMeleeHits: true })
    expect(comparable(balor)).toEqual(comparable(homebrew))
  })

  it('compiles the SRD Remorhaz’s zone-less Heated Body as the same zone a core-options 5 ft aura of 3d6 fire answering melee hits is (SPELLS-33 T4k2)', () => {
    const comparable = ({ label: _label, shape, entry, ...rest }: CompiledActionZonePlacement) => ({
      ...rest,
      shape: { ...shape, id: null },
      nodes: entry.frozenGraph.definition.nodes.map(({ id, operation }) => ({ id, operation }))
    })
    const remorhaz = passiveZoneOf(srdByLabel(SRD.creatures, 'Remorhaz'))
    const homebrew = goblinWith(creatureAuraFeature('3d6', 5, ['MELEE_HIT_ON_SOURCE']))
    expect(remorhaz).toMatchObject({
      label: 'Heated Body',
      attachment: 'SOURCE',
      retaliatesMeleeHits: true
    })
    expect(remorhaz).not.toHaveProperty('turnTriggers')
    expect(comparable(remorhaz)).toEqual(comparable(homebrew))
  })

  it('stays manual on a zone left at a point, which has no source to hit', () => {
    expect(
      compileItemEntry(
        variantEquipment((parts) => {
          diceDamage('2d6')(parts)
          noSave(['MELEE_HIT_ON_SOURCE'])(parts)
        })
      ).compilation
    ).toMatchObject({ kind: 'MANUAL', reasonCode: 'NOT_NORMALIZED' })
  })
})

describe('a zone the System cannot honor in full stays manual', () => {
  const REFUSED: readonly (readonly [string, (parts: ZoneParts) => void])[] = [
    [
      'two components',
      ({ zone, component }) => {
        zone.components = [component, { ...component, id: extraId(2), order: 2 }]
      }
    ],
    [
      'two behaviors',
      ({ component, behavior }) => {
        component.behaviors = [behavior, { ...behavior, id: extraId(3), order: 2 }]
      }
    ],
    [
      'an unmodeled zone field',
      ({ zone }) => {
        Object.assign(zone, { hollow: true })
      }
    ],
    [
      'an unmodeled component field',
      ({ component }) => {
        Object.assign(component, { hollow: true })
      }
    ],
    [
      'a fully-within rule on a zone that a mover enters',
      ({ component }) => {
        component.requiresFullyWithin = true
      }
    ],

    [
      'a save DC that is not fixed',
      ({ invocation }) => {
        invocation.savingThrow = {
          id: invocation.savingThrow.id,
          abilityDefinitionId: invocation.savingThrow.abilityDefinitionId,
          dcMethod: 'DERIVED_DC',
          baseDc: 13,
          bonuses: []
        }
      }
    ],
    [
      'an entry that is not the failed save',
      ({ savePath }) => {
        savePath.pathCode = 'ON_SAVE_SUCCESS'
      }
    ],
    [
      'two damage outcomes',
      ({ savePath }) => {
        const damage = savePath.resultBlock.outcomes.find(
          (outcome) => outcome.effectKind === 'DAMAGE'
        )
        if (!damage) throw new Error('The zone must author damage.')
        savePath.resultBlock.outcomes.push({ ...damage, id: extraId(4) })
      }
    ],
    [
      'a grant that ends on an attack roll, which the Encounter never reads for a grant',
      ({ savePath }) => {
        savePath.resultBlock.lifecycle = { endOnEvents: ['ON_ATTACK_ROLL'] }
      }
    ],
    [
      'a grant that ends on casting a spell, which the Encounter never reads for a grant',
      ({ savePath }) => {
        savePath.resultBlock.lifecycle = { endOnEvents: ['ON_CAST_SPELL'] }
      }
    ],
    [
      'a cone, which is aimed rather than placed at a point',
      ({ zone }) => {
        zone.shape = { id: extraId(5), shapeKind: 'CONE', length: { amount: 15, unit: 'FEET' } }
      }
    ],
    [
      'a zone outcome with no save that halves its dice',
      (parts) => {
        diceDamage('2d6', (damage) => Object.assign(damage, { multiplier: 0.5 }))(parts)
        noSave()(parts)
      }
    ],
    [
      'a zone outcome with no save that stops the mover',
      (parts) => {
        const stop = parts.savePath.resultBlock.outcomes[0]!
        diceDamage('2d6')(parts)
        noSave()(parts)
        parts.savePath.resultBlock.outcomes.push(stop)
      }
    ],
    [
      'a cube aimed from the caster',
      ({ effect }) => {
        effect.invocation.range = { id: effect.invocation.range.id, rangeKind: 'SELF' }
      }
    ]
  ]

  it.each(REFUSED)('refuses %s instead of partly honoring it', (_name, change) => {
    expect(compileItemEntry(variantEquipment(change)).compilation).toMatchObject({
      kind: 'MANUAL',
      reasonCode: 'NOT_NORMALIZED'
    })
  })
})
