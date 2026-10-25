import {
  ACTIVATION_CODE,
  AUTHORING_SELECTION_KIND,
  GRANT_KIND,
  MODIFIER_KIND,
  MODIFIER_SCOPE_KIND,
  PATH_CODE,
  PATH_GROUP_TYPE,
  CASTING_TIME_UNIT_CODE,
  DURATION_KIND,
  EFFECT_KIND,
  RANGE_KIND,
  SUBJECT,
  TARGET_DISPOSITION_KIND,
  TARGET_SELECTION_KIND,
  TRIGGER,
  SPELL_COMPONENT,
  VALUE_DOMAIN_CODE,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import {
  SRD_DAMAGE_TYPES,
  SRD_MAGIC_SCHOOLS,
  SRD_SPEEDS,
  SRD_SYSTEM_ID,
  SRD_USER_ID,
  ABILITY_CODE
} from '../vocabulary.js'
import { nonmagicalResistanceGrants, spellChildId } from './shared.js'
function schoolId(code: string): string {
  const entry = SRD_MAGIC_SCHOOLS.find((s) => s.code === code)
  if (!entry) {
    throw new Error(`SRD magic school vocabulary entry for ${code} required for spell source data.`)
  }
  return entry.id
}
export const gaseousForm: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.GASEOUS_FORM,
  label: 'Gaseous Form',
  description:
    "<p>You transform a willing creature you touch, along with everything it's wearing and carrying, into a misty cloud for the duration. The spell ends if the creature drops to 0 hit points. An incorporeal creature isn't affected. While in this form, the target's only method of movement is a flying speed of 10 feet. The target can enter and occupy the space of another creature. The target has resistance to nonmagical damage, and it has advantage on Strength, Dexterity, and Constitution saving throws. The target can pass through small holes, narrow openings, and even mere cracks, though it treats liquids as though they were solid surfaces. The target can't fall and remains hovering in the air even when stunned or otherwise incapacitated. While in the form of a misty cloud, the target can't talk or manipulate objects, and any objects it was carrying or holding can't be dropped, used, or otherwise interacted with. The target can't attack or cast spells.</p>",
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 3,
  classIds: [CLASS_IDS.SORCERER, CLASS_IDS.WARLOCK, CLASS_IDS.WIZARD],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC, SPELL_COMPONENT.MATERIAL],
  materialDescription: 'a bit of gauze and a wisp of smoke',
  magicSchoolId: schoolId('TRANSMUTATION'),
  effects: [
    {
      id: spellChildId(SPELL_IDS.GASEOUS_FORM, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.GASEOUS_FORM, 0x211, 1),
          rangeKind: RANGE_KIND.TOUCH
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
          dispositionKind: TARGET_DISPOSITION_KIND.WILLING
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.GASEOUS_FORM, 0x212, 1),
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.GASEOUS_FORM, 0x212, 1) + '__result',
            resultKind: 'SEQUENCE' as const,
            duration: {
              id: spellChildId(SPELL_IDS.GASEOUS_FORM, 0x213, 1),
              durationKind: DURATION_KIND.HOUR,
              amount: 1
            },
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.GASEOUS_FORM, 0x212, 1),
                effectKind: EFFECT_KIND.APPLY_GRANT,
                grants: {
                  modifiers: [
                    // The only method of movement is a flying speed of 10 feet.
                    ...SRD_SPEEDS.map((speed, index) => ({
                      id: spellChildId(SPELL_IDS.GASEOUS_FORM, 0x214, index + 1),
                      order: index + 1,
                      grantKind: GRANT_KIND.MODIFIER_GRANT,
                      valueDomainCode: VALUE_DOMAIN_CODE.SPEED,
                      domain: { speedId: speed.id },
                      modifierKind: MODIFIER_KIND.SET_VALUE,
                      scope: MODIFIER_SCOPE_KIND.GLOBAL,
                      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                      payload: { amount: speed.code === 'FLY' ? 10 : 0, unit: 'FEET' as const }
                    })),
                    ...[
                      ABILITY_CODE.STRENGTH,
                      ABILITY_CODE.DEXTERITY,
                      ABILITY_CODE.CONSTITUTION
                    ].map((ability, index) => ({
                      id: spellChildId(SPELL_IDS.GASEOUS_FORM, 0x215, index + 1),
                      order: SRD_SPEEDS.length + index + 1,
                      grantKind: GRANT_KIND.MODIFIER_GRANT,
                      valueDomainCode: VALUE_DOMAIN_CODE.SAVING_THROW_MODIFIER,
                      domain: { ability },
                      modifierKind: MODIFIER_KIND.ROLL_INFLUENCE,
                      scope: MODIFIER_SCOPE_KIND.GLOBAL,
                      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                      payload: { influence: 'ADVANTAGE' as const }
                    })),
                    ...nonmagicalResistanceGrants(
                      SRD_DAMAGE_TYPES.map((damageType) => damageType.code),
                      (entry) => spellChildId(SPELL_IDS.GASEOUS_FORM, 0x216, entry)
                    ).map((resistance) => ({
                      ...resistance,
                      order: SRD_SPEEDS.length + 3 + resistance.order
                    }))
                  ]
                }
              },
              {
                id: spellChildId(SPELL_IDS.GASEOUS_FORM, 0x217, 1),
                effectKind: EFFECT_KIND.MANUAL_ADJUDICATION,
                label: 'Resolve the Misty Form',
                reasonCode: 'NARRATIVE_JUDGMENT' as const,
                instructions:
                  "The spell ends if the target drops to 0 hit points. The target can enter and occupy another creature's space, pass through small holes, narrow openings and cracks, and treats liquids as solid surfaces. It can't fall and hovers even when stunned or incapacitated. It can't talk, manipulate objects, attack or cast spells, and its carried objects can't be dropped or used. Its resistance covers damage from nonmagical attacks only: apply it yourself to other nonmagical damage, such as a fall or a trap."
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
