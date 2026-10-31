import {
  ACTIVATION_CODE,
  AUTHORING_MODE_KIND,
  AUTHORING_SELECTION_KIND,
  CLASS_CATEGORY,
  CLOSED_RULE_KIND,
  DAMAGE_DEFENSE_BYPASS_CODE,
  DURATION_KIND,
  EFFECT_KIND,
  GRANT_KIND,
  MANUAL_ADJUDICATION_REASON,
  MODIFIER_KIND,
  MODIFIER_SCOPE_KIND,
  PATH_CODE,
  PATH_GROUP_TYPE,
  RANGE_KIND,
  SCALING,
  SPELL_GRANT_ACCESS,
  TARGET_SELECTION_KIND,
  TRIGGER,
  VALUE_DOMAIN_CODE,
  type ClassAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS, SUBCLASS_IDS } from '../ids.js'
import { SRD_DAMAGE_TYPES, SRD_SYSTEM_ID, SRD_USER_ID } from '../vocabulary.js'
import { closedRuleEffect, gmRulingEffect } from './mechanics.js'

function classRowId(classIndex: number, group: number, entry: number): string {
  const xx = classIndex.toString(16).padStart(2, '0')
  const gg = group.toString(16).padStart(2, '0')
  const nn = entry.toString(16).padStart(2, '0')
  return `00000000-0000-0000-c0${xx}-${gg}${nn}00000000`
}

const W = 11

export const theFiend: ClassAuthored = {
  id: SUBCLASS_IDS.FIEND,
  label: 'The Fiend',
  category: CLASS_CATEGORY.SUBCLASS,
  parentClassId: CLASS_IDS.WARLOCK,
  description:
    "You have made a pact with a fiend from the lower planes of existence, a being whose aims are evil, even if you strive against those aims. Such beings desire the corruption or destruction of all things, ultimately including you. Fiends powerful enough to forge a pact include demon lords such as Demogorgon, Orcus, Fraz'Urb-luu, and Baphomet; archdevils such as Asmodeus, Dispater, Mephistopheles, and Belial; pit fiends and balors that are especially mighty; and ultroloths and other lords of the yugoloths.",
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  features: [
    {
      id: classRowId(W, 11, 1),
      label: 'Expanded Spell List',
      description:
        'The Fiend lets you choose from an expanded list of spells when you learn a warlock spell. The following spells are added to the warlock spell list for you.',
      availableAtLevel: 1,
      order: 0,
      grants: {
        spells: [
          {
            id: classRowId(W, 23, 1),
            grantKind: GRANT_KIND.SPELL_GRANT,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: SCALING.NONE,
            authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
            spellIds: [
              SPELL_IDS.BURNING_HANDS,
              SPELL_IDS.COMMAND,
              SPELL_IDS.BLINDNESS_DEAFNESS,
              SPELL_IDS.SCORCHING_RAY,
              SPELL_IDS.FIREBALL,
              SPELL_IDS.STINKING_CLOUD,
              SPELL_IDS.FIRE_SHIELD,
              SPELL_IDS.WALL_OF_FIRE,
              SPELL_IDS.FLAME_STRIKE,
              SPELL_IDS.HALLOW
            ],
            access: SPELL_GRANT_ACCESS.CLASS_LIST_ONLY,
            classListIds: [CLASS_IDS.WARLOCK],
            order: 0
          }
        ]
      }
    },
    {
      id: classRowId(W, 11, 3),
      label: "Dark One's Blessing",
      description:
        'Starting at 1st level, when you reduce a hostile creature to 0 hit points, you gain temporary hit points equal to your Charisma modifier + your warlock level (minimum of 1).',
      availableAtLevel: 1,
      order: 1,
      effects: [
        closedRuleEffect({
          id: classRowId(W, 20, 2),
          invocation: {
            kind: 'PASSIVE',
            triggerCode: TRIGGER.ACTIVATED,
            range: { id: classRowId(W, 21, 2), rangeKind: RANGE_KIND.SELF },
            targeting: { selectionKind: TARGET_SELECTION_KIND.SELF }
          },
          ruleKind: CLOSED_RULE_KIND.CLASS_FIEND_DARK_ONES_BLESSING
        })
      ]
    },
    {
      id: classRowId(W, 11, 4),
      label: "Dark One's Own Luck",
      description:
        "Starting at 6th level, you can call on your patron to alter fate in your favor. When you make an ability check or a saving throw, you can use this feature to add a d10 to your roll. You can do so after seeing the initial roll but before any of the roll's effects occur. Once you use this feature, you can't use it again until you finish a short or long rest.",
      availableAtLevel: 6,
      order: 2,
      attributes: ['LIMITED_USE'],
      charges: {
        id: classRowId(W, 22, 1),
        limitKind: 'FIXED_AMOUNT',
        scalingKind: SCALING.NONE,
        resetKind: 'SHORT_REST',
        amount: 1
      },
      effects: [
        closedRuleEffect({
          id: classRowId(W, 20, 3),
          invocation: {
            kind: 'ACTION',
            triggerCode: TRIGGER.ACTIVATED,
            resourceUse: { chargeId: classRowId(W, 22, 1), cost: 1 },
            activation: { code: ACTIVATION_CODE.FREE },
            range: { id: classRowId(W, 21, 3), rangeKind: RANGE_KIND.SELF },
            targeting: { selectionKind: TARGET_SELECTION_KIND.SELF }
          },
          ruleKind: CLOSED_RULE_KIND.CLASS_FIEND_DARK_ONES_OWN_LUCK
        })
      ]
    },
    {
      id: classRowId(W, 11, 5),
      label: 'Fiendish Resilience',
      description:
        'Starting at 10th level, you can choose one damage type when you finish a short or long rest. You gain resistance to that damage type until you choose a different one with this feature. Damage from magical weapons or silver weapons ignores this resistance.',
      availableAtLevel: 10,
      order: 3,
      // The choice is made once between rests at any time rather than as a rest ends (a GM ruling):
      // the engine has no rest-end prompt. A new choice ends the earlier one.
      attributes: ['LIMITED_USE'],
      charges: {
        id: classRowId(W, 22, 3),
        limitKind: 'FIXED_AMOUNT',
        scalingKind: SCALING.NONE,
        resetKind: 'SHORT_REST',
        amount: 1
      },
      effects: [
        {
          id: classRowId(W, 20, 4),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: TRIGGER.ACTIVATED,
            resourceUse: { chargeId: classRowId(W, 22, 3), cost: 1 },
            activation: { code: ACTIVATION_CODE.FREE },
            range: { id: classRowId(W, 21, 4), rangeKind: RANGE_KIND.SELF },
            targeting: { selectionKind: TARGET_SELECTION_KIND.SELF }
          },
          paths: [
            {
              id: classRowId(W, 24, 1),
              order: 1,
              pathCode: PATH_CODE.ON_USE,
              groupType: PATH_GROUP_TYPE.CHOICE,
              originKind: 'SOURCE',
              selectionKind: 'CHOICE',
              options: SRD_DAMAGE_TYPES.map(({ id: damageTypeId, label }, index) => ({
                id: classRowId(W, 25, index + 1),
                order: index + 1,
                label,
                description: `Resistance to ${label.toLowerCase()} damage until you choose a different one; magical and silvered weapons ignore it.`,
                resultBlock: {
                  id: `${classRowId(W, 26, index + 1)}__result`,
                  resultKind: 'SEQUENCE',
                  duration: {
                    id: classRowId(W, 27, index + 1),
                    durationKind: DURATION_KIND.UNTIL_DISPELLED
                  },
                  outcomes: [
                    {
                      id: classRowId(W, 28, index + 1),
                      effectKind: EFFECT_KIND.END_EFFECTS,
                      scope: 'ALL',
                      selectors: [{ kind: 'SAME_EFFECT' }]
                    },
                    {
                      id: classRowId(W, 29, index + 1),
                      effectKind: EFFECT_KIND.APPLY_GRANT,
                      grants: {
                        modifiers: [
                          {
                            id: classRowId(W, 30, index + 1),
                            grantKind: GRANT_KIND.MODIFIER_GRANT,
                            valueDomainCode: VALUE_DOMAIN_CODE.DAMAGE_RESISTANCE,
                            domain: {},
                            modifierKind: MODIFIER_KIND.ADD_OPTION,
                            scope: MODIFIER_SCOPE_KIND.GLOBAL,
                            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                            payload: {
                              damageTypeId,
                              bypassedBy: [
                                DAMAGE_DEFENSE_BYPASS_CODE.MAGICAL,
                                DAMAGE_DEFENSE_BYPASS_CODE.SILVERED
                              ]
                            },
                            order: 1
                          }
                        ]
                      }
                    }
                  ]
                }
              }))
            }
          ]
        }
      ]
    },
    {
      id: classRowId(W, 11, 6),
      label: 'Hurl Through Hell',
      description:
        "Starting at 14th level, when you hit a creature with an attack, you can use this feature to instantly transport the target through the lower planes. The creature disappears and hurtles through a nightmare landscape. At the end of your next turn, the target returns to the space it previously occupied, or the nearest unoccupied space. If the target is not a fiend, it takes 10d10 psychic damage as it reels from its horrific experience. Once you use this feature, you can't use it again until you finish a long rest.",
      availableAtLevel: 14,
      order: 4,
      attributes: ['LIMITED_USE'],
      charges: {
        id: classRowId(W, 22, 2),
        limitKind: 'FIXED_AMOUNT',
        scalingKind: SCALING.NONE,
        resetKind: 'LONG_REST',
        amount: 1
      },
      effects: [
        gmRulingEffect({
          ids: {
            effect: classRowId(W, 20, 5),
            range: classRowId(W, 21, 5),
            path: classRowId(W, 0x74, 1),
            result: classRowId(W, 0x75, 1),
            outcome: classRowId(W, 0x76, 1)
          },
          label: 'Hurl Through Hell',
          instructions:
            'The GM removes the target you just hit from play until the end of your next turn, when it returns to its space or the nearest unoccupied space. If it is not a fiend, the GM deals 10d10 psychic damage to it.',
          reasonCode: MANUAL_ADJUDICATION_REASON.GM_CHOICE,
          resourceUse: { chargeId: classRowId(W, 22, 2), cost: 1 }
        })
      ]
    }
  ]
}
