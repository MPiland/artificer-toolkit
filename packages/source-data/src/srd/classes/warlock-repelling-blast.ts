import {
  EFFECT_KIND,
  MEASUREMENT_UNIT_CODE,
  PATH_CODE,
  PATH_GROUP_TYPE,
  RANGE_KIND,
  TARGET_DISPOSITION_KIND,
  TARGET_SELECTION_KIND,
  TRIGGER,
  type EffectAuthored
} from '@artificer-toolkit/shared'

/** The id of one authored row of the owning Feature, by its group. */
type RowId = (group: number) => string

/** Repelling Blast: a hit with the named Spell's attack pushes the target up to 10 feet away. */
export function repellingBlastEffect(rowId: RowId, spellId: string): EffectAuthored {
  return {
    id: rowId(0x60),
    order: 0,
    invocation: {
      kind: 'PASSIVE',
      triggerCode: TRIGGER.RANGED_SPELL_ATTACK,
      ridesSpellIds: [spellId],
      range: { id: rowId(0x69), rangeKind: RANGE_KIND.SPECIAL },
      targeting: {
        selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
        dispositionKind: TARGET_DISPOSITION_KIND.HOSTILE
      }
    },
    paths: [
      {
        id: rowId(0x80),
        order: 1,
        pathCode: PATH_CODE.ON_HIT,
        groupType: PATH_GROUP_TYPE.SINGLE,
        originKind: 'SOURCE',
        selectionKind: 'FIXED',
        resultBlock: {
          id: `${rowId(0x81)}__result`,
          resultKind: 'SINGLE',
          outcomes: [
            {
              id: rowId(0x82),
              effectKind: EFFECT_KIND.FORCED_MOVEMENT,
              direction: 'AWAY_FROM_SOURCE',
              actionEconomy: 'NONE',
              distanceMode: 'UP_TO',
              amount: 10,
              unit: MEASUREMENT_UNIT_CODE.FEET
            }
          ]
        }
      }
    ]
  }
}
