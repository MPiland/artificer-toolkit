import { describe, expect, it } from 'vitest'

import { reviveDtoSchema } from '@artificer-toolkit/schema/effects/revive'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { caltropsBagOf20 } from '@artificer-toolkit/source-data/srd/equipment/caltrops-bag-of-20.js'
import { raiseDead } from '@artificer-toolkit/source-data/srd/spells/raise-dead.js'
import { resurrection } from '@artificer-toolkit/source-data/srd/spells/resurrection.js'
import { revivify } from '@artificer-toolkit/source-data/srd/spells/revivify.js'
import { trueResurrection } from '@artificer-toolkit/source-data/srd/spells/true-resurrection.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from '../tests/srdSourceReader.js'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'

const reader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)

type Container = { paths: { resultBlock: { outcomes: Record<string, unknown>[] } }[] }

function withRevive(revive: Record<string, unknown>) {
  const effects = structuredClone(revivify.effects) as unknown as Container[]
  Object.assign(effects[0]!.paths[0]!.resultBlock.outcomes[0]!, revive)
  return { ...structuredClone(caltropsBagOf20), effects }
}

const normalize = (authored: ReturnType<typeof withRevive>) =>
  normalizeNodeRuntimeValues(reader, {
    mapId: 'equipment',
    systemId: srdSystemRecord.id,
    values: structuredClone(authored) as Record<string, unknown>
  })

describe('a homebrew REVIVE outcome through the effect node map (SPELLS-4.T2g1, ADR 0038)', () => {
  it.each([
    ['a fixed number', { valueKind: 'FIXED', amount: 7 }],
    ['its maximum', { valueKind: 'MAXIMUM' }]
  ])('keeps %s exactly as authored', async (_label, revive) => {
    const authored = withRevive(revive)
    const result = await normalize(authored)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['effects'])).toEqual(authored.effects)
  })

  it.each([
    ['Revivify', revivify],
    ['Raise Dead', raiseDead],
    ['Resurrection', resurrection],
    ['True Resurrection', trueResurrection]
  ])('keeps the authored %s effects exactly as authored', async (_label, spell) => {
    const authored = {
      ...structuredClone(caltropsBagOf20),
      effects: structuredClone(spell.effects)
    }
    const result = await normalize(authored as ReturnType<typeof withRevive>)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['effects'])).toEqual(authored.effects)
  })

  it('clears a value kind the node does not offer', async () => {
    const result = await normalize(withRevive({ valueKind: 'HALF', amount: undefined }))
    expect(result.clearedPaths.length).toBeGreaterThan(0)
  })
})

describe('the REVIVE transport contract (SPELLS-4.T2g1)', () => {
  it.each([0, 1.5, -2])('refuses a fixed amount of %s', (amount) => {
    const outcome = { id: 'revive', effectKind: 'REVIVE', valueKind: 'FIXED', amount }
    expect(reviveDtoSchema.safeParse(outcome).success).toBe(false)
  })

  it('accepts a positive whole fixed amount', () => {
    const outcome = { id: 'revive', effectKind: 'REVIVE', valueKind: 'FIXED', amount: 3 }
    expect(reviveDtoSchema.safeParse(outcome).success).toBe(true)
  })
})
