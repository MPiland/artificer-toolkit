import { CLASS_CATEGORY, type ClassAuthored } from '@artificer-toolkit/shared'
import { CLASS_IDS, SUBCLASS_IDS } from '../ids.js'
import { SRD_SYSTEM_ID, SRD_USER_ID } from '../vocabulary.js'

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
  description: 'You hone your skills in the larcenous arts. Burglars, bandits, cutpurses, and other criminals typically follow this archetype.',
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  features: [
    { id: classRowId(R, 11, 1), label: 'Fast Hands', description: 'Starting at 3rd level, you can use the bonus action granted by your Cunning Action to make a Dexterity (Sleight of Hand) check, use your thieves\' tools to disarm a trap or open a lock, or take the Use an Object action.', availableAtLevel: 3, order: 0 },
    { id: classRowId(R, 11, 2), label: 'Second-Story Work', description: 'When you choose this archetype at 3rd level, you gain the ability to climb faster than normal; climbing no longer costs you extra movement. In addition, when you make a running jump, the distance you cover increases by a number of feet equal to your Dexterity modifier.', availableAtLevel: 3, order: 1 },
    { id: classRowId(R, 11, 3), label: 'Supreme Sneak', description: 'Starting at 9th level, you have advantage on a Dexterity (Stealth) check if you move no more than half your speed on the same turn.', availableAtLevel: 9, order: 2 },
    { id: classRowId(R, 11, 4), label: 'Use Magic Device', description: 'By 13th level, you have learned enough about the workings of magic that you can improvise the use of items even when they are not intended for you. You ignore all class, race, and level requirements on the use of magic items.', availableAtLevel: 13, order: 3 },
    { id: classRowId(R, 11, 5), label: 'Thief\'s Reflexes', description: 'When you reach 17th level, you have become adept at laying ambushes and quickly escaping danger. You can take two turns during the first round of any combat.', availableAtLevel: 17, order: 4 }
  ]
}
