import {
  ACTIVATION_CODE,
  AUTHORING_SELECTION_KIND,
  PATH_CODE,
  PATH_GROUP_TYPE,
  CASTING_TIME_UNIT_CODE,
  DURATION_KIND,
  EFFECT_KIND,
  GRANT_KIND,
  MODIFIER_KIND,
  MODIFIER_SCOPE_KIND,
  RANGE_KIND,
  SUBJECT,
  TARGET_SELECTION_KIND,
  TRIGGER,
  VALUE_DOMAIN_CODE,
  SPELL_COMPONENT,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { damageTypeId, schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'

const energyTypes = [
  { code: 'ACID', label: 'Acid' },
  { code: 'COLD', label: 'Cold' },
  { code: 'FIRE', label: 'Fire' },
  { code: 'LIGHTNING', label: 'Lightning' },
  { code: 'THUNDER', label: 'Thunder' }
] as const
export const protectionFromEnergy: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.PROTECTION_FROM_ENERGY,
  label: 'Protection from Energy',
  description:
    '<p>For the duration, the willing creature you touch has resistance to one damage type of your choice: acid, cold, fire, lightning, or thunder.</p>',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 3,
  classIds: [
    CLASS_IDS.CLERIC,
    CLASS_IDS.DRUID,
    CLASS_IDS.RANGER,
    CLASS_IDS.SORCERER,
    CLASS_IDS.WIZARD
  ],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC],
  magicSchoolId: schoolId('ABJURATION'),
  effects: [
    {
      id: spellChildId(SPELL_IDS.PROTECTION_FROM_ENERGY, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.PROTECTION_FROM_ENERGY, 0x211, 1),
          rangeKind: RANGE_KIND.TOUCH
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
          dispositionKind: 'WILLING'
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.PROTECTION_FROM_ENERGY, 0x212, 1),
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.CHOICE,
          originKind: 'SOURCE' as const,
          selectionKind: 'CHOICE' as const,
          options: energyTypes.map(({ code, label }, index) => ({
            id: spellChildId(SPELL_IDS.PROTECTION_FROM_ENERGY, 0x220, index + 1),
            order: index + 1,
            label,
            description:
              'For the duration, the willing creature you touch has resistance to one damage type of your choice: acid, cold, fire, lightning, or thunder.',
            resultBlock: {
              id: `${spellChildId(SPELL_IDS.PROTECTION_FROM_ENERGY, 0x221, index + 1)}__result`,
              resultKind: 'SINGLE' as const,
              duration: {
                id: spellChildId(SPELL_IDS.PROTECTION_FROM_ENERGY, 0x222, index + 1),
                durationKind: DURATION_KIND.HOUR,
                amount: 1
              },
              outcomes: [
                {
                  id: spellChildId(SPELL_IDS.PROTECTION_FROM_ENERGY, 0x223, index + 1),
                  effectKind: EFFECT_KIND.APPLY_GRANT,
                  grants: {
                    modifiers: [
                      {
                        id: spellChildId(SPELL_IDS.PROTECTION_FROM_ENERGY, 0x224, index + 1),
                        grantKind: GRANT_KIND.MODIFIER_GRANT,
                        valueDomainCode: VALUE_DOMAIN_CODE.DAMAGE_RESISTANCE,
                        domain: {},
                        modifierKind: MODIFIER_KIND.ADD_OPTION,
                        scope: MODIFIER_SCOPE_KIND.GLOBAL,
                        selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                        payload: { damageTypeId: damageTypeId(code) },
                        order: 1
                      }
                    ]
                  }
                }
              ]
            }
          }))
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
