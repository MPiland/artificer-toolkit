import { describe, expect, it } from 'vitest'

import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { seaHag } from '@artificer-toolkit/source-data/srd/creatures/sea-hag.js'
import { conditionTypeId } from '@artificer-toolkit/source-data/srd/equipment/shared.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from './srdSourceReader.js'
import { dnd5eVocabularyCapabilityAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/vocabulary'

/**
 * SPELLS-33.T4i4a (D156): a single-target action may require its target to hold a condition, to be
 * seen or to see the user, or to be at 0 hit points. A homebrew creature feature authors them from
 * the same options a Builder author has, with damage on a failed save, so it must pass the creature
 * node map exactly as authored; a malformed requirement must not.
 */

const reader = createSrdNodeRuntimeReader(dnd5eVocabularyCapabilityAdapter.lists)

function normalize(creature: CreatureAuthored) {
  return normalizeNodeRuntimeValues(reader, {
    mapId: 'creature',
    systemId: srdSystemRecord.id,
    values: structuredClone(creature) as unknown as Record<string, unknown>
  })
}

/** The Sea Hag with Death Glare's feature rewritten as a homebrew damaging gaze with requirements. */
function homebrewGaze(requirements: unknown[]): CreatureAuthored {
  const authored = structuredClone(seaHag)
  const feature = authored.features?.find(({ label }) => label === 'Death Glare')
  const claws = authored.features?.find(({ label }) => label === 'Claws')
  const effect = feature?.effects?.[0]
  const damage = claws?.effects?.[0]?.paths[0]
  if (!feature || !effect || !damage || damage.selectionKind !== 'FIXED')
    throw new Error('The Sea Hag must author Death Glare and Claws.')
  if (
    effect.invocation.kind !== 'ACTION' ||
    effect.invocation.targeting?.selectionKind !== 'SINGLE_TARGET'
  )
    throw new Error('Death Glare must be a single-target action.')
  effect.invocation.targeting = {
    ...effect.invocation.targeting,
    targetRequirements: requirements
  } as typeof effect.invocation.targeting
  effect.paths = [
    {
      ...damage,
      id: `${damage.id}-gaze`,
      pathCode: 'ON_SAVE_FAIL',
      resultBlock: { ...damage.resultBlock, id: `${damage.id}-gaze__result` }
    }
  ] as typeof effect.paths
  delete (effect.invocation as { savingThrow?: unknown }).savingThrow
  return authored
}

describe('a single-target action’s requirements through the creature node map (SPELLS-33.T4i4a)', () => {
  it.each([
    [
      'a condition from anyone, sight both ways, and a dying target',
      [
        { kind: 'HAS_CONDITION', conditionIds: [conditionTypeId('FRIGHTENED')], source: 'ANY' },
        { kind: 'SIGHT', direction: 'ACTOR_SEES_TARGET' },
        { kind: 'SIGHT', direction: 'TARGET_SEES_ACTOR' },
        { kind: 'AT_ZERO_HIT_POINTS' }
      ]
    ],
    [
      'a condition from the user alone',
      [{ kind: 'HAS_CONDITION', conditionIds: [conditionTypeId('POISONED')], source: 'ACTOR' }]
    ]
  ])('keeps a gaze requiring %s exactly as authored', async (_label, requirements) => {
    const authored = homebrewGaze(requirements)
    const result = await normalize(authored)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['features'])).toEqual(authored.features)
  })

  it('clears a condition the System does not define', async () => {
    const result = await normalize(
      homebrewGaze([
        {
          kind: 'HAS_CONDITION',
          conditionIds: ['00000000-0000-0000-0000-00000000dead'],
          source: 'ANY'
        }
      ])
    )
    expect(result.clearedPaths).toEqual([
      [
        'features',
        4,
        'effects',
        0,
        'invocation',
        'targeting',
        'targetRequirements',
        0,
        'conditionIds'
      ]
    ])
  })
})
