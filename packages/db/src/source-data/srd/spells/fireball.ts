import {
  ABILITY_CODE,
  ACTIVATION_CODE,
  BRANCH,
  BRANCH_GROUP_TYPE,
  BRANCH_RESOLUTION_KIND,
  CASTING_TIME_UNIT_CODE,
  EFFECT_KIND,
  MEASUREMENT_UNIT_CODE,
  RANGE_KIND,
  SCALING,
  SCALING_AMOUNT_KIND,
  SCALING_SOURCE,
  SHAPE_KIND,
  SUBJECT,
  TARGET_SELECTION_KIND,
  TRIGGER,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { damageTypeId, schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'

export const fireball: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.FIREBALL,
  label: 'Fireball',
  description:
    'A bright streak flashes from your pointing finger to a point you choose within range and then blossoms with a low roar into an explosion of flame. Each creature in a 20-foot-radius sphere must make a Dexterity saving throw, taking 8d6 fire damage on a failed save, or half as much damage on a successful one.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 3,
  classIds: [CLASS_IDS.WARLOCK],
  magicSchoolId: schoolId('EVOCATION'),
  capabilities: [
    {
      id: spellChildId(SPELL_IDS.FIREBALL, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.SAVING_THROW,
        savingThrow: {
          id: spellChildId(SPELL_IDS.FIREBALL, 0x214, 1),
          savingThrowKind: 'SOURCE_SAVE_DC',
          ability: ABILITY_CODE.DEXTERITY
        },
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.FIREBALL, 0x211, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 150,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS,
          detail: 'Each creature in the sphere.'
        },
        shape: {
          id: spellChildId(SPELL_IDS.FIREBALL, 0x212, 1),
          shapeKind: SHAPE_KIND.SPHERE,
          radius: {
            amount: 20,
            unit: MEASUREMENT_UNIT_CODE.FEET
          }
        }
      },
      branches: [
        {
          id: spellChildId(SPELL_IDS.FIREBALL, 0x213, 1),
          branch: BRANCH.ON_SAVE_FAIL,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          effectKind: EFFECT_KIND.DAMAGE,
          damageTypeId: damageTypeId('FIRE'),
          valueKind: 'DICE',
          scalingKind: SCALING.PER_LEVEL,
          scalingSource: SCALING_SOURCE.SPELL_CAST_LEVEL,
          levels: [
            { id: spellChildId(SPELL_IDS.FIREBALL, 0x213, 2), level: 3, order: 1, diceConfig: '8d6' },
            { id: spellChildId(SPELL_IDS.FIREBALL, 0x213, 3), level: 4, order: 2, diceConfig: '9d6' },
            { id: spellChildId(SPELL_IDS.FIREBALL, 0x213, 4), level: 5, order: 3, diceConfig: '10d6' },
            { id: spellChildId(SPELL_IDS.FIREBALL, 0x213, 5), level: 6, order: 4, diceConfig: '11d6' },
            { id: spellChildId(SPELL_IDS.FIREBALL, 0x213, 6), level: 7, order: 5, diceConfig: '12d6' },
            { id: spellChildId(SPELL_IDS.FIREBALL, 0x213, 7), level: 8, order: 6, diceConfig: '13d6' },
            { id: spellChildId(SPELL_IDS.FIREBALL, 0x213, 8), level: 9, order: 7, diceConfig: '14d6' }
          ]
        },
        {
          id: spellChildId(SPELL_IDS.FIREBALL, 0x216, 1),
          branch: BRANCH.ON_SAVE_SUCCESS,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          effectKind: EFFECT_KIND.DAMAGE,
          damageTypeId: damageTypeId('FIRE'),
          amountKind: SCALING_AMOUNT_KIND.HALF,
          valueKind: 'DICE',
          scalingKind: SCALING.PER_LEVEL,
          scalingSource: SCALING_SOURCE.SPELL_CAST_LEVEL,
          levels: [
            { id: spellChildId(SPELL_IDS.FIREBALL, 0x216, 2), level: 3, order: 1, diceConfig: '8d6' },
            { id: spellChildId(SPELL_IDS.FIREBALL, 0x216, 3), level: 4, order: 2, diceConfig: '9d6' },
            { id: spellChildId(SPELL_IDS.FIREBALL, 0x216, 4), level: 5, order: 3, diceConfig: '10d6' },
            { id: spellChildId(SPELL_IDS.FIREBALL, 0x216, 5), level: 6, order: 4, diceConfig: '11d6' },
            { id: spellChildId(SPELL_IDS.FIREBALL, 0x216, 6), level: 7, order: 5, diceConfig: '12d6' },
            { id: spellChildId(SPELL_IDS.FIREBALL, 0x216, 7), level: 8, order: 6, diceConfig: '13d6' },
            { id: spellChildId(SPELL_IDS.FIREBALL, 0x216, 8), level: 9, order: 7, diceConfig: '14d6' }
          ]
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
