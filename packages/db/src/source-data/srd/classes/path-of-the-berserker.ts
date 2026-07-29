import { CLASS_CATEGORY, type ClassAuthored } from '@artificer-toolkit/shared'
import { CLASS_IDS, SUBCLASS_IDS } from '../ids.js'
import { SRD_SYSTEM_ID, SRD_USER_ID } from '../vocabulary.js'

function classRowId(classIndex: number, group: number, entry: number): string {
  const xx = classIndex.toString(16).padStart(2, '0')
  const gg = group.toString(16).padStart(2, '0')
  const nn = entry.toString(16).padStart(2, '0')
  return `00000000-0000-0000-c0${xx}-${gg}${nn}00000000`
}

const B = 1

export const pathOfTheBerserker: ClassAuthored = {
  id: SUBCLASS_IDS.BERSERKER,
  label: 'Path of the Berserker',
  category: CLASS_CATEGORY.SUBCLASS,
  parentClassId: CLASS_IDS.BARBARIAN,
  description:
    'For some barbarians, rage is a means to an end - that end being violence. The Path of the Berserker is a path of untrammeled fury, slick with blood.',
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  features: [
    {
      id: classRowId(B, 11, 1),
      label: 'Frenzy',
      description:
        'Starting when you choose this path at 3rd level, you can go into a frenzy when you rage. If you do so, for the duration of your rage you can make a single melee weapon attack as a bonus action on each of your turns after this one.',
      availableAtLevel: 3,
      order: 0
    },
    {
      id: classRowId(B, 11, 2),
      label: 'Mindless Rage',
      description:
        "Beginning at 6th level, you can't be charmed or frightened while raging. If you are charmed or frightened when you enter your rage, the effect is suspended for the duration of the rage.",
      availableAtLevel: 6,
      order: 1
    },
    {
      id: classRowId(B, 11, 3),
      label: 'Intimidating Presence',
      description:
        'Beginning at 10th level, you can use your action to frighten someone with your menacing presence.',
      availableAtLevel: 10,
      order: 2
    },
    {
      id: classRowId(B, 11, 4),
      label: 'Retaliation',
      description:
        'Starting at 14th level, when you take damage from a creature that is within 5 feet of you, you can use your reaction to make a melee weapon attack against that creature.',
      availableAtLevel: 14,
      order: 3
    }
  ]
}
