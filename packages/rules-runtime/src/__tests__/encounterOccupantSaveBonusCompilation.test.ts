import { describe, expect, it } from 'vitest'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { CLASS_IDS } from '@artificer-toolkit/source-data/srd/ids.js'

import type { CompiledActionZonePlacement } from '@artificer-toolkit/schema/projections/characterMechanics'
import type { ShapeMeasurementAuthored } from '@artificer-toolkit/shared/core'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'

import { discoverEncounterFeatureActions } from '../encounterFeatureActionCapabilityDiscoveryRegistry.js'
import {
  planEncounterPlacedZone,
  zoneShapeAtSource,
  type PlacedZoneSource
} from '../encounterPlacedZone.js'
import { SRD, srdByLabel } from '../testing/dnd5eSrdCharacter.js'
import { srdCreatureActor, testUuid } from '../testing/dnd5eSrdEncounter.js'
import {
  compileItemEntry,
  creatureAuraFeature,
  extraId,
  variantEquipment,
  withFeature
} from '../testing/authoredZoneFixture.js'

/**
 * SPELLS-20 T5a (D155): a zone component may lend its occupants a continuous save bonus. It compiles
 * on a source zone with no trigger or behavior, keeps a radius scaled by class level for placement to
 * resolve, and is refused everywhere else rather than partly honored.
 */

type CreatureFeature = NonNullable<CreatureAuthored['features']>[number]
type AuraZone = Extract<
  NonNullable<CreatureFeature['effects']>[number]['paths'][number],
  { selectionKind: 'FIXED' }
>['resultBlock']['outcomes'][number]

const CHARISMA_BONUS = {
  id: extraId(40),
  domain: 'EVERY_SAVING_THROW',
  amountKind: 'SOURCE_ABILITY_MODIFIER',
  ability: 'CHARISMA',
  minimum: 1,
  dispositionFilter: 'ALLIES_AND_SOURCE'
} as const

const PALADIN_REACH: ShapeMeasurementAuthored = {
  amount: 10,
  unit: 'FEET',
  scaling: {
    scalingKind: 'BREAKPOINTS',
    scalingSource: 'CLASS_LEVEL',
    classId: CLASS_IDS.PALADIN,
    breakpoints: [{ id: extraId(41), level: 18, order: 1, value: { amount: 30, unit: 'FEET' } }]
  }
}

/** The SRD paladin's Aura of Protection, carried as a Creature feature so discovery compiles it. */
function auraOfProtectionFeature(): CreatureFeature {
  const feature = srdByLabel(SRD.classes, 'Paladin').features?.find(
    ({ label }) => label === 'Aura of Protection'
  )
  if (!feature?.effects) throw new Error('The paladin must author its Aura of Protection.')
  return {
    id: feature.id,
    label: feature.label,
    description: feature.description,
    order: 99,
    effects: structuredClone(feature.effects)
  }
}

/** Every zone and invocation shape of a feature, so a test can rewrite the aura it authors. */
function auraParts(feature: CreatureFeature) {
  const effect = feature.effects?.[0]
  const path = effect?.paths[0]
  const zone: AuraZone | undefined =
    path?.selectionKind === 'FIXED' ? path.resultBlock.outcomes[0] : undefined
  const component =
    zone?.effectKind === 'MANIFEST' && zone.manifestKind === 'ZONE'
      ? zone.components?.[0]
      : undefined
  if (!effect || zone?.effectKind !== 'MANIFEST' || zone.manifestKind !== 'ZONE' || !component)
    throw new Error('The aura must author one zone component.')
  return { effect, zone, component }
}

/** A Builder-authored aura from core options: the Charisma bonus within the paladin's reach. */
function coreOptionsAura(change?: (parts: ReturnType<typeof auraParts>) => void): CreatureFeature {
  const feature = creatureAuraFeature('1d6', 10)
  const parts = auraParts(feature)
  const { effect, zone, component } = parts
  delete component.interactionKinds
  delete component.behaviors
  component.occupantSaveBonus = { ...CHARISMA_BONUS }
  for (const shape of [effect.invocation.shape, zone.shape])
    if (shape?.shapeKind === 'SPHERE') shape.radius = structuredClone(PALADIN_REACH)
  change?.(parts)
  return feature
}

function discover(feature: CreatureFeature) {
  return discoverEncounterFeatureActions({
    spells: new Map(),
    actor: srdCreatureActor({
      id: testUuid(0x1a50),
      creature: withFeature(srdByLabel(SRD.creatures, 'Goblin'), feature)
    }),
    conditionDefinitionIds: srdSystemRecord.conditionTypes.map(({ id }) => id),
    abilityDefinitions: (srdSystemRecord.abilities ?? []).map(({ id, code }) => ({ id, code }))
  })
}

function placeAura(zone: CompiledActionZonePlacement, source?: PlacedZoneSource) {
  return planEncounterPlacedZone({
    zone,
    id: testUuid(0x1a51),
    maintainedEffectStateId: null,
    encounterId: testUuid(0x1a52),
    occurrenceId: testUuid(0x1a53),
    rootCommandId: testUuid(0x1a54),
    sourceActorId: testUuid(0x1a50),
    point: { x: 0, y: 0 },
    area: { kind: 'RADIUS', radius: 10 },
    sourceToken: { tokenId: testUuid(0x1a55), width: 1 },
    saveDc: null,
    ...(source ? { source } : {})
  })
}

function passiveZoneOf(feature: CreatureFeature): CompiledActionZonePlacement {
  const [passive, ...others] = discover(feature).passiveZones
  if (!passive || others.length) throw new Error('The creature must keep exactly one zone.')
  return passive.zone
}

describe('an occupant save-bonus aura (SPELLS-20 T5a, D155)', () => {
  it('compiles the SRD Aura of Protection to an untriggered source zone lending the Charisma bonus', () => {
    const zone = passiveZoneOf(auraOfProtectionFeature())
    expect(zone).toMatchObject({
      attachment: 'SOURCE',
      label: 'Aura of Protection',
      triggerModes: [],
      grant: null,
      maintenance: null,
      occupantSaveBonus: {
        domain: 'EVERY_SAVING_THROW',
        dispositionFilter: 'ALLIES_AND_SOURCE',
        amount: { kind: 'SOURCE_ABILITY_MODIFIER', ability: 'CHARISMA', minimum: 1 }
      }
    })
    for (const absent of ['turnTriggers', 'retaliatesMeleeHits', 'heldCondition', 'sourceGrant'])
      expect(zone).not.toHaveProperty(absent)
    expect(zone.entry.castSaveDcFactKey).toBeNull()
    expect(zone.entry.frozenGraph.definition.nodes).toHaveLength(1)
  })

  it('keeps the radius scaled by paladin level for placement to resolve: 10 feet, 30 from level 18', () => {
    const { shape } = passiveZoneOf(auraOfProtectionFeature())
    const { scaling, ...reach } = PALADIN_REACH
    expect(shape).toMatchObject({
      shapeKind: 'SPHERE',
      radius: {
        ...reach,
        scaling: {
          ...scaling,
          breakpoints: [expect.objectContaining({ level: 18, value: { amount: 30, unit: 'FEET' } })]
        }
      }
    })
  })

  it('compiles the SRD aura as the same zone a core-options aura is (ADR 0038)', () => {
    // Authored identities and the label differ by design; the rule each zone carries must not.
    const comparable = ({ label: _label, shape, entry, ...rest }: CompiledActionZonePlacement) => {
      if (!('radius' in shape)) throw new Error('The aura must be a sphere.')
      const { id: _shapeId, radius, ...measurements } = shape
      const { scaling, ...reach } = radius
      return {
        ...rest,
        shape: measurements,
        reach,
        scaling: scaling && {
          ...scaling,
          breakpoints: scaling.breakpoints.map(({ id: _id, ...point }) => point)
        },
        nodes: entry.frozenGraph.definition.nodes.map(({ operation }) => operation)
      }
    }
    expect(comparable(passiveZoneOf(auraOfProtectionFeature()))).toEqual(
      comparable(passiveZoneOf(coreOptionsAura()))
    )
  })

  it('compiles a fixed bonus as authored', () => {
    const zone = passiveZoneOf(
      coreOptionsAura(({ component }) => {
        component.occupantSaveBonus = {
          id: extraId(42),
          domain: 'EVERY_SAVING_THROW',
          amountKind: 'FIXED',
          amount: 2,
          dispositionFilter: 'ALLIES_AND_SOURCE'
        }
      })
    )
    expect(zone.occupantSaveBonus?.amount).toEqual({ kind: 'FIXED', value: 2 })
  })

  it.each([
    [
      'a trigger beside the bonus',
      ({ component }: ReturnType<typeof auraParts>) => {
        component.interactionKinds = ['START_OF_SOURCE_TURN']
      }
    ],
    [
      'a movement cost beside the bonus',
      ({ component }: ReturnType<typeof auraParts>) => {
        component.movementCostMultiplier = 2
      }
    ],
    [
      'a radius scaled by the spell’s cast level',
      ({ zone }: ReturnType<typeof auraParts>) => {
        if (zone.shape?.shapeKind !== 'SPHERE' || !zone.shape.radius.scaling)
          throw new Error('The aura must author a scaled sphere.')
        zone.shape.radius.scaling = {
          scalingKind: 'BREAKPOINTS',
          scalingSource: 'SPELL_CAST_LEVEL',
          breakpoints: zone.shape.radius.scaling.breakpoints
        }
      }
    ]
  ])('shows an aura with %s as unavailable, with no zone', (_name, change) => {
    const feature = coreOptionsAura(change)
    const discovery = discover(feature)
    expect(discovery.passiveZones).toEqual([])
    expect(discovery.unavailable).toContainEqual(
      expect.objectContaining({ ownerFeatureId: feature.id })
    )
  })

  it('stays manual on a zone left at a point, which has no source to stand with', () => {
    expect(
      compileItemEntry(
        variantEquipment(({ component }) => {
          delete component.interactionKinds
          delete component.behaviors
          delete component.bypassAtHalfSpeed
          component.occupantSaveBonus = { ...CHARISMA_BONUS }
        })
      ).compilation
    ).toMatchObject({ kind: 'MANUAL', reasonCode: 'NOT_NORMALIZED' })
  })

  it('pins the bonus and reach against its source at placement (T5b)', () => {
    const zone = passiveZoneOf(auraOfProtectionFeature())
    const paladin18 = {
      abilityModifier: (ability: string) => (ability === 'CHARISMA' ? -1 : 0),
      classLevel: (classId: string) => (classId === CLASS_IDS.PALADIN ? 18 : 0)
    }
    expect(zoneShapeAtSource(zone.shape, paladin18)).toMatchObject({
      radius: { amount: 30, unit: 'FEET' }
    })
    expect(placeAura(zone, paladin18).placement.occupantSaveBonus).toEqual({
      domain: 'EVERY_SAVING_THROW',
      dispositionFilter: 'ALLIES_AND_SOURCE',
      amount: 1
    })
  })

  it('refuses to place a bonus of its source’s modifier with no source to resolve it against', () => {
    expect(() => placeAura(passiveZoneOf(auraOfProtectionFeature()))).toThrow(
      'A save bonus from its source’s modifier is resolved against it.'
    )
  })
})

describe('an occupant condition-immunity aura (SPELLS-31.T4r, D155)', () => {
  const conditionId = (code: string) =>
    srdSystemRecord.conditionTypes.find((condition) => condition.code === code)?.id ?? code
  /** The SRD paladin's Aura of Courage, carried as a Creature feature so discovery compiles it. */
  function auraOfCourageFeature(): CreatureFeature {
    const feature = srdByLabel(SRD.classes, 'Paladin').features?.find(
      ({ label }) => label === 'Aura of Courage'
    )
    if (!feature?.effects) throw new Error('The paladin must author its Aura of Courage.')
    return {
      id: feature.id,
      label: feature.label,
      description: feature.description,
      order: 99,
      effects: structuredClone(feature.effects)
    }
  }
  /** A Builder-authored aura from core options keeping charmed and frightened off within the reach. */
  const coreOptionsImmunityAura = (change?: (parts: ReturnType<typeof auraParts>) => void) =>
    coreOptionsAura((parts) => {
      delete parts.component.occupantSaveBonus
      parts.component.occupantConditionImmunity = {
        id: extraId(43),
        conditionTypeIds: [conditionId('FRIGHTENED')],
        dispositionFilter: 'ALLIES_AND_SOURCE'
      }
      change?.(parts)
    })

  it('compiles the SRD Aura of Courage to an untriggered source zone keeping frightened off', () => {
    const zone = passiveZoneOf(auraOfCourageFeature())
    expect(zone).toMatchObject({
      attachment: 'SOURCE',
      triggerModes: [],
      grant: null,
      occupantConditionImmunity: {
        dispositionFilter: 'ALLIES_AND_SOURCE',
        conditionTypeIds: [conditionId('FRIGHTENED')]
      }
    })
    expect(zone).not.toHaveProperty('occupantSaveBonus')
  })

  it('compiles the SRD aura as the same zone a core-options aura is (ADR 0038)', () => {
    const comparable = ({ label: _label, shape, entry, ...rest }: CompiledActionZonePlacement) => {
      if (!('radius' in shape)) throw new Error('The aura must be a sphere.')
      const { scaling, ...reach } = shape.radius
      return {
        ...rest,
        reach,
        breakpoints: scaling?.breakpoints.map(({ id: _id, ...point }) => point),
        nodes: entry.frozenGraph.definition.nodes.map(({ operation }) => operation)
      }
    }
    expect(comparable(passiveZoneOf(auraOfCourageFeature()))).toEqual(
      comparable(passiveZoneOf(coreOptionsImmunityAura()))
    )
  })

  it('compiles the immunity beside a save bonus on one zone', () => {
    const zone = passiveZoneOf(
      coreOptionsImmunityAura(({ component }) => {
        component.occupantSaveBonus = { ...CHARISMA_BONUS }
      })
    )
    expect(zone.occupantSaveBonus).toBeDefined()
    expect(zone.occupantConditionImmunity?.conditionTypeIds).toEqual([conditionId('FRIGHTENED')])
  })

  it('shows an immunity aura with a trigger as unavailable, with no zone', () => {
    const feature = coreOptionsImmunityAura(({ component }) => {
      component.interactionKinds = ['START_OF_SOURCE_TURN']
    })
    const discovery = discover(feature)
    expect(discovery.passiveZones).toEqual([])
    expect(discovery.unavailable).toContainEqual(
      expect.objectContaining({ ownerFeatureId: feature.id })
    )
  })

  it('pins the conditions on the placement', () => {
    const zone = passiveZoneOf(auraOfCourageFeature())
    const paladin10 = { abilityModifier: () => 0, classLevel: () => 10 }
    expect(placeAura(zone, paladin10).placement.occupantConditionImmunity).toEqual({
      dispositionFilter: 'ALLIES_AND_SOURCE',
      conditionTypeIds: [conditionId('FRIGHTENED')]
    })
  })
})
