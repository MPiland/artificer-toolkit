import { describe, expect, it } from 'vitest'

import { SIZE_OPTIONS } from '@artificer-toolkit/shared/core'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { getRuntimeNodeMap, listRuntimeNodeMapIds } from './mapRegistry.js'
import { resolveNodeRuntime } from './nodeRuntimeService.js'
import { nodeRuntimeSourceManifest } from './nodeRuntimeSourceManifest.js'
import { createNodeRuntimeSourceReader, systemVocabularyRows } from './systemSourceRows.js'
import { dnd5eVocabularyCapabilityAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/vocabulary'

const reader = createNodeRuntimeSourceReader({
  policyVocabulary: dnd5eVocabularyCapabilityAdapter.lists,
  system: srdSystemRecord,
  readAuthoredRows: () => [],
  readReusableDefinitions: async () => []
})

const vocabularyTables = Object.keys(
  systemVocabularyRows(srdSystemRecord, dnd5eVocabularyCapabilityAdapter.lists)
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

  it('serves the code-list description for an inline option', async () => {
    const options = await optionsOf('vehicle', 'size')
    expect(SIZE_OPTIONS.some((size) => size.description)).toBe(true)
    for (const size of SIZE_OPTIONS) {
      expect(options.find((option) => option.value === size.code)?.description).toBe(
        size.description ?? undefined
      )
    }
  })

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
