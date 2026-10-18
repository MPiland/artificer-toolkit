import {
  ACTIVATION_CODE,
  AUTHORING_SELECTION_KIND,
  PATH_CODE,
  PATH_GROUP_TYPE,
  CASTING_TIME_UNIT_CODE,
  DAMAGE_VALUE_KIND,
  DURATION_KIND,
  EFFECT_KIND,
  GRANT_KIND,
  MANIFEST_KIND,
  MEASUREMENT_UNIT_CODE,
  MODIFIER_KIND,
  MODIFIER_SCOPE_KIND,
  RANGE_KIND,
  SCALING,
  SHAPE_KIND,
  SUBJECT,
  TARGET_DISPOSITION_KIND,
  TARGET_SELECTION_KIND,
  TRIGGER,
  VALUE_DOMAIN_CODE,
  SPELL_COMPONENT,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { damageTypeId, schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'

/** The flames reach a melee attacker within 5 feet of the caster. */
const flamesShape = (kind: number) => ({
  id: spellChildId(SPELL_IDS.FIRE_SHIELD, kind, 1),
  shapeKind: SHAPE_KIND.SPHERE,
  radius: { amount: 5, unit: MEASUREMENT_UNIT_CODE.FEET }
})

/**
 * One shield (D153): resistance to one damage type for the caster, and a zone around the caster
 * that deals 2d8 of the other to a creature in it that hits the caster with a melee attack. Each
 * option keeps its ids in its own bucket.
 */
const shieldResult = (resistance: 'COLD' | 'FIRE', eruption: 'FIRE' | 'COLD', bucket: number) => ({
  id: spellChildId(SPELL_IDS.FIRE_SHIELD, bucket + 0x13, 1) + '__result',
  resultKind: 'SINGLE' as const,
  duration: {
    id: spellChildId(SPELL_IDS.FIRE_SHIELD, bucket + 0x14, 1),
    durationKind: DURATION_KIND.MINUTE,
    amount: 10
  },
  outcomes: [
    {
      id: spellChildId(SPELL_IDS.FIRE_SHIELD, bucket + 0x13, 1),
      effectKind: EFFECT_KIND.MANIFEST,
      manifestKind: MANIFEST_KIND.ZONE,
      attachmentKind: 'SOURCE' as const,
      label: 'Fire Shield',
      shape: flamesShape(bucket + 0x20),
      components: [
        {
          id: spellChildId(SPELL_IDS.FIRE_SHIELD, bucket + 0x21, 1),
          order: 1,
          label: 'Shield erupts',
          interactionKinds: ['MELEE_HIT_ON_SOURCE' as const],
          behaviors: [
            {
              id: spellChildId(SPELL_IDS.FIRE_SHIELD, bucket + 0x22, 1),
              order: 1,
              invocation: {
                kind: 'PASSIVE' as const,
                triggerCode: TRIGGER.ACTIVATED,
                range: {
                  id: spellChildId(SPELL_IDS.FIRE_SHIELD, bucket + 0x24, 1),
                  rangeKind: RANGE_KIND.SELF
                }
              },
              paths: [
                {
                  id: spellChildId(SPELL_IDS.FIRE_SHIELD, bucket + 0x25, 1),
                  order: 1,
                  pathCode: PATH_CODE.ON_USE,
                  groupType: PATH_GROUP_TYPE.SINGLE,
                  originKind: 'SOURCE' as const,
                  selectionKind: 'FIXED' as const,
                  resultBlock: {
                    id: `${spellChildId(SPELL_IDS.FIRE_SHIELD, bucket + 0x25, 1)}__result`,
                    resultKind: 'SINGLE' as const,
                    outcomes: [
                      {
                        id: spellChildId(SPELL_IDS.FIRE_SHIELD, bucket + 0x26, 1),
                        effectKind: EFFECT_KIND.DAMAGE,
                        damageTypeId: damageTypeId(eruption),
                        valueKind: DAMAGE_VALUE_KIND.DICE,
                        diceConfig: '2d8',
                        scalingKind: SCALING.NONE
                      }
                    ]
                  }
                }
              ]
            }
          ]
        }
      ]
    },
    {
      id: spellChildId(SPELL_IDS.FIRE_SHIELD, bucket + 0x30, 1),
      effectKind: EFFECT_KIND.APPLY_GRANT,
      grants: {
        modifiers: [
          {
            id: spellChildId(SPELL_IDS.FIRE_SHIELD, bucket + 0x31, 1),
            grantKind: GRANT_KIND.MODIFIER_GRANT,
            valueDomainCode: VALUE_DOMAIN_CODE.DAMAGE_RESISTANCE,
            domain: {},
            modifierKind: MODIFIER_KIND.ADD_OPTION,
            scope: MODIFIER_SCOPE_KIND.GLOBAL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            payload: { damageTypeId: damageTypeId(resistance) },
            order: 1
          }
        ]
      }
    }
  ]
})

export const fireShield: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.FIRE_SHIELD,
  label: 'Fire Shield',
  description:
    '<p>Thin and wispy flames wreathe your body for the duration, shedding bright light in a 10-foot radius and dim light for an additional 10 feet. You can end the spell early by using an action to dismiss it. The flames provide you with a warm shield or a chill shield, as you choose. The warm shield grants you resistance to cold damage, and the chill shield grants you resistance to fire damage. In addition, whenever a creature within 5 feet of you hits you with a melee attack, the shield erupts with flame. The attacker takes 2d8 fire damage from a warm shield, or 2d8 cold damage from a cold shield.</p>',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 4,
  classIds: [CLASS_IDS.WIZARD],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC, SPELL_COMPONENT.MATERIAL],
  materialDescription: 'a bit of phosphorus or a firefly',
  magicSchoolId: schoolId('EVOCATION'),
  effects: [
    {
      id: spellChildId(SPELL_IDS.FIRE_SHIELD, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.FIRE_SHIELD, 0x211, 1),
          rangeKind: RANGE_KIND.SELF
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS,
          dispositionKind: TARGET_DISPOSITION_KIND.ANY
        },
        shape: flamesShape(0x214)
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.FIRE_SHIELD, 0x212, 1),
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.CHOICE,
          originKind: 'SOURCE' as const,
          selectionKind: 'CHOICE' as const,
          options: [
            {
              label: 'Warm shield',
              resistance: 'COLD' as const,
              eruption: 'FIRE' as const,
              bucket: 0x200
            },
            {
              label: 'Chill shield',
              resistance: 'FIRE' as const,
              eruption: 'COLD' as const,
              bucket: 0x300
            }
          ].map(({ label, resistance, eruption, bucket }, index) => ({
            id: spellChildId(SPELL_IDS.FIRE_SHIELD, 0x215, index + 1),
            order: index + 1,
            label,
            description:
              '<p>The warm shield grants resistance to cold damage and burns a melee attacker with fire; the chill shield grants resistance to fire damage and burns a melee attacker with cold.</p>',
            resultBlock: shieldResult(resistance, eruption, bucket)
          }))
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
