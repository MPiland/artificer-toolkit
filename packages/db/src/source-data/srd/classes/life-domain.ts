import {
  ACTIVATION_CODE,
  AUTHORING_MODE_KIND,
  AUTHORING_SELECTION_KIND,
  CLASS_CATEGORY,
  CLOSED_RULE_KIND,
  GRANT_KIND,
  MEASUREMENT_UNIT_CODE,
  PATH_CODE,
  PROFICIENCY_KIND,
  RANGE_KIND,
  SCALING,
  SCALING_AMOUNT_KIND,
  SCALING_SOURCE,
  SPELL_GRANT_ATTRIBUTE,
  TARGET_SELECTION_KIND,
  TRIGGER,
  type ClassAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS, SUBCLASS_IDS } from '../ids.js'
import { SRD_SYSTEM_ID, SRD_USER_ID } from '../vocabulary.js'
import { closedRuleEffect } from './mechanics.js'

function classRowId(classIndex: number, group: number, entry: number): string {
  const xx = classIndex.toString(16).padStart(2, '0')
  const gg = group.toString(16).padStart(2, '0')
  const nn = entry.toString(16).padStart(2, '0')
  return `00000000-0000-0000-c0${xx}-${gg}${nn}00000000`
}

const C = 3

const lifeDomainSpellLevels = [
  { level: 1, spellIds: [SPELL_IDS.BLESS, SPELL_IDS.CURE_WOUNDS] },
  { level: 3, spellIds: [SPELL_IDS.LESSER_RESTORATION, SPELL_IDS.SPIRITUAL_WEAPON] },
  { level: 5, spellIds: [SPELL_IDS.BEACON_OF_HOPE, SPELL_IDS.REVIVIFY] },
  { level: 7, spellIds: [SPELL_IDS.DEATH_WARD, SPELL_IDS.GUARDIAN_OF_FAITH] },
  { level: 9, spellIds: [SPELL_IDS.MASS_CURE_WOUNDS, SPELL_IDS.RAISE_DEAD] }
]

export const lifeDomainCleric: ClassAuthored = {
  id: SUBCLASS_IDS.LIFE,
  label: 'Life Domain',
  category: CLASS_CATEGORY.SUBCLASS,
  parentClassId: CLASS_IDS.CLERIC,
  description:
    'The Life domain focuses on the vibrant positive energy—one of the fundamental forces of the universe—that sustains all life. The gods of life promote vitality and health through healing the sick and wounded, caring for those in need, and driving away the forces of death and undeath. Almost any non-evil deity can claim influence over this domain, particularly agricultural deities (such as Chauntea, Arawai, and Demeter), sun gods (such as Lathander, Pelor, and Re-Horakhty), gods of healing or endurance (such as Ilmater, Mishakal, Apollo, and Diancecht), and gods of home and community (such as Hestia, Hathor, and Boldrei).',
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  features: [
    {
      id: classRowId(C, 11, 1),
      label: 'Domain Spells',
      description:
        "Each domain has a list of spells—its domain spells—that you gain at the cleric levels noted in the domain description. Once you gain a domain spell, you always have it prepared, and it doesn't count against the number of spells you can prepare each day. If you have a domain spell that doesn't appear on the cleric spell list, the spell is nonetheless a cleric spell for you.",
      availableAtLevel: 1,
      order: 0,
      grants: {
        spells: [
          {
            id: classRowId(C, 11, 10),
            grantKind: GRANT_KIND.SPELL_GRANT,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: SCALING.PER_LEVEL,
            progression: {
              scalingSource: SCALING_SOURCE.PARENT_CLASS_LEVEL,
              levels: lifeDomainSpellLevels.map((spellLevel, index) => ({
                id: classRowId(C, 16, index + 1),
                level: spellLevel.level,
                order: index + 1,
                authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                spellIds: spellLevel.spellIds
              }))
            },
            attributes: [SPELL_GRANT_ATTRIBUTE.PREPARED],
            order: 0
          }
        ]
      }
    },
    {
      id: classRowId(C, 11, 2),
      label: 'Bonus Proficiency',
      description:
        'When you choose this domain at 1st level, you gain proficiency with heavy armor.',
      availableAtLevel: 1,
      order: 1,
      grants: {
        proficiencies: [
          {
            id: classRowId(C, 11, 11),
            grantKind: GRANT_KIND.PROFICIENCY_GRANT,
            proficiencyKind: PROFICIENCY_KIND.EQUIPMENT_PROPERTY,
            level: SCALING_AMOUNT_KIND.FULL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: SCALING.NONE,
            authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
            properties: ['HEAVY'],
            category: 'ARMOR',
            order: 0
          }
        ]
      }
    },
    {
      id: classRowId(C, 11, 3),
      label: 'Disciple of Life',
      description:
        "Also starting at 1st level, your healing spells are more effective. Whenever you use a spell of 1st level or higher to restore hit points to a creature, the creature regains additional hit points equal to 2 + the spell's level.",
      availableAtLevel: 1,
      order: 2,
      effects: [
        closedRuleEffect({
          id: classRowId(C, 20, 1),
          invocation: {
            kind: 'PASSIVE',
            triggerCode: TRIGGER.ACTIVATED,
            range: { id: classRowId(C, 21, 1), rangeKind: RANGE_KIND.SPECIAL },
            targeting: {
              selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: 'ANY'
            }
          },
          ruleKind: CLOSED_RULE_KIND.CLASS_LIFE_DOMAIN_DISCIPLE_OF_LIFE
        })
      ]
    },
    {
      id: classRowId(C, 11, 4),
      label: 'Channel Divinity: Preserve Life',
      description:
        "Starting at 2nd level, you can use your Channel Divinity to heal the badly injured. As an action, you present your holy symbol and evoke healing energy that can restore a number of hit points equal to five times your cleric level. Choose any creatures within 30 feet of you, and divide those hit points among them. This feature can restore a creature to no more than half of its hit point maximum. You can't use this feature on an undead or a construct.",
      availableAtLevel: 2,
      order: 3,
      effects: [
        closedRuleEffect({
          id: classRowId(C, 20, 2),
          invocation: {
            kind: 'ACTION',
            triggerCode: TRIGGER.ACTIVATED,
            activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: classRowId(C, 21, 2),
              rangeKind: RANGE_KIND.DISTANCE,
              amount: 30,
              unit: MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: TARGET_SELECTION_KIND.CHOSEN_CREATURES,
              dispositionKind: 'ANY'
            }
          },
          ruleKind: CLOSED_RULE_KIND.CLASS_LIFE_DOMAIN_PRESERVE_LIFE
        })
      ]
    },
    {
      id: classRowId(C, 11, 5),
      label: 'Blessed Healer',
      description:
        "Beginning at 6th level, the healing spells you cast on others heal you as well. When you cast a spell of 1st level or higher that restores hit points to a creature other than you, you regain hit points equal to 2 + the spell's level.",
      availableAtLevel: 6,
      order: 4,
      effects: [
        closedRuleEffect({
          id: classRowId(C, 20, 3),
          invocation: {
            kind: 'PASSIVE',
            triggerCode: TRIGGER.ACTIVATED,
            range: { id: classRowId(C, 21, 3), rangeKind: RANGE_KIND.SELF },
            targeting: { selectionKind: TARGET_SELECTION_KIND.SELF }
          },
          ruleKind: CLOSED_RULE_KIND.CLASS_LIFE_DOMAIN_BLESSED_HEALER
        })
      ]
    },
    {
      id: classRowId(C, 11, 6),
      label: 'Divine Strike',
      description:
        'At 8th level, you gain the ability to infuse your weapon strikes with divine energy. Once on each of your turns when you hit a creature with a weapon attack, you can cause the attack to deal an extra 1d8 radiant damage to the target. When you reach 14th level, the extra damage increases to 2d8.',
      availableAtLevel: 8,
      order: 5,
      effects: [
        closedRuleEffect({
          id: classRowId(C, 20, 4),
          invocation: {
            kind: 'PASSIVE',
            triggerCode: TRIGGER.MELEE_WEAPON_ATTACK,
            range: { id: classRowId(C, 21, 4), rangeKind: RANGE_KIND.SPECIAL },
            targeting: {
              selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: 'ANY'
            }
          },
          pathCode: PATH_CODE.ON_HIT,
          ruleKind: CLOSED_RULE_KIND.CLASS_LIFE_DOMAIN_DIVINE_STRIKE
        }),
        closedRuleEffect({
          id: classRowId(C, 20, 6),
          invocation: {
            kind: 'PASSIVE',
            triggerCode: TRIGGER.RANGED_WEAPON_ATTACK,
            range: { id: classRowId(C, 21, 6), rangeKind: RANGE_KIND.SPECIAL },
            targeting: {
              selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: 'ANY'
            }
          },
          pathCode: PATH_CODE.ON_HIT,
          ruleKind: CLOSED_RULE_KIND.CLASS_LIFE_DOMAIN_DIVINE_STRIKE
        })
      ]
    },
    {
      id: classRowId(C, 11, 7),
      label: 'Supreme Healing',
      description:
        'Starting at 17th level, when you would normally roll one or more dice to restore hit points with a spell, you instead use the highest number possible for each die. For example, instead of restoring 2d6 hit points to a creature, you restore 12.',
      availableAtLevel: 17,
      order: 6,
      effects: [
        closedRuleEffect({
          id: classRowId(C, 20, 5),
          invocation: {
            kind: 'PASSIVE',
            triggerCode: TRIGGER.ACTIVATED,
            range: { id: classRowId(C, 21, 5), rangeKind: RANGE_KIND.SPECIAL },
            targeting: {
              selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: 'ANY'
            }
          },
          ruleKind: CLOSED_RULE_KIND.CLASS_LIFE_DOMAIN_SUPREME_HEALING
        })
      ]
    }
  ]
}
