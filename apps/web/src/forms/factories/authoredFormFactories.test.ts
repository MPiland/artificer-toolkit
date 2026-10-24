import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { AuthoredDraftDto } from '@artificer-toolkit/schema/api/content'
import {
  authoredRouteStoryEquipmentParentResponse,
  authoredRouteStoryResponses,
  authoredRouteStorySystem,
  createEditLoaderData
} from '#domains/authoredRouteStory.fixtures'
import { ownedBackgroundFixture } from '../../domains/backgrounds/background.fixtures'
import { ownedClassResponseFixture } from '../../domains/classes/class.fixtures'
import { ownedMonsterFixture } from '../../domains/creatures/creature.fixtures'
import { ownedEquipmentFixture } from '../../domains/equipment/equipment.fixtures'
import { ownedFeatFixture } from '../../domains/feats/feat.fixtures'
import { ownedBaseRaceFixture } from '../../domains/races/race.fixtures'
import { spellFixture } from '../../domains/spells/spellAuthoring.fixtures'
import { ownedVehicleResponseFixture } from '../../domains/vehicles/vehicle.fixtures'
import { getEquipment } from '#app/data/equipment/queries'
import { queryKeys } from '#app/lib/queryKeys'
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

  it('resolves the create session system from the available systems', () => {
    const data = { systems: [{ id: 'system-1' }] }

    for (const factory of Object.values(authoredFormFactories)) {
      expect(factory.createSession({ data, mode: 'create' }).systemId).toBe('system-1')
    }
  })

  it('reports a missing system when the create route has no systems', () => {
    for (const factory of Object.values(authoredFormFactories)) {
      const session = factory.createSession({ data: { systems: [] }, mode: 'create' })

      expect(session.systemRequired).toBe(true)
      expect(session.canSaveDraft).toBe(false)
    }
  })

  it('caches saved draft JSON for the first navigation to its edit route', async () => {
    const session = spellFormFactory.createSession?.({
      data: { systems: [{ id: 'system-1' }] },
      mode: 'create'
    })
    if (!session) throw new Error('Expected a spell create session.')

    const queryClient = new QueryClient()
    const draft: AuthoredDraftDto = {
      baseActiveUpdatedAt: null,
      draftState: 'DRAFT_ONLY',
      label: 'Cached Spell',
      payload: { label: 'Cached Spell' },
      publicId: 'cached-spell',
      status: 'DRAFT',
      subjectId: 'spell-1',
      subjectKind: 'SPELL',
      systemId: 'system-1',
      userId: 'user-1'
    }

    await session.operations.onSaveDraftSuccess?.(queryClient, draft)

    expect(queryClient.getQueryData(queryKeys.content.spells.draft('spell-1'))).toBe(draft)
    expect(queryClient.getQueryData(queryKeys.routeIds.resolve('SPELL', 'cached-spell'))).toBe(
      'spell-1'
    )
    expect(queryClient.getQueryData(queryKeys.content.spells.detail('spell-1'))).toBeNull()
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

  it('keeps an edit session identity stable when only the saved draft timestamp changes', () => {
    const firstData = createEditLoaderData('equipment', 'ownedDraft').authoringData
    if (!firstData.draft) throw new Error('Expected an equipment draft fixture.')
    const secondData = {
      ...firstData,
      draft: { ...firstData.draft, updatedAt: '2026-02-02T00:00:00.000Z' }
    }

    const firstSession = equipmentFormFactory.createSession?.({ data: firstData, mode: 'edit' })
    const secondSession = equipmentFormFactory.createSession?.({ data: secondData, mode: 'edit' })

    expect(secondSession?.key).toBe(firstSession?.key)
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

  it('resolves a selected equipment parent in create previews', () => {
    const parentResponse = authoredRouteStoryEquipmentParentResponse
    if (!parentResponse.item) throw new Error('Expected the equipment parent fixture.')

    const session = equipmentFormFactory.createSession?.({
      data: {
        system: authoredRouteStorySystem,
        systems: [authoredRouteStorySystem]
      },
      mode: 'create'
    })
    if (!session) throw new Error('Expected an equipment create session.')

    const queryClient = new QueryClient()
    queryClient.setQueryData(getEquipment(parentResponse.item.id).queryKey, parentResponse)
    const preview = session.renderPreview?.({
      domain: 'equipment',
      label: 'New Variant',
      statusLabel: 'Draft',
      system: authoredRouteStorySystem,
      values: {
        ...session.initialValues,
        category: 'VARIANT',
        parentEquipmentId: parentResponse.item.id
      }
    })
    const markup = renderToStaticMarkup(
      createElement(QueryClientProvider, { client: queryClient }, preview)
    )

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
