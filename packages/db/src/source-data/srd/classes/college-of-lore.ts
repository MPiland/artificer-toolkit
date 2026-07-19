import {
  AUTHORING_MODE_KIND,
  AUTHORING_SELECTION_DUPLICATE_POLICY,
  AUTHORING_SELECTION_KIND,
  CLASS_CATEGORY,
  GRANT_KIND,
  PROFICIENCY_KIND,
  SCALING,
  SCALING_AMOUNT_KIND,
  type ClassAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SUBCLASS_IDS } from '../ids.js'
import { SRD_SKILLS, SRD_SYSTEM_ID, SRD_USER_ID } from '../vocabulary.js'

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
  description: 'Bards of the College of Lore know something about most things, collecting bits of knowledge from sources as diverse as scholarly tomes and peasant tales.',
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  features: [
    {
      id: classRowId(BD, 11, 1),
      label: 'Bonus Proficiencies',
      description: 'When you join the College of Lore at 3rd level, you gain proficiency with three skills of your choice.',
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
      description: 'Also at 3rd level, you learn how to use your wit to distract, confuse, and otherwise sap the confidence and competence of others.',
      availableAtLevel: 3,
      order: 1
    },
    {
      id: classRowId(BD, 11, 3),
      label: 'Additional Magical Secrets',
      description: 'At 6th level, you learn two spells of your choice from any class. A spell you choose must be of a level you can cast, as shown on the Bard table, or a cantrip.',
      availableAtLevel: 6,
      order: 2
    },
    {
      id: classRowId(BD, 11, 4),
      label: 'Peerless Skill',
      description: 'Starting at 14th level, when you make an ability check, you can expend one use of Bardic Inspiration. Roll a Bardic Inspiration die and add the number rolled to your ability check.',
      availableAtLevel: 14,
      order: 3
    }
  ]
}
