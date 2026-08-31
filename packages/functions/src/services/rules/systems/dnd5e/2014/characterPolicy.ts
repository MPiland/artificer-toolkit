import type { RulePackDocumentDto } from '@artificer-toolkit/schema/api/rules'
import { CHARACTER_GRANT_FOLD_MODEL_KEY } from '@artificer-toolkit/schema/api/characterGrantFoldRules'
import { CHARACTER_ACTION_MODEL_KEY } from '@artificer-toolkit/schema/api/characterActionRules'

import {
  dnd5e2014CharacterDerivedPolicyExpressions,
  dnd5e2014CharacterDerivedPolicyOutputExpression
} from './characterDerivedPolicy.js'
import { dnd5e2014CharacterModifierPolicyExpressions } from './characterModifierPolicy.js'
import {
  dnd5e2014CharacterConditionImmunityPolicyOutputExpression,
  dnd5e2014CharacterDefensePolicyExpressions,
  dnd5e2014CharacterDefensePolicyOutputExpression
} from './characterDefensePolicy.js'
import {
  dnd5e2014CharacterMovementPolicyExpressions,
  dnd5e2014CharacterMovementPolicyOutputExpression
} from './characterMovementPolicy.js'
import {
  dnd5e2014CharacterSensePolicyExpressions,
  dnd5e2014CharacterSensePolicyOutputExpression
} from './characterSensePolicy.js'
import { dnd5e2014CharacterArmorClassPolicyExpressions } from './characterArmorClassPolicy.js'
import {
  dnd5e2014CharacterHitPointPolicyExpressions,
  dnd5e2014CharacterHitPointProgressionOutputExpression
} from './characterHitPointPolicy.js'
import { dnd5e2014CharacterRollModePolicyExpressions } from './characterRollModePolicy.js'
import {
  dnd5e2014CharacterProficiencyPolicyExpressions,
  dnd5e2014CharacterProficiencyPolicyOutputExpression
} from './characterProficiencyPolicy.js'
import {
  dnd5e2014CharacterSpellMechanicsPolicyExpressions,
  dnd5e2014CharacterSpellMechanicsPolicyOutputExpression
} from './characterSpellMechanicsPolicy.js'
import {
  dnd5e2014CharacterItemMechanicsPolicyExpressions,
  dnd5e2014CharacterItemMechanicsPolicyOutputExpression
} from './characterItemMechanicsPolicy.js'
import {
  dnd5e2014CharacterCompanionMechanicsPolicyExpressions,
  dnd5e2014CharacterCompanionMechanicsPolicyOutputExpression
} from './characterCompanionMechanicsPolicy.js'
import {
  dnd5e2014CharacterSpellPolicyNodes,
  dnd5e2014CharacterSpellPolicyOutputExpressions
} from './characterSpellPolicy.js'
import {
  dnd5e2014CharacterSpellPreparationPolicyNodes,
  dnd5e2014CharacterSpellPreparationPolicyOutputExpressions
} from './characterSpellPreparationPolicy.js'
import {
  dnd5e2014CharacterGrantFoldEmptyInput,
  dnd5e2014CharacterGrantFoldEmptyOutput,
  dnd5e2014CharacterGrantFoldModel
} from './characterGrantFoldSource.js'
import {
  dnd5e2014CharacterResourcePolicyExpressions,
  dnd5e2014CharacterResourcePolicyOutputExpression
} from './characterResourcePolicy.js'
import {
  dnd5e2014CharacterActionPolicyInputExpression,
  dnd5e2014CharacterActionPolicyOutputExpression,
  dnd5e2014CharacterSpellActionPolicyOutputExpression,
  dnd5e2014CharacterSpellCastDecisionPolicyOutputExpression,
  dnd5e2014CharacterSpellReferencePolicyOutputExpression
} from './characterActionPolicy.js'
import { dnd5e2014CharacterActionModel } from './characterActionSource.js'

const dnd5e2014EmptyRollContributorEvidence = {
  initiative: [],
  abilityChecks: {
    STRENGTH: [],
    DEXTERITY: [],
    CONSTITUTION: [],
    INTELLIGENCE: [],
    WISDOM: [],
    CHARISMA: []
  },
  savingThrows: {
    STRENGTH: [],
    DEXTERITY: [],
    CONSTITUTION: [],
    INTELLIGENCE: [],
    WISDOM: [],
    CHARISMA: []
  },
  skillChecks: {
    acrobatics: [],
    'animal-handling': [],
    arcana: [],
    athletics: [],
    deception: [],
    history: [],
    insight: [],
    intimidation: [],
    investigation: [],
    medicine: [],
    nature: [],
    perception: [],
    performance: [],
    persuasion: [],
    religion: [],
    'sleight-of-hand': [],
    stealth: [],
    survival: []
  },
  attacks: { MELEE: [], RANGED: [], SPELL: [], UNARMED: [] }
}

/** UUID identity from the D&D System vocabulary snapshot, never a display code. */

const multiclassSlotTable: Record<number, Array<{ spellLevel: number; slotCount: number }>> = {
  1: [{ spellLevel: 1, slotCount: 2 }],
  2: [{ spellLevel: 1, slotCount: 3 }],
  3: [
    { spellLevel: 1, slotCount: 4 },
    { spellLevel: 2, slotCount: 2 }
  ],
  4: [
    { spellLevel: 1, slotCount: 4 },
    { spellLevel: 2, slotCount: 3 }
  ],
  5: [
    { spellLevel: 1, slotCount: 4 },
    { spellLevel: 2, slotCount: 3 },
    { spellLevel: 3, slotCount: 2 }
  ],
  6: [
    { spellLevel: 1, slotCount: 4 },
    { spellLevel: 2, slotCount: 3 },
    { spellLevel: 3, slotCount: 3 }
  ],
  7: [
    { spellLevel: 1, slotCount: 4 },
    { spellLevel: 2, slotCount: 3 },
    { spellLevel: 3, slotCount: 3 },
    { spellLevel: 4, slotCount: 1 }
  ],
  8: [
    { spellLevel: 1, slotCount: 4 },
    { spellLevel: 2, slotCount: 3 },
    { spellLevel: 3, slotCount: 3 },
    { spellLevel: 4, slotCount: 2 }
  ],
  9: [
    { spellLevel: 1, slotCount: 4 },
    { spellLevel: 2, slotCount: 3 },
    { spellLevel: 3, slotCount: 3 },
    { spellLevel: 4, slotCount: 3 },
    { spellLevel: 5, slotCount: 1 }
  ],
  10: [
    { spellLevel: 1, slotCount: 4 },
    { spellLevel: 2, slotCount: 3 },
    { spellLevel: 3, slotCount: 3 },
    { spellLevel: 4, slotCount: 3 },
    { spellLevel: 5, slotCount: 2 }
  ],
  11: [
    { spellLevel: 1, slotCount: 4 },
    { spellLevel: 2, slotCount: 3 },
    { spellLevel: 3, slotCount: 3 },
    { spellLevel: 4, slotCount: 3 },
    { spellLevel: 5, slotCount: 2 },
    { spellLevel: 6, slotCount: 1 }
  ],
  12: [
    { spellLevel: 1, slotCount: 4 },
    { spellLevel: 2, slotCount: 3 },
    { spellLevel: 3, slotCount: 3 },
    { spellLevel: 4, slotCount: 3 },
    { spellLevel: 5, slotCount: 2 },
    { spellLevel: 6, slotCount: 1 }
  ],
  13: [
    { spellLevel: 1, slotCount: 4 },
    { spellLevel: 2, slotCount: 3 },
    { spellLevel: 3, slotCount: 3 },
    { spellLevel: 4, slotCount: 3 },
    { spellLevel: 5, slotCount: 2 },
    { spellLevel: 6, slotCount: 1 },
    { spellLevel: 7, slotCount: 1 }
  ],
  14: [
    { spellLevel: 1, slotCount: 4 },
    { spellLevel: 2, slotCount: 3 },
    { spellLevel: 3, slotCount: 3 },
    { spellLevel: 4, slotCount: 3 },
    { spellLevel: 5, slotCount: 2 },
    { spellLevel: 6, slotCount: 1 },
    { spellLevel: 7, slotCount: 1 }
  ],
  15: [
    { spellLevel: 1, slotCount: 4 },
    { spellLevel: 2, slotCount: 3 },
    { spellLevel: 3, slotCount: 3 },
    { spellLevel: 4, slotCount: 3 },
    { spellLevel: 5, slotCount: 2 },
    { spellLevel: 6, slotCount: 1 },
    { spellLevel: 7, slotCount: 1 },
    { spellLevel: 8, slotCount: 1 }
  ],
  16: [
    { spellLevel: 1, slotCount: 4 },
    { spellLevel: 2, slotCount: 3 },
    { spellLevel: 3, slotCount: 3 },
    { spellLevel: 4, slotCount: 3 },
    { spellLevel: 5, slotCount: 2 },
    { spellLevel: 6, slotCount: 1 },
    { spellLevel: 7, slotCount: 1 },
    { spellLevel: 8, slotCount: 1 }
  ],
  17: [
    { spellLevel: 1, slotCount: 4 },
    { spellLevel: 2, slotCount: 3 },
    { spellLevel: 3, slotCount: 3 },
    { spellLevel: 4, slotCount: 3 },
    { spellLevel: 5, slotCount: 2 },
    { spellLevel: 6, slotCount: 1 },
    { spellLevel: 7, slotCount: 1 },
    { spellLevel: 8, slotCount: 1 },
    { spellLevel: 9, slotCount: 1 }
  ],
  18: [
    { spellLevel: 1, slotCount: 4 },
    { spellLevel: 2, slotCount: 3 },
    { spellLevel: 3, slotCount: 3 },
    { spellLevel: 4, slotCount: 3 },
    { spellLevel: 5, slotCount: 3 },
    { spellLevel: 6, slotCount: 1 },
    { spellLevel: 7, slotCount: 1 },
    { spellLevel: 8, slotCount: 1 },
    { spellLevel: 9, slotCount: 1 }
  ],
  19: [
    { spellLevel: 1, slotCount: 4 },
    { spellLevel: 2, slotCount: 3 },
    { spellLevel: 3, slotCount: 3 },
    { spellLevel: 4, slotCount: 3 },
    { spellLevel: 5, slotCount: 3 },
    { spellLevel: 6, slotCount: 2 },
    { spellLevel: 7, slotCount: 1 },
    { spellLevel: 8, slotCount: 1 },
    { spellLevel: 9, slotCount: 1 }
  ],
  20: [
    { spellLevel: 1, slotCount: 4 },
    { spellLevel: 2, slotCount: 3 },
    { spellLevel: 3, slotCount: 3 },
    { spellLevel: 4, slotCount: 3 },
    { spellLevel: 5, slotCount: 3 },
    { spellLevel: 6, slotCount: 2 },
    { spellLevel: 7, slotCount: 2 },
    { spellLevel: 8, slotCount: 1 },
    { spellLevel: 9, slotCount: 1 }
  ]
}

const multiclassSlotsExpression = Object.entries(multiclassSlotTable)
  .map(([level, slots]) => `$.effectiveCasterLevel == ${level} ? ${JSON.stringify(slots)} :`)
  .join(' ')
  .concat(' []')

const standardSlotRawUsed = (level: string) =>
  `len(filter(spellSlotUsageFacts == null ? [] : spellSlotUsageFacts as usage, usage.kind == "STANDARD" and usage.spellLevel == ${level})) == 1 ? filter(spellSlotUsageFacts == null ? [] : spellSlotUsageFacts as usage, usage.kind == "STANDARD" and usage.spellLevel == ${level})[0].rawUsed : 0`

const resolvedStandardSlots = (slots: string, sourceIds: string) => {
  const rawUsed = standardSlotRawUsed('slot.spellLevel')
  const effectiveUsed = `min([${rawUsed}, slot.slotCount])`
  return `map(${slots} as slot, { spellLevel: slot.spellLevel, slotCount: slot.slotCount, sourceIds: ${sourceIds}, rawUsed: ${rawUsed}, effectiveUsed: ${effectiveUsed}, remaining: max([slot.slotCount - ${effectiveUsed}, 0]) })`
}

const pactSelectedSlots = '$.pactCasters[len($.pactCasters) - 1].selectedSlots'
const pactLevel = `max(map(${pactSelectedSlots}, #.spellLevel))`
const pactMaximum = `filter(${pactSelectedSlots} as slot, slot.spellLevel == ${pactLevel})[0].slotCount`
const pactRawUsed =
  'len(filter(spellSlotUsageFacts == null ? [] : spellSlotUsageFacts as usage, usage.kind == "PACT")) == 1 ? filter(spellSlotUsageFacts == null ? [] : spellSlotUsageFacts as usage, usage.kind == "PACT")[0].rawUsed : 0'
const pactEffectiveUsed = `min([${pactRawUsed}, ${pactMaximum}])`

const spellSlotResultExpression = `{ calculationId: "spell-slots", sourceClassIds: map(resolvedSpellcastingClasses, #.classId), maxByLevel: len($.standardCasters) == 0 ? [] : len($.standardCasters) == 1 ? ${resolvedStandardSlots('filter($.standardCasters[0].selectedSlots, #.slotCount > 0)', '[$.standardCasters[0].classId]')} : ${resolvedStandardSlots('$.multiclassSlots', 'map($.standardCasters as caster, caster.classId)')}, pactMagic: len($.pactCasters) == 0 ? null : { sourceClassId: $.pactCasters[len($.pactCasters) - 1].classId, slots: ${pactMaximum}, level: ${pactLevel}, rawUsed: ${pactRawUsed}, effectiveUsed: ${pactEffectiveUsed}, remaining: max([${pactMaximum} - ${pactEffectiveUsed}, 0]) }, fusionStrategy: len($.standardCasters) == 0 ? "NONE" : len($.standardCasters) == 1 ? "SINGLE_CLASS" : "MULTICLASS_FUSED" }`

function clampIntegerExpression(value: string, minimum: string, maximum: string): string {
  return `floor(${minimum} == null ? (${maximum} == null ? ${value} : min([${value}, ${maximum}])) : (${maximum} == null ? max([${value}, ${minimum}]) : min([max([${value}, ${minimum}]), ${maximum}])))`
}

function eligibilityConditionMatches(condition: string): string {
  const range = (value: string) =>
    `(${condition}.min == null or ${value} >= ${condition}.min) and (${condition}.max == null or ${value} <= ${condition}.max)`
  const abilityMatches = (value: string) =>
    `(${value} == ${condition}.abilityId or (${value} == "STR" and ${condition}.abilityId == "STRENGTH") or (${value} == "STRENGTH" and ${condition}.abilityId == "STR") or (${value} == "DEX" and ${condition}.abilityId == "DEXTERITY") or (${value} == "DEXTERITY" and ${condition}.abilityId == "DEX") or (${value} == "CON" and ${condition}.abilityId == "CONSTITUTION") or (${value} == "CONSTITUTION" and ${condition}.abilityId == "CON") or (${value} == "INT" and ${condition}.abilityId == "INTELLIGENCE") or (${value} == "INTELLIGENCE" and ${condition}.abilityId == "INT") or (${value} == "WIS" and ${condition}.abilityId == "WISDOM") or (${value} == "WISDOM" and ${condition}.abilityId == "WIS") or (${value} == "CHA" and ${condition}.abilityId == "CHARISMA") or (${value} == "CHARISMA" and ${condition}.abilityId == "CHA"))`
  const selected = (values: string, requiredIds = `${condition}.requiredIds`) =>
    `(${condition}.authoringMode == "ALL" ? len(${values}) > 0 : (len(${requiredIds}) == 0 or some(${requiredIds} as requiredId, some(${values}, # == requiredId))))`
  const proficiencies = (kind: string) =>
    `some(resolvedProficiencies as proficiency, proficiency.kind == "${kind}" and (${condition}.category == null or proficiency.category == ${condition}.category) and (${condition}.minimumRank == null or proficiency.scaling == "DOUBLE" or proficiency.scaling == ${condition}.minimumRank or (proficiency.scaling == "FULL" and ${condition}.minimumRank == "HALF")) and (${condition}.authoringMode == "ALL" or proficiency.matchId == "*" or some(${condition}.requiredIds, # == proficiency.matchId or # == proficiency.subjectId)))`
  return `${condition}.kind == "PREDICATE" ? (${condition}.predicateCode == "ABILITY_SCORE" ? some(resolvedDerivedAbilities as ability, ${abilityMatches('ability.abilityId')} and ${range('ability.score.effective')}) : ${condition}.predicateCode == "HERITAGE" ? (${condition}.authoringMode == "ALL" or ${selected('grantFoldFacts.base.heritageIds')}) : ${condition}.predicateCode == "CHARACTER_LEVEL" ? ${range('totalLevel')} : ${condition}.predicateCode == "CLASS_LEVEL" ? some(grantFoldFacts.base.classes as entry, some(${condition}.requiredIds, # == entry.classId) and ${range('entry.level')}) : ${condition}.predicateCode == "FEAT_OBTAINED" ? ${selected('flatten([grantFoldFacts.base.featIds, grantFold.unlockedFeatIds])')} : ${condition}.predicateCode == "FEATURE_OBTAINED" ? ${selected('grantFoldFacts.base.featureIds')} : ${condition}.predicateCode == "OPTION_OBTAINED" ? (${condition}.secondaryRequiredIds == null ? ${selected('grantFoldFacts.base.optionIds')} : (${selected('grantFoldFacts.base.featureIds')} and ${selected('grantFoldFacts.base.optionIds', `${condition}.secondaryRequiredIds`)})) : ${condition}.predicateCode == "SPELL_OBTAINED" ? ${selected('flatten([map(spellAccess, #.spellId), grantFold.unlockedSpellIds])')} : ${condition}.predicateCode == "CAN_CAST_SPELL" ? (len(spellAccess) > 0 or some(grantFoldFacts.base.classes, #.spellcasting)) : ${condition}.predicateCode == "EQUIPMENT_PROFICIENCY" ? ${proficiencies('EQUIPMENT')} : ${condition}.predicateCode == "EQUIPMENT_PROPERTY_PROFICIENCY" ? ${proficiencies('EQUIPMENT_PROPERTY')} : ${condition}.predicateCode == "SAVE_ABILITY_PROFICIENCY" ? ${proficiencies('SAVE_ABILITY')} : ${condition}.predicateCode == "LANGUAGE_PROFICIENCY" ? ${proficiencies('LANGUAGE')} : ${condition}.predicateCode == "SKILL_PROFICIENCY" ? ${proficiencies('SKILL')} : ${condition}.predicateCode == "EQUIPMENT_EQUIPPED" ? some(grantFoldFacts.base.equipment as equipment, equipment.equipped and (${condition}.category == null or equipment.category == ${condition}.category) and (${condition}.authoringMode == "ALL" or some(${condition}.requiredIds, # == equipment.equipmentId)) and all(${condition}.requiredProperties as property, some(equipment.properties, # == property))) : ${condition}.predicateCode == "SKILL_SCORE" ? ${selected('map(resolvedDerivedSkills, #.skillId)')} : ${condition}.predicateCode == "SAVING_THROW_ABILITY_BONUS" ? (${condition}.authoringMode == "ALL" ? len(resolvedDerivedSavingThrows) > 0 : some(resolvedDerivedSavingThrows as savingThrow, ${abilityMatches('savingThrow.abilityId')} and ${range('savingThrow.total.effective')})) : ${condition}.predicateCode == "WHILE_SOURCE_CARRIED" ? facet.sourceState.carried : ${condition}.predicateCode == "WHILE_SOURCE_EQUIPPED" ? facet.sourceState.equipped : ${condition}.predicateCode == "WHILE_SOURCE_ATTUNED" ? facet.sourceState.attuned : false) : false`
}

function eligibilityConditionPasses(condition: string): string {
  return `${condition}.kind == "UNSUPPORTED" ? ${condition}.constraint == "EXCLUDE" : ((${eligibilityConditionMatches(condition)}) ? ${condition}.constraint == "INCLUDE" : ${condition}.constraint == "EXCLUDE")`
}

function eligibilityFailureCount(group: string): string {
  return `len(filter(${group}.conditions as condition, !(${eligibilityConditionPasses('condition')})))`
}

const eligibilityFacetPasses = `len(facet.groups) == 0 or some(facet.groups as group, ${eligibilityFailureCount('group')} == 0)`
const eligibilityMinimumFailureCount = `min(map(facet.groups as candidateGroup, ${eligibilityFailureCount('candidateGroup')}))`
const eligibilityBestFailureGroup = `filter(facet.groups as candidateGroup, ${eligibilityFailureCount('candidateGroup')} == ${eligibilityMinimumFailureCount})[0]`
const eligibilityFailedConditions = `filter((${eligibilityBestFailureGroup}).conditions as condition, !(${eligibilityConditionPasses('condition')}))`

const model: RulePackDocumentDto['models'][string] = {
  contentType: 'application/vnd.gorules.decision',
  nodes: [
    {
      id: 'input',
      type: 'inputNode',
      name: 'Character facts',
      position: { x: 0, y: 0 },
      content: { schema: '' }
    },
    {
      id: 'resolved-grant-fold-facts',
      type: 'expressionNode',
      name: 'Resolved grant fold facts',
      position: { x: 540, y: -360 },
      content: {
        passThrough: true,
        inputField: null,
        outputPath: null,
        executionMode: 'single',
        expressions: [
          {
            id: 'grant-fold-facts',
            key: 'resolvedGrantFoldFacts',
            value:
              'merge([grantFoldFacts, { upstreamSpellIds: map(filter(spellAccess as access, !some(spellAccess as earlier, earlier.spellId == access.spellId and earlier.sequence < access.sequence)), #.spellId) }])'
          }
        ]
      }
    },
    {
      id: 'grant-fold',
      type: 'decisionNode',
      name: 'Character grant fold',
      position: { x: 180, y: -180 },
      content: {
        key: CHARACTER_GRANT_FOLD_MODEL_KEY,
        passThrough: true,
        inputField: 'resolvedGrantFoldFacts',
        outputPath: 'grantFold',
        executionMode: 'single'
      }
    },
    {
      id: 'character-calculations',
      type: 'expressionNode',
      name: 'Character calculations',
      position: { x: 540, y: -180 },
      content: {
        passThrough: true,
        inputField: null,
        outputPath: null,
        executionMode: 'single',
        expressions: [
          ...dnd5e2014CharacterModifierPolicyExpressions,
          ...dnd5e2014CharacterProficiencyPolicyExpressions,
          ...dnd5e2014CharacterDerivedPolicyExpressions,
          ...dnd5e2014CharacterRollModePolicyExpressions,
          ...dnd5e2014CharacterDefensePolicyExpressions,
          ...dnd5e2014CharacterMovementPolicyExpressions,
          ...dnd5e2014CharacterSensePolicyExpressions,
          ...dnd5e2014CharacterArmorClassPolicyExpressions,
          ...dnd5e2014CharacterHitPointPolicyExpressions,
          ...dnd5e2014CharacterItemMechanicsPolicyExpressions,
          ...dnd5e2014CharacterCompanionMechanicsPolicyExpressions
        ]
      }
    },
    {
      id: 'spell-mechanics',
      type: 'expressionNode',
      name: 'Spell mechanics',
      position: { x: 1980, y: 300 },
      content: {
        passThrough: true,
        inputField: null,
        outputPath: null,
        executionMode: 'single',
        expressions: dnd5e2014CharacterSpellMechanicsPolicyExpressions
      }
    },
    {
      id: 'spellcasting-classes',
      type: 'expressionNode',
      name: 'Spellcasting classes',
      position: { x: 720, y: 0 },
      content: {
        passThrough: true,
        inputField: 'spellcastingClasses',
        outputPath: 'resolvedSpellcastingClasses',
        executionMode: 'loop',
        expressions: [
          { id: 'class-id', key: 'classId', value: 'classId' },
          { id: 'class-level', key: 'classLevel', value: 'classLevel' },
          { id: 'reset-kind', key: 'resetKind', value: 'resetKind' },
          {
            id: 'selected-class-level',
            key: 'selectedClassLevel',
            value:
              'len(filter(spellLimits as limit, limit.classLevel <= classLevel)) == 0 ? null : max(map(filter(spellLimits as limit, limit.classLevel <= classLevel), #.classLevel))'
          },
          {
            id: 'selected-slots',
            key: 'selectedSlots',
            value:
              '$.selectedClassLevel == null ? [] : filter(spellLimits as limit, limit.classLevel == $.selectedClassLevel)[0].slots'
          },
          {
            id: 'max-spell-level',
            key: 'maxSpellLevel',
            value:
              'max(map(spellLimits as limit, len(limit.slots) == 0 ? 0 : max(map(limit.slots, #.spellLevel))))'
          }
        ]
      }
    },
    {
      id: 'spell-slots',
      type: 'expressionNode',
      name: 'Spell slots',
      position: { x: 900, y: 0 },
      content: {
        passThrough: true,
        inputField: null,
        outputPath: null,
        executionMode: 'single',
        expressions: [
          {
            id: 'standard-casters',
            key: 'standardCasters',
            value: 'filter(resolvedSpellcastingClasses as caster, caster.resetKind != "SHORT_REST")'
          },
          {
            id: 'pact-casters',
            key: 'pactCasters',
            value:
              'filter(resolvedSpellcastingClasses as caster, caster.resetKind == "SHORT_REST" and len(caster.selectedSlots) > 0)'
          },
          {
            id: 'effective-caster-level',
            key: 'effectiveCasterLevel',
            value:
              'min([20, sum(map($.standardCasters as caster, caster.maxSpellLevel >= 9 ? caster.classLevel : caster.maxSpellLevel >= 5 ? floor(caster.classLevel / 2) : floor(caster.classLevel / 3)))])'
          },
          {
            id: 'multiclass-slots',
            key: 'multiclassSlots',
            value: multiclassSlotsExpression
          },
          {
            id: 'spell-slot-result',
            key: 'spellSlots',
            value: spellSlotResultExpression
          }
        ]
      }
    },
    {
      id: 'resolved-charge-facts',
      type: 'expressionNode',
      name: 'Resolved charge facts',
      position: { x: 990, y: 0 },
      content: {
        passThrough: true,
        inputField: null,
        outputPath: null,
        executionMode: 'single',
        expressions: [
          {
            id: 'charge-ability-base-values',
            key: 'chargeAbilityBaseValues',
            value:
              'map(filter(chargeCalculations as charge, charge.base.kind == "ABILITY_MODIFIER") as charge, { calculationId: charge.calculationId, factValue: len(filter(resolvedDerivedAbilities as ability, ability.abilityId == charge.base.abilityId)) == 0 ? null : filter(resolvedDerivedAbilities as ability, ability.abilityId == charge.base.abilityId)[0].score.effective })'
          },
          {
            id: 'charge-class-base-values',
            key: 'chargeClassBaseValues',
            value:
              'map(filter(chargeCalculations as charge, charge.base.kind == "CLASS_LEVEL") as charge, { calculationId: charge.calculationId, factValue: len(filter(grantFoldFacts.base.classes as entry, entry.classId == charge.base.classId)) == 0 ? null : filter(grantFoldFacts.base.classes as entry, entry.classId == charge.base.classId)[0].level })'
          },
          {
            id: 'charge-source-class-base-values',
            key: 'chargeSourceClassBaseValues',
            value:
              'map(filter(chargeCalculations as charge, charge.base.kind == "PARENT_CLASS_LEVEL" or charge.base.kind == "PER_LEVEL") as charge, { calculationId: charge.calculationId, factValue: charge.base.sourceLevel.kind == "CHARACTER_LEVEL" ? totalLevel : len(filter(grantFoldFacts.base.classes as entry, entry.classId == charge.base.sourceLevel.classId)) == 0 ? null : filter(grantFoldFacts.base.classes as entry, entry.classId == charge.base.sourceLevel.classId)[0].level })'
          },
          {
            id: 'charge-spell-cast-base-values',
            key: 'chargeSpellCastBaseValues',
            value:
              'map(filter(chargeCalculations as charge, charge.base.kind == "SPELL_CAST_LEVEL") as charge, { calculationId: charge.calculationId, factValue: charge.base.spellCastLevel })'
          },
          {
            id: 'charge-direct-base-values',
            key: 'chargeDirectBaseValues',
            value:
              'map(filter(chargeCalculations as charge, charge.base.kind == "CHARACTER_LEVEL" or charge.base.kind == "FIXED_AMOUNT") as charge, { calculationId: charge.calculationId, factValue: charge.base.kind == "CHARACTER_LEVEL" ? totalLevel : charge.base.amount })'
          },
          {
            id: 'charge-base-values',
            key: 'chargeBaseValues',
            value:
              'flatten([$.chargeAbilityBaseValues, $.chargeClassBaseValues, $.chargeSourceClassBaseValues, $.chargeSpellCastBaseValues, $.chargeDirectBaseValues])'
          },
          {
            id: 'charge-ability-bonus-values',
            key: 'chargeAbilityBonusValues',
            value:
              'flatten(map(chargeCalculations as charge, map(filter(charge.bonuses as bonus, bonus.kind == "ABILITY_MODIFIER") as bonus, { calculationId: charge.calculationId, sourceId: bonus.sourceId, factValue: len(filter(resolvedDerivedAbilities as ability, ability.abilityId == bonus.abilityId)) == 0 ? null : filter(resolvedDerivedAbilities as ability, ability.abilityId == bonus.abilityId)[0].score.effective })))'
          },
          {
            id: 'charge-skill-bonus-values',
            key: 'chargeSkillBonusValues',
            value:
              'flatten(map(chargeCalculations as charge, map(filter(charge.bonuses as bonus, bonus.kind == "SKILL_BONUS") as bonus, { calculationId: charge.calculationId, sourceId: bonus.sourceId, factValue: len(filter(resolvedDerivedSkills as skill, skill.skillId == bonus.skillId)) == 0 ? null : filter(resolvedDerivedSkills as skill, skill.skillId == bonus.skillId)[0].total.effective })))'
          },
          {
            id: 'charge-proficiency-bonus-values',
            key: 'chargeProficiencyBonusValues',
            value:
              'flatten(map(chargeCalculations as charge, map(filter(charge.bonuses as bonus, bonus.kind == "PROFICIENCY_BONUS") as bonus, { calculationId: charge.calculationId, sourceId: bonus.sourceId, factValue: derivedProficiencyBonusCalculation.effective })))'
          },
          {
            id: 'charge-bonus-values',
            key: 'chargeBonusValues',
            value:
              'flatten([$.chargeAbilityBonusValues, $.chargeSkillBonusValues, $.chargeProficiencyBonusValues])'
          },
          {
            id: 'resolved-charge-calculation',
            key: 'resolvedChargeCalculations',
            value:
              'map(chargeCalculations as charge, merge([charge, { base: merge([charge.base, { factValue: len(filter($.chargeBaseValues as value, value.calculationId == charge.calculationId)) == 0 ? null : filter($.chargeBaseValues as value, value.calculationId == charge.calculationId)[0].factValue }]), bonuses: map(charge.bonuses as bonus, merge([bonus, { factValue: len(filter($.chargeBonusValues as value, value.calculationId == charge.calculationId and value.sourceId == bonus.sourceId)) == 0 ? null : filter($.chargeBonusValues as value, value.calculationId == charge.calculationId and value.sourceId == bonus.sourceId)[0].factValue }])) }]))'
          }
        ]
      }
    },
    {
      id: 'charge-maximums',
      type: 'expressionNode',
      name: 'Charge maximums',
      position: { x: 1080, y: 0 },
      content: {
        passThrough: true,
        inputField: 'resolvedChargeCalculations',
        outputPath: 'resolvedChargeMaximums',
        executionMode: 'loop',
        expressions: [
          {
            id: 'calculation-id',
            key: 'calculationId',
            value: 'calculationId'
          },
          { id: 'source-id', key: 'sourceId', value: 'sourceId' },
          {
            id: 'missing-fact',
            key: 'missingRequiredFact',
            value: 'base.factValue == null or some(bonuses, #.factValue == null)'
          },
          {
            id: 'selected-level',
            key: 'selectedLevel',
            value:
              'base.kind != "PER_LEVEL" or base.factValue == null or len(filter(base.levels as level, level.level <= base.factValue)) == 0 ? null : filter(base.levels as level, level.level == max(map(filter(base.levels as level, level.level <= base.factValue), #.level)))[0]'
          },
          {
            id: 'base-raw',
            key: 'baseRaw',
            value:
              '$.missingRequiredFact ? 0 : base.kind == "PER_LEVEL" ? ($.selectedLevel == null ? 0 : $.selectedLevel.amount) : base.kind == "ABILITY_MODIFIER" ? floor((base.factValue - 10) / 2) : base.factValue'
          },
          {
            id: 'base-value',
            key: 'baseValue',
            value: `$.missingRequiredFact ? 0 : ${clampIntegerExpression('$.baseRaw * (base.multiplier == null ? 1 : base.multiplier)', 'base.minimum', 'base.maximum')}`
          },
          {
            id: 'bonus-contributions',
            key: 'bonusContributions',
            value: `$.missingRequiredFact ? [] : map(bonuses as bonus, { sourceId: bonus.sourceId, value: ${clampIntegerExpression('(bonus.kind == "ABILITY_MODIFIER" ? floor((bonus.factValue - 10) / 2) : bonus.factValue) * (bonus.multiplier == null ? 1 : bonus.multiplier)', 'bonus.minimum', 'bonus.maximum')} })`
          },
          {
            id: 'state',
            key: 'state',
            value: '$.missingRequiredFact ? "UNRESOLVED" : "RESOLVED"'
          },
          {
            id: 'maximum',
            key: 'maximum',
            value:
              '$.missingRequiredFact ? null : max([0, floor($.baseValue + sum(map($.bonusContributions, #.value)))])'
          },
          {
            id: 'reason',
            key: 'reasonCode',
            value: '$.missingRequiredFact ? "MISSING_REQUIRED_FACT" : "CALCULATED"'
          },
          {
            id: 'base-contribution',
            key: 'baseContribution',
            value:
              '$.missingRequiredFact ? null : { sourceId: base.kind == "PER_LEVEL" and $.selectedLevel != null ? $.selectedLevel.sourceId : sourceId, value: $.baseValue }'
          }
        ]
      }
    },
    {
      id: 'resource-pools',
      type: 'expressionNode',
      name: 'Resource pools',
      position: { x: 1260, y: 0 },
      content: {
        passThrough: true,
        inputField: null,
        outputPath: null,
        executionMode: 'single',
        expressions: [...dnd5e2014CharacterResourcePolicyExpressions]
      }
    },
    {
      id: 'action-policy-input',
      type: 'expressionNode',
      name: 'Character action input',
      position: { x: 1350, y: -180 },
      content: {
        passThrough: true,
        inputField: null,
        outputPath: null,
        executionMode: 'single',
        expressions: [dnd5e2014CharacterActionPolicyInputExpression]
      }
    },
    {
      id: 'action-policy',
      type: 'decisionNode',
      name: 'Character actions',
      position: { x: 1440, y: -180 },
      content: {
        key: CHARACTER_ACTION_MODEL_KEY,
        passThrough: true,
        inputField: 'resolvedActionInput',
        outputPath: 'resolvedActionPolicy',
        executionMode: 'single'
      }
    },
    ...dnd5e2014CharacterSpellPolicyNodes,
    ...dnd5e2014CharacterSpellPreparationPolicyNodes,
    {
      id: 'policy',
      type: 'expressionNode',
      name: 'Character policy',
      position: { x: 2160, y: 0 },
      content: {
        passThrough: false,
        inputField: null,
        outputPath: null,
        executionMode: 'single',
        expressions: [
          {
            id: 'proficiency',
            key: 'proficiencyBonus',
            value: 'floor((max([totalLevel, 1]) - 1) / 4) + 2'
          },
          { id: 'grant-fold', key: 'grantFold', value: 'grantFold' },
          dnd5e2014CharacterProficiencyPolicyOutputExpression,
          {
            id: 'abilities',
            key: 'abilityModifiers',
            value:
              'map(resolvedDerivedAbilities as ability, { ability: ability.abilityId, value: ability.modifier.effective })'
          },
          {
            id: 'passives',
            key: 'passiveChecks',
            value:
              'map(resolvedDerivedSkills as skill, { checkId: skill.skillId, value: skill.passive.effective })'
          },
          {
            id: 'modifiers',
            key: 'modifierGroups',
            value:
              'map(resolvedModifierGroups as group, { domainKey: group.domainKey, effective: group.effective, contributions: group.contributions })'
          },
          { id: 'roll-modes', key: 'rollModes', value: 'rollModes' },
          {
            id: 'roll-contributor-evidence',
            key: 'rollContributorEvidence',
            value: 'rollContributorEvidence'
          },
          dnd5e2014CharacterDefensePolicyOutputExpression,
          dnd5e2014CharacterConditionImmunityPolicyOutputExpression,
          dnd5e2014CharacterMovementPolicyOutputExpression,
          dnd5e2014CharacterSensePolicyOutputExpression,
          dnd5e2014CharacterHitPointProgressionOutputExpression,
          dnd5e2014CharacterDerivedPolicyOutputExpression,
          ...dnd5e2014CharacterSpellPolicyOutputExpressions,
          dnd5e2014CharacterSpellMechanicsPolicyOutputExpression,
          dnd5e2014CharacterItemMechanicsPolicyOutputExpression,
          dnd5e2014CharacterCompanionMechanicsPolicyOutputExpression,
          ...dnd5e2014CharacterSpellPreparationPolicyOutputExpressions,
          dnd5e2014CharacterSpellCastDecisionPolicyOutputExpression,
          { id: 'spell-slots', key: 'spellSlots', value: 'spellSlots' },
          {
            id: 'charges',
            key: 'chargeMaximums',
            value:
              'map(resolvedChargeMaximums as charge, { calculationId: charge.calculationId, sourceId: charge.sourceId, state: charge.state, maximum: charge.maximum, reasonCode: charge.reasonCode, baseContribution: charge.baseContribution, bonusContributions: charge.bonusContributions })'
          },
          dnd5e2014CharacterResourcePolicyOutputExpression,
          dnd5e2014CharacterActionPolicyOutputExpression,
          dnd5e2014CharacterSpellActionPolicyOutputExpression,
          dnd5e2014CharacterSpellReferencePolicyOutputExpression,
          {
            id: 'eligibility',
            key: 'eligibilityFacets',
            value: `map(eligibilityFacets as facet, { evaluationId: facet.evaluationId, passed: ${eligibilityFacetPasses}, failures: ${eligibilityFacetPasses} ? [] : map(${eligibilityFailedConditions} as condition, { conditionId: condition.conditionId, reasonCode: condition.kind == "UNSUPPORTED" ? "UNSUPPORTED_CONDITION" : condition.constraint == "EXCLUDE" ? "EXCLUDED_CONDITION_MATCHED" : "REQUIRED_CONDITION_FAILED" }) })`
          },
          {
            id: 'rest',
            key: 'rest',
            value:
              '{ hitDieConstitutionModifier: len(filter(resolvedDerivedAbilities, #.abilityId == "CONSTITUTION" or #.abilityId == "CON")) == 0 ? 0 : filter(resolvedDerivedAbilities, #.abilityId == "CONSTITUTION" or #.abilityId == "CON")[0].modifier.effective, hitDiceRecoveredAfterLongRest: rest.totalHitDice == 0 ? 0 : max([1, floor(rest.totalHitDice / 2)]), currentExhaustion: rest.currentExhaustion, minimumExhaustion: 0, maximumExhaustion: 6, exhaustionAfterLongRest: max([0, rest.currentExhaustion - 1]), attunementSlotLimit: rest.attunementSlotOverride == null ? 3 : rest.attunementSlotOverride, companionHitDiceRecoveredAfterLongRest: map(rest.companions == null ? [] : rest.companions as companion, { companionInstanceId: companion.companionInstanceId, recovered: companion.totalHitDice == 0 ? 0 : max([1, floor(companion.totalHitDice / 2)]) }) }'
          }
        ]
      }
    },
    {
      id: 'output',
      type: 'outputNode',
      name: 'Policy result',
      position: { x: 2340, y: 0 },
      content: { schema: '' }
    }
  ],
  edges: [
    {
      id: 'input-spell-access-candidates',
      sourceId: 'input',
      targetId: 'spell-access-candidates'
    },
    {
      id: 'spell-access-summary-resolved-grant-fold-facts',
      sourceId: 'spell-access-summary',
      targetId: 'resolved-grant-fold-facts'
    },
    {
      id: 'resolved-grant-fold-facts-grant-fold',
      sourceId: 'resolved-grant-fold-facts',
      targetId: 'grant-fold'
    },
    {
      id: 'grant-fold-character-calculations',
      sourceId: 'grant-fold',
      targetId: 'character-calculations'
    },
    {
      id: 'character-calculations-spellcasting-classes',
      sourceId: 'character-calculations',
      targetId: 'spellcasting-classes'
    },
    {
      id: 'spellcasting-classes-spell-slots',
      sourceId: 'spellcasting-classes',
      targetId: 'spell-slots'
    },
    {
      id: 'spell-slots-resolved-charge-facts',
      sourceId: 'spell-slots',
      targetId: 'resolved-charge-facts'
    },
    {
      id: 'resolved-charge-facts-charge-maximums',
      sourceId: 'resolved-charge-facts',
      targetId: 'charge-maximums'
    },
    {
      id: 'spell-access-candidates-spell-access-decisions',
      sourceId: 'spell-access-candidates',
      targetId: 'spell-access-decisions'
    },
    {
      id: 'spell-access-decisions-spell-access-summary',
      sourceId: 'spell-access-decisions',
      targetId: 'spell-access-summary'
    },
    {
      id: 'charge-maximums-resource-pools',
      sourceId: 'charge-maximums',
      targetId: 'resource-pools'
    },
    {
      id: 'resource-pools-spell-class-states',
      sourceId: 'resource-pools',
      targetId: 'spell-class-states'
    },
    {
      id: 'spell-class-states-spell-mechanics',
      sourceId: 'spell-class-states',
      targetId: 'spell-mechanics'
    },
    {
      id: 'spell-mechanics-action-policy-input',
      sourceId: 'spell-mechanics',
      targetId: 'action-policy-input'
    },
    {
      id: 'action-policy-input-action-policy',
      sourceId: 'action-policy-input',
      targetId: 'action-policy'
    },
    {
      id: 'action-policy-spell-preparation-source-calculations',
      sourceId: 'action-policy',
      targetId: 'spell-preparation-source-calculations'
    },
    {
      id: 'spell-preparation-source-calculations-spell-preparation-state',
      sourceId: 'spell-preparation-source-calculations',
      targetId: 'spell-preparation-state'
    },
    {
      id: 'spell-preparation-state-spell-preparation-request',
      sourceId: 'spell-preparation-state',
      targetId: 'spell-preparation-request'
    },
    {
      id: 'spell-preparation-request-policy',
      sourceId: 'spell-preparation-request',
      targetId: 'policy'
    },
    { id: 'policy-output', sourceId: 'policy', targetId: 'output' }
  ]
}

const dnd5e2014CharacterActionEmptyFixture: RulePackDocumentDto['fixtures'][number] = {
  id: '31471730-8aec-4cb7-aae2-ef13635a46d7',
  label: 'Empty Character actions',
  modelKey: CHARACTER_ACTION_MODEL_KEY,
  input: {
    candidates: [],
    spellCandidates: [],
    spellSlots: [],
    spellEffects: [],
    spellMechanics: [],
    activeSourceIds: [],
    activeEquipmentInstanceIds: [],
    resources: [],
    totalLevel: 0,
    classLevels: [],
    proficiencyBonus: 2,
    abilities: [],
    skills: [],
    spellcasting: null,
    attackRollModes: {
      MELEE: 'NORMAL',
      RANGED: 'NORMAL',
      SPELL: 'NORMAL',
      UNARMED: 'NORMAL'
    }
  },
  expected: {
    actionDecisions: [],
    spellCastMechanics: [],
    spellReferenceMechanics: [],
    spellCastDecisions: []
  }
}

export const dnd5e2014CharacterPolicyDocument = {
  schemaVersion: 1,
  models: {
    'character-policy': model,
    [CHARACTER_GRANT_FOLD_MODEL_KEY]: dnd5e2014CharacterGrantFoldModel,
    [CHARACTER_ACTION_MODEL_KEY]: dnd5e2014CharacterActionModel
  },
  fixtures: [
    {
      id: 'dd78adf8-2983-47ba-bb2e-9240339b68bf',
      label: 'Fifth-level character policy',
      modelKey: 'character-policy',
      input: {
        contractVersion: 4,
        grantFoldFacts: dnd5e2014CharacterGrantFoldEmptyInput,
        totalLevel: 5,
        eligibilityFacets: [],
        derivedBaseFacts: {
          abilities: [
            {
              abilityId: 'STR',
              baseScore: 16,
              bonuses: [],
              scoreOverride: null
            }
          ],
          savingThrows: [],
          skills: [],
          initiative: { abilityId: 'STR', abilityIndex: 0, bonuses: [] },
          spellcasting: null
        },
        defenseFacts: { manualAdditions: [] },
        proficiencyFacts: { manualAdditions: [] },
        spellAccessCandidates: [],
        spellActionFacts: [],
        spellClasses: [],
        spellPreparationClasses: [],
        spellPreparationCatalog: [],
        spellPreparationRequest: null,
        spellCastCandidates: [],
        spellCastSlots: [],
        spellCastResources: [],
        spellcastingClasses: [],
        chargeCalculations: [],
        resourcePoolCandidates: [],
        rest: {
          totalHitDice: 5,
          currentExhaustion: 2,
          attunementSlotOverride: null
        }
      },
      expected: {
        grantFold: dnd5e2014CharacterGrantFoldEmptyOutput,
        proficiencies: [],
        proficiencyBonus: 3,
        abilityModifiers: [{ ability: 'STR', value: 3 }],
        passiveChecks: [],
        modifierGroups: [],
        rollModes: {
          initiative: 'NORMAL',
          abilityChecks: {
            STRENGTH: 'NORMAL',
            DEXTERITY: 'NORMAL',
            CONSTITUTION: 'NORMAL',
            INTELLIGENCE: 'NORMAL',
            WISDOM: 'NORMAL',
            CHARISMA: 'NORMAL'
          },
          savingThrows: {
            STRENGTH: 'NORMAL',
            DEXTERITY: 'NORMAL',
            CONSTITUTION: 'NORMAL',
            INTELLIGENCE: 'NORMAL',
            WISDOM: 'NORMAL',
            CHARISMA: 'NORMAL'
          },
          skillChecks: {
            acrobatics: 'NORMAL',
            'animal-handling': 'NORMAL',
            arcana: 'NORMAL',
            athletics: 'NORMAL',
            deception: 'NORMAL',
            history: 'NORMAL',
            insight: 'NORMAL',
            intimidation: 'NORMAL',
            investigation: 'NORMAL',
            medicine: 'NORMAL',
            nature: 'NORMAL',
            perception: 'NORMAL',
            performance: 'NORMAL',
            persuasion: 'NORMAL',
            religion: 'NORMAL',
            'sleight-of-hand': 'NORMAL',
            stealth: 'NORMAL',
            survival: 'NORMAL'
          },
          attacks: { MELEE: 'NORMAL', RANGED: 'NORMAL', SPELL: 'NORMAL', UNARMED: 'NORMAL' }
        },
        rollContributorEvidence: dnd5e2014EmptyRollContributorEvidence,
        defenses: [],
        hitPointProgression: [],
        derivedStats: {
          proficiencyBonus: {
            base: 3,
            effective: 3,
            contributions: [],
            override: null
          },
          abilities: [
            {
              abilityId: 'STR',
              score: {
                base: 16,
                effective: 16,
                contributions: [],
                override: null
              },
              modifier: {
                base: 3,
                effective: 3,
                contributions: [],
                override: null
              }
            }
          ],
          savingThrows: [],
          skills: [],
          initiative: {
            base: 3,
            effective: 3,
            contributions: [],
            override: null
          },
          armorClass: {
            base: 10,
            effective: 10,
            contributions: [],
            override: null
          },
          maxHitPoints: {
            base: 0,
            effective: 0,
            contributions: [],
            override: null
          },
          spellcasting: null
        },
        spellAccessDecisions: [],
        spellAccess: [],
        spellMechanics: [],
        itemMechanics: [],
        companions: [],
        classSpellStates: [],
        spellPreparation: { sources: [], requestDecision: null },
        spellCastDecisions: [],
        spellSlots: {
          calculationId: 'spell-slots',
          sourceClassIds: [],
          maxByLevel: [],
          pactMagic: null,
          fusionStrategy: 'NONE'
        },
        chargeMaximums: [],
        resources: [],
        actionDecisions: [],
        spellCastMechanics: [],
        spellReferenceMechanics: [],
        eligibilityFacets: [],
        rest: {
          hitDieConstitutionModifier: 0,
          hitDiceRecoveredAfterLongRest: 2,
          currentExhaustion: 2,
          minimumExhaustion: 0,
          maximumExhaustion: 6,
          exhaustionAfterLongRest: 1,
          attunementSlotLimit: 3,
          companionHitDiceRecoveredAfterLongRest: []
        }
      }
    },
    {
      id: '34e801bf-26b5-4f4d-9764-b0aa8c3dd870',
      label: 'Empty Character grant fold',
      modelKey: CHARACTER_GRANT_FOLD_MODEL_KEY,
      input: dnd5e2014CharacterGrantFoldEmptyInput,
      expected: dnd5e2014CharacterGrantFoldEmptyOutput
    },
    dnd5e2014CharacterActionEmptyFixture
  ]
} satisfies RulePackDocumentDto
