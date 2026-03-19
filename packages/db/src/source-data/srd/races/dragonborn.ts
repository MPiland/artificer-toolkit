import {
  ACTIVATION_CODE,
  ABILITY_CODE,
  AUTHORING_SELECTION_KIND,
  BRANCH,
  BRANCH_GROUP_TYPE,
  BRANCH_RESOLUTION_KIND,
  EFFECT_KIND,
  GRANT_KIND,
  MEASUREMENT_UNIT_CODE,
  MODIFIER_KIND,
  MODIFIER_SCOPE_KIND,
  RANGE_KIND,
  RACE_CATEGORY_CODE,
  SCALING,
  SCALING_AMOUNT_KIND,
  SCALING_SOURCE,
  SHAPE_KIND,
  SIZE_CODE,
  TRIGGER,
  VALUE_DOMAIN_CODE,
  type FeatureAuthored,
  type RaceAncestryAuthored,
  type RaceAuthored
} from '@artificer-toolkit/shared'
import { RACE_IDS } from '../ids.js'
import { SRD_DAMAGE_TYPES, SRD_SPEEDS, SRD_SYSTEM_ID, SRD_USER_ID } from '../vocabulary.js'

function raceFeatureId(raceIndex: number, group: number, entry: number): string {
  const rHex = raceIndex.toString(16).padStart(4, '0')
  const gHex = group.toString(16).padStart(2, '0')
  const eHex = entry.toString(16).padStart(2, '0')
  return `00000000-0000-0000-a001-${rHex}${gHex}${eHex}0000`
}

// ancestry option ID helper
function ancestryOptionId(index: number): string {
  const hex = index.toString(16).padStart(2, '0')
  return `00000000-0000-0000-a001-0005aa${hex}0000`
}

function ancestryFeatureId(optionIndex: number, entry: number): string {
  return raceFeatureId(5, 0x10 + optionIndex, entry)
}

function damageTypeId(code: string): string {
  const entry = SRD_DAMAGE_TYPES.find((damageType) => damageType.code === code)
  if (!entry) throw new Error(`SRD damage type vocabulary entry for ${code} is required for dragonborn source data.`)
  return entry.id
}

type DragonbornAncestryConfig = {
  damageCode: string
  shapeKind: 'LINE' | 'CONE'
  saveAbility: 'DEXTERITY' | 'CONSTITUTION'
}

function dragonbornAncestryFeatures(optionIndex: number, config: DragonbornAncestryConfig): FeatureAuthored[] {
  const damageType = damageTypeId(config.damageCode)

  return [
    {
      id: ancestryFeatureId(optionIndex, 1),
      label: 'Breath Weapon',
      description: 'You can use your action to exhale destructive energy. The size, shape, saving throw, and damage type are determined by your draconic ancestry. The DC equals 8 + your Constitution modifier + your proficiency bonus. A creature takes damage on a failed save, or half as much damage on a successful one. After you use your breath weapon, you can\'t use it again until you complete a short or long rest.',
      attributes: ['LIMITED_USE'],
      charges: {
        id: ancestryFeatureId(optionIndex, 2),
        limitKind: 'FIXED_AMOUNT',
        scalingKind: SCALING.NONE,
        resetKind: 'SHORT_REST',
        amount: 1
      },
      capabilities: [
        {
          id: ancestryFeatureId(optionIndex, 3),
          order: 1,
          invocation: {
            triggerCode: TRIGGER.SAVING_THROW,
            savingThrow: {
              id: ancestryFeatureId(optionIndex, 4),
              savingThrowKind: 'SOURCE_SAVE_DC',
              ability: config.saveAbility,
              sourceAbility: ABILITY_CODE.CONSTITUTION
            },
            activation: {
              code: ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: ancestryFeatureId(optionIndex, 5),
              rangeKind: RANGE_KIND.SELF
            },
            targeting: {
              selectionKind: 'AREA_CONTENTS',
              detail: config.shapeKind === SHAPE_KIND.LINE
                ? 'Each creature in the 5-by-30-foot line.'
                : 'Each creature in the 15-foot cone.'
            },
            shape: config.shapeKind === SHAPE_KIND.LINE
              ? {
                  id: ancestryFeatureId(optionIndex, 6),
                  shapeKind: SHAPE_KIND.LINE,
                  length: {
                    amount: 30,
                    unit: MEASUREMENT_UNIT_CODE.FEET
                  }
                }
              : {
                  id: ancestryFeatureId(optionIndex, 6),
                  shapeKind: SHAPE_KIND.CONE,
                  length: {
                    amount: 15,
                    unit: MEASUREMENT_UNIT_CODE.FEET
                  }
                }
          },
          branches: [
            {
              id: ancestryFeatureId(optionIndex, 7),
              branch: BRANCH.ON_SAVE_FAIL,
              groupType: BRANCH_GROUP_TYPE.SINGLE,
              resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: EFFECT_KIND.DAMAGE,
              damageTypeId: damageType,
              valueKind: 'DICE',
              scalingKind: SCALING.PER_LEVEL,
              scalingSource: SCALING_SOURCE.CHARACTER_LEVEL,
              levels: [
                { id: ancestryFeatureId(optionIndex, 8), level: 1, order: 1, diceConfig: '2d6' },
                { id: ancestryFeatureId(optionIndex, 9), level: 6, order: 2, diceConfig: '3d6' },
                { id: ancestryFeatureId(optionIndex, 10), level: 11, order: 3, diceConfig: '4d6' },
                { id: ancestryFeatureId(optionIndex, 11), level: 16, order: 4, diceConfig: '5d6' }
              ]
            },
            {
              id: ancestryFeatureId(optionIndex, 12),
              branch: BRANCH.ON_SAVE_SUCCESS,
              groupType: BRANCH_GROUP_TYPE.SINGLE,
              resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: EFFECT_KIND.DAMAGE,
              damageTypeId: damageType,
              amountKind: SCALING_AMOUNT_KIND.HALF,
              valueKind: 'DICE',
              scalingKind: SCALING.PER_LEVEL,
              scalingSource: SCALING_SOURCE.CHARACTER_LEVEL,
              levels: [
                { id: ancestryFeatureId(optionIndex, 13), level: 1, order: 1, diceConfig: '2d6' },
                { id: ancestryFeatureId(optionIndex, 14), level: 6, order: 2, diceConfig: '3d6' },
                { id: ancestryFeatureId(optionIndex, 15), level: 11, order: 3, diceConfig: '4d6' },
                { id: ancestryFeatureId(optionIndex, 16), level: 16, order: 4, diceConfig: '5d6' }
              ]
            }
          ]
        }
      ],
      availableAtLevel: 1,
      order: 0
    },
    {
      id: ancestryFeatureId(optionIndex, 17),
      label: 'Damage Resistance',
      description: 'You have resistance to the damage type associated with your draconic ancestry.',
      grants: {
        modifiers: [
          {
            id: ancestryFeatureId(optionIndex, 18),
            grantKind: GRANT_KIND.MODIFIER_GRANT,
            valueDomainCode: VALUE_DOMAIN_CODE.DAMAGE_RESISTANCE,
            domain: {},
            modifierKind: MODIFIER_KIND.ADD_OPTION,
            scope: MODIFIER_SCOPE_KIND.GLOBAL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            payload: { damageTypeId: damageType },
            order: 0
          }
        ]
      },
      availableAtLevel: 1,
      order: 1
    }
  ]
}

const walkSpeedId = SRD_SPEEDS.find((speed) => speed.code === 'WALK')?.id
if (!walkSpeedId) throw new Error('SRD WALK speed vocabulary entry is required for race source data.')

const dragonbornWalk30 = [{ speedId: walkSpeedId, amount: 30, unit: MEASUREMENT_UNIT_CODE.FEET }]

const dragonbornAncestry: RaceAncestryAuthored = {
  id: raceFeatureId(5, 9, 1),
  label: 'Draconic Ancestry',
  description: 'You have draconic ancestry of a particular dragon type. Choose one type from the Draconic Ancestry table. Your breath weapon and damage resistance are determined by the dragon type.',
  options: [
    {
      id: ancestryOptionId(1),
      label: 'Black (Acid)',
      description: 'Your draconic ancestry is black dragon. Damage type: acid. Breath weapon: 5 by 30 ft. line (DEX save).',
      order: 0,
      features: dragonbornAncestryFeatures(1, { damageCode: 'ACID', shapeKind: 'LINE', saveAbility: 'DEXTERITY' })
    },
    {
      id: ancestryOptionId(2),
      label: 'Blue (Lightning)',
      description: 'Your draconic ancestry is blue dragon. Damage type: lightning. Breath weapon: 5 by 30 ft. line (DEX save).',
      order: 1,
      features: dragonbornAncestryFeatures(2, { damageCode: 'LIGHTNING', shapeKind: 'LINE', saveAbility: 'DEXTERITY' })
    },
    {
      id: ancestryOptionId(3),
      label: 'Brass (Fire)',
      description: 'Your draconic ancestry is brass dragon. Damage type: fire. Breath weapon: 5 by 30 ft. line (DEX save).',
      order: 2,
      features: dragonbornAncestryFeatures(3, { damageCode: 'FIRE', shapeKind: 'LINE', saveAbility: 'DEXTERITY' })
    },
    {
      id: ancestryOptionId(4),
      label: 'Bronze (Lightning)',
      description: 'Your draconic ancestry is bronze dragon. Damage type: lightning. Breath weapon: 5 by 30 ft. line (DEX save).',
      order: 3,
      features: dragonbornAncestryFeatures(4, { damageCode: 'LIGHTNING', shapeKind: 'LINE', saveAbility: 'DEXTERITY' })
    },
    {
      id: ancestryOptionId(5),
      label: 'Copper (Acid)',
      description: 'Your draconic ancestry is copper dragon. Damage type: acid. Breath weapon: 5 by 30 ft. line (DEX save).',
      order: 4,
      features: dragonbornAncestryFeatures(5, { damageCode: 'ACID', shapeKind: 'LINE', saveAbility: 'DEXTERITY' })
    },
    {
      id: ancestryOptionId(6),
      label: 'Gold (Fire)',
      description: 'Your draconic ancestry is gold dragon. Damage type: fire. Breath weapon: 15 ft. cone (DEX save).',
      order: 5,
      features: dragonbornAncestryFeatures(6, { damageCode: 'FIRE', shapeKind: 'CONE', saveAbility: 'DEXTERITY' })
    },
    {
      id: ancestryOptionId(7),
      label: 'Green (Poison)',
      description: 'Your draconic ancestry is green dragon. Damage type: poison. Breath weapon: 15 ft. cone (CON save).',
      order: 6,
      features: dragonbornAncestryFeatures(7, { damageCode: 'POISON', shapeKind: 'CONE', saveAbility: 'CONSTITUTION' })
    },
    {
      id: ancestryOptionId(8),
      label: 'Red (Fire)',
      description: 'Your draconic ancestry is red dragon. Damage type: fire. Breath weapon: 15 ft. cone (DEX save).',
      order: 7,
      features: dragonbornAncestryFeatures(8, { damageCode: 'FIRE', shapeKind: 'CONE', saveAbility: 'DEXTERITY' })
    },
    {
      id: ancestryOptionId(9),
      label: 'Silver (Cold)',
      description: 'Your draconic ancestry is silver dragon. Damage type: cold. Breath weapon: 15 ft. cone (CON save).',
      order: 8,
      features: dragonbornAncestryFeatures(9, { damageCode: 'COLD', shapeKind: 'CONE', saveAbility: 'CONSTITUTION' })
    },
    {
      id: ancestryOptionId(10),
      label: 'White (Cold)',
      description: 'Your draconic ancestry is white dragon. Damage type: cold. Breath weapon: 15 ft. cone (CON save).',
      order: 9,
      features: dragonbornAncestryFeatures(10, { damageCode: 'COLD', shapeKind: 'CONE', saveAbility: 'CONSTITUTION' })
    }
  ]
}

// ─── Dragonborn (raceIndex = 5) ───────────────────────────────────────────────

export const dragonborn: RaceAuthored = {
  id: RACE_IDS.DRAGONBORN,
  label: 'Dragonborn',
  category: RACE_CATEGORY_CODE.BASE,
  playable: true,
  size: SIZE_CODE.MEDIUM,
  speeds: dragonbornWalk30,
  ancestry: dragonbornAncestry,
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  features: [
    {
      id: raceFeatureId(5, 1, 1),
      label: 'Ability Score Increase',
      description: 'Your Strength score increases by 2, and your Charisma score increases by 1.',
      availableAtLevel: 1,
      order: 0,
      grants: {
        modifiers: [
          {
            id: raceFeatureId(5, 1, 2),
            grantKind: GRANT_KIND.MODIFIER_GRANT,
            valueDomainCode: VALUE_DOMAIN_CODE.ABILITY_SCORE,
            domain: { ability: ABILITY_CODE.STRENGTH },
            modifierKind: MODIFIER_KIND.BONUS,
            scope: MODIFIER_SCOPE_KIND.GLOBAL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            payload: { valueKind: 'FIXED' as const, amount: 2 },
            order: 0
          },
          {
            id: raceFeatureId(5, 1, 3),
            grantKind: GRANT_KIND.MODIFIER_GRANT,
            valueDomainCode: VALUE_DOMAIN_CODE.ABILITY_SCORE,
            domain: { ability: ABILITY_CODE.CHARISMA },
            modifierKind: MODIFIER_KIND.BONUS,
            scope: MODIFIER_SCOPE_KIND.GLOBAL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            payload: { valueKind: 'FIXED' as const, amount: 1 },
            order: 1
          }
        ]
      }
    },
    {
      id: raceFeatureId(5, 2, 1),
      label: 'Draconic Ancestry',
      description: 'You have draconic ancestry of a particular dragon type, which determines your breath weapon and damage resistance.',
      availableAtLevel: 1,
      order: 1
    },
    {
      id: raceFeatureId(5, 3, 1),
      label: 'Ancestry-Linked Features',
      description: 'Your selected draconic ancestry option grants the matching Breath Weapon and Damage Resistance features.',
      availableAtLevel: 1,
      order: 2
    }
  ]
}
