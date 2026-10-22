import { describe, expect, it } from 'vitest'

import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { vampire } from '@artificer-toolkit/source-data/srd/creatures/vampire.js'
import { vampireSpawn } from '@artificer-toolkit/source-data/srd/creatures/vampire-spawn.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from './srdSourceReader.js'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'

/**
 * SPELLS-33 T3a6 (D148): the Vampire Spawn's Claws and the Vampire's Unarmed Strike deal damage or
 * grapple, picked at use. Each is one ON_HIT CHOICE path of core options a Builder author has on a
 * creature feature, so it must pass the creature node map exactly as authored, as must a variant
 * with another grapple escape DC.
 */

const reader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)

const cases = [
  { creature: vampireSpawn, feature: 'Claws' },
  { creature: vampire, feature: 'Unarmed Strike (Vampire Form Only)' }
]

function normalize(creature: CreatureAuthored) {
  return normalizeNodeRuntimeValues(reader, {
    mapId: 'creature',
    systemId: srdSystemRecord.id,
    values: structuredClone(creature) as unknown as Record<string, unknown>
  })
}

/** The attack's one ON_HIT path, found by narrowing the authored record to its pick. */
function pick(creature: CreatureAuthored, label: string) {
  const path = creature.features
    ?.find((feature) => feature.label === label)
    ?.effects?.[0]?.paths.find(({ pathCode }) => pathCode === 'ON_HIT')
  if (path?.selectionKind !== 'CHOICE')
    throw new Error(`${creature.label} must author ${label} as a pick.`)
  return path
}

/** The grapple option of a pick, whose relationship carries the escape DC. */
function grappleOption(creature: CreatureAuthored, label: string) {
  const option = pick(creature, label).options.find((value) => value.label === 'Grapple')
  const grapple = option?.resultBlock.outcomes[0]
  if (grapple?.effectKind !== 'ACTOR_RELATIONSHIP')
    throw new Error(`${creature.label} must author a grapple option.`)
  return grapple
}

describe('a creature’s damage-or-grapple attack through the creature node map (D148)', () => {
  it.each(cases)(
    'keeps the $creature.label’s $feature exactly as authored, with no closed rule',
    async ({ creature, feature }) => {
      expect(
        JSON.stringify(creature.features?.find(({ label }) => label === feature))
      ).not.toContain('CLOSED_RULE')
      expect(pick(creature, feature).options.map(({ label }) => label)).toEqual([
        'Damage',
        'Grapple'
      ])
      const result = await normalize(creature)
      expect(result.clearedPaths).toEqual([])
      expect(getValueAtPath(result.values, ['features'])).toEqual(creature.features)
    }
  )

  it.each(cases)(
    'keeps the $creature.label’s $feature with another escape DC the same way',
    async ({ creature, feature }) => {
      const authored = structuredClone(creature)
      const escape = grappleOption(authored, feature).modules.find(
        (module) => module.kind === 'ESCAPE_CHECK'
      )
      if (escape?.kind !== 'ESCAPE_CHECK' || escape.dc.kind !== 'FIXED')
        throw new Error('The grapple must author a fixed escape DC.')
      escape.dc.value = 15
      const result = await normalize(authored)
      expect(result.clearedPaths).toEqual([])
      expect(getValueAtPath(result.values, ['features'])).toEqual(authored.features)
    }
  )
})
