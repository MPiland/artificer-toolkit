import { describe, expect, it } from 'vitest'

import type { ClassAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { sorcerer } from '@artificer-toolkit/source-data/srd/classes/sorcerer.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from '../tests/srdSourceReader.js'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'

/**
 * SPELLS-31.T5h: Distant Spell resolves from the `castModifier` core option and its `RANGE`
 * parameter, so it passes the class node map exactly as authored, with no closed rule, as does a
 * homebrew variant.
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

function parametersOf(record: ClassAuthored) {
  const invocation = find(record.features, 'Distant Spell')?.effects?.[0]?.invocation
  const castModifier = invocation && 'castModifier' in invocation ? invocation.castModifier : null
  return castModifier && typeof castModifier === 'object' && 'parameters' in castModifier
    ? (castModifier.parameters as Record<string, unknown>[] | undefined)
    : undefined
}

describe('cast modifier parameters through the class node map (SPELLS-31.T5h)', () => {
  it(
    'keeps the SRD Distant Spell exactly as authored, with no closed rule',
    async () => {
      expect(parametersOf(sorcerer)).toHaveLength(1)
      expect(JSON.stringify(find(sorcerer.features, 'Distant Spell'))).not.toContain('CLOSED_RULE')
      const result = await normalize(sorcerer)
      expect(result.clearedPaths).toEqual([])
      expect(getValueAtPath(result.values, ['features'])).toEqual(sorcerer.features)
    },
    COLD_START_MS
  )

  it('keeps a homebrew variant the same way', async () => {
    const authored = structuredClone(sorcerer)
    const [parameter] = parametersOf(authored)!
    parameter!.multiplier = 3
    expect(authored.features).not.toEqual(sorcerer.features)
    const result = await normalize(authored)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['features'])).toEqual(authored.features)
  })

  it('clears a parameter the System does not offer', async () => {
    const authored = structuredClone(sorcerer)
    const [parameter] = parametersOf(authored)!
    parameter!.parameter = 'SPEED'
    const result = await normalize(authored)
    expect(result.clearedPaths.length).toBeGreaterThan(0)
    expect(JSON.stringify(result.values)).not.toContain('SPEED')
  })
})
