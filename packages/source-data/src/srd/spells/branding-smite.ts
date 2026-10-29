import {
  ACTIVATION_CODE,
  ATTACK_DOMAIN_CODE,
  AUTHORING_SELECTION_KIND,
  CASTING_TIME_UNIT_CODE,
  DAMAGE_DIE_RECIPIENT,
  DURATION_KIND,
  EFFECT_KIND,
  GRANT_KIND,
  MODIFIER_KIND,
  MODIFIER_SCOPE_KIND,
  PATH_CODE,
  PATH_GROUP_TYPE,
  RANGE_KIND,
  ROLLED_DIE_SIGN,
  SPELL_ATTRIBUTE,
  SPELL_COMPONENT,
  SUBJECT,
  TARGET_SELECTION_KIND,
  TRIGGER,
  VALUE_DOMAIN_CODE,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { SRD_MAGIC_SCHOOLS, SRD_SYSTEM_ID, SRD_USER_ID } from '../vocabulary.js'
import { damageTypeId, spellChildId } from './shared.js'
function schoolId(code: string): string {
  const entry = SRD_MAGIC_SCHOOLS.find((s) => s.code === code)
  if (!entry)
    throw new Error(`SRD magic school vocabulary entry for ${code} required for spell source data.`)
  return entry.id
}
export const brandingSmite: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.BRANDING_SMITE,
  label: 'Branding Smite',
  description:
    "<p>The next time you hit a creature with a weapon attack before this spell ends, the weapon gleams with astral radiance as you strike. The attack deals an extra 2d6 radiant damage to the target, which becomes visible if it's invisible, and the target sheds dim light in a 5-foot radius and can't become invisible until the spell ends. At Higher Levels. When you cast this spell using a spell slot of 3rd level or higher, the extra damage increases by 1d6 for each slot level above 2nd.</p>",
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 2,
  classIds: [CLASS_IDS.PALADIN],
  components: [SPELL_COMPONENT.VERBAL],
  magicSchoolId: schoolId('EVOCATION'),
  attributes: [SPELL_ATTRIBUTE.CONCENTRATION],
  effects: [
    {
      id: spellChildId(SPELL_IDS.BRANDING_SMITE, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.BONUS_ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.BRANDING_SMITE, 0x211, 1),
          rangeKind: RANGE_KIND.SELF
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SELF
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.BRANDING_SMITE, 0x212, 1),
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.BRANDING_SMITE, 0x212, 1) + '__result',
            resultKind: 'SINGLE' as const,
            // The next weapon hit; the light and lost invisibility stay with the reader.
            duration: {
              id: spellChildId(SPELL_IDS.BRANDING_SMITE, 0x213, 1),
              durationKind: DURATION_KIND.MINUTE,
              amount: 1
            },
            lifecycle: {
              endTriggers: [
                { event: 'LIFECYCLE' as const, timing: 'CONSUME' as const, code: 'ON_HIT' }
              ]
            },
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.BRANDING_SMITE, 0x212, 1),
                effectKind: EFFECT_KIND.APPLY_GRANT,
                grants: {
                  modifiers: [ATTACK_DOMAIN_CODE.MELEE, ATTACK_DOMAIN_CODE.RANGED].map(
                    (attackDomain, index) => ({
                      id: spellChildId(SPELL_IDS.BRANDING_SMITE, 0x215, index + 1),
                      grantKind: GRANT_KIND.MODIFIER_GRANT,
                      valueDomainCode: VALUE_DOMAIN_CODE.DAMAGE,
                      domain: { attackDomain },
                      modifierKind: MODIFIER_KIND.ADD_BONUS_DIE,
                      scope: MODIFIER_SCOPE_KIND.GLOBAL,
                      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                      payload: {
                        count: 2,
                        faces: 6,
                        sign: ROLLED_DIE_SIGN.ADD,
                        recipient: DAMAGE_DIE_RECIPIENT.HOLDER_DEALS,
                        damageTypeId: damageTypeId('RADIANT'),
                        countPerCastLevelAbove: { level: 2, count: 1 }
                      },
                      order: index + 1
                    })
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
