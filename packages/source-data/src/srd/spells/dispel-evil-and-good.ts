import {
  ACTIVATION_CODE,
  PATH_CODE,
  PATH_GROUP_TYPE,
  CASTING_TIME_UNIT_CODE,
  DURATION_KIND,
  EFFECT_KIND,
  RANGE_KIND,
  SPELL_ATTRIBUTE,
  SUBJECT,
  TARGET_SELECTION_KIND,
  TRIGGER,
  SPELL_COMPONENT,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'
import {
  againstCreatureTypes,
  attackDisadvantageAgainstHolder
} from './protection-from-evil-and-good.js'
export const dispelEvilAndGood: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.DISPEL_EVIL_AND_GOOD,
  label: 'Dispel Evil and Good',
  description:
    "<p>Shimmering energy surrounds and protects you from fey, undead, and creatures originating from beyond the Material Plane. For the duration, celestials, elementals, fey, fiends, and undead have disadvantage on attack rolls against you. You can end the spell early by using either of the following special functions. Break Enchantment. As your action, you touch a creature you can reach that is charmed, frightened, or possessed by a celestial, an elemental, a fey, a fiend, or an undead. The creature you touch is no longer charmed, frightened, or possessed by such creatures. Dismissal. As your action, make a melee spell attack against a celestial, an elemental, a fey, a fiend, or an undead you can reach. On a hit, you attempt to drive the creature back to its home plane. The creature must succeed on a Charisma saving throw or be sent back to its home plane (if it isn't there already). If they aren't on their home plane, undead are sent to the Shadowfell, and fey are sent to the Feywild.</p>",
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 5,
  classIds: [CLASS_IDS.CLERIC, CLASS_IDS.PALADIN],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC, SPELL_COMPONENT.MATERIAL],
  materialDescription: 'holy water or powdered silver and iron',
  magicSchoolId: schoolId('ABJURATION'),
  attributes: [SPELL_ATTRIBUTE.CONCENTRATION],
  effects: [
    {
      id: spellChildId(SPELL_IDS.DISPEL_EVIL_AND_GOOD, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.DISPEL_EVIL_AND_GOOD, 0x211, 1),
          rangeKind: RANGE_KIND.SELF
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SELF
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.DISPEL_EVIL_AND_GOOD, 0x212, 1),
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.DISPEL_EVIL_AND_GOOD, 0x212, 1) + '__result',
            resultKind: 'SINGLE' as const,
            duration: {
              id: spellChildId(SPELL_IDS.DISPEL_EVIL_AND_GOOD, 0x213, 1),
              durationKind: DURATION_KIND.MINUTE,
              amount: 1
            },
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.DISPEL_EVIL_AND_GOOD, 0x214, 1),
                effectKind: EFFECT_KIND.APPLY_GRANT,
                grants: {
                  modifiers: againstCreatureTypes(
                    (part, entry) =>
                      spellChildId(SPELL_IDS.DISPEL_EVIL_AND_GOOD, 0x200 + part, entry),
                    attackDisadvantageAgainstHolder,
                    ['CELESTIAL', 'ELEMENTAL', 'FEY', 'FIEND', 'UNDEAD']
                  )
                }
              }
            ]
          }
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
