import { describe, expect, it } from 'vitest'

import { SPELLCASTING_ABILITY_REFERENCE } from '@artificer-toolkit/shared/core'
import { brownBear } from '@artificer-toolkit/source-data/srd/creatures/brown-bear.js'
import { dwarf } from '@artificer-toolkit/source-data/srd/races/dwarf.js'
import { cart } from '@artificer-toolkit/source-data/srd/vehicles/cart.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { getRuntimeNodeMap, listRuntimeNodeMapIds } from './mapRegistry.js'
import {
  normalizeIngressValues,
  normalizeNodeRuntimeValues,
  resolveNodeRuntime
} from './nodeRuntimeService.js'
import { nodeRuntimeSourceManifest } from './nodeRuntimeSourceManifest.js'
import {
  createNodeRuntimeSourceReader,
  systemCoreCodeRows,
  systemCoreCodeTables
} from './systemSourceRows.js'
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

  it('serves the System abilities, in System order, as ability options', async () => {
    const options = await optionsOf('classMulticlassRequirement', 'ability')
    expect(options.map((option) => option.value)).toEqual(
      srdSystemRecord.abilities.map(({ code }) => code)
    )
    expectDescriptions(
      options,
      srdSystemRecord.abilities.map(({ code, description }) => ({ id: code, description }))
    )
  })

  it('clears an ability the System does not list, and keeps one it does', async () => {
    const normalizeAbility = (ability: string) =>
      normalizeNodeRuntimeValues(reader, {
        mapId: 'classMulticlassRequirement',
        systemId: srdSystemRecord.id,
        values: { ability, min: 13 }
      })
    expect((await normalizeAbility('SANITY')).values).not.toHaveProperty('ability')
    expect((await normalizeAbility('WISDOM')).values).toHaveProperty('ability', 'WISDOM')
  })

  it('offers every System ability, then the spellcasting ability, as ability modifier references', () => {
    const rows = systemCoreCodeRows(
      srdSystemRecord,
      dnd5eCoreCodeAdapter.lists
    ).ability_modifier_references
    expect(rows.map(({ id }) => id)).toEqual([
      ...srdSystemRecord.abilities.map(({ code }) => code),
      SPELLCASTING_ABILITY_REFERENCE
    ])
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
      .flatMap((mapId) => collectTablePlans(getRuntimeNodeMap(mapId)))
      .filter((plan) => vocabularyTables.includes(plan.table) && plan.selectColumns)

    expect(selects.length).toBeGreaterThan(30)
    for (const plan of selects) expect(plan.selectColumns, plan.table).toContain('description')
  })

  it('selects only columns the node runtime source manifest serves, on every node map select', () => {
    const selects = listRuntimeNodeMapIds()
      .flatMap((mapId) => collectTablePlans(getRuntimeNodeMap(mapId)))
      .filter((plan) => plan.selectColumns)

    for (const plan of selects) {
      const served: readonly string[] =
        nodeRuntimeSourceManifest[plan.table as keyof typeof nodeRuntimeSourceManifest]
      for (const column of plan.selectColumns ?? []) expect(served, plan.table).toContain(column)
    }
  })
})

/** Every DATA select source a node map declares, wherever the builder nested it. */
function collectDataSources(value: unknown, seen = new WeakSet<object>()) {
  const sources: { relationship: { kind: string } }[] = []
  if (typeof value !== 'object' || value === null || seen.has(value)) return sources
  seen.add(value)
  const record = value as Record<string, unknown>
  const source = record.source as { kind?: unknown; relationship?: { kind: string } } | undefined
  if (source?.kind === 'DATA' && source.relationship)
    sources.push({ relationship: source.relationship })
  for (const child of Object.values(record)) sources.push(...collectDataSources(child, seen))
  return sources
}

describe('System core codes at authoring ingress', () => {
  const ingress = (mapId: string, values: Record<string, unknown>) =>
    normalizeIngressValues(reader, { mapId, systemId: srdSystemRecord.id, values })
  const refusal = (path: string, value: string) =>
    `The Game System does not define "${value}" at ${path}.`

  it('reads every core-code select from its table directly, so ingress refuses its unknown codes', () => {
    const coreCodeSources = listRuntimeNodeMapIds()
      .flatMap((mapId) => collectDataSources(getRuntimeNodeMap(mapId).nodes))
      .filter(({ relationship }) =>
        collectTablePlans(relationship).some(({ table }) =>
          (systemCoreCodeTables as readonly string[]).includes(table)
        )
      )

    expect(coreCodeSources.length).toBeGreaterThan(30)
    for (const { relationship } of coreCodeSources) expect(relationship.kind).toBe('TABLE')
  })

  it('accepts the SRD sizes', async () => {
    for (const [mapId, document] of [
      ['creature', brownBear],
      ['race', dwarf],
      ['vehicle', cart]
    ] as const)
      expect((await ingress(mapId, { ...document })).refusedPaths).toEqual([])
  })

  it.each([
    { mapId: 'creature', document: brownBear },
    { mapId: 'race', document: dwarf },
    { mapId: 'vehicle', document: cart }
  ])('refuses a $mapId size the System does not list', async ({ mapId, document }) => {
    await expect(ingress(mapId, { ...document, size: 'ENORMOUS' })).rejects.toThrow(
      refusal('size', 'ENORMOUS')
    )
  })

  it('refuses a nested attack-slot size condition the System does not list', async () => {
    const [multiattack, ...rest] = brownBear.features
    const features = [
      {
        ...multiattack,
        attackSlots: {
          alternatives: [
            {
              slots: [
                {
                  count: 1,
                  fillers: [{ kind: 'ANY_ATTACK' }],
                  condition: { kind: 'TARGET_SIZE_AT_MOST', size: 'ENORMOUS' }
                }
              ]
            }
          ]
        }
      },
      ...rest
    ]
    await expect(ingress('creature', { ...brownBear, features })).rejects.toThrow(
      refusal('features.0.attackSlots.alternatives.0.slots.0.condition.size', 'ENORMOUS')
    )
  })

  it('refuses an ability the System does not list, where an editor clears it', async () => {
    const values = { ability: 'SANITY', min: 13 }
    await expect(ingress('classMulticlassRequirement', values)).rejects.toThrow(
      refusal('ability', 'SANITY')
    )
    const edited = await normalizeNodeRuntimeValues(reader, {
      mapId: 'classMulticlassRequirement',
      systemId: srdSystemRecord.id,
      values
    })
    expect(edited.values).not.toHaveProperty('ability')
    expect(edited.refusedPaths).toEqual([['ability']])
  })

  it('still clears a stale definition reference at ingress', async () => {
    const normalized = await ingress('creature', { ...brownBear, alignmentId: 'STALE' })
    expect(normalized.values).not.toHaveProperty('alignmentId')
    expect(normalized.refusedPaths).toEqual([])
  })
})
