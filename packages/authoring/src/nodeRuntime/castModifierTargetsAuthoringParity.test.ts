import { describe, expect, it } from 'vitest'

import type { ClassAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { sorcerer } from '@artificer-toolkit/source-data/srd/classes/sorcerer.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from '../tests/srdSourceReader.js'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'

/**
 * SPELLS-31.T5g2: Careful and Heightened Spell resolve from the `castModifier` core option and its
 * per-target outcome, so each passes the class node map exactly as authored, with no closed rule,
 * as does a homebrew variant.
 */

const reader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)
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
  options?: Node[]
  effects?: { invocation?: { castModifier?: { targets?: Record<string, unknown> } } }[]
}

function find(nodes: Node[] | undefined, label: string): Node | undefined {
  for (const node of nodes ?? []) {
    if (node.label === label) return node
    const nested = find(node.options, label)
    if (nested) return nested
  }
  return undefined
}

const LABELS = ['Careful Spell', 'Heightened Spell']

const targetsOf = (record: ClassAuthored, label: string) =>
  find(record.features, label)?.effects?.[0]?.invocation?.castModifier?.targets

describe('cast modifier targets through the class node map (SPELLS-31.T5g2)', () => {
  it.each(LABELS)(
    'keeps the SRD %s exactly as authored, with no closed rule',
    async (label) => {
      expect(targetsOf(sorcerer, label)).toBeDefined()
      expect(JSON.stringify(find(sorcerer.features, label))).not.toContain('CLOSED_RULE')
      const result = await normalize(sorcerer)
      expect(result.clearedPaths).toEqual([])
      expect(getValueAtPath(result.values, ['features'])).toEqual(sorcerer.features)
    },
    COLD_START_MS
  )

  it.each(LABELS)('keeps a homebrew %s variant the same way', async (label) => {
    const authored = structuredClone(sorcerer)
    const targets = targetsOf(authored, label)!
    targets.base = 4
    expect(authored.features).not.toEqual(sorcerer.features)
    const result = await normalize(authored)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['features'])).toEqual(authored.features)
  })

  it('clears an outcome the System does not offer', async () => {
    const authored = structuredClone(sorcerer)
    targetsOf(authored, 'Careful Spell')!.outcome = 'SAVE_AUTO_PIERCE'
    const result = await normalize(authored)
    expect(result.clearedPaths.length).toBeGreaterThan(0)
    expect(JSON.stringify(result.values)).not.toContain('SAVE_AUTO_PIERCE')
  })
})
