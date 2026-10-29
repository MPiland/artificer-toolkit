import {
  ACTIVATION_CODE,
  AUTHORING_MODE_KIND,
  AUTHORING_SELECTION_DUPLICATE_POLICY,
  AUTHORING_SELECTION_KIND,
  CLASS_CATEGORY,
  CLOSED_RULE_KIND,
  GRANT_KIND,
  MANUAL_ADJUDICATION_REASON,
  MEASUREMENT_UNIT_CODE,
  PROFICIENCY_KIND,
  RANGE_KIND,
  SCALING,
  SCALING_AMOUNT_KIND,
  SPELL_GRANT_ATTRIBUTE,
  TARGET_SELECTION_KIND,
  TRIGGER,
  type ClassAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SUBCLASS_IDS } from '../ids.js'
import { SRD_SKILLS, SRD_SYSTEM_ID, SRD_USER_ID } from '../vocabulary.js'
import { srdSpells } from '../spells/index.js'
import { closedRuleEffect, gmRulingEffect } from './mechanics.js'

function classRowId(classIndex: number, group: number, entry: number): string {
  const xx = classIndex.toString(16).padStart(2, '0')
  const gg = group.toString(16).padStart(2, '0')
  const nn = entry.toString(16).padStart(2, '0')
  return `00000000-0000-0000-c0${xx}-${gg}${nn}00000000`
}

const BD = 2

function skillId(code: string): string {
  const entry = SRD_SKILLS.find((skill) => skill.code === code)
  if (!entry) throw new Error(`SRD skill vocabulary entry for ${code} required.`)
  return entry.id
}

export const collegeOfLore: ClassAuthored = {
  id: SUBCLASS_IDS.LORE,
  label: 'College of Lore',
  category: CLASS_CATEGORY.SUBCLASS,
  parentClassId: CLASS_IDS.BARD,
  description:
    "Bards of the College of Lore know something about most things, collecting bits of knowledge from sources as diverse as scholarly tomes and peasant tales. Whether singing folk ballads in taverns or elaborate compositions in royal courts, these bards use their gifts to hold audiences spellbound. When the applause dies down, the audience members might find themselves questioning everything they held to be true, from their faith in the priesthood of the local temple to their loyalty to the king. The loyalty of these bards lies in the pursuit of beauty and truth, not in fealty to a monarch or following the tenets of a deity. A noble who keeps such a bard as a herald or advisor knows that the bard would rather be honest than politic. The college's members gather in libraries and sometimes in actual colleges, complete with classrooms and dormitories, to share their lore with one another. They also meet at festivals or affairs of state, where they can expose corruption, unravel lies, and poke fun at self-important figures of authority.",
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  features: [
    {
      id: classRowId(BD, 11, 1),
      label: 'Bonus Proficiencies',
      description:
        'When you join the College of Lore at 3rd level, you gain proficiency with three skills of your choice.',
      availableAtLevel: 3,
      order: 0,
      grants: {
        proficiencies: [
          {
            id: classRowId(BD, 11, 10),
            grantKind: GRANT_KIND.PROFICIENCY_GRANT,
            proficiencyKind: PROFICIENCY_KIND.SKILL,
            level: SCALING_AMOUNT_KIND.FULL,
            selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
            count: 3,
            selectionDuplicatePolicy: AUTHORING_SELECTION_DUPLICATE_POLICY.UNIQUE,
            scalingKind: SCALING.NONE,
            authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
            skillIds: [
              skillId('ACROBATICS'),
              skillId('ANIMAL_HANDLING'),
              skillId('ARCANA'),
              skillId('ATHLETICS'),
              skillId('DECEPTION'),
              skillId('HISTORY'),
              skillId('INSIGHT'),
              skillId('INTIMIDATION'),
              skillId('INVESTIGATION'),
              skillId('MEDICINE'),
              skillId('NATURE'),
              skillId('PERCEPTION'),
              skillId('PERFORMANCE'),
              skillId('PERSUASION'),
              skillId('RELIGION'),
              skillId('SLEIGHT_OF_HAND'),
              skillId('STEALTH'),
              skillId('SURVIVAL')
            ],
            order: 0
          }
        ]
      }
    },
    {
      id: classRowId(BD, 11, 2),
      label: 'Cutting Words',
      description:
        "Also at 3rd level, you learn how to use your wit to distract, confuse, and otherwise sap the confidence and competence of others. When a creature that you can see within 60 feet of you makes an attack roll, an ability check, or a damage roll, you can use your reaction to expend one of your uses of Bardic Inspiration, rolling a Bardic Inspiration die and subtracting the number rolled from the creature's roll. You can choose to use this feature after the creature makes its roll, but before the GM determines whether the attack roll or ability check succeeds or fails, or before the creature deals its damage. The creature is immune if it can't hear you or if it's immune to being charmed.",
      availableAtLevel: 3,
      order: 1,
      effects: [
        closedRuleEffect({
          id: classRowId(BD, 20, 1),
          invocation: {
            kind: 'ACTION',
            triggerCode: TRIGGER.ACTIVATED,
            activation: { code: ACTIVATION_CODE.REACTION, amount: 1 },
            range: {
              id: classRowId(BD, 21, 1),
              rangeKind: RANGE_KIND.DISTANCE,
              amount: 60,
              unit: MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: 'ANY'
            }
          },
          ruleKind: CLOSED_RULE_KIND.CLASS_COLLEGE_OF_LORE_CUTTING_WORDS
        })
      ]
    },
    {
      id: classRowId(BD, 11, 3),
      label: 'Additional Magical Secrets',
      description:
        "At 6th level, you learn two spells of your choice from any class. A spell you choose must be of a level you can cast, as shown on the Bard table, or a cantrip. The chosen spells count as bard spells for you but don't count against the number of bard spells you know.",
      availableAtLevel: 6,
      order: 2,
      grants: {
        spells: [
          {
            id: classRowId(BD, 11, 11),
            grantKind: GRANT_KIND.SPELL_GRANT,
            selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
            count: 2,
            selectionDuplicatePolicy: AUTHORING_SELECTION_DUPLICATE_POLICY.UNIQUE,
            scalingKind: SCALING.NONE,
            authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
            spellIds: srdSpells.filter((spell) => spell.level <= 3).map((spell) => spell.id),
            attributes: [SPELL_GRANT_ATTRIBUTE.KNOWN],
            order: 0
          }
        ]
      }
    },
    {
      id: classRowId(BD, 11, 4),
      label: 'Peerless Skill',
      description:
        'Starting at 14th level, when you make an ability check, you can expend one use of Bardic Inspiration. Roll a Bardic Inspiration die and add the number rolled to your ability check. You can choose to do so after you roll the die for the ability check, but before the GM tells you whether you succeed or fail.',
      availableAtLevel: 14,
      order: 3,
      effects: [
        gmRulingEffect({
          ids: {
            effect: classRowId(BD, 20, 2),
            range: classRowId(BD, 21, 2),
            path: classRowId(BD, 23, 2),
            result: classRowId(BD, 24, 2),
            outcome: classRowId(BD, 25, 2)
          },
          label: 'Peerless Skill',
          instructions:
            'After you roll an ability check and before the GM says whether it succeeds, you can expend one use of Bardic Inspiration to roll a Bardic Inspiration die and add the number rolled to the check. The GM adds the die to the result and you mark the use spent.',
          reasonCode: MANUAL_ADJUDICATION_REASON.GM_CHOICE
        })
      ]
    }
  ]
}
