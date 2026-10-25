import { describe, expect, it } from 'vitest'

import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { getRuntimeNodeMap, listRuntimeNodeMapIds } from './mapRegistry.js'
import { normalizeNodeRuntimeValues, resolveNodeRuntime } from './nodeRuntimeService.js'
import { nodeRuntimeSourceManifest } from './nodeRuntimeSourceManifest.js'
import { createNodeRuntimeSourceReader, systemCoreCodeRows } from './systemSourceRows.js'
import {
  DND5E_SIZES,
  dnd5eCoreCodeAdapter
} from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'

const reader = createNodeRuntimeSourceReader({
  coreCodes: dnd5eCoreCodeAdapter.lists,
  system: srdSystemRecord,
  readAuthoredRows: () => [],
  readReusableDefinitions: async () => []
})

const vocabularyTables = Object.keys(
  systemCoreCodeRows(srdSystemRecord, dnd5eCoreCodeAdapter.lists)
)

async function optionsOf(mapId: string, nodeId: string, values: Record<string, unknown> = {}) {
  const result = await resolveNodeRuntime(reader, { mapId, systemId: srdSystemRecord.id, values })
  const node = result.steps
    .flatMap((step) => step.sections.flatMap((section) => section.nodes))
    .find((candidate) => candidate.id === nodeId)
  if (!node || !('options' in node)) throw new Error(`Expected a select node: ${mapId}.${nodeId}`)
  return node.options
}

type VocabularySource = { description?: string | null }

function expectDescriptions(
  options: readonly { value: string; description?: string }[],
  vocabulary: readonly (VocabularySource & { id: string })[]
) {
  expect(vocabulary.some((entry) => entry.description)).toBe(true)
  for (const entry of vocabulary) {
    expect(options.find((option) => option.value === entry.id)?.description).toBe(
      entry.description ?? undefined
    )
  }
}

/** Every relationship plan a node map declares, wherever the builder nested it. */
function collectTablePlans(value: unknown, seen = new WeakSet<object>()) {
  const plans: { table: string; selectColumns?: readonly string[] }[] = []
  if (typeof value !== 'object' || value === null || seen.has(value)) return plans
  seen.add(value)
  const record = value as Record<string, unknown>
  if (
    (record.kind === 'TABLE' || record.kind === 'MAP_VALUES') &&
    typeof record.table === 'string'
  ) {
    plans.push({
      table: record.table,
      selectColumns: record.selectColumns as readonly string[] | undefined
    })
  }
  for (const child of Object.values(record)) plans.push(...collectTablePlans(child, seen))
  return plans
}

describe('System vocabulary option descriptions', () => {
  it('serves the vocabulary description for a speed option', async () => {
    expectDescriptions(await optionsOf('speed', 'speedId'), srdSystemRecord.speeds)
  })

  it('serves the vocabulary description for a damage type option', async () => {
    expectDescriptions(
      await optionsOf('creatureQualifiedDamageDefense', 'damageTypeIds'),
      srdSystemRecord.damageTypes
    )
  })

  it('serves the skill description', async () => {
    const options = await optionsOf('proficiencyGrant', 'skillIds', {
      authoringModeKind: 'SELECTED',
      proficiencyKind: 'SKILL'
    })
    expectDescriptions(options, srdSystemRecord.skills)
  })

  it('serves the System size list, smallest first, with its descriptions', async () => {
    const options = await optionsOf('vehicle', 'size')
    expect(options.map((option) => option.value)).toEqual(DND5E_SIZES.map(({ code }) => code))
    expectDescriptions(
      options,
      DND5E_SIZES.map(({ code, description }) => ({ id: code, description }))
    )
  })

  it.each([
    { mapId: 'vehicle', values: {} },
    { mapId: 'creature', values: {} },
    { mapId: 'race', values: { category: 'BASE' } },
    { mapId: 'attackSlotCondition', values: { kind: 'TARGET_SIZE_AT_MOST' } }
  ])(
    'clears a $mapId size the System does not list, and keeps one it does',
    async ({ mapId, values }) => {
      const normalizeSize = (size: string) =>
        normalizeNodeRuntimeValues(reader, {
          mapId,
          systemId: srdSystemRecord.id,
          values: { ...values, size }
        })
      expect((await normalizeSize('ENORMOUS')).values).not.toHaveProperty('size')
      expect((await normalizeSize('LARGE')).values).toHaveProperty('size', 'LARGE')
    }
  )

  it('exposes the description column, and no tooltip column, on every System vocabulary source', () => {
    for (const table of vocabularyTables) {
      const columns: readonly string[] =
        nodeRuntimeSourceManifest[table as keyof typeof nodeRuntimeSourceManifest]
      expect(columns, table).toContain('description')
      expect(columns, table).not.toContain('tooltip')
    }
  })

  it('selects the description on every node map select drawn from System vocabulary', () => {
    const selects = listRuntimeNodeMapIds()
      .flatMap((mapId) => collectTablePlans(getRuntimeNodeMap(mapId).nodes))
      .filter((plan) => vocabularyTables.includes(plan.table) && plan.selectColumns)

    expect(selects.length).toBeGreaterThan(30)
    for (const plan of selects) expect(plan.selectColumns, plan.table).toContain('description')
  })

  it('selects only columns the node runtime source manifest serves, on every node map select', () => {
    const selects = listRuntimeNodeMapIds()
      .flatMap((mapId) => collectTablePlans(getRuntimeNodeMap(mapId).nodes))
      .filter((plan) => plan.selectColumns)

    for (const plan of selects) {
      const served: readonly string[] =
        nodeRuntimeSourceManifest[plan.table as keyof typeof nodeRuntimeSourceManifest]
      for (const column of plan.selectColumns ?? []) expect(served, plan.table).toContain(column)
    }
  })
})
