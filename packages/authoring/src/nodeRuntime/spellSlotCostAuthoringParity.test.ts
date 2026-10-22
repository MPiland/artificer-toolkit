import { describe, expect, it } from 'vitest'

import type { ClassAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { SPELL_GRANT_ACCESS, SPELL_SLOT_POOL } from '@artificer-toolkit/shared/core'
import { ranger } from '@artificer-toolkit/source-data/srd/classes/ranger.js'
import { theFiend } from '@artificer-toolkit/source-data/srd/classes/the-fiend.js'
import { warlock } from '@artificer-toolkit/source-data/srd/classes/warlock.js'
import { CLASS_IDS } from '@artificer-toolkit/source-data/srd/ids.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from './srdSourceReader.js'

/**
 * SPELLS-31.T5p (D175): the six Warlock pact-slot invocations, the Fiend's Expanded Spell List and
 * Primeval Awareness resolve from core options a Builder author has on a class feature, so each
 * passes the class node map exactly as authored, with no closed rule, as does a homebrew variant.
 */

const reader = createSrdNodeRuntimeReader()
const COLD_START_MS = 30_000

function normalize(values: ClassAuthored) {
  return normalizeNodeRuntimeValues(reader, {
    mapId: 'class',
    systemId: srdSystemRecord.id,
    values: structuredClone(values) as unknown as Record<string, unknown>
  })
}

type Node = {
  label?: string
  description?: string
  options?: Node[]
  grants?: { spells?: Record<string, unknown>[] }
}

function find(nodes: Node[] | undefined, label: string): Node | undefined {
  for (const node of nodes ?? []) {
    if (node.label === label) return node
    const nested = find(node.options, label)
    if (nested) return nested
  }
  return undefined
}

const PACT_INVOCATIONS = [
  'Thief of Five Fates',
  'Dreadful Word',
  'Minions of Chaos',
  'Mire the Mind',
  'Sculptor of Flesh',
  'Sign of Ill Omen'
]

const CASES: { record: ClassAuthored; label: string; variant: (copy: ClassAuthored) => void }[] = [
  ...PACT_INVOCATIONS.map((label) => ({
    record: warlock,
    label,
    variant: (copy: ClassAuthored) => {
      // A homebrew invocation that casts at a fixed level through the same pool.
      find(copy.features, label)!.grants!.spells![0]!.castAtLevel = 9
    }
  })),
  {
    record: theFiend,
    label: 'Expanded Spell List',
    variant: (copy) => {
      const grant = find(copy.features, 'Expanded Spell List')!.grants!.spells![0]!
      grant.classListIds = [...(grant.classListIds as string[]), CLASS_IDS.WIZARD]
    }
  },
  {
    record: ranger,
    label: 'Primeval Awareness',
    variant: (copy) => {
      find(copy.features, 'Primeval Awareness')!.description = 'A homebrew description.'
    }
  }
]

describe('spell slot costs and class spell lists through the class node map (SPELLS-31.T5p)', () => {
  it.each(CASES)(
    'keeps the SRD $label exactly as authored, with no closed rule',
    async (entry) => {
      const node = find(entry.record.features, entry.label)
      expect(node).toBeDefined()
      expect(JSON.stringify(node)).not.toContain('CLOSED_RULE')
      const result = await normalize(entry.record)
      expect(result.clearedPaths).toEqual([])
      expect(getValueAtPath(result.values, ['features'])).toEqual(entry.record.features)
    },
    COLD_START_MS
  )

  it.each(CASES)('keeps a homebrew $label variant the same way', async (entry) => {
    const authored = structuredClone(entry.record)
    entry.variant(authored)
    expect(authored.features).not.toEqual(entry.record.features)
    const result = await normalize(authored)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['features'])).toEqual(authored.features)
  })

  it('authors the pact cost on the System pool code and the list grant as list-only', () => {
    for (const label of PACT_INVOCATIONS)
      expect(find(warlock.features, label)!.grants!.spells![0]!.slotCost).toEqual({
        poolCode: SPELL_SLOT_POOL.PACT
      })
    expect(find(theFiend.features, 'Expanded Spell List')!.grants!.spells![0]!.access).toBe(
      SPELL_GRANT_ACCESS.CLASS_LIST_ONLY
    )
  })
})
