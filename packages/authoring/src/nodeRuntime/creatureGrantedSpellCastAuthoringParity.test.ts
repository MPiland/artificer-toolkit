import { describe, expect, it } from 'vitest'

import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { gynosphinx } from '@artificer-toolkit/source-data/srd/creatures/gynosphinx.js'
import { lich } from '@artificer-toolkit/source-data/srd/creatures/lich.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from './srdSourceReader.js'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'

/**
 * SPELLS-33 T6c: a legendary option that casts a granted spell is the generic `grantedSpellCast`
 * effect on an option that spends the legendary pool, the options a Builder author has on a
 * creature feature. The Lich's Cantrip and the Gynosphinx's Cast a Spell no longer use a closed rule.
 */

const reader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)

const cases: ReadonlyArray<{
  name: string
  creature: CreatureAuthored
  label: string
  spellKind: 'CANTRIP' | 'LEVELED'
  cost: number
}> = [
  { name: 'Lich', creature: lich, label: 'Cantrip', spellKind: 'CANTRIP', cost: 1 },
  {
    name: 'Gynosphinx',
    creature: gynosphinx,
    label: 'Cast a Spell (Costs 3 Actions)',
    spellKind: 'LEVELED',
    cost: 3
  }
]

function legendary(creature: CreatureAuthored) {
  const feature = creature.features?.find(({ section }) => section === 'LEGENDARY_ACTION')
  if (!feature?.charges) throw new Error('The creature must author a legendary action pool.')
  return { feature, chargeId: feature.charges.id }
}

describe.each(cases)(
  '$name legendary spell option through the creature node map (SPELLS-33 T6c)',
  ({ creature, label, spellKind, cost }) => {
    const { feature, chargeId } = legendary(creature)
    const option = feature.options?.find((entry) => entry.label === label)

    it('casts a granted spell and spends the legendary pool, with no closed rule', () => {
      expect(JSON.stringify(feature)).not.toContain('CLOSED_RULE')
      const [spellEffect] = option?.effects ?? []
      expect(spellEffect?.grantedSpellCast).toEqual({ spellKind })
      expect(spellEffect?.paths).toEqual([])
      expect(spellEffect?.invocation).toMatchObject({
        kind: 'ACTION',
        activation: { code: 'ACTION', amount: cost },
        resourceUse: { chargeId, cost }
      })
    })

    it('keeps the feature exactly as authored through the node map', async () => {
      const result = await normalizeNodeRuntimeValues(reader, {
        mapId: 'creature',
        systemId: srdSystemRecord.id,
        values: structuredClone(creature) as unknown as Record<string, unknown>
      })
      expect(result.clearedPaths).toEqual([])
      expect(getValueAtPath(result.values, ['features'])).toEqual(creature.features)
    })
  }
)
