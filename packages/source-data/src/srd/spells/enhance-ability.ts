import {
  ABILITY_CODE,
  ACTIVATION_CODE,
  AUTHORING_SELECTION_KIND,
  DURATION_KIND,
  GRANT_KIND,
  MODIFIER_KIND,
  MODIFIER_SCOPE_KIND,
  PATH_CODE,
  PATH_GROUP_TYPE,
  CASTING_TIME_UNIT_CODE,
  EFFECT_KIND,
  RANGE_KIND,
  SPELL_ATTRIBUTE,
  SUBJECT,
  TARGET_DISPOSITION_KIND,
  TARGET_SELECTION_KIND,
  TRIGGER,
  SCALING,
  VALUE_DOMAIN_CODE,
  SPELL_COMPONENT,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'

/** Each enhancement grants advantage on one ability's checks; Bear's Endurance adds temporary hit points. */
const enhancements = [
  { label: "Bear's Endurance", ability: ABILITY_CODE.CONSTITUTION, temporaryHitPointDice: '2d6' },
  { label: "Bull's Strength", ability: ABILITY_CODE.STRENGTH },
  { label: "Cat's Grace", ability: ABILITY_CODE.DEXTERITY },
  { label: "Eagle's Splendor", ability: ABILITY_CODE.CHARISMA },
  { label: "Fox's Cunning", ability: ABILITY_CODE.INTELLIGENCE },
  { label: "Owl's Wisdom", ability: ABILITY_CODE.WISDOM }
] as const
const ENHANCEMENT_DESCRIPTION =
  'Choose one of the following effects; the target gains that effect until the spell ends.'
export const enhanceAbility: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.ENHANCE_ABILITY,
  label: 'Enhance Ability',
  description:
    "<p>. You touch a creature and bestow upon it a magical enhancement. Choose one of the following effects; the target gains that effect until the spell ends. Bear's Endurance. The target has advantage on Constitution checks. It also gains 2d6 temporary hit points, which are lost when the spell ends. Bull's Strength. The target has advantage on Strength checks, and his or her carrying capacity doubles. Cat's Grace. The target has advantage on Dexterity checks. It also doesn't take damage from falling 20 feet or less if it isn't incapacitated. Eagle's Splendor. The target has advantage on Charisma checks. Fox's Cunning. The target has advantage on Intelligence checks. Owl's Wisdom. The target has advantage on Wisdom checks. At Higher Levels. When you cast this spell using a spell slot of 3rd level or higher, you can target one additional creature for each slot level above 2nd.</p>",
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 2,
  classIds: [CLASS_IDS.BARD, CLASS_IDS.CLERIC, CLASS_IDS.DRUID, CLASS_IDS.SORCERER],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC, SPELL_COMPONENT.MATERIAL],
  materialDescription: 'fur or a feather from a beast',
  magicSchoolId: schoolId('TRANSMUTATION'),
  attributes: [SPELL_ATTRIBUTE.CONCENTRATION],
  effects: [
    {
      id: spellChildId(SPELL_IDS.ENHANCE_ABILITY, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.ENHANCE_ABILITY, 0x211, 1),
          rangeKind: RANGE_KIND.TOUCH
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
          dispositionKind: TARGET_DISPOSITION_KIND.WILLING
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.ENHANCE_ABILITY, 0x212, 1),
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.CHOICE,
          originKind: 'SOURCE' as const,
          selectionKind: 'CHOICE' as const,
          options: enhancements.map((enhancement, index) => {
            const option = index + 1
            const duration = {
              id: spellChildId(SPELL_IDS.ENHANCE_ABILITY, 0x222, option),
              durationKind: DURATION_KIND.HOUR,
              amount: 1
            }
            const grant = {
              id: spellChildId(SPELL_IDS.ENHANCE_ABILITY, 0x223, option),
              effectKind: EFFECT_KIND.APPLY_GRANT,
              grants: {
                modifiers: [
                  {
                    id: spellChildId(SPELL_IDS.ENHANCE_ABILITY, 0x224, option),
                    grantKind: GRANT_KIND.MODIFIER_GRANT,
                    valueDomainCode: VALUE_DOMAIN_CODE.ABILITY_CHECK,
                    domain: { ability: enhancement.ability },
                    modifierKind: MODIFIER_KIND.ROLL_INFLUENCE,
                    payload: { influence: 'ADVANTAGE' },
                    scope: MODIFIER_SCOPE_KIND.GLOBAL,
                    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                    order: 1
                  }
                ]
              }
            }
            const resultBlockId = spellChildId(SPELL_IDS.ENHANCE_ABILITY, 0x221, option)
            return {
              id: spellChildId(SPELL_IDS.ENHANCE_ABILITY, 0x220, option),
              order: option,
              label: enhancement.label,
              description: ENHANCEMENT_DESCRIPTION,
              resultBlock:
                'temporaryHitPointDice' in enhancement
                  ? {
                      id: resultBlockId,
                      resultKind: 'SEQUENCE' as const,
                      duration,
                      outcomes: [
                        grant,
                        {
                          id: spellChildId(SPELL_IDS.ENHANCE_ABILITY, 0x225, option),
                          effectKind: EFFECT_KIND.HEAL,
                          temporary: true,
                          valueKind: 'DICE' as const,
                          scalingKind: SCALING.NONE,
                          diceConfig: enhancement.temporaryHitPointDice
                        }
                      ]
                    }
                  : {
                      id: resultBlockId,
                      resultKind: 'SINGLE' as const,
                      duration,
                      outcomes: [grant]
                    }
            }
          })
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
