import { describe, expect, it } from 'vitest'

import { CLOSED_RULE_KIND } from '@artificer-toolkit/shared/core'
import type { EffectAuthored } from '@artificer-toolkit/shared/authored'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { adultBrassDragon } from '@artificer-toolkit/source-data/srd/creatures/adult-brass-dragon.js'
import { adultBronzeDragon } from '@artificer-toolkit/source-data/srd/creatures/adult-bronze-dragon.js'
import { adultCopperDragon } from '@artificer-toolkit/source-data/srd/creatures/adult-copper-dragon.js'
import { adultGoldDragon } from '@artificer-toolkit/source-data/srd/creatures/adult-gold-dragon.js'
import { adultSilverDragon } from '@artificer-toolkit/source-data/srd/creatures/adult-silver-dragon.js'
import { ancientGoldDragon } from '@artificer-toolkit/source-data/srd/creatures/ancient-gold-dragon.js'
import { ancientSilverDragon } from '@artificer-toolkit/source-data/srd/creatures/ancient-silver-dragon.js'
import { hydra } from '@artificer-toolkit/source-data/srd/creatures/hydra.js'
import { marilith } from '@artificer-toolkit/source-data/srd/creatures/marilith.js'
import { stoneGolem } from '@artificer-toolkit/source-data/srd/creatures/stone-golem.js'
import { slow } from '@artificer-toolkit/source-data/srd/spells/slow.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from './srdSourceReader.js'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'

/**
 * SPELLS-33 T4l2 (D187a): Stone Golem Slow is authored from the Slow spell's action-economy grants
 * and repeat save; Hydra Reactive Heads, Marilith Reactive and the dragons' fly after a Wing Attack
 * ship as GM rulings. Each creature passes the creature node map exactly as authored, and the four
 * closed rule kinds are gone.
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

/** The result blocks authored on the fixed paths of a feature or legendary option. */
function resultBlocks(effects: readonly EffectAuthored[] | undefined) {
  return (effects ?? []).flatMap((effect) =>
    effect.paths.flatMap((path) => (path.selectionKind === 'FIXED' ? [path.resultBlock] : []))
  )
}

function featureResultBlocks(creature: CreatureAuthored, label: string) {
  const feature = creature.features?.find((candidate) => candidate.label === label)
  if (!feature) throw new Error(`The creature must author ${label}.`)
  return resultBlocks(feature.effects)
}

describe('Creature reaction rules and Wing Attack (D187a)', () => {
  it('authors Stone Golem Slow with the Slow spell’s limits and repeat save', async () => {
    const [block] = featureResultBlocks(stoneGolem, 'Slow (Recharge 5-6)')
    const [spellBlock] = resultBlocks(slow.effects)
    const domains = (resultBlock: typeof block) =>
      resultBlock?.outcomes.flatMap((outcome) =>
        outcome.effectKind === 'APPLY_GRANT'
          ? (outcome.grants.modifiers ?? []).map(({ valueDomainCode, modifierKind, payload }) => ({
              valueDomainCode,
              modifierKind,
              payload
            }))
          : []
      )
    // The golem's Slow is the spell's without its AC and Dexterity save penalties.
    expect(domains(block)).toEqual(
      domains(spellBlock)?.filter(
        ({ valueDomainCode }) =>
          valueDomainCode !== 'ARMOR_CLASS' && valueDomainCode !== 'SAVING_THROW_MODIFIER'
      )
    )
    expect(block?.outcomes.map(({ effectKind }) => effectKind)).toEqual([
      'APPLY_GRANT',
      'FOLLOW_UP_SAVE'
    ])
    expect(block?.duration).toMatchObject({ durationKind: 'MINUTE', amount: 1 })
    await expectAuthoringParity(stoneGolem)
  })

  it.each([
    { creature: hydra, label: 'Reactive Heads' },
    { creature: marilith, label: 'Reactive' }
  ])('ships $label as a GM ruling', async ({ creature, label }) => {
    const outcomes = featureResultBlocks(creature, label).flatMap((block) => block.outcomes)
    expect(outcomes.map(({ effectKind }) => effectKind)).toEqual(['MANUAL_ADJUDICATION'])
    await expectAuthoringParity(creature)
  })

  it.each([
    adultBrassDragon,
    adultBronzeDragon,
    adultCopperDragon,
    adultGoldDragon,
    adultSilverDragon,
    ancientGoldDragon,
    ancientSilverDragon
  ])('keeps $label’s Wing Attack damage and prone, with the fly as a GM ruling', async (dragon) => {
    const options = dragon.features?.flatMap((feature) => feature.options ?? []) ?? []
    const wingAttack = options.find((option) => option.label.startsWith('Wing Attack'))
    const outcomes = resultBlocks(wingAttack?.effects).flatMap((block) => block.outcomes)
    expect(outcomes.map(({ effectKind }) => effectKind)).toEqual([
      'DAMAGE',
      'CONDITION',
      'MANUAL_ADJUDICATION'
    ])
    await expectAuthoringParity(dragon)
  })

  it('no longer lists the four closed rule kinds', () => {
    for (const kind of [
      'CREATURE_HYDRA_REACTIVE_HEADS',
      'CREATURE_MARILITH_REACTIVE',
      'CREATURE_STONE_GOLEM_SLOW',
      'DRAGON_LEGENDARY_WING_ATTACK'
    ]) {
      expect(CLOSED_RULE_KIND).not.toHaveProperty(kind)
    }
  })
})
