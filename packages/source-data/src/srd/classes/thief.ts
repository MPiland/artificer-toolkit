import {
  ACTIVATION_CODE,
  AUTHORING_SELECTION_KIND,
  GRANT_KIND,
  MODIFIER_KIND,
  MODIFIER_SCOPE_KIND,
  VALUE_DOMAIN_CODE,
  CLASS_CATEGORY,
  CLOSED_RULE_KIND,
  EFFECT_KIND,
  MANUAL_ADJUDICATION_REASON,
  PATH_CODE,
  PATH_GROUP_TYPE,
  RANGE_KIND,
  TARGET_SELECTION_KIND,
  TRIGGER,
  type ClassAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SUBCLASS_IDS } from '../ids.js'
import { SRD_STEALTH_SKILL_ID, SRD_SYSTEM_ID, SRD_USER_ID } from '../vocabulary.js'
import { closedRuleEffect } from './mechanics.js'

function classRowId(classIndex: number, group: number, entry: number): string {
  const xx = classIndex.toString(16).padStart(2, '0')
  const gg = group.toString(16).padStart(2, '0')
  const nn = entry.toString(16).padStart(2, '0')
  return `00000000-0000-0000-c0${xx}-${gg}${nn}00000000`
}

const R = 9

export const thiefRoguishArchetype: ClassAuthored = {
  id: SUBCLASS_IDS.THIEF,
  label: 'Thief',
  category: CLASS_CATEGORY.SUBCLASS,
  parentClassId: CLASS_IDS.ROGUE,
  description:
    "You hone your skills in the larcenous arts. Burglars, bandits, cutpurses, and other criminals typically follow this archetype, but so do rogues who prefer to think of themselves as professional treasure seekers, explorers, delvers, and investigators. In addition to improving your agility and stealth, you learn skills useful for delving into ancient ruins, reading unfamiliar languages, and using magic items you normally couldn't employ.",
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  features: [
    {
      id: classRowId(R, 11, 1),
      label: 'Fast Hands',
      description:
        "Starting at 3rd level, you can use the bonus action granted by your Cunning Action to make a Dexterity (Sleight of Hand) check, use your thieves' tools to disarm a trap or open a lock, or take the Use an Object action.",
      availableAtLevel: 3,
      order: 0,
      effects: [
        closedRuleEffect({
          id: classRowId(R, 20, 1),
          invocation: {
            kind: 'ACTION',
            triggerCode: TRIGGER.ACTIVATED,
            activation: { code: ACTIVATION_CODE.BONUS_ACTION, amount: 1 },
            range: { id: classRowId(R, 21, 1), rangeKind: RANGE_KIND.SELF },
            targeting: { selectionKind: TARGET_SELECTION_KIND.SELF }
          },
          ruleKind: CLOSED_RULE_KIND.CLASS_THIEF_FAST_HANDS
        })
      ]
    },
    {
      id: classRowId(R, 11, 2),
      label: 'Second-Story Work',
      description:
        'When you choose this archetype at 3rd level, you gain the ability to climb faster than normal; climbing no longer costs you extra movement. In addition, when you make a running jump, the distance you cover increases by a number of feet equal to your Dexterity modifier.',
      availableAtLevel: 3,
      order: 1,
      effects: [
        closedRuleEffect({
          id: classRowId(R, 20, 2),
          invocation: {
            kind: 'PASSIVE',
            triggerCode: TRIGGER.ACTIVATED,
            range: { id: classRowId(R, 21, 2), rangeKind: RANGE_KIND.SELF },
            targeting: { selectionKind: TARGET_SELECTION_KIND.SELF }
          },
          ruleKind: CLOSED_RULE_KIND.CLASS_THIEF_SECOND_STORY_WORK
        })
      ]
    },
    {
      id: classRowId(R, 11, 3),
      label: 'Supreme Sneak',
      description:
        'Starting at 9th level, you have advantage on a Dexterity (Stealth) check if you move no more than half your speed on the same turn.',
      availableAtLevel: 9,
      order: 2,
      grants: {
        modifiers: [
          {
            id: classRowId(R, 0x8a, 3),
            grantKind: GRANT_KIND.MODIFIER_GRANT,
            valueDomainCode: VALUE_DOMAIN_CODE.SKILL_MODIFIER,
            domain: { skillId: SRD_STEALTH_SKILL_ID },
            modifierKind: MODIFIER_KIND.ROLL_INFLUENCE,
            payload: { influence: 'ADVANTAGE' },
            scope: MODIFIER_SCOPE_KIND.GLOBAL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            order: 0,
            restrictions: {
              id: classRowId(R, 0x8b, 0),
              groups: [
                {
                  id: classRowId(R, 0x8b, 1),
                  order: 0,
                  contexts: [
                    {
                      id: classRowId(R, 0x8b, 2),
                      order: 0,
                      subject: 'CHARACTER',
                      conditions: [
                        {
                          id: classRowId(R, 0x8b, 3),
                          order: 0,
                          kind: 'PREDICATE',
                          constraint: 'INCLUDE',
                          predicateCode: 'TURN_MOVEMENT',
                          maxSpeedFraction: 0.5
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          }
        ]
      }
    },
    {
      id: classRowId(R, 11, 4),
      label: 'Use Magic Device',
      description:
        'By 13th level, you have learned enough about the workings of magic that you can improvise the use of items even when they are not intended for you. You ignore all class, race, and level requirements on the use of magic items.',
      availableAtLevel: 13,
      order: 3
    },
    {
      id: classRowId(R, 11, 5),
      label: "Thief's Reflexes",
      description:
        "When you reach 17th level, you have become adept at laying ambushes and quickly escaping danger. You can take two turns during the first round of any combat. You take your first turn at your normal initiative and your second turn at your initiative minus 10. You can't use this feature when you are surprised.",
      availableAtLevel: 17,
      order: 4,
      effects: [
        {
          id: classRowId(R, 20, 5),
          order: 1,
          invocation: {
            kind: 'PASSIVE',
            triggerCode: TRIGGER.ACTIVATED,
            range: { id: classRowId(R, 21, 5), rangeKind: RANGE_KIND.SELF },
            targeting: { selectionKind: TARGET_SELECTION_KIND.SELF }
          },
          paths: [
            {
              id: classRowId(R, 24, 5),
              order: 1,
              pathCode: PATH_CODE.PASSIVE,
              groupType: PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: classRowId(R, 25, 5),
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: classRowId(R, 26, 5),
                    effectKind: EFFECT_KIND.MANUAL_ADJUDICATION,
                    label: "Thief's Reflexes",
                    reasonCode: MANUAL_ADJUDICATION_REASON.EXTERNAL_WORLD_STATE,
                    instructions:
                      "In the first round of any combat, you take two turns: the first at your normal initiative and the second at your initiative minus 10. The table adds the second turn to the turn order. You can't use this feature when you are surprised."
                  }
                ]
              }
            }
          ]
        }
      ]
    }
  ]
}
