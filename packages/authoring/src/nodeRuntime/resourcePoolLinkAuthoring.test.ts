import { describe, expect, it } from 'vitest'

import type { ClassAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { paladin } from '@artificer-toolkit/source-data/srd/classes/paladin.js'
import { lifeDomainCleric } from '@artificer-toolkit/source-data/srd/classes/life-domain.js'
import { srdBaselineContent } from '@artificer-toolkit/source-data/srd/index.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'

import { normalizeIngressValues, normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from '../tests/srdSourceReader.js'

/**
 * AUTHORING-21.2: an effect's `chargeId` must name a resource pool the authored record can reach,
 * its own or its parent class's. A record that does not is refused at ingress (publication, import)
 * with the path of the field, and a stored SRD record always passes.
 */

const reader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)
const request = (mapId: string, values: unknown) => ({
  mapId,
  systemId: srdSystemRecord.id,
  values: structuredClone(values) as Record<string, unknown>
})

function divineSenseIndex(record: ClassAuthored) {
  const index = record.features?.findIndex(({ label }) => label === 'Divine Sense') ?? -1
  if (index < 0) throw new Error('Expected the Paladin Divine Sense feature.')
  return index
}

const chargeIdPath = (index: number) => [
  'features',
  index,
  'effects',
  0,
  'invocation',
  'resourceUse',
  'chargeId'
]

function withDivineSenseCharge(chargeId: string) {
  const record = structuredClone(paladin)
  const effect = record.features?.[divineSenseIndex(record)]?.effects?.[0]
  if (effect?.invocation.kind !== 'ACTION' || !effect.invocation.resourceUse)
    throw new Error('Divine Sense must spend from its pool.')
  effect.invocation.resourceUse.chargeId = chargeId
  return record
}

const mapIdByKind = {
  classes: 'class',
  creatures: 'creature',
  equipment: 'equipment',
  feats: 'feat',
  races: 'race',
  spells: 'spell'
} as const

describe('a chargeId names a pool the record can reach', () => {
  it('keeps every SRD record that links an effect to a pool', async () => {
    for (const [kind, mapId] of Object.entries(mapIdByKind)) {
      const subjects = srdBaselineContent.subjects[kind as keyof typeof mapIdByKind]
      for (const record of subjects.filter((subject) =>
        JSON.stringify(subject).includes('chargeId')
      )) {
        const result = await normalizeIngressValues(reader, request(mapId, record))
        expect(result.refusedPaths, `${mapId} ${record.label}`).toEqual([])
      }
    }
  }, 120_000)

  it('reaches the parent class pool a subclass spends', async () => {
    expect(JSON.stringify(lifeDomainCleric)).toContain('chargeId')
    expect(JSON.stringify(lifeDomainCleric)).not.toContain('"charges"')
    const result = await normalizeIngressValues(reader, request('class', lifeDomainCleric))
    expect(result.refusedPaths).toEqual([])
  })

  it('refuses an id that names no pool, at that field', async () => {
    const record = withDivineSenseCharge('not-a-pool')
    const normalized = await normalizeNodeRuntimeValues(reader, request('class', record))
    expect(normalized.refusedPaths).toEqual([chargeIdPath(divineSenseIndex(record))])
    await expect(normalizeIngressValues(reader, request('class', record))).rejects.toThrow(
      chargeIdPath(divineSenseIndex(record)).join('.')
    )
  })

  it('refuses an id that two pools in the record share', async () => {
    const record = structuredClone(paladin)
    const [first, second] = record.features?.filter(({ charges }) => charges) ?? []
    if (!first?.charges || !second?.charges) throw new Error('Expected two Paladin pools.')
    second.charges.id = first.charges.id
    const effect = first.effects?.[0]
    if (effect?.invocation.kind !== 'ACTION' || !effect.invocation.resourceUse)
      throw new Error('The first pool must be spent by an action.')

    const normalized = await normalizeNodeRuntimeValues(reader, request('class', record))
    expect(normalized.refusedPaths).toContainEqual(
      chargeIdPath(record.features?.indexOf(first) ?? -1)
    )
  })

  it('refuses, rather than skips, a subclass whose parent class does not exist', async () => {
    const orphan = { ...structuredClone(lifeDomainCleric), parentClassId: crypto.randomUUID() }
    await expect(normalizeIngressValues(reader, request('class', orphan))).rejects.toThrow()
  })
})
