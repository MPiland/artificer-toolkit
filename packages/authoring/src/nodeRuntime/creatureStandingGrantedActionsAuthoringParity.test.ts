import { describe, expect, it } from 'vitest'

import { CLOSED_RULE_KIND } from '@artificer-toolkit/shared/core'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { clayGolem } from '@artificer-toolkit/source-data/srd/creatures/clay-golem.js'
import { giantOctopus } from '@artificer-toolkit/source-data/srd/creatures/giant-octopus.js'
import { goblin } from '@artificer-toolkit/source-data/srd/creatures/goblin.js'
import { orc } from '@artificer-toolkit/source-data/srd/creatures/orc.js'
import { shadow } from '@artificer-toolkit/source-data/srd/creatures/shadow.js'
import { spy } from '@artificer-toolkit/source-data/srd/creatures/spy.js'
import { vampire } from '@artificer-toolkit/source-data/srd/creatures/vampire.js'
import { SRD_BASIC_ACTION_IDS } from '@artificer-toolkit/source-data/srd/basicActions.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from './srdSourceReader.js'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'

/**
 * SPELLS-33 T4l1 (D160, D187a): the Creature traits that offer basic actions (Goblin Nimble Escape,
 * Spy Cunning Action, Shadow Stealth, Orc Aggressive, Giant Octopus Ink Cloud, Clay Golem Haste) are
 * authored from the `grantedActions` option a Builder author has on an APPLY_GRANT result block, and
 * the Vampire's legendary Move ships as a GM ruling. Each must pass the creature node map exactly as
 * authored, and the seven closed rule kinds they used are gone.
 */

const reader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)

function normalize(creature: CreatureAuthored) {
  return normalizeNodeRuntimeValues(reader, {
    mapId: 'creature',
    systemId: srdSystemRecord.id,
    values: structuredClone(creature) as unknown as Record<string, unknown>
  })
}

/** The result blocks the creature feature authors on its fixed paths. */
function featureResultBlocks(creature: CreatureAuthored, label: string) {
  const feature = creature.features?.find((candidate) => candidate.label === label)
  if (!feature) throw new Error(`The creature must author ${label}.`)
  return (feature.effects ?? []).flatMap((effect) =>
    effect.paths.flatMap((path) => (path.selectionKind === 'FIXED' ? [path.resultBlock] : []))
  )
}

const { DASH, DISENGAGE, HIDE } = SRD_BASIC_ACTION_IDS

describe('Creature traits that offer basic actions (D160)', () => {
  it.each([
    {
      creature: goblin,
      label: 'Nimble Escape',
      standing: true,
      offers: [{ activation: 'BONUS_ACTION', actionDefinitionIds: [DISENGAGE, HIDE] }]
    },
    {
      creature: spy,
      label: 'Cunning Action',
      standing: true,
      offers: [{ activation: 'BONUS_ACTION', actionDefinitionIds: [DASH, DISENGAGE, HIDE] }]
    },
    {
      creature: shadow,
      label: 'Shadow Stealth',
      standing: true,
      offers: [{ activation: 'BONUS_ACTION', actionDefinitionIds: [HIDE] }]
    },
    {
      creature: orc,
      label: 'Aggressive',
      standing: true,
      offers: [{ activation: 'BONUS_ACTION', actionDefinitionIds: [DASH] }]
    },
    {
      creature: giantOctopus,
      label: 'Ink Cloud (Recharges after a Short or Long Rest)',
      standing: false,
      offers: [{ activation: 'BONUS_ACTION', actionDefinitionIds: [DASH] }]
    },
    {
      creature: clayGolem,
      label: 'Haste (Recharge 5-6)',
      standing: false,
      offers: [{ activation: 'FREE', usesPerTurn: 1, actionDefinitionIds: [], weaponAttack: true }]
    }
  ])(
    'authors $label as an APPLY_GRANT with no closed rule',
    async ({ creature, label, standing, offers }) => {
      const [block] = featureResultBlocks(creature, label)
      expect(block?.lifecycle?.grantedActions).toEqual(offers)
      const outcomes = block?.outcomes.map(({ effectKind }) => effectKind) ?? []
      expect(outcomes).toContain('APPLY_GRANT')
      expect(outcomes).not.toContain('CLOSED_RULE')
      // A standing offer has no duration; a timed one ends with the turn it was set up for.
      expect(block?.duration === undefined).toBe(standing)
      const result = await normalize(creature)
      expect(result.clearedPaths).toEqual([])
      expect(getValueAtPath(result.values, ['features'])).toEqual(creature.features)
    }
  )

  it('keeps the Vampire’s legendary Move as a GM ruling', async () => {
    const options = vampire.features?.flatMap((feature) => feature.options ?? []) ?? []
    const move = options.find((option) => option.label === 'Move')
    const outcomes = (move?.effects ?? []).flatMap((effect) =>
      effect.paths.flatMap((path) =>
        path.selectionKind === 'FIXED' ? path.resultBlock.outcomes : []
      )
    )
    expect(outcomes.map(({ effectKind }) => effectKind)).toEqual(['MANUAL_ADJUDICATION'])
    const result = await normalize(vampire)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['features'])).toEqual(vampire.features)
  })

  it('no longer lists the seven closed rule kinds', () => {
    for (const kind of [
      'CLAY_GOLEM_HASTE',
      'CREATURE_GIANT_OCTOPUS_INK_CLOUD',
      'CREATURE_GOBLIN_NIMBLE_ESCAPE',
      'CREATURE_ORC_AGGRESSIVE',
      'CREATURE_SHADOW_STEALTH',
      'CREATURE_SPY_CUNNING_ACTION',
      'CREATURE_VAMPIRE_LEGENDARY_ACTIONS'
    ]) {
      expect(CLOSED_RULE_KIND).not.toHaveProperty(kind)
    }
  })
})
