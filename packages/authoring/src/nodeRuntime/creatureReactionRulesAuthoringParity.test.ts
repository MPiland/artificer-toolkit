import { describe, expect, it } from 'vitest'

import { CLOSED_RULE_KIND } from '@artificer-toolkit/shared/core'
import type { EffectAuthored } from '@artificer-toolkit/shared/authored'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { srdCreatures } from '@artificer-toolkit/source-data/srd/creatures/index.js'
import { hydra } from '@artificer-toolkit/source-data/srd/creatures/hydra.js'
import { marilith } from '@artificer-toolkit/source-data/srd/creatures/marilith.js'
import { stoneGolem } from '@artificer-toolkit/source-data/srd/creatures/stone-golem.js'
import { slow } from '@artificer-toolkit/source-data/srd/spells/slow.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from '../tests/srdSourceReader.js'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'

/**
 * SPELLS-33 T4l2 (D187a): Stone Golem Slow is authored from the Slow spell's action-economy grants
 * and repeat save; Hydra Reactive Heads and Marilith Reactive ship as GM rulings. T4l3: every adult
 * and ancient dragon's Wing Attack is a self-centered area save with damage and prone, and the fly
 * after it is the GM's, from the option's description. Each creature passes the creature node map
 * exactly as authored, and the four closed rule kinds are gone.
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

  const dragons = srdCreatures.filter((creature) =>
    /^(Adult|Ancient) \w+ Dragon$/.test(creature.label)
  )

  it('finds every adult and ancient dragon', () => {
    expect(dragons).toHaveLength(20)
  })

  it.each(dragons)('authors $label’s Wing Attack as a self-centered area save', async (dragon) => {
    const options = dragon.features?.flatMap((feature) => feature.options ?? []) ?? []
    const wingAttack = options.find((option) => option.label.startsWith('Wing Attack'))
    const [effect] = wingAttack?.effects ?? []
    expect(effect?.invocation).toMatchObject({
      range: { rangeKind: 'SELF' },
      shape: {
        shapeKind: 'SPHERE',
        radius: { amount: dragon.label.startsWith('Ancient') ? 15 : 10, unit: 'FEET' }
      },
      targeting: { selectionKind: 'AREA_CONTENTS', dispositionKind: 'ANY' }
    })
    const outcomes = resultBlocks(wingAttack?.effects).flatMap((block) => block.outcomes)
    // The fly is the dragon's own, once, so it is no outcome of a creature's failed save.
    expect(outcomes.map(({ effectKind }) => effectKind)).toEqual(['DAMAGE', 'CONDITION'])
    expect(wingAttack?.description).toContain(
      'The dragon can then fly up to half its flying speed.'
    )
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
