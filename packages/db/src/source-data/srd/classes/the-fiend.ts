import { CLASS_CATEGORY, type ClassAuthored } from '@artificer-toolkit/shared'
import { CLASS_IDS, SUBCLASS_IDS } from '../ids.js'
import { SRD_SYSTEM_ID, SRD_USER_ID } from '../vocabulary.js'

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
    'You have made a pact with a fiend from the lower planes of existence, a being whose aims are evil, even if you strive against those aims.',
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  features: [
    {
      id: classRowId(W, 11, 1),
      label: 'Expanded Spell List',
      description:
        'The Fiend lets you choose from an expanded list of spells when you learn a warlock spell. The following spells are added to the warlock spell list for you: Burning Hands, Command (L1), Blindness/Deafness, Scorching Ray (L2), Fireball, Stinking Cloud (L3), Fire Shield, Wall of Fire (L4), Flame Strike, Hallow (L5).',
      availableAtLevel: 1,
      order: 0
    },
    {
      id: classRowId(W, 11, 3),
      label: "Dark One's Blessing",
      description:
        'Starting at 1st level, when you reduce a hostile creature to 0 hit points, you gain temporary hit points equal to your Charisma modifier + your warlock level (minimum of 1).',
      availableAtLevel: 1,
      order: 1
    },
    {
      id: classRowId(W, 11, 4),
      label: "Dark One's Own Luck",
      description:
        'Starting at 6th level, you can call on your patron to alter fate in your favor. When you make an ability check or a saving throw, you can use this feature to add a d10 to your roll.',
      availableAtLevel: 6,
      order: 2
    },
    {
      id: classRowId(W, 11, 5),
      label: 'Fiendish Resilience',
      description:
        'Starting at 10th level, you can choose one damage type when you finish a short or long rest. You gain resistance to that damage type until you choose a different one with this feature.',
      availableAtLevel: 10,
      order: 3
    },
    {
      id: classRowId(W, 11, 6),
      label: 'Hurl Through Hell',
      description:
        'Starting at 14th level, when you hit a creature with an attack, you can use this feature to instantly transport the target through the lower planes.',
      availableAtLevel: 14,
      order: 4
    }
  ]
}
