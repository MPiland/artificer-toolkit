import type { FeatureAuthored } from '@artificer-toolkit/shared/authored'
import {
  collegeOfLore,
  cuttingWordsReaction
} from '@artificer-toolkit/source-data/srd/classes/college-of-lore.js'

import { srdByLabel } from './dnd5eSrdCharacter.js'
import { testUuid } from './dnd5eSrdEncounter.js'

/**
 * A homebrew class feature: a free reaction (no charge) that takes 1d4 from another creature's
 * attack roll, otherwise authored as the SRD Cutting Words is. Its authored ids come from `newId`;
 * by default they are fixed test ids.
 */
export function heckleFeature(newId?: () => string): FeatureAuthored {
  let next = 0x7d0
  const id = newId ?? (() => testUuid(next++))
  if (cuttingWordsReaction.invocation.kind !== 'ACTION')
    throw new Error('The SRD Cutting Words is not an action.')
  const { resourceUse: _charge, ...invocation } = cuttingWordsReaction.invocation
  const [path] = cuttingWordsReaction.paths ?? []
  if (!path || !('resultBlock' in path)) throw new Error('Expected a result-block path.')
  const [outcome] = path.resultBlock.outcomes
  if (!outcome || !('die' in outcome) || !invocation.range)
    throw new Error('The SRD Cutting Words has no ranged outcome.')
  return {
    ...srdByLabel(collegeOfLore.features ?? [], 'Cutting Words'),
    id: id(),
    label: 'Heckle',
    availableAtLevel: 1,
    effects: [
      {
        ...cuttingWordsReaction,
        id: id(),
        invocation: { ...invocation, range: { ...invocation.range, id: id() } },
        paths: [
          {
            ...path,
            id: id(),
            resultBlock: {
              ...path.resultBlock,
              id: id(),
              outcomes: [
                {
                  ...outcome,
                  id: id(),
                  die: {
                    count: 1,
                    faces: 4,
                    sign: 'SUBTRACT' as const,
                    timing: 'AFTER_ROLL' as const
                  }
                }
              ]
            }
          }
        ]
      }
    ]
  }
}
