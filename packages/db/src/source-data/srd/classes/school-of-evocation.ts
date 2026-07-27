import { CLASS_CATEGORY, type ClassAuthored } from '@artificer-toolkit/shared'
import { CLASS_IDS, SUBCLASS_IDS } from '../ids.js'
import { SRD_SYSTEM_ID, SRD_USER_ID } from '../vocabulary.js'

function classRowId(classIndex: number, group: number, entry: number): string {
  const xx = classIndex.toString(16).padStart(2, '0')
  const gg = group.toString(16).padStart(2, '0')
  const nn = entry.toString(16).padStart(2, '0')
  return `00000000-0000-0000-c0${xx}-${gg}${nn}00000000`
}

const WZ = 12

export const schoolOfEvocation: ClassAuthored = {
  id: SUBCLASS_IDS.EVOCATION_SCHOOL,
  label: 'School of Evocation',
  category: CLASS_CATEGORY.SUBCLASS,
  parentClassId: CLASS_IDS.WIZARD,
  description:
    'You focus your study on magic that creates powerful elemental effects such as bitter cold, searing flame, rolling thunder, crackling lightning, and burning acid.',
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  features: [
    {
      id: classRowId(WZ, 11, 1),
      label: 'Evocation Savant',
      description:
        'Beginning when you select this school at 2nd level, the gold and time you must spend to copy an evocation spell into your spellbook is halved.',
      availableAtLevel: 2,
      order: 0
    },
    {
      id: classRowId(WZ, 11, 2),
      label: 'Sculpt Spells',
      description:
        "Beginning at 2nd level, you can create pockets of relative safety within the effects of your evocation spells. When you cast an evocation spell that affects other creatures that you can see, you can choose a number of them equal to 1 + the spell's level.",
      availableAtLevel: 2,
      order: 1
    },
    {
      id: classRowId(WZ, 11, 3),
      label: 'Potent Cantrip',
      description:
        "Starting at 6th level, your damaging cantrips affect even creatures that avoid the brunt of the effect. When a creature succeeds on a saving throw against your cantrip, the creature takes half the cantrip's damage (if any) but suffers no additional effect from the cantrip.",
      availableAtLevel: 6,
      order: 2
    },
    {
      id: classRowId(WZ, 11, 4),
      label: 'Empowered Evocation',
      description:
        'Beginning at 10th level, you can add your Intelligence modifier to one damage roll of any wizard evocation spell you cast.',
      availableAtLevel: 10,
      order: 3
    },
    {
      id: classRowId(WZ, 11, 5),
      label: 'Overchannel',
      description:
        'Starting at 14th level, you can increase the power of your simpler spells. When you cast a wizard spell of 1st through 5th level that deals damage, you can deal maximum damage with that spell.',
      availableAtLevel: 14,
      order: 4
    }
  ]
}
