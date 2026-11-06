import { describe, expect, it } from 'vitest'

import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'
import type { RelationshipPlan } from '@artificer-toolkit/shared/maps'
import { srdBaselineContent } from '@artificer-toolkit/source-data/srd/index.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import type { NodeRuntimeNormalizeValuesRequestDto } from '@artificer-toolkit/schema/api/nodeRuntime'

import { authoredSourceRootsForRead } from './authoredSourceFacts.js'
import type { NodeRuntimeQueryWhere, NodeRuntimeSourceReader } from './nodeRuntimeSourceContract.js'
import type { NodeRuntimeSourceTable } from './nodeRuntimeSourceManifest.js'
import { normalizeIngressValues, normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import {
  executeRelationshipPlan,
  restrictPlanToOptionValues,
  streamToOptions
} from './relationshipExecutor.js'
import { createSrdNodeRuntimeReader, warmFixtureAuthoredSources } from '../tests/srdSourceReader.js'

// PERF-5.T1: normalization checks a select's values against only the options those values can be,
// so a publish reads the roots a draft names instead of each referenced kind's whole catalogue.
const { subjects } = srdBaselineContent
const srdReader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)
const scope = { systemId: srdSystemRecord.id, values: { mode: 'SPELLS' } }
// Publication normalizes a subject against the node map named for its kind.
const mapIds = {
  backgrounds: 'background',
  classes: 'class',
  creatures: 'creature',
  equipment: 'equipment',
  feats: 'feat',
  races: 'race',
  spells: 'spell',
  vehicles: 'vehicle'
} as const

function recordingReader() {
  const reads: { table: NodeRuntimeSourceTable; where: NodeRuntimeQueryWhere | undefined }[] = []
  const reader: NodeRuntimeSourceReader = (table, columns, where, systemId) => {
    reads.push({ table, where })
    return srdReader(table, columns, where, systemId)
  }
  return { reader, reads }
}

const [firstSpell, secondSpell] = subjects.spells
if (!firstSpell || !secondSpell) throw new Error('The SRD has no spells.')
const missing = '00000000-0000-4000-8000-0000000000aa'
const schoolOf = { kind: 'SEED', table: 'spells', valueColumn: 'magic_school_id' } as const
const spellsBySchool = {
  kind: 'MAP_VALUES',
  table: 'spells',
  whereColumn: 'magic_school_id',
  valueColumn: 'id'
} as const
const spellTable: RelationshipPlan = {
  kind: 'TABLE',
  table: 'spells',
  selectColumns: ['id', 'label']
}

const plans: readonly (readonly [string, RelationshipPlan, readonly unknown[]])[] = [
  ['a table', spellTable, [firstSpell.id, secondSpell.id, missing]],
  ['a table read through its implicit option columns', { kind: 'TABLE', table: 'currencies' }, []],
  [
    'a seeded chain',
    { kind: 'CHAIN', mode: 'ROOT', steps: [{ ...schoolOf, valueColumn: 'id' }] },
    [firstSpell.id, missing]
  ],
  [
    'a chain ending in a mapped step',
    { kind: 'CHAIN', mode: 'ROOT', steps: [schoolOf, spellsBySchool] },
    [secondSpell.id, missing]
  ],
  [
    'a chain ending in a union',
    {
      kind: 'CHAIN',
      mode: 'ROOT',
      steps: [
        schoolOf,
        {
          kind: 'UNION',
          branches: [
            { kind: 'CHAIN', mode: 'CONTINUE', steps: [spellsBySchool] },
            {
              kind: 'CHAIN',
              mode: 'CONTINUE',
              steps: [{ ...spellsBySchool, valueColumn: 'label' }]
            }
          ]
        }
      ]
    },
    [firstSpell.id, secondSpell.label]
  ],
  [
    'a condition',
    {
      kind: 'CONDITION',
      choices: [
        {
          useIf: { kind: 'PREDICATE', from: 'LOCAL', path: ['mode'], op: '=', value: 'SPELLS' },
          plan: spellTable
        }
      ],
      fallback: { kind: 'TABLE', table: 'skills' }
    },
    [firstSpell.id, missing]
  ]
]

describe('option value checks', () => {
  it.each(plans)(
    'resolves %s to exactly the full options that match the checked values',
    async (_name, plan, checked) => {
      const values = checked.length > 0 ? checked : await currencyIds()
      const full = streamToOptions(await executeRelationshipPlan(srdReader, plan, scope))
      const { reader, reads } = recordingReader()
      const restricted = streamToOptions(
        await executeRelationshipPlan(reader, restrictPlanToOptionValues(plan, values), scope)
      )

      expect(restricted).toEqual(full.filter((option) => values.includes(option.value)))
      expect(restricted).not.toHaveLength(0)
      expect(JSON.stringify(reads.at(-1)?.where)).toContain('"op":"IN"')
    }
  )

  it('pins the read of the option table to the checked roots, so the reader can serve it by key', async () => {
    const { reader, reads } = recordingReader()
    await executeRelationshipPlan(
      reader,
      restrictPlanToOptionValues(spellTable, [secondSpell.id, firstSpell.id]),
      scope
    )

    expect(reads.map(({ table, where }) => authoredSourceRootsForRead(table, where))).toEqual([
      { by: 'ID', ids: [firstSpell.id, secondSpell.id].sort() }
    ])
  })

  it('normalizes every SRD subject at ingress exactly as the editor does', async () => {
    warmFixtureAuthoredSources()
    const documents = (Object.keys(mapIds) as (keyof typeof mapIds)[]).flatMap((kind) =>
      subjects[kind].map((record: { id: string }) => ({ kind, record }))
    )
    expect(documents.length).toBeGreaterThan(100)

    for (const { kind, record } of documents)
      await expectIngressMatchesEditor(request(kind, record), `${kind} ${record.id}`)
  }, 600_000)

  // Option checks must clear exactly what full options clear, not only accept what they accept.
  it.each([
    ['an unknown id', missing],
    ['a value of the wrong type', 42]
  ] as const)(
    'clears %s at ingress exactly as the editor does',
    async (_name, replacement) => {
      warmFixtureAuthoredSources()
      let replaced = 0
      for (const kind of Object.keys(mapIds) as (keyof typeof mapIds)[])
        for (const record of subjects[kind].slice(0, 3)) {
          const values = mapReferences(record, () => {
            replaced++
            return replacement
          })
          await expectIngressMatchesEditor(request(kind, values), `${kind} ${record.id}`)
        }
      expect(replaced).toBeGreaterThan(100)
    },
    300_000
  )

  it('keeps only the valid entries of a mixed multi-select at ingress exactly as the editor does', async () => {
    warmFixtureAuthoredSources()
    let mixed = 0
    for (const kind of Object.keys(mapIds) as (keyof typeof mapIds)[])
      for (const record of subjects[kind].slice(0, 3)) {
        const values = mixReferenceLists(record, () => mixed++)
        await expectIngressMatchesEditor(request(kind, values), `${kind} ${record.id}`)
      }
    expect(mixed).toBeGreaterThan(10)
  }, 300_000)
})

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

function request(kind: keyof typeof mapIds, values: unknown): NodeRuntimeNormalizeValuesRequestDto {
  return {
    mapId: mapIds[kind],
    systemId: srdSystemRecord.id,
    values: structuredClone(values) as Record<string, unknown>
  }
}

async function expectIngressMatchesEditor(
  input: NodeRuntimeNormalizeValuesRequestDto,
  name: string
) {
  const editor = await normalizeNodeRuntimeValues(srdReader, input)
  const ingress = normalizeIngressValues(srdReader, input)
  if (editor.refusedPaths.length > 0)
    await expect(ingress, name).rejects.toThrow('The Game System does not define')
  else expect(await ingress, name).toEqual(editor)
}

// Every reference except the document's own id, which names the document rather than an option.
function mapReferences(record: { id: string }, replace: () => unknown): unknown {
  const visit = (value: unknown): unknown => {
    if (typeof value === 'string') return uuid.test(value) ? replace() : value
    if (Array.isArray(value)) return value.map(visit)
    if (value && typeof value === 'object')
      return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, visit(entry)]))
    return value
  }
  return { ...(visit(record) as object), id: record.id }
}

function mixReferenceLists(record: { id: string }, count: () => void): unknown {
  const visit = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      const entries = value.map(visit)
      if (!entries.some((entry) => typeof entry === 'string' && uuid.test(entry))) return entries
      count()
      return [...entries, missing, 7]
    }
    if (value && typeof value === 'object')
      return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, visit(entry)]))
    return value
  }
  return visit(record)
}

async function currencyIds() {
  const rows = await srdReader('currencies', ['id'], undefined, srdSystemRecord.id)
  return rows.slice(0, 2).map((row) => String(row.id))
}
