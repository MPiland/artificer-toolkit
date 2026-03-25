import {
  ABILITY_CODE,
  ACTIVATION_CODE,
  AUTHORING_SELECTION_KIND,
  BRANCH,
  BRANCH_GROUP_TYPE,
  BRANCH_RESOLUTION_KIND,
  CASTING_TIME_UNIT_CODE,
  DURATION_KIND,
  EFFECT_KIND,
  GRANT_KIND,
  MODIFIER_KIND,
  MODIFIER_SCOPE_KIND,
  RANGE_KIND,
  SCALING,
  SPELL_ATTRIBUTE,
  SUBJECT,
  TARGET_DISPOSITION_KIND,
  TARGET_SELECTION_KIND,
  TRIGGER,
  VALUE_DOMAIN_CODE,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { conditionTypeId, schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'

export const heroism: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.HEROISM,
  label: 'Heroism',
  description:
    'A willing creature you touch is imbued with bravery. Until the spell ends, the creature is immune to being frightened and gains temporary hit points equal to your spellcasting ability modifier at the start of each of its turns.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 1,
  classIds: [CLASS_IDS.BARD, CLASS_IDS.PALADIN],
  magicSchoolId: schoolId('ENCHANTMENT'),
  attributes: [SPELL_ATTRIBUTE.CONCENTRATION],
  capabilities: [
    {
      id: spellChildId(SPELL_IDS.HEROISM, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.HEROISM, 0x211, 1),
          rangeKind: RANGE_KIND.TOUCH
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
          dispositionKind: TARGET_DISPOSITION_KIND.WILLING
        }
      },
      branches: [
        {
          id: spellChildId(SPELL_IDS.HEROISM, 0x212, 1),
          branch: BRANCH.ON_USE,
          groupType: BRANCH_GROUP_TYPE.SEQUENTIAL,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          duration: {
            id: spellChildId(SPELL_IDS.HEROISM, 0x213, 1),
            durationKind: DURATION_KIND.MINUTE,
            amount: 1
          },
          effectKind: EFFECT_KIND.APPLY_GRANT,
          grants: {
            modifiers: [
              {
                id: spellChildId(SPELL_IDS.HEROISM, 0x214, 1),
                grantKind: GRANT_KIND.MODIFIER_GRANT,
                valueDomainCode: VALUE_DOMAIN_CODE.CONDITION_IMMUNITY,
                domain: {},
                modifierKind: MODIFIER_KIND.ADD_OPTION,
                scope: MODIFIER_SCOPE_KIND.GLOBAL,
                selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                payload: {
                  conditionTypeId: conditionTypeId('FRIGHTENED')
                },
                order: 1
              }
            ]
          }
        },
        {
          id: spellChildId(SPELL_IDS.HEROISM, 0x215, 1),
          branch: BRANCH.ON_USE,
          groupType: BRANCH_GROUP_TYPE.SEQUENTIAL,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          duration: {
            id: spellChildId(SPELL_IDS.HEROISM, 0x216, 1),
            durationKind: DURATION_KIND.MINUTE,
            amount: 1
          },
          lifecycle: {
            recurringKind: 'START_OF_TURN'
          },
          effectKind: EFFECT_KIND.HEAL,
          temporary: true,
          valueKind: 'FIXED',
          scalingKind: SCALING.NONE,
          amount: 0,
          bonuses: [
            {
              id: spellChildId(SPELL_IDS.HEROISM, 0x217, 1),
              bonusKind: 'ABILITY_BONUS',
              ability: ABILITY_CODE.SPELLCASTING,
              order: 1
            }
          ]
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
