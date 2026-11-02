import { describe, expect, it } from 'vitest'

import type { ClassAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { sorcerer } from '@artificer-toolkit/source-data/srd/classes/sorcerer.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from '../tests/srdSourceReader.js'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'

/**
 * SPELLS-31.T5e2a (D208): Empowered Spell resolves from the `castModifier` core option's
 * `damageRerolls` count, so it passes the class node map exactly as authored, with no closed rule, as
 * does a homebrew variant.
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
  effects?: { invocation?: object }[]
}

function find(nodes: Node[] | undefined, label: string): Node | undefined {
  for (const node of nodes ?? []) {
    if (node.label === label) return node
    const nested = find(node.options, label)
    if (nested) return nested
  }
  return undefined
}

function castModifierOf(record: ClassAuthored) {
  const invocation = find(record.features, 'Empowered Spell')?.effects?.[0]?.invocation
  return invocation && 'castModifier' in invocation
    ? (invocation.castModifier as { cost: number; damageRerolls?: Record<string, unknown> })
    : undefined
}

describe('cast modifier damage rerolls through the class node map (SPELLS-31.T5e2a)', () => {
  it(
    'keeps the SRD Empowered Spell exactly as authored, with no closed rule',
    async () => {
      expect(castModifierOf(sorcerer)?.damageRerolls).toBeDefined()
      expect(JSON.stringify(find(sorcerer.features, 'Empowered Spell'))).not.toContain(
        'CLOSED_RULE'
      )
      const result = await normalize(sorcerer)
      expect(result.clearedPaths).toEqual([])
      expect(getValueAtPath(result.values, ['features'])).toEqual(sorcerer.features)
    },
    COLD_START_MS
  )

  it('keeps a homebrew variant that rerolls two dice for two points', async () => {
    const authored = structuredClone(sorcerer)
    const castModifier = castModifierOf(authored)!
    castModifier.cost = 2
    castModifier.damageRerolls = { base: 2 }
    expect(authored.features).not.toEqual(sorcerer.features)
    const result = await normalize(authored)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['features'])).toEqual(authored.features)
  })
})
