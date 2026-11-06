import { describe, expect, it } from 'vitest'

import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'
import type { RelationshipPlan } from '@artificer-toolkit/shared/maps'
import { srdBaselineContent } from '@artificer-toolkit/source-data/srd/index.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { authoredSourceRootsForRead } from './authoredSourceFacts.js'
import type { NodeRuntimeQueryWhere, NodeRuntimeSourceReader } from './nodeRuntimeSourceContract.js'
import type { NodeRuntimeSourceTable } from './nodeRuntimeSourceManifest.js'
import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
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

  it('normalizes every SRD subject the same whether it checks values or resolves full options', async () => {
    warmFixtureAuthoredSources()
    const documents = (Object.keys(mapIds) as (keyof typeof mapIds)[]).flatMap((kind) =>
      subjects[kind].map((record: { id: string }) => ({ kind, record }))
    )
    expect(documents.length).toBeGreaterThan(100)

    for (const { kind, record } of documents) {
      const request = {
        mapId: mapIds[kind],
        systemId: srdSystemRecord.id,
        values: structuredClone(record) as unknown as Record<string, unknown>
      }
      expect(
        await normalizeNodeRuntimeValues(srdReader, request, 'CHECK'),
        `${kind} ${record.id}`
      ).toEqual(await normalizeNodeRuntimeValues(srdReader, request, 'EDITOR'))
    }
  }, 600_000)
})

async function currencyIds() {
  const rows = await srdReader('currencies', ['id'], undefined, srdSystemRecord.id)
  return rows.slice(0, 2).map((row) => String(row.id))
}
