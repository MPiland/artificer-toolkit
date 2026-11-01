import { describe, expect, it } from 'vitest'
import {
  ACTIVATION_CODE,
  EFFECT_KIND,
  PATH_CODE,
  PATH_GROUP_TYPE,
  RANGE_KIND,
  TRIGGER
} from '@artificer-toolkit/shared/core'
import type { CreatureAuthored } from '@artificer-toolkit/shared'
import { cleric } from '@artificer-toolkit/source-data/srd/classes/cleric.js'
import { ghoul } from '@artificer-toolkit/source-data/srd/creatures/ghoul.js'
import { wight } from '@artificer-toolkit/source-data/srd/creatures/wight.js'
import { zombie } from '@artificer-toolkit/source-data/srd/creatures/zombie.js'

import { challengeRatingGateCap } from '../systems/dnd5e/effectActionGates.js'
import { testUuid } from '../testing/dnd5eSrdEncounter.js'
import {
  creatureActor,
  prepareCreatureAction,
  settleCreatureAction,
  srdAbilityId,
  type CreatureFeature
} from './encounterCreatureAction.js'

/**
 * SPELLS-31.T4m2 (D202): a result block gate admits a target by its challenge rating, so Destroy
 * Undead is a generic gated kill on Turn Undead's failed save rather than a closed rule.
 */

const SOURCE_ID = testUuid(0x6e301)
const TARGET_ID = testUuid(0x6e302)
const FEATURE_ID = testUuid(0x6e303)
const FAILED = 0

/** A DC 13 Wisdom save whose failed block kills a target of challenge rating 1 or less. */
const killingSave: CreatureFeature = {
  id: FEATURE_ID,
  label: 'Gated Kill',
  description: 'Fixture: a challenge rating gate on a saving throw result block.',
  order: 1,
  effects: [
    {
      id: testUuid(0x6e310),
      order: 1,
      invocation: {
        kind: 'ACTION',
        triggerCode: TRIGGER.SAVING_THROW,
        savingThrow: {
          id: testUuid(0x6e311),
          dcMethod: 'FIXED_DC',
          abilityDefinitionId: srdAbilityId('WISDOM'),
          baseDc: 13
        },
        activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
        range: { id: testUuid(0x6e312), rangeKind: RANGE_KIND.UNLIMITED },
        targeting: { selectionKind: 'SINGLE_TARGET', dispositionKind: 'ANY' }
      },
      paths: [
        {
          id: testUuid(0x6e313),
          order: 1,
          pathCode: PATH_CODE.ON_SAVE_FAIL,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE',
          selectionKind: 'FIXED',
          resultBlock: {
            id: testUuid(0x6e314),
            resultKind: 'SINGLE',
            gate: { kind: 'TARGET_CHALLENGE_RATING_AT_MOST', maxChallengeRating: 1 },
            outcomes: [{ id: testUuid(0x6e315), effectKind: EFFECT_KIND.KILL }]
          }
        }
      ]
    }
  ]
}

async function failedSaveApplications(statBlock?: CreatureAuthored) {
  const prepared = await prepareCreatureAction({
    actor: creatureActor({ id: SOURCE_ID, label: 'Source', features: [killingSave] }),
    target: creatureActor({
      id: TARGET_ID,
      label: 'Target',
      features: [],
      ...(statBlock ? { statBlock } : {})
    }),
    featureId: FEATURE_ID,
    overridable: true
  })
  const { execution } = await settleCreatureAction({ prepared, rolls: [FAILED] })
  expect(execution.d20).toMatchObject({ resultPath: 'ON_SAVE_FAIL' })
  return execution.applications
}

describe('a challenge rating gate on a saving throw result block', () => {
  it.each([
    ['a Zombie (CR 1/4)', zombie],
    ['a Ghoul (CR 1, at the cap)', ghoul]
  ])('kills %s that fails the save', async (_name, statBlock) => {
    expect(await failedSaveApplications(statBlock)).toEqual([
      expect.objectContaining({ kind: 'KILL' })
    ])
  })

  it('spares a Wight (CR 3) above the cap', async () => {
    expect(await failedSaveApplications(wight)).toEqual([])
  })

  it('spares a target with no challenge rating rather than guess one', async () => {
    expect(await failedSaveApplications()).toEqual([])
  })
})

describe('Destroy Undead challenge rating by Cleric level (D202)', () => {
  const destroyGate = () => {
    const effect = cleric.features?.find(({ label }) => label === 'Channel Divinity')?.effects?.[0]
    const path = effect?.paths[1]
    if (path?.selectionKind !== 'FIXED') throw new Error('Turn Undead needs a Destroy Undead path.')
    return path.resultBlock.gate
  }
  const capAt = (level: number) =>
    challengeRatingGateCap(destroyGate(), {
      classLevels: { [cleric.id]: level },
      resolvedDamageExpressions: {},
      resolvedDamageOutcomeExpressions: {},
      selectedOptionalRiderIds: [],
      attackRollMode: 'NORMAL'
    })

  it.each([
    [4, undefined],
    [5, 0.5],
    [7, 0.5],
    [8, 1],
    [11, 2],
    [14, 3],
    [17, 4],
    [20, 4]
  ])('a level %i Cleric destroys undead of challenge rating %s or less', (level, cap) => {
    expect(capAt(level)).toBe(cap)
  })
})
