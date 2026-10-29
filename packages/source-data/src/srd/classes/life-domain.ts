import {
  ACTIVATION_CODE,
  AUTHORING_MODE_KIND,
  AUTHORING_SELECTION_KIND,
  CLASS_CATEGORY,
  EFFECT_KIND,
  GRANT_KIND,
  MANUAL_ADJUDICATION_REASON,
  MODIFIER_KIND,
  MODIFIER_SCOPE_KIND,
  PATH_CODE,
  PATH_GROUP_TYPE,
  PATH_USAGE,
  PROFICIENCY_KIND,
  RANGE_KIND,
  SCALING,
  SCALING_AMOUNT_KIND,
  SCALING_SOURCE,
  SPELL_GRANT_ATTRIBUTE,
  TARGET_DISPOSITION_KIND,
  TARGET_SELECTION_KIND,
  TRIGGER,
  VALUE_DOMAIN_CODE,
  type ClassAuthored,
  type EffectAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS, SUBCLASS_IDS } from '../ids.js'
import { damageTypeId } from '../equipment/shared.js'
import { SRD_SYSTEM_ID, SRD_USER_ID } from '../vocabulary.js'
import { gmRulingEffect } from './mechanics.js'

function classRowId(classIndex: number, group: number, entry: number): string {
  const xx = classIndex.toString(16).padStart(2, '0')
  const gg = group.toString(16).padStart(2, '0')
  const nn = entry.toString(16).padStart(2, '0')
  return `00000000-0000-0000-c0${xx}-${gg}${nn}00000000`
}

const C = 3

/**
 * Divine Strike as authored data: an `ON_HIT` radiant rider whose dice grow with Cleric level (1d8
 * at 8th, 2d8 at 14th), once per turn. The melee and ranged triggers are two effects of the one
 * Feature, which share its single use each turn.
 */
function divineStrikeEffect(variant: 'MELEE' | 'RANGED'): EffectAuthored {
  const melee = variant === 'MELEE'
  const entry = melee ? 4 : 6
  const id = (part: number) => classRowId(C, 0x16, (melee ? 0 : 0x10) + part)
  return {
    id: classRowId(C, 20, entry),
    order: melee ? 0 : 1,
    invocation: {
      kind: 'PASSIVE',
      triggerCode: melee ? TRIGGER.MELEE_WEAPON_ATTACK : TRIGGER.RANGED_WEAPON_ATTACK,
      range: { id: classRowId(C, 21, entry), rangeKind: RANGE_KIND.SPECIAL },
      targeting: {
        selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
        dispositionKind: TARGET_DISPOSITION_KIND.ANY
      }
    },
    paths: [
      {
        id: id(0),
        order: 1,
        pathCode: PATH_CODE.ON_HIT,
        groupType: PATH_GROUP_TYPE.SINGLE,
        originKind: 'SOURCE',
        selectionKind: 'FIXED',
        usage: PATH_USAGE.ONCE_PER_TURN,
        resultBlock: {
          id: id(1),
          resultKind: 'SINGLE',
          outcomes: [
            {
              id: id(2),
              effectKind: EFFECT_KIND.DAMAGE,
              damageTypeId: damageTypeId('RADIANT'),
              valueKind: 'DICE',
              scalingKind: SCALING.PER_LEVEL,
              scalingSource: 'CLASS_LEVEL',
              classId: CLASS_IDS.CLERIC,
              levels: [
                { id: id(3), level: 8, order: 1, diceConfig: '1d8' },
                { id: id(4), level: 14, order: 2, diceConfig: '2d8' }
              ]
            }
          ]
        }
      }
    ]
  }
}

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
      grants: {
        modifiers: [
          {
            id: classRowId(C, 11, 12),
            grantKind: GRANT_KIND.MODIFIER_GRANT,
            valueDomainCode: VALUE_DOMAIN_CODE.HEALING_DEALT,
            domain: { addsSpellLevel: true },
            modifierKind: MODIFIER_KIND.BONUS,
            scope: MODIFIER_SCOPE_KIND.GLOBAL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            payload: { valueKind: 'FIXED', amount: 2 },
            order: 0
          }
        ]
      }
    },
    {
      id: classRowId(C, 11, 4),
      label: 'Channel Divinity: Preserve Life',
      description:
        "Starting at 2nd level, you can use your Channel Divinity to heal the badly injured. As an action, you present your holy symbol and evoke healing energy that can restore a number of hit points equal to five times your cleric level. Choose any creatures within 30 feet of you, and divide those hit points among them. This feature can restore a creature to no more than half of its hit point maximum. You can't use this feature on an undead or a construct.",
      availableAtLevel: 2,
      order: 3,
      effects: [
        gmRulingEffect({
          ids: {
            effect: classRowId(C, 20, 2),
            range: classRowId(C, 21, 2),
            path: classRowId(C, 0xd0, 2),
            result: classRowId(C, 0xd1, 2),
            outcome: classRowId(C, 0xd2, 2)
          },
          label: 'Preserve Life',
          instructions:
            'Restore up to five times your cleric level in hit points, divided as you choose among creatures within 30 feet of you, none above half its hit point maximum. This does not work on an undead or a construct. The GM applies the division and the cap.',
          reasonCode: MANUAL_ADJUDICATION_REASON.GM_CHOICE,
          activationCode: ACTIVATION_CODE.ACTION
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
        gmRulingEffect({
          ids: {
            effect: classRowId(C, 20, 3),
            range: classRowId(C, 21, 3),
            path: classRowId(C, 0xd0, 3),
            result: classRowId(C, 0xd1, 3),
            outcome: classRowId(C, 0xd2, 3)
          },
          label: 'Blessed Healer',
          instructions:
            "When you cast a spell of 1st level or higher that restores hit points to a creature other than you, you regain hit points equal to 2 + the spell's level. The GM applies the self-healing.",
          reasonCode: MANUAL_ADJUDICATION_REASON.GM_CHOICE
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
      effects: [divineStrikeEffect('MELEE'), divineStrikeEffect('RANGED')]
    },
    {
      id: classRowId(C, 11, 7),
      label: 'Supreme Healing',
      description:
        'Starting at 17th level, when you would normally roll one or more dice to restore hit points with a spell, you instead use the highest number possible for each die. For example, instead of restoring 2d6 hit points to a creature, you restore 12.',
      availableAtLevel: 17,
      order: 6,
      effects: [
        gmRulingEffect({
          ids: {
            effect: classRowId(C, 20, 5),
            range: classRowId(C, 21, 5),
            path: classRowId(C, 0xd0, 5),
            result: classRowId(C, 0xd1, 5),
            outcome: classRowId(C, 0xd2, 5)
          },
          label: 'Supreme Healing',
          instructions:
            'When you would roll dice to restore hit points with a spell, you instead use the highest number possible for each die. The GM applies the maximum.',
          reasonCode: MANUAL_ADJUDICATION_REASON.GM_CHOICE
        })
      ]
    }
  ]
}
