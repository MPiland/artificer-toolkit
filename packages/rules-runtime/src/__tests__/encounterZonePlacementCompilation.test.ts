import { describe, expect, it } from 'vitest'
import {
  SRD_ABILITIES,
  SRD_ABILITY_DEFINITION_IDS,
  SRD_CONDITION_TYPES,
  SRD_SYSTEM_ID
} from '@artificer-toolkit/source-data/srd/vocabulary.js'

import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'

import { prepareActiveRuleEffectRecord } from '../activeRuleEffectRecords.js'
import { discoverCharacterActionCapabilities } from '../characterActionCapabilityDiscoveryRegistry.js'
import { compileCharacterActionEntryPoints } from '../encounterActionEntryPointCompiler.js'
import { encounterActionTargetKind } from '../encounterAreaAction.js'
import { grantsEndedBy } from '../encounterGrantLifetimes.js'
import { planEncounterPlacedZone } from '../encounterPlacedZone.js'
import { planSpatialEntryGrant } from '../encounterSpatialEntryGrant.js'
import {
  DND5E_ACTIVE_EFFECT_SAVE_ABILITY_DEFINITION_FACT_KEY,
  DND5E_SAVE_DC_FACT_KEY
} from '../systems/dnd5e/effectActionCompiler.js'
import { ENCOUNTER_ID, TIMESTAMP, testUuid } from '../testing/dnd5eSrdEncounter.js'
import { evaluateSrdCharacter } from './dnd5eSrdCharacter.js'

const CALTROPS = 'Caltrops (bag of 20)'

/** A Character carrying real SRD Caltrops, compiled through the real policy and entry compiler. */
function compileCaltropsEntry() {
  const character = evaluateSrdCharacter({
    abilities: { DEXTERITY: 14 },
    classes: [{ label: 'Fighter', level: 1 }],
    items: [{ label: CALTROPS }]
  })
  const itemInstanceId = character.itemInstanceId(CALTROPS)
  const candidate = character.facts.actionCandidates.find(
    (entry) => entry.equipment?.itemInstanceId === itemInstanceId
  )
  if (!candidate) throw new Error('Caltrops must offer an action.')
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
  if (entry?.kind !== 'CHARACTER_ACTION' || entry.schemaVersion !== 4)
    throw new Error('Caltrops must compile to a v4 Character action entry.')
  if (entry.compilation.kind !== 'COMPILED')
    throw new Error('Caltrops must compile, not go manual.')
  return { entry, compilation: entry.compilation }
}

describe('placed-space zone compilation from real SRD Caltrops', () => {
  it('compiles the manifest zone to a point-placed 5-foot square that triggers on entering', () => {
    const { entry, compilation } = compileCaltropsEntry()
    expect(compilation.activeEffectPlan).toBeNull()
    expect(compilation.zonePlacement).toMatchObject({
      label: 'Caltrop field',
      shape: { shapeKind: 'CUBE', edgeLength: { amount: 5, unit: 'FEET' } },
      triggerModes: ['ENTER'],
      movementKinds: ['VOLUNTARY', 'FORCED', 'TELEPORT'],
      activation: 'REPEATABLE',
      visibility: 'PUBLIC',
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
    expect(zone.lingeringEffect?.modifierGrantContribution).toMatchObject({
      modifiers: [expect.objectContaining({ modifierKind: 'PENALTY' })],
      endOnEvents: ['ON_HIT_POINTS_REGAINED']
    })
    expect(zone.lingeringEffect?.modifierGrantContribution?.modifiers[0]?.grant).toMatchObject({
      payload: { amount: 10, unit: 'FEET' }
    })
    expect(zone.lingeringEffect?.initialRemaining).toBeNull()
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
    encounterId: ENCOUNTER_ID,
    occurrenceId: OCCURRENCE_ID,
    rootCommandId: SPREAD_COMMAND_ID,
    sourceActorId: SOURCE_ID,
    point: { x: 250, y: 350 },
    area: { kind: 'CUBE', edgeLength: 100 }
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

function grantRecordFor(grant: NonNullable<ReturnType<typeof plannedEntryGrant>>) {
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
      triggerModes: ['ENTER'],
      activation: 'REPEATABLE',
      visibility: 'PUBLIC',
      revealOnTrigger: false,
      label: 'Caltrop field',
      bypassAtHalfSpeed: true
    })
  })

  it('freezes the authored entry and the speed penalty that ends when hit points are regained', () => {
    const { definition } = placedCaltropsZone()
    expect(definition).toMatchObject({
      schemaVersion: 2,
      origin: { kind: 'ENCOUNTER', sourceAggregateId: ENCOUNTER_ID, sourceActorId: SOURCE_ID },
      recurrence: { endOnEvents: ['ON_HIT_POINTS_REGAINED'], expiration: { kind: 'INDEFINITE' } },
      stateContributions: [{ kind: 'MODIFIER_GRANT', sourceLabel: 'Caltrop field' }]
    })
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
    expect(grantsEndedBy(held, 'ON_HIT_POINTS_REGAINED')).toEqual(held)
    expect(grantsEndedBy(held, 'ON_ATTACK_ROLL')).toEqual([])
    expect(grantsEndedBy(held, 'ON_CAST_SPELL')).toEqual([])
  })
})
