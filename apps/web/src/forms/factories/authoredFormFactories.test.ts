import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  authoredRouteStoryEquipmentParentResponse,
  authoredRouteStoryResponses,
  authoredRouteStorySystem
} from '#domains/authoredRouteStory.fixtures'
import { ownedBackgroundFixture } from '../../domains/backgrounds/background.fixtures'
import { ownedClassResponseFixture } from '../../domains/classes/class.fixtures'
import { ownedMonsterFixture } from '../../domains/creatures/creature.fixtures'
import { ownedEquipmentFixture } from '../../domains/equipment/equipment.fixtures'
import { ownedFeatFixture } from '../../domains/feats/feat.fixtures'
import { ownedBaseRaceFixture } from '../../domains/races/race.fixtures'
import { spellFixture } from '../../domains/spells/spellAuthoring.fixtures'
import { ownedVehicleResponseFixture } from '../../domains/vehicles/vehicle.fixtures'
import { authoredFormFactories } from './authoredFormFactories'

const {
  background: backgroundFormFactory,
  class: classFormFactory,
  creature: creatureFormFactory,
  equipment: equipmentFormFactory,
  feat: featFormFactory,
  race: raceFormFactory,
  spell: spellFormFactory,
  vehicle: vehicleFormFactory
} = authoredFormFactories

describe('authoredFormFactories', () => {
  it('registers every authored form domain factory', () => {
    expect(Object.keys(authoredFormFactories).sort()).toEqual([
      'background',
      'class',
      'creature',
      'equipment',
      'feat',
      'race',
      'spell',
      'vehicle'
    ])
  })

  it('uses the node-map id as each form map id', () => {
    for (const [domain, factory] of Object.entries(authoredFormFactories)) {
      expect(factory.mapId).toBe(domain)
    }
  })

  it('creates empty values with the selected system id', () => {
    const emptyValues = [
      backgroundFormFactory.createEmptyValues({ systemId: 'system-1' }),
      classFormFactory.createEmptyValues({ systemId: 'system-1' }),
      creatureFormFactory.createEmptyValues({ systemId: 'system-1' }),
      equipmentFormFactory.createEmptyValues({ systemId: 'system-1' }),
      featFormFactory.createEmptyValues({ systemId: 'system-1' }),
      raceFormFactory.createEmptyValues({ systemId: 'system-1' }),
      spellFormFactory.createEmptyValues({ systemId: 'system-1' }),
      vehicleFormFactory.createEmptyValues({ systemId: 'system-1' })
    ]

    expect(emptyValues.every(hasSystemId)).toBe(true)
    for (const values of emptyValues) {
      if (hasSystemId(values)) {
        expect(values.systemId).toBe('system-1')
      }
    }
  })

  it('normalizes fixture-backed form values into submit payloads', () => {
    const payloads = [
      backgroundFormFactory.normalizeForSubmit(
        backgroundFormFactory.toFormValues(ownedBackgroundFixture)
      ),
      classFormFactory.normalizeForSubmit(
        classFormFactory.toFormValues(ownedClassResponseFixture.item)
      ),
      creatureFormFactory.normalizeForSubmit(creatureFormFactory.toFormValues(ownedMonsterFixture)),
      equipmentFormFactory.normalizeForSubmit(
        equipmentFormFactory.toFormValues(ownedEquipmentFixture)
      ),
      featFormFactory.normalizeForSubmit(featFormFactory.toFormValues(ownedFeatFixture)),
      raceFormFactory.normalizeForSubmit(raceFormFactory.toFormValues(ownedBaseRaceFixture)),
      spellFormFactory.normalizeForSubmit(spellFormFactory.toFormValues(spellFixture)),
      vehicleFormFactory.normalizeForSubmit(
        vehicleFormFactory.toFormValues(ownedVehicleResponseFixture.item)
      )
    ]

    expect(payloads.every(hasSystemId)).toBe(true)
    expect(payloads.map((payload) => payload.label)).toEqual([
      'Urban Investigator',
      'Fighter',
      'Moonlit Owlbear',
      'Explorer Pack',
      'Battlefield Reader',
      'Dragonborn',
      'Fire Lace',
      'Sky Skiff'
    ])
  })

  it('resolves create system ids from available systems', () => {
    const systems = [{ id: 'system-1' }]

    expect(backgroundFormFactory.resolveCreateSystemId(systems)).toBe('system-1')
    expect(classFormFactory.resolveCreateSystemId(systems)).toBe('system-1')
    expect(creatureFormFactory.resolveCreateSystemId(systems)).toBe('system-1')
    expect(equipmentFormFactory.resolveCreateSystemId(systems)).toBe('system-1')
    expect(featFormFactory.resolveCreateSystemId(systems)).toBe('system-1')
    expect(raceFormFactory.resolveCreateSystemId(systems)).toBe('system-1')
    expect(spellFormFactory.resolveCreateSystemId(systems)).toBe('system-1')
    expect(vehicleFormFactory.resolveCreateSystemId(systems)).toBe('system-1')
  })

  it('creates authoring sessions for every authored form domain', () => {
    const systemData = { systems: [{ id: 'system-1' }] }
    const sessions = [
      ['background', backgroundFormFactory.createSession?.({ data: systemData, mode: 'create' })],
      ['class', classFormFactory.createSession?.({ data: systemData, mode: 'create' })],
      ['creature', creatureFormFactory.createSession?.({ data: systemData, mode: 'create' })],
      ['equipment', equipmentFormFactory.createSession?.({ data: systemData, mode: 'create' })],
      ['feat', featFormFactory.createSession?.({ data: systemData, mode: 'create' })],
      ['race', raceFormFactory.createSession?.({ data: systemData, mode: 'create' })],
      ['spell', spellFormFactory.createSession?.({ data: systemData, mode: 'create' })],
      ['vehicle', vehicleFormFactory.createSession?.({ data: systemData, mode: 'create' })]
    ] as const

    for (const [domain, session] of sessions) {
      expect(session).toEqual(
        expect.objectContaining({
          domain,
          mapId: domain,
          mode: 'create',
          systemRequired: false
        })
      )
      expect(session?.initialValues).toEqual(
        expect.objectContaining({
          label: '',
          systemId: 'system-1'
        })
      )
    }
  })

  it('inherits weight and value from the selected equipment parent in the live preview', () => {
    const response = authoredRouteStoryResponses.equipment
    const session = equipmentFormFactory.createSession?.({
      data: {
        draft: null,
        parentResponse: authoredRouteStoryEquipmentParentResponse,
        response,
        subjectId: response.item.id,
        system: authoredRouteStorySystem
      },
      mode: 'edit'
    })
    const preview = session?.renderPreview?.({
      domain: 'equipment',
      label: response.item.label,
      statusLabel: 'Draft',
      system: authoredRouteStorySystem,
      values: session.initialValues
    })
    const markup = renderToStaticMarkup(preview)

    expect(markup).toContain('Weight')
    expect(markup).toContain('2 lb.')
    expect(markup).toContain('Value')
    expect(markup).toContain('10 gp')
  })
})

function hasSystemId(value: unknown): value is { systemId: string } {
  return Boolean(
    value && typeof value === 'object' && 'systemId' in value && typeof value.systemId === 'string'
  )
}
