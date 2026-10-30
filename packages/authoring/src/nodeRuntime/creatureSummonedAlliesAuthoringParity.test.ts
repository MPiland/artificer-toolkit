import { describe, expect, it } from 'vitest'

import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { chainDevil } from '@artificer-toolkit/source-data/srd/creatures/chain-devil.js'
import { damageTypeId } from '@artificer-toolkit/source-data/srd/creatures/shared.js'
import { treant } from '@artificer-toolkit/source-data/srd/creatures/treant.js'
import { vampire } from '@artificer-toolkit/source-data/srd/creatures/vampire.js'
import { wraith } from '@artificer-toolkit/source-data/srd/creatures/wraith.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from '../tests/srdSourceReader.js'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'

/**
 * SPELLS-33.T4w (D198): Animate Chains summons an Animated Chain from its stat block, with the four
 * chains, their extra attacks, grappling and reverting as a GM ruling; Animate Trees, Children of the
 * Night and Create Specter are GM rulings, the GM adding the creatures with REINFORCE. Each creature
 * passes the creature node map exactly as authored, and the four closed rule kinds are gone.
 */

const reader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)

async function expectAuthoringParity(creature: CreatureAuthored) {
  const result = await normalizeNodeRuntimeValues(reader, {
    mapId: 'creature',
    systemId: srdSystemRecord.id,
    values: structuredClone(creature) as unknown as Record<string, unknown>
  })
  expect(result.clearedPaths).toEqual([])
  expect(getValueAtPath(result.values, ['features'])).toEqual(creature.features)
}

/** The outcomes of a feature's one use. */
function useOutcomes(creature: CreatureAuthored, label: string) {
  const path = creature.features?.find((candidate) => candidate.label.startsWith(label))
    ?.effects?.[0]?.paths[0]
  if (path?.selectionKind !== 'FIXED') throw new Error(`The creature must author ${label}.`)
  return path.resultBlock.outcomes
}

const CLOSED_RULE_PATTERN =
  /CHAIN_DEVIL_ANIMATE_CHAINS|TREANT_ANIMATE_TREES|VAMPIRE_CHILDREN_OF_THE_NIGHT|WRAITH_CREATE_SPECTER/

describe('Creature-summoned allies (D198)', () => {
  it('leaves no closed rule for the four features', () => {
    for (const creature of [chainDevil, treant, vampire, wraith])
      expect(JSON.stringify(creature.features)).not.toMatch(CLOSED_RULE_PATTERN)
  })

  it('summons an Animated Chain from its stat block and rules the rest', async () => {
    const [summon, ruling, ...rest] = useOutcomes(chainDevil, 'Animate Chains')
    expect(rest).toEqual([])
    expect(summon).toMatchObject({
      effectKind: 'MANIFEST',
      manifestKind: 'SUMMON',
      label: 'Animated Chain',
      statBlock: {
        armorClass: { kind: 'FIXED', value: 20 },
        hitPoints: { kind: 'FIXED', value: 20 },
        damageResistances: [damageTypeId('PIERCING')],
        damageImmunities: [damageTypeId('PSYCHIC'), damageTypeId('THUNDER')]
      }
    })
    expect(ruling).toMatchObject({ effectKind: 'MANUAL_ADJUDICATION', label: 'Animate Chains' })
    await expectAuthoringParity(chainDevil)
  })

  it('keeps a homebrew summon with another armor class, hit points and defenses the same way', async () => {
    const authored = structuredClone(chainDevil)
    const [summon] = useOutcomes(authored, 'Animate Chains')
    if (summon?.effectKind !== 'MANIFEST' || summon.manifestKind !== 'SUMMON')
      throw new Error('Animate Chains must author a summon.')
    summon.statBlock = {
      ...summon.statBlock,
      armorClass: { kind: 'FIXED', value: 15 },
      hitPoints: { kind: 'FIXED', value: 30 },
      damageResistances: [damageTypeId('SLASHING')],
      damageImmunities: [damageTypeId('POISON')]
    }
    await expectAuthoringParity(authored)
  })

  it.each([
    { creature: treant, label: 'Animate Trees' },
    { creature: vampire, label: 'Children of the Night' },
    { creature: wraith, label: 'Create Specter' }
  ])('ships $label as a GM ruling', async ({ creature, label }) => {
    expect(useOutcomes(creature, label)).toMatchObject([
      { effectKind: 'MANUAL_ADJUDICATION', label }
    ])
    await expectAuthoringParity(creature)
  })
})
