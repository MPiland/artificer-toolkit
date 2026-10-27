import { describe, expect, it } from 'vitest'

import { CLOSED_RULE_KIND } from '@artificer-toolkit/shared/core'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { androsphinx } from '@artificer-toolkit/source-data/srd/creatures/androsphinx.js'
import { couatl } from '@artificer-toolkit/source-data/srd/creatures/couatl.js'
import { dryad } from '@artificer-toolkit/source-data/srd/creatures/dryad.js'
import { hornedDevil } from '@artificer-toolkit/source-data/srd/creatures/horned-devil.js'
import { vrock } from '@artificer-toolkit/source-data/srd/creatures/vrock.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from './srdSourceReader.js'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'

/**
 * SPELLS-33 T6m2 (D187a): the Androsphinx roars, Couatl poison, Dryad Tree Stride, Horned Devil
 * infernal wound and Vrock screech are written from the options a Builder author has on a creature
 * feature: saves, conditions, a turn-anchored duration and GM rulings (MANUAL_ADJUDICATION) for the
 * ordinal roar, the hearing and demon exemptions, the wake action, the stacking wound and the tree
 * size. Each creature must pass the creature node map exactly as authored, and the five closed rule
 * kinds are gone.
 */

const reader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)

function normalize(creature: CreatureAuthored) {
  return normalizeNodeRuntimeValues(reader, {
    mapId: 'creature',
    systemId: srdSystemRecord.id,
    values: structuredClone(creature) as unknown as Record<string, unknown>
  })
}

function feature(creature: CreatureAuthored, label: string) {
  const found = creature.features?.find((candidate) => candidate.label === label)
  if (!found) throw new Error(`The creature must author ${label}.`)
  return found
}

/** The outcome kinds each effect of the feature authors on one path, in effect order. */
function pathKinds(creature: CreatureAuthored, label: string, pathCode: string) {
  return (feature(creature, label).effects ?? []).map((effect) =>
    effect.paths.flatMap((path) =>
      path.pathCode === pathCode && path.selectionKind === 'FIXED'
        ? path.resultBlock.outcomes.map(({ effectKind }) => effectKind)
        : []
    )
  )
}

describe('lingering creature riders from core options (D187a)', () => {
  it.each([
    {
      creature: androsphinx,
      label: 'Roar (3/Day)',
      pathCode: 'ON_SAVE_FAIL',
      kinds: [
        ['CONDITION', 'FOLLOW_UP_SAVE', 'MANUAL_ADJUDICATION'],
        ['CONDITION', 'CONDITION', 'CONDITION', 'FOLLOW_UP_SAVE', 'MANUAL_ADJUDICATION'],
        ['DAMAGE', 'CONDITION', 'MANUAL_ADJUDICATION']
      ]
    },
    { creature: couatl, label: 'Bite', pathCode: 'ON_HIT', kinds: [['DAMAGE', 'FOLLOW_UP_SAVE']] },
    {
      creature: dryad,
      label: 'Tree Stride',
      pathCode: 'ON_USE',
      kinds: [['TELEPORT', 'MANUAL_ADJUDICATION']]
    },
    {
      creature: hornedDevil,
      label: 'Tail',
      pathCode: 'ON_HIT',
      kinds: [['DAMAGE', 'FOLLOW_UP_SAVE']]
    },
    {
      creature: vrock,
      label: 'Stunning Screech (1/Day)',
      pathCode: 'ON_SAVE_FAIL',
      kinds: [['CONDITION', 'MANUAL_ADJUDICATION']]
    }
  ])(
    'authors $creature.label $label from core options and passes the node map unchanged',
    async ({ creature, label, pathCode, kinds }) => {
      expect(pathKinds(creature, label, pathCode)).toEqual(kinds)
      const result = await normalize(creature)
      expect(result.clearedPaths).toEqual([])
      expect(getValueAtPath(result.values, ['features'])).toEqual(creature.features)
    }
  )

  it.each([
    { creature: couatl, label: 'Bite', kinds: ['CONDITION', 'CONDITION', 'MANUAL_ADJUDICATION'] },
    { creature: hornedDevil, label: 'Tail', kinds: ['MANUAL_ADJUDICATION'] }
  ])(
    'rules on the $creature.label $label rider when the save fails',
    ({ creature, label, kinds }) => {
      const [effect] = feature(creature, label).effects ?? []
      const save = effect?.paths
        .flatMap((path) => (path.selectionKind === 'FIXED' ? path.resultBlock.outcomes : []))
        .find((outcome) => outcome.effectKind === 'FOLLOW_UP_SAVE')
      expect(
        save?.onFailure.kind === 'OUTCOMES' &&
          save.onFailure.outcomes.map(({ effectKind }) => effectKind)
      ).toEqual(kinds)
    }
  )

  it('stuns the Vrock screech targets until the end of the vrock’s next turn', () => {
    const [screech] = feature(vrock, 'Stunning Screech (1/Day)').effects ?? []
    const [path] = screech?.paths ?? []
    expect(path).toMatchObject({
      selectionKind: 'FIXED',
      resultBlock: {
        duration: { durationKind: 'ROUND', amount: 1 },
        lifecycle: { turnAnchor: { actor: 'SOURCE', boundary: 'END_OF_TURN' } }
      }
    })
  })

  it('no longer lists the five lingering-rider closed rule kinds', () => {
    for (const kind of [
      'CREATURE_ANDROSPHINX_ROAR',
      'CREATURE_COUATL_BITE_POISON',
      'CREATURE_DRYAD_TREE_STRIDE',
      'CREATURE_HORNED_DEVIL_INFERNAL_WOUND',
      'CREATURE_VROCK_STUNNING_SCREECH'
    ]) {
      expect(CLOSED_RULE_KIND).not.toHaveProperty(kind)
    }
  })
})
