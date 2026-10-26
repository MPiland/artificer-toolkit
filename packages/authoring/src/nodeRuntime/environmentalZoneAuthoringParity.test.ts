import { describe, expect, it } from 'vitest'

import { environmentalZones } from '@artificer-toolkit/rules-runtime/testing/authoredZoneFixture'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues, resolveNodeRuntime } from './nodeRuntimeService.js'
import { createNodeRuntimeSourceReader } from './systemSourceRows.js'

/**
 * MOVE-3.2 (ADR 0038): the GM zone tool renders the zone node map an author's item or spell
 * outcome uses, so a pit or a caltrop field the GM builds there passes through it exactly as
 * authored. The room test `nativeRoomEnvironmentalZone.test.ts` proves the zones then resolve as
 * an item's do.
 */

const reader = createNodeRuntimeSourceReader({
  coreCodes: dnd5eCoreCodeAdapter.lists,
  system: srdSystemRecord,
  readAuthoredRows: () => [],
  readReusableDefinitions: async () => []
})

describe('an environmental zone through the zone node map', () => {
  it.each(Object.entries(environmentalZones()))(
    'keeps the GM-built %s exactly as authored',
    async (_name, zone) => {
      const result = await normalizeNodeRuntimeValues(reader, {
        mapId: 'outcome',
        systemId: srdSystemRecord.id,
        values: structuredClone(zone) as unknown as Record<string, unknown>
      })

      expect(result.clearedPaths).toEqual([])
      expect(result.values).toEqual(zone)
    }
  )
})

describe('a camouflaged zone through the zone node map (MOVE-3.4)', () => {
  const { pit } = environmentalZones()

  it.each([
    ['a fixed spot DC', { kind: 'FIXED', value: 14 }],
    ['the source save DC', { kind: 'SOURCE_SAVE_DC' }]
  ])('keeps a zone camouflaged by %s exactly as authored', async (_name, spotDc) => {
    const zone = { ...pit, camouflage: { spotDc } }

    const result = await normalizeNodeRuntimeValues(reader, {
      mapId: 'outcome',
      systemId: srdSystemRecord.id,
      values: structuredClone(zone) as unknown as Record<string, unknown>
    })

    expect(result.clearedPaths).toEqual([])
    expect(result.values).toEqual(zone)
  })

  async function resolve(values: object) {
    return resolveNodeRuntime(reader, {
      mapId: 'outcome',
      systemId: srdSystemRecord.id,
      values: structuredClone(values) as Record<string, unknown>
    })
  }

  const nodesOf = (scope: { steps: { sections: { nodes: { id: string }[] }[] }[] }, id: string) =>
    scope.steps
      .flatMap((step) => step.sections.flatMap((section) => section.nodes))
      .filter((node) => node.id === id)

  it('asks for the fixed value only when the spot DC is fixed', async () => {
    const valueNodes = async (kind: string) => {
      const resolved = await resolve({ ...pit, camouflage: { spotDc: { kind } } })
      return resolved.scopes
        .filter((scope) => scope.mapId === 'heldEscapeDc')
        .flatMap((scope) => nodesOf(scope, 'value'))
    }

    expect(await valueNodes('FIXED')).toMatchObject([{ visible: true }])
    expect(await valueNodes('SOURCE_SAVE_DC')).toMatchObject([{ visible: false }])
  })

  it('offers camouflage on a zone and not on any other manifest', async () => {
    expect(nodesOf(await resolve(pit), 'camouflage')).toMatchObject([{ visible: true }])
    expect(nodesOf(await resolve({ ...pit, manifestKind: 'SENSOR' }), 'camouflage')).toMatchObject([
      { visible: false }
    ])
  })
})
