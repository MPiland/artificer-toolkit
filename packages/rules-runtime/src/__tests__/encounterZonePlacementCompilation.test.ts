import { describe, expect, it } from 'vitest'
import {
  SRD_ABILITIES,
  SRD_ABILITY_DEFINITION_IDS,
  SRD_CONDITION_TYPES,
  SRD_SYSTEM_ID
} from '@artificer-toolkit/source-data/srd/vocabulary.js'

import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import { equipmentAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/equipment'
import type { EquipmentAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { caltropsBagOf20 } from '@artificer-toolkit/source-data/srd/equipment/caltrops-bag-of-20.js'

import { prepareActiveRuleEffectRecord } from '../activeRuleEffectRecords.js'
import { discoverCharacterActionCapabilities } from '../characterActionCapabilityDiscoveryRegistry.js'
import { compileCharacterActionEntryPoints } from '../encounterActionEntryPointCompiler.js'
import { encounterActionTargetKind } from '../encounterAreaAction.js'
import { effectsEndedBy } from '../encounterGrantLifetimes.js'
import { planEncounterPlacedZone } from '../encounterPlacedZone.js'
import { planSpatialEntryGrant } from '../encounterSpatialEntryGrant.js'
import {
  DND5E_ACTIVE_EFFECT_SAVE_ABILITY_DEFINITION_FACT_KEY,
  DND5E_SAVE_DC_FACT_KEY
} from '../systems/dnd5e/effectActionCompiler.js'
import { ENCOUNTER_ID, TIMESTAMP, testUuid } from '../testing/dnd5eSrdEncounter.js'
import { evaluateSrdCharacter } from './dnd5eSrdCharacter.js'

const CALTROPS = 'Caltrops (bag of 20)'

/**
 * A Character carrying an item (real SRD Caltrops unless a further authored record is given),
 * compiled through the real policy and entry compiler.
 */
function compileItemEntry(equipment?: EquipmentAuthored) {
  const label = equipment?.label ?? CALTROPS
  const character = evaluateSrdCharacter({
    abilities: { DEXTERITY: 14 },
    classes: [{ label: 'Fighter', level: 1 }],
    items: [{ label }],
    ...(equipment ? { extraEquipment: [equipment] } : {})
  })
  const itemInstanceId = character.itemInstanceId(label)
  const candidate = character.facts.actionCandidates.find(
    (entry) => entry.equipment?.itemInstanceId === itemInstanceId
  )
  if (!candidate) throw new Error('The item must offer an action.')
  const entry = compileCharacterActionEntryPoints({
    gameSystemId: SRD_SYSTEM_ID,
    candidates: character.facts.actionCandidates,
    descriptors: discoverCharacterActionCapabilities({
      gameSystemId: SRD_SYSTEM_ID,
      candidates: character.facts.actionCandidates,
      conditionDefinitionIds: SRD_CONDITION_TYPES.map((condition) => condition.id).sort(),
      abilityDefinitions: SRD_ABILITIES.map(({ id, code }) => ({ id, code })),
      entryPoints: character.entryPoints
    })
  }).find((compiled) => compiled.actionId === candidate.actionId)
  if (entry?.kind !== 'CHARACTER_ACTION') throw new Error('The item must compile an action entry.')
  return entry
}

function compileCaltropsEntry(equipment?: EquipmentAuthored) {
  const entry = compileItemEntry(equipment)
  if (entry.schemaVersion !== 4)
    throw new Error('Caltrops must compile to a v4 Character action entry.')
  if (entry.compilation.kind !== 'COMPILED')
    throw new Error('Caltrops must compile, not go manual.')
  return { entry, compilation: entry.compilation }
}

describe('placed-space zone compilation from real SRD Caltrops', () => {
  it('compiles the manifest zone to a point-placed 5-foot square that triggers on entering or passing through', () => {
    const { entry, compilation } = compileCaltropsEntry()
    expect(compilation.activeEffectPlan).toBeNull()
    expect(compilation.zonePlacement?.maintenance).toBeNull()
    expect(compilation.zonePlacement).toMatchObject({
      label: 'Caltrop field',
      shape: { shapeKind: 'CUBE', edgeLength: { amount: 5, unit: 'FEET' } },
      triggerModes: ['ENTER', 'CROSS'],
      bypassAtHalfSpeed: true
    })
    expect(entry.targetPolicy?.shape).toMatchObject({ shapeKind: 'CUBE' })
    expect(entry.targetPolicy && encounterActionTargetKind(entry.targetPolicy)).toBe('POINT')
  })

  it('freezes the authored Dexterity save, stop, damage and speed penalty as the zone entry', () => {
    const zone = compileCaltropsEntry().compilation.zonePlacement
    if (!zone) throw new Error('Caltrops must place a zone.')
    expect(zone.entry.frozenGraph.definition.nodes.map((node) => node.id)).toEqual([
      'd20',
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
  const zone = compileCaltropsEntry().compilation.zonePlacement
  if (!zone) throw new Error('Caltrops must place a zone.')
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
      effectsEndedBy([grantRecordFor(placedCaltropsZone())], 'ON_HIT_POINTS_REGAINED')
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
      grant?.definition.schemaVersion === 2 &&
        grant.definition.stateContributions.every(
          (contribution) =>
            contribution.kind !== 'MODIFIER_GRANT' || !('endOnEvents' in contribution)
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
    expect(effectsEndedBy(held, 'ON_HIT_POINTS_REGAINED')).toEqual(held)
    expect(effectsEndedBy(held, 'ON_ATTACK_ROLL')).toEqual([])
    expect(effectsEndedBy(held, 'ON_CAST_SPELL')).toEqual([])
  })
})

const VARIANT_ID = testUuid(0x1790)
const VARIANT_LABEL = 'Spike field (bag)'
const extraId = (offset: number) => testUuid(0x1800 + offset)

/** The pieces of the one zone action Caltrops authors, found by narrowing the authored record. */
function zoneParts(equipment: EquipmentAuthored) {
  const effect = equipment.effects?.[0]
  const path = effect?.paths[0]
  const outcome = path?.selectionKind === 'FIXED' ? path.resultBlock.outcomes[0] : undefined
  if (!effect || outcome?.effectKind !== 'MANIFEST' || outcome.manifestKind !== 'ZONE')
    throw new Error('The record must author a zone action.')
  const component = outcome.components?.[0]
  const behavior = component?.behaviors?.[0]
  const savePath = behavior?.paths[0]
  const invocation = behavior?.invocation
  if (
    !component ||
    !behavior ||
    savePath?.selectionKind !== 'FIXED' ||
    !invocation ||
    !('savingThrow' in invocation)
  )
    throw new Error('The zone must author one saving-throw behavior.')
  return { effect, zone: outcome, component, behavior, savePath, invocation }
}
type ZoneParts = ReturnType<typeof zoneParts>

/** A copy of the real SRD Caltrops record, edited and given an identity of its own. */
function variantEquipment(change: (parts: ZoneParts) => void): EquipmentAuthored {
  const equipment: EquipmentAuthored = {
    ...structuredClone(caltropsBagOf20),
    id: VARIANT_ID,
    label: VARIANT_LABEL
  }
  change(zoneParts(equipment))
  return equipment
}

function zonePlacementOf(equipment?: EquipmentAuthored) {
  const zone = compileCaltropsEntry(equipment).compilation.zonePlacement
  if (!zone) throw new Error('The item must place a zone.')
  return zone
}

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

/** The authored zone damage, as dice instead of the fixed amount. */
function diceDamage(diceConfig: string, change?: (damage: Record<string, unknown>) => void) {
  return ({ savePath }: ZoneParts) => {
    const damage = savePath.resultBlock.outcomes.find((outcome) => outcome.effectKind === 'DAMAGE')
    if (!damage) throw new Error('The zone must author damage.')
    const authored: Record<string, unknown> = damage
    delete authored.amount
    Object.assign(authored, { valueKind: 'DICE', diceConfig })
    change?.(authored)
  }
}

describe('a zone whose failed entry save deals dice damage (D133)', () => {
  const authored = variantEquipment(diceDamage('2d6'))

  it('passes the equipment publication contract', () => {
    expect(equipmentAuthoredDtoSchema.safeParse(authored).success).toBe(true)
  })

  it('rolls its dice inside the one frozen entry graph, only for the failed save', () => {
    const { nodes, outputs } = zonePlacementOf(authored).entry.frozenGraph.definition
    expect(nodes.map((node) => node.id)).toEqual([
      'd20',
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
      'test',
      'damage-enabled',
      'damage-die-1',
      'damage-die-2',
      'damage-sum-1',
      'proposal-on_save_fail',
      'damage-success-enabled',
      'damage-success-die-1',
      'damage-success-die-2',
      'damage-success-sum-1',
      'damage-success-multiplied',
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
    expect(nodes.find((node) => node.id === 'proposal-on_save_success')?.inputs.amount).toEqual({
      kind: 'NODE_OUTPUT',
      nodeId: 'damage-success-multiplied',
      port: 'value'
    })
    expect(nodes.find((node) => node.id === 'proposal-on_save_fail')?.inputs.amount).toEqual({
      kind: 'NODE_OUTPUT',
      nodeId: 'damage-sum-1',
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
        Object.assign(component, { requiresFullyWithin: true })
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
