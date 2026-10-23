import { z, lazySchema } from '../zod.js'
import type { CompiledEffectGroup } from '@artificer-toolkit/shared/compilers'

import {
  characterGrantFoldRestrictionSchema,
  characterMechanicSourceSchema
} from './characterGrantFoldRules.js'
import { characterResourcesSchema } from './characterResourceRules.js'
import { characterResourcePoolIdentitySchema } from '../shared/characterResourceIdentity.js'
import {
  abilityCodeSchema,
  attackKindSchema,
  equipmentGripSchema,
  modifierScopeKindSchema
} from '../shared/enums.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { lengthUnitCodeSchema } from '../shared/enums.js'
import { reactionTriggerBindingDtoSchema } from '../shared/reaction.js'
import { facetDtoSchema } from '../shared/facet.js'
import { systemCoreCodeSchema } from '../shared/systemCoreCode.js'

const stringSchema = lazySchema(() => z.string())
const integerSchema = lazySchema(() => z.number().check(z.int()))
const finiteNumberSchema = lazySchema(() => z.number())
const booleanSchema = lazySchema(() => z.boolean())

const identitySchema = lazySchema(() =>
  stringSchema.check(z.trim()).check(z.minLength(1)).check(z.maxLength(240))
)
const spellCandidateIdentitySchema = lazySchema(() =>
  stringSchema.check(z.trim()).check(z.minLength(1)).check(z.maxLength(1_000))
)
const actionAbilityDefinitionSchema = lazySchema(() =>
  z.strictObject({
    id: postgresUuidSchema,
    code: identitySchema
  })
)
const actionAbilityDefinitionsSchema = lazySchema(() =>
  z.pipe(
    z
      .array(actionAbilityDefinitionSchema)
      .check(z.maxLength(32))
      .check(
        z.superRefine((definitions, context) => {
          const ids = new Set<string>()
          const codes = new Set<string>()
          for (const [index, definition] of definitions.entries()) {
            if (ids.has(definition.id)) {
              context.addIssue({
                code: 'custom',
                path: [index, 'id'],
                message: 'Action ability definition IDs must be unique.'
              })
            }
            if (codes.has(definition.code)) {
              context.addIssue({
                code: 'custom',
                path: [index, 'code'],
                message: 'Action ability definition codes must be unique.'
              })
            }
            ids.add(definition.id)
            codes.add(definition.code)
          }
        })
      ),
    z.transform((definitions) =>
      [...definitions].sort((left, right) => left.id.localeCompare(right.id))
    )
  )
)
const canonicalConditionDefinitionIdSchema = lazySchema(() =>
  z
    .string()
    .check(
      z.regex(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
        'Condition definition identity must be a canonical lowercase PostgreSQL UUID.'
      )
    )
)

const actionEquipmentStateSchema = lazySchema(() =>
  z.strictObject({
    itemInstanceId: identitySchema,
    equipmentId: z.optional(z.nullable(identitySchema)),
    /** Variant ancestry, nearest parent first; proficiency and item conditions match through it. */
    parentEquipmentIds: z.array(identitySchema).check(z.maxLength(20)),
    category: z.optional(z.nullable(identitySchema)),
    properties: z.optional(z.array(identitySchema).check(z.maxLength(100))),
    equipped: booleanSchema,
    attuned: booleanSchema,
    requiresAttunement: booleanSchema,
    requiresEquipped: booleanSchema,
    requiresAttuned: booleanSchema,
    /** The grip this action's effect is wielded with; null for non-attack and item-feature actions. */
    grip: z.nullable(equipmentGripSchema),
    /** The item effect's authored requirements; the Encounter decides them when it offers the action. */
    requirements: z.optional(facetDtoSchema),
    /** Another weapon is equipped: attacking with this item is not wielding it alone (Dueling). */
    otherWeaponEquipped: booleanSchema,
    /** Using this item's action uses one up (the item's `CONSUMED_ON_USE` attribute). */
    consumedOnUse: booleanSchema,
    /** Corrosion on this item: its damage rolls lose this much. */
    degradation: z.optional(integerSchema.check(z.gte(1))),
    /** The equipment this weapon's ammunition descends from (an ammunition weapon only). */
    ammunitionEquipmentId: z.optional(z.nullable(identitySchema)),
    /** The Character's items that fit `ammunitionEquipmentId`, whatever their remaining quantity. */
    ammunitionStacks: z.optional(
      z
        .array(
          z.strictObject({
            itemInstanceId: identitySchema,
            equipmentId: identitySchema,
            label: z.string().check(z.maxLength(200))
          })
        )
        .check(z.maxLength(100))
    )
  })
)

const actionResourceUseSchema = lazySchema(() =>
  z.strictObject({
    chargeId: identitySchema,
    cost: integerSchema.check(z.gte(1)).check(z.lte(2_147_483_647)),
    poolId: z.nullable(characterResourcePoolIdentitySchema)
  })
)

const actionMechanicsOwnerSchema = lazySchema(() =>
  z.strictObject({
    kind: z.enum(['FEATURE', 'FEATURE_OPTION', 'FEAT', 'EQUIPMENT', 'SPELL']),
    id: identitySchema
  })
)

const actionDamageBonusSchema = lazySchema(() =>
  z.discriminatedUnion('bonusKind', [
    z.strictObject({
      bonusKind: z.literal('ABILITY_BONUS'),
      ability: identitySchema,
      order: integerSchema,
      min: z.nullable(finiteNumberSchema),
      max: z.nullable(finiteNumberSchema),
      multiplier: z.nullable(finiteNumberSchema)
    }),
    z.strictObject({
      bonusKind: z.literal('SKILL_BONUS'),
      skillId: identitySchema,
      order: integerSchema,
      min: z.nullable(finiteNumberSchema),
      max: z.nullable(finiteNumberSchema),
      multiplier: z.nullable(finiteNumberSchema)
    }),
    z.strictObject({
      bonusKind: z.literal('PROFICIENCY_BONUS'),
      order: integerSchema,
      min: z.nullable(finiteNumberSchema),
      max: z.nullable(finiteNumberSchema),
      multiplier: z.nullable(finiteNumberSchema)
    })
  ])
)

const actionDamageFactSchema = lazySchema(() =>
  z.strictObject({
    kind: z.literal('DAMAGE'),
    outcomeId: z.optional(identitySchema),
    pathCode: identitySchema,
    label: z.nullable(stringSchema.check(z.trim()).check(z.minLength(1)).check(z.maxLength(500))),
    damageTypeId: identitySchema,
    valueKind: z.enum(['DICE', 'FIXED', 'POOL']),
    scalingKind: z.enum(['NONE', 'PER_LEVEL', 'BREAKPOINTS']),
    scalingSource: z.nullable(
      z.enum(['CHARACTER_LEVEL', 'CLASS_LEVEL', 'PARENT_CLASS_LEVEL', 'SPELL_CAST_LEVEL'])
    ),
    classId: z.nullable(identitySchema),
    amountKind: z.nullable(z.enum(['FULL', 'HALF', 'DOUBLE'])),
    amountMultiplier: z.nullable(finiteNumberSchema),
    values: z
      .array(
        z.strictObject({
          level: z.nullable(integerSchema.check(z.gte(0)).check(z.lte(20))),
          order: integerSchema,
          amount: z.nullable(finiteNumberSchema),
          dice: z.nullable(
            stringSchema.check(z.trim()).check(z.minLength(1)).check(z.maxLength(240))
          ),
          /** The dice rolled instead while the source has half of its hit points or fewer. */
          halfHitPointsDice: z.nullable(
            stringSchema.check(z.trim()).check(z.minLength(1)).check(z.maxLength(240))
          ),
          multiplier: z.nullable(finiteNumberSchema),
          minimum: z.nullable(finiteNumberSchema),
          maximum: z.nullable(finiteNumberSchema)
        })
      )
      .check(z.minLength(1))
      .check(z.maxLength(100)),
    bonuses: z.array(actionDamageBonusSchema).check(z.maxLength(100))
  })
)

const actionHealBonusSchema = lazySchema(() =>
  z.discriminatedUnion('bonusKind', [
    z.strictObject({
      bonusKind: z.literal('ABILITY_BONUS'),
      ability: identitySchema,
      order: integerSchema,
      min: z.nullable(finiteNumberSchema),
      max: z.nullable(finiteNumberSchema),
      multiplier: z.nullable(finiteNumberSchema)
    }),
    z.strictObject({
      bonusKind: z.literal('PROFICIENCY_BONUS'),
      order: integerSchema,
      min: z.nullable(finiteNumberSchema),
      max: z.nullable(finiteNumberSchema),
      multiplier: z.nullable(finiteNumberSchema)
    }),
    z.strictObject({
      bonusKind: z.literal('CLASS_LEVEL'),
      classId: identitySchema,
      order: integerSchema,
      min: z.nullable(finiteNumberSchema),
      max: z.nullable(finiteNumberSchema),
      multiplier: z.nullable(finiteNumberSchema)
    })
  ])
)

/** An outcome the action resolves that has no dedicated fact; the resolved mechanics repeat the fact's shape. */
const actionEffectFactSchema = lazySchema(() =>
  z.strictObject({
    kind: z.literal('EFFECT'),
    pathCode: identitySchema,
    effectKind: identitySchema,
    /** A movement rule's kind, so a consumer can tell Dash (`ADD_SPEED_TO_MOVEMENT`) apart. */
    ruleKind: z.optional(identitySchema),
    /** What an END_EFFECTS outcome ends: held effects any selector matches (D174, D182). */
    endEffects: z.optional(
      z.strictObject({
        scope: z.enum(['ALL', 'ONE_CHOSEN']),
        selectors: z
          .array(
            z.discriminatedUnion('kind', [
              z.strictObject({
                kind: z.literal('CONDITION'),
                conditionIds: z
                  .array(canonicalConditionDefinitionIdSchema)
                  .check(z.minLength(1))
                  .check(z.maxLength(100))
              }),
              z.strictObject({
                kind: z.literal('SPELL_LEVEL'),
                limit: z.enum(['SLOT_LEVEL', 'FIXED']),
                level: z.optional(z.number().check(z.int()).check(z.gte(0)).check(z.lte(9)))
              })
            ])
          )
          .check(z.minLength(1))
          .check(z.maxLength(4))
      })
    ),
    label: z.nullable(stringSchema.check(z.trim()).check(z.minLength(1)).check(z.maxLength(500)))
  })
)

const actionHealFactSchema = lazySchema(() =>
  z.strictObject({
    kind: z.literal('HEAL'),
    outcomeId: z.optional(identitySchema),
    pathCode: identitySchema,
    label: z.nullable(stringSchema.check(z.trim()).check(z.minLength(1)).check(z.maxLength(500))),
    valueKind: z.enum(['DICE', 'FIXED', 'POOL']),
    scalingKind: z.enum(['NONE', 'PER_LEVEL', 'BREAKPOINTS']),
    scalingSource: z.nullable(
      z.enum(['CHARACTER_LEVEL', 'CLASS_LEVEL', 'PARENT_CLASS_LEVEL', 'SPELL_CAST_LEVEL'])
    ),
    classId: z.nullable(identitySchema),
    temporary: booleanSchema,
    values: z
      .array(
        z.strictObject({
          level: z.nullable(integerSchema.check(z.gte(0)).check(z.lte(20))),
          order: integerSchema,
          amount: z.nullable(finiteNumberSchema),
          dice: z.nullable(
            stringSchema.check(z.trim()).check(z.minLength(1)).check(z.maxLength(240))
          ),
          multiplier: z.nullable(finiteNumberSchema),
          minimum: z.nullable(finiteNumberSchema),
          maximum: z.nullable(finiteNumberSchema)
        })
      )
      .check(z.minLength(1))
      .check(z.maxLength(100)),
    bonuses: z.array(actionHealBonusSchema).check(z.maxLength(100))
  })
)

const actionSavingThrowBonusSchema = lazySchema(() =>
  z.discriminatedUnion('bonusKind', [
    z.strictObject({
      bonusKind: z.literal('ABILITY_MODIFIER'),
      abilityDefinitionId: postgresUuidSchema
    }),
    z.strictObject({ bonusKind: z.literal('PROFICIENCY_BONUS') }),
    z.strictObject({
      bonusKind: z.literal('STATIC_BONUS'),
      amount: integerSchema
    })
  ])
)

const actionInvocationFactSchema = lazySchema(() =>
  z.strictObject({
    triggerCode: identitySchema,
    activation: z.nullable(
      z.strictObject({
        code: identitySchema,
        amount: z.nullable(finiteNumberSchema)
      })
    ),
    range: z.strictObject({
      rangeKind: identitySchema,
      amount: z.nullable(finiteNumberSchema),
      /** A ranged weapon attack's long range; null for every other range. */
      longAmount: z.nullable(finiteNumberSchema),
      unit: z.nullable(lengthUnitCodeSchema)
    }),
    savingThrow: z.nullable(
      z.strictObject({
        dcMethod: z.enum(['SOURCE_SAVE_DC', 'FIXED_DC', 'DERIVED_DC']),
        abilityDefinitionId: postgresUuidSchema,
        baseDc: z.nullable(integerSchema),
        bonuses: z.array(actionSavingThrowBonusSchema).check(z.maxLength(100))
      })
    ),
    reactionTrigger: z.nullable(reactionTriggerBindingDtoSchema),
    /** The spell levels at which the number of creatures the effect names changes (Magic Missile darts). */
    targetCountLevels: z.optional(
      z.array(integerSchema.check(z.positive())).check(z.maxLength(100))
    )
  })
)

const characterActionMechanicFactSchema = lazySchema(() =>
  z.strictObject({
    invocation: actionInvocationFactSchema,
    outcomes: z
      .array(
        z.discriminatedUnion('kind', [
          actionDamageFactSchema,
          actionHealFactSchema,
          z.strictObject({
            kind: z.literal('CONDITION'),
            pathCode: identitySchema,
            conditionId: canonicalConditionDefinitionIdSchema
          }),
          actionEffectFactSchema
        ])
      )
      .check(z.maxLength(1_000))
  })
)

const actionOutcomeScalingSchema = lazySchema(() =>
  z.strictObject({
    level: integerSchema.check(z.positive()),
    expression: stringSchema.check(z.trim()).check(z.minLength(1)).check(z.maxLength(500))
  })
)

const actionProficiencySchema = lazySchema(() =>
  z.strictObject({
    kind: identitySchema,
    subjectId: identitySchema,
    scaling: z.enum(['HALF', 'FULL', 'DOUBLE']),
    category: z.nullable(identitySchema)
  })
)

const actionModifierGroupSchema = lazySchema(() =>
  z.strictObject({
    domainKey: identitySchema,
    contributions: z
      .array(
        z.strictObject({
          sourceId: identitySchema,
          boundSourceId: z.optional(identitySchema),
          value: finiteNumberSchema,
          ability: z.nullable(identitySchema),
          state: z.enum(['APPLIED', 'SUPPRESSED']),
          scope: modifierScopeKindSchema,
          deferredRequirements: characterGrantFoldRestrictionSchema,
          scopeSpellIds: z.array(identitySchema).check(z.maxLength(500))
        })
      )
      .check(z.maxLength(1_000))
  })
)

const actionItemAdjustmentSchema = lazySchema(() =>
  z.strictObject({
    itemInstanceId: identitySchema,
    attackBonus: finiteNumberSchema,
    attackOverride: z.nullable(finiteNumberSchema),
    damageBonus: finiteNumberSchema
  })
)

export const characterResolvedActionMechanicSchema = lazySchema(() =>
  z.strictObject({
    effectId: postgresUuidSchema,
    trigger: identitySchema,
    activation: z.nullable(
      z.strictObject({ kind: identitySchema, amount: integerSchema.check(z.positive()) })
    ),
    rangeLabel: z.nullable(
      stringSchema.check(z.trim()).check(z.minLength(1)).check(z.maxLength(500))
    ),
    attackKind: z.nullable(attackKindSchema),
    // The ability the attack is made with, which an ability-scoped attack grant is read against.
    attackAbility: z.nullable(abilityCodeSchema),
    attackBonus: z.nullable(integerSchema),
    attackRollMode: z.nullable(systemCoreCodeSchema),
    save: z.nullable(
      z.strictObject({
        ability: abilityCodeSchema,
        dc: z.nullable(integerSchema)
      })
    ),
    targetCountLevels: z.optional(
      z.array(integerSchema.check(z.positive())).check(z.maxLength(100))
    ),
    outcomes: z
      .array(
        z.discriminatedUnion('kind', [
          z.strictObject({
            kind: z.literal('DAMAGE'),
            outcomeId: z.optional(identitySchema),
            pathCode: identitySchema,
            expression: stringSchema.check(z.trim()).check(z.minLength(1)).check(z.maxLength(500)),
            diceExpression: stringSchema
              .check(z.trim())
              .check(z.minLength(1))
              .check(z.maxLength(500)),
            damageTypeId: identitySchema,
            /** The faces of the die a grant set for the weapon's damage (Shillelagh's d8), when one did. */
            weaponDieFaces: z.optional(integerSchema.check(z.positive())),
            scaling: z.array(actionOutcomeScalingSchema).check(z.maxLength(100))
          }),
          z.strictObject({
            kind: z.literal('HEAL'),
            outcomeId: z.optional(identitySchema),
            pathCode: identitySchema,
            expression: stringSchema.check(z.trim()).check(z.minLength(1)).check(z.maxLength(500)),
            temporary: booleanSchema,
            scaling: z.array(actionOutcomeScalingSchema).check(z.maxLength(100))
          }),
          z.strictObject({
            kind: z.literal('CONDITION'),
            pathCode: identitySchema,
            conditionId: identitySchema
          }),
          actionEffectFactSchema
        ])
      )
      .check(z.maxLength(1_000))
  })
)

export const characterActionCandidatesSchema = lazySchema(() =>
  z
    .array(
      z.strictObject({
        sequence: integerSchema.check(z.gte(0)).check(z.lte(9_999)),
        actionId: identitySchema,
        label: stringSchema.check(z.trim()).check(z.minLength(1)).check(z.maxLength(500)),
        effectId: postgresUuidSchema,
        sourceId: identitySchema,
        source: characterMechanicSourceSchema,
        mechanicsOwner: actionMechanicsOwnerSchema,
        /**
         * What must be active to offer the action: its source, its item, or both for a Feature attack
         * made with a wielded weapon (D156).
         */
        activationSourceKind: z.enum([
          'ACTIVE_SOURCE',
          'ACTIVE_EQUIPMENT',
          'ACTIVE_SOURCE_AND_EQUIPMENT'
        ]),
        equipment: z.nullable(actionEquipmentStateSchema),
        resourceUse: z.nullable(actionResourceUseSchema),
        mechanicFacts: characterActionMechanicFactSchema
      })
    )
    .check(z.maxLength(1_000))
    .check(
      z.superRefine((candidates, context) => {
        const actionIds = new Set<string>()
        for (const [index, candidate] of candidates.entries()) {
          if (candidate.sequence !== index) {
            context.addIssue({
              code: 'custom',
              message: 'Action candidates must use contiguous source order',
              path: [index, 'sequence']
            })
          }
          if (actionIds.has(candidate.actionId)) {
            context.addIssue({
              code: 'custom',
              message: 'Action IDs must be unique',
              path: [index, 'actionId']
            })
          }
          if (candidate.activationSourceKind !== 'ACTIVE_SOURCE' && candidate.equipment === null) {
            context.addIssue({
              code: 'custom',
              message: 'Equipment action candidates must include exact equipment state',
              path: [index, 'equipment']
            })
          }
          actionIds.add(candidate.actionId)
        }
      })
    )
)

export const characterActionReasonCodeSchema = lazySchema(() =>
  z.enum([
    'SOURCE_NOT_EQUIPPED',
    'SOURCE_NOT_ATTUNED',
    'SOURCE_REQUIREMENTS_NOT_MET',
    'RESOURCE_MISSING',
    'INSUFFICIENT_RESOURCE'
  ])
)

export const characterActionDecisionsSchema = lazySchema(() =>
  z
    .array(
      z.strictObject({
        sequence: integerSchema.check(z.gte(0)).check(z.lte(9_999)),
        actionId: identitySchema,
        effectId: postgresUuidSchema,
        sourceId: identitySchema,
        source: characterMechanicSourceSchema,
        mechanicsOwner: actionMechanicsOwnerSchema,
        status: z.enum(['AVAILABLE', 'UNAVAILABLE']),
        reasonCode: z.nullable(characterActionReasonCodeSchema),
        resourcePoolId: z.nullable(characterResourcePoolIdentitySchema),
        resourceCost: z.nullable(integerSchema.check(z.gte(1)).check(z.lte(2_147_483_647))),
        mechanic: characterResolvedActionMechanicSchema,
        /** An ammunition weapon's mechanic as each stack that fits would make it (ATTACK-19.4). */
        ammunitionMechanics: z.optional(
          z
            .array(
              z.strictObject({
                itemInstanceId: identitySchema,
                mechanic: characterResolvedActionMechanicSchema
              })
            )
            .check(z.maxLength(100))
        )
      })
    )
    .check(z.maxLength(1_000))
    .check(
      z.superRefine((decisions, context) => {
        const actionIds = new Set<string>()
        for (const [index, decision] of decisions.entries()) {
          if (decision.sequence !== index) {
            context.addIssue({
              code: 'custom',
              message: 'Action decisions must use contiguous source order',
              path: [index, 'sequence']
            })
          }
          if (actionIds.has(decision.actionId)) {
            context.addIssue({
              code: 'custom',
              message: 'Action IDs must be unique',
              path: [index, 'actionId']
            })
          }
          const resourceBound = decision.resourcePoolId !== null || decision.resourceCost !== null
          const resourceFieldsMatch =
            (decision.resourcePoolId === null && decision.resourceCost === null) ||
            (decision.resourcePoolId !== null && decision.resourceCost !== null)
          const statusMatches =
            decision.status === 'AVAILABLE'
              ? decision.reasonCode === null
              : decision.reasonCode !== null &&
                (decision.reasonCode === 'INSUFFICIENT_RESOURCE' ? resourceBound : !resourceBound)
          if (!resourceFieldsMatch || !statusMatches) {
            context.addIssue({
              code: 'custom',
              message: 'Action decision status, reason, and resource binding must agree',
              path: [index]
            })
          }
          actionIds.add(decision.actionId)
        }
      })
    )
)

export type CharacterActionCandidate = z.infer<typeof characterActionCandidatesSchema>[number]

/** Server-only exact compiled source retained until System capability discovery completes. */
export interface CharacterActionRuleEntryPoint {
  actionId: string
  effectId: string
  sourceId: string
  source: CharacterActionCandidate['source']
  mechanicsOwner: CharacterActionCandidate['mechanicsOwner']
  activationSourceKind: CharacterActionCandidate['activationSourceKind']
  compiledEffect: CompiledEffectGroup
  /** The level a spell cast is made at, which selects the scaling row the compiler rolls. */
  spellCastLevel?: number
  /** The Character's level, which selects a cap scaled by it (Eldritch Blast's beams). */
  characterLevel?: number
  /** Set for an at-will grant's cast whose targets are each locked out of the grant (D156). */
  perTargetLockout?: { grantId: string }
}
export type CharacterResolvedActionMechanic = z.infer<typeof characterResolvedActionMechanicSchema>

export const characterActionSpellSourceSchema = lazySchema(() =>
  z.strictObject({
    spellId: identitySchema,
    sourceKind: z.enum([
      'BACKGROUND',
      'CLASS',
      'FEAT',
      'FEATURE',
      'ITEM',
      'OPTION',
      'RACE',
      'SUBCLASS'
    ]),
    sourceInstanceId: identitySchema
  })
)

export const characterSpellActionFactsSchema = lazySchema(() =>
  z
    .array(
      z.strictObject({
        spellId: identitySchema,
        /** Whether a higher cast level changes what the spell does, so the Character may list those levels. */
        readsCastLevel: booleanSchema,
        effects: z
          .array(
            z.strictObject({
              effectId: postgresUuidSchema,
              mechanicFacts: characterActionMechanicFactSchema
            })
          )
          .check(z.maxLength(100))
      })
    )
    .check(z.maxLength(1_000))
    .check(
      z.superRefine((spells, context) => {
        const spellIds = new Set<string>()
        for (const [index, spell] of spells.entries()) {
          if (spellIds.has(spell.spellId)) {
            context.addIssue({
              code: 'custom',
              message: 'Spell action facts must use unique spell IDs',
              path: [index, 'spellId']
            })
          }
          const effectIds = new Set<string>()
          for (const [effectIndex, effect] of spell.effects.entries()) {
            if (effectIds.has(effect.effectId)) {
              context.addIssue({
                code: 'custom',
                message: 'Spell action effects must use unique effect IDs',
                path: [index, 'effects', effectIndex, 'effectId']
              })
            }
            effectIds.add(effect.effectId)
          }
          spellIds.add(spell.spellId)
        }
      })
    )
)

const characterSpellCastCandidateIdSchema = lazySchema(() =>
  stringSchema.check(z.trim()).check(z.minLength(1)).check(z.maxLength(1_000))
)

const characterSpellCastCandidateSchema = lazySchema(() =>
  z.strictObject({
    sequence: integerSchema.check(z.gte(0)).check(z.lte(4_999)),
    candidateId: characterSpellCastCandidateIdSchema,
    /** Optional display label retained for snapshot compatibility. */
    label: z.optional(stringSchema.check(z.trim()).check(z.minLength(1)).check(z.maxLength(500))),
    spellId: identitySchema,
    source: characterActionSpellSourceSchema,
    spellLevel: integerSchema.check(z.gte(0)).check(z.lte(9)),
    castMode: z.enum(['SPELL_SLOT', 'AT_WILL', 'RITUAL', 'FIXED_LEVEL', 'LIMITED_USE']),
    castLevel: integerSchema.check(z.gte(0)).check(z.lte(9)),
    baseEntry: booleanSchema,
    resourceOwnerKey: z.nullable(characterResourcePoolIdentitySchema),
    /** The slot pool the cast also spends a slot from (D175); null when it spends none. */
    slotPoolCode: z._default(z.nullable(systemCoreCodeSchema), null)
  })
)

export const characterSpellCastCandidatesSchema = lazySchema(() =>
  z
    .array(characterSpellCastCandidateSchema)
    .check(z.maxLength(5_000))
    .check(
      z.superRefine((candidates, context) => {
        const candidateIds = new Set<string>()
        for (const [index, candidate] of candidates.entries()) {
          if (candidate.sequence !== index) {
            context.addIssue({
              code: 'custom',
              message: 'Spell action candidates must use contiguous source order',
              path: [index, 'sequence']
            })
          }
          if (candidateIds.has(candidate.candidateId)) {
            context.addIssue({
              code: 'custom',
              message: 'Spell action candidate IDs must be unique',
              path: [index, 'candidateId']
            })
          }
          if (candidate.spellId !== candidate.source.spellId) {
            context.addIssue({
              code: 'custom',
              message: 'Spell action candidate source must match its spell ID',
              path: [index, 'source', 'spellId']
            })
          }
          candidateIds.add(candidate.candidateId)
        }
      })
    )
)

export const characterSpellCastSlotsSchema = lazySchema(() =>
  z
    .array(
      z.strictObject({
        slotKey: identitySchema,
        label: identitySchema,
        level: integerSchema.check(z.gte(1)).check(z.lte(9)),
        max: integerSchema.check(z.gte(0)).check(z.lte(99)),
        remaining: integerSchema.check(z.gte(0)).check(z.lte(99))
      })
    )
    .check(z.maxLength(99))
    .check(
      z.superRefine((slots, context) => {
        for (let index = 1; index < slots.length; index += 1) {
          if (slots[index - 1]!.level > slots[index]!.level) {
            context.addIssue({
              code: 'custom',
              message: 'Spell cast slots must be ordered by level',
              path: [index, 'level']
            })
          }
        }
      })
    )
)

const characterSpellCastReasonSchema = lazySchema(() =>
  z.enum([
    'CANTRIP',
    'AT_WILL',
    'RITUAL',
    'FIXED_LEVEL_WITHOUT_RESOURCE',
    'RESOURCE_REMAINING',
    'RESOURCE_OWNER_MISSING',
    'RESOURCE_EXHAUSTED',
    'SPELL_SLOT_REMAINING',
    'SPELL_SLOT_EXHAUSTED',
    'NO_ELIGIBLE_SPELL_SLOT',
    'SPELLCASTING_LOCKED'
  ])
)

export const characterSpellCastDecisionsSchema = lazySchema(() =>
  z
    .array(
      z.strictObject({
        candidateId: characterSpellCastCandidateIdSchema,
        status: z.enum(['AVAILABLE', 'UNAVAILABLE']),
        reasonCode: characterSpellCastReasonSchema,
        slotKey: z.nullable(identitySchema)
      })
    )
    .check(z.maxLength(5_000))
)

const characterSpellSourceMechanicsSchema = lazySchema(() =>
  z
    .array(
      z.strictObject({
        source: characterActionSpellSourceSchema,
        attackBonus: z.nullable(integerSchema),
        saveDc: z.nullable(integerSchema),
        damageBonus: finiteNumberSchema
      })
    )
    .check(z.maxLength(1_000))
)

export const characterSpellCastMechanicsSchema = lazySchema(() =>
  z
    .array(
      z.strictObject({
        sequence: integerSchema.check(z.gte(0)).check(z.lte(4_999)),
        candidateId: spellCandidateIdentitySchema,
        spellId: identitySchema,
        source: characterActionSpellSourceSchema,
        castLevel: integerSchema.check(z.gte(0)).check(z.lte(9)),
        mechanics: z.array(characterResolvedActionMechanicSchema).check(z.maxLength(100))
      })
    )
    .check(z.maxLength(5_000))
    .check(
      z.superRefine((mechanics, context) => {
        const candidateIds = new Set<string>()
        for (const [index, candidate] of mechanics.entries()) {
          if (candidate.sequence !== index) {
            context.addIssue({
              code: 'custom',
              message: 'Spell cast mechanics must use contiguous source order',
              path: [index, 'sequence']
            })
          }
          if (candidateIds.has(candidate.candidateId)) {
            context.addIssue({
              code: 'custom',
              message: 'Spell cast mechanic candidate IDs must be unique',
              path: [index, 'candidateId']
            })
          }
          if (candidate.spellId !== candidate.source.spellId) {
            context.addIssue({
              code: 'custom',
              message: 'Spell cast mechanic source must match its spell ID',
              path: [index, 'source', 'spellId']
            })
          }
          candidateIds.add(candidate.candidateId)
        }
      })
    )
)

export const characterSpellReferenceMechanicsSchema = lazySchema(() =>
  z
    .array(
      z.strictObject({
        sequence: integerSchema.check(z.gte(0)).check(z.lte(999)),
        spellId: identitySchema,
        readsCastLevel: booleanSchema,
        mechanics: z.array(characterResolvedActionMechanicSchema).check(z.maxLength(100))
      })
    )
    .check(z.maxLength(1_000))
    .check(
      z.superRefine((mechanics, context) => {
        const spellIds = new Set<string>()
        for (const [index, spell] of mechanics.entries()) {
          if (spell.sequence !== index) {
            context.addIssue({
              code: 'custom',
              message: 'Spell reference mechanics must use contiguous source order',
              path: [index, 'sequence']
            })
          }
          if (spellIds.has(spell.spellId)) {
            context.addIssue({
              code: 'custom',
              message: 'Spell reference mechanics must use unique spell IDs',
              path: [index, 'spellId']
            })
          }
          spellIds.add(spell.spellId)
        }
      })
    )
)

export const characterActionModelOutputSchema = lazySchema(() =>
  z.strictObject({
    actionDecisions: characterActionDecisionsSchema,
    spellCastMechanics: characterSpellCastMechanicsSchema,
    spellReferenceMechanics: characterSpellReferenceMechanicsSchema,
    spellCastDecisions: z._default(characterSpellCastDecisionsSchema, [])
  })
)

export const characterActionModelInputSchema = lazySchema(() =>
  z.strictObject({
    candidates: characterActionCandidatesSchema,
    /** Exact ability definitions carried from the Character's frozen System snapshot. */
    abilityDefinitions: z._default(actionAbilityDefinitionsSchema, []),
    spellCandidates: z._default(characterSpellCastCandidatesSchema, []),
    spellSlots: z._default(characterSpellCastSlotsSchema, []),
    spellEffects: z._default(characterSpellActionFactsSchema, []),
    spellMechanics: z._default(characterSpellSourceMechanicsSchema, []),
    /** An active `SPELLCASTING_LOCK` grant bars every spell cast. */
    spellcastingLocked: z.boolean(),
    activeSourceIds: z.array(identitySchema).check(z.maxLength(10_000)),
    activeEquipmentInstanceIds: z.array(identitySchema).check(z.maxLength(1_000)),
    resources: characterResourcesSchema,
    proficiencies: z._default(z.array(actionProficiencySchema).check(z.maxLength(1_000)), []),
    modifierGroups: z._default(z.array(actionModifierGroupSchema).check(z.maxLength(1_000)), []),
    itemAdjustments: z._default(z.array(actionItemAdjustmentSchema).check(z.maxLength(500)), []),
    totalLevel: integerSchema.check(z.gte(0)).check(z.lte(20)),
    classLevels: z
      .array(
        z.strictObject({
          classId: identitySchema,
          level: integerSchema.check(z.gte(0)).check(z.lte(20))
        })
      )
      .check(z.maxLength(20)),
    proficiencyBonus: integerSchema,
    abilities: z
      .array(z.strictObject({ abilityId: identitySchema, modifier: integerSchema }))
      .check(z.maxLength(32)),
    skills: z
      .array(z.strictObject({ skillId: identitySchema, total: integerSchema }))
      .check(z.maxLength(500)),
    spellcasting: z.nullable(z.strictObject({ saveDc: integerSchema, attackBonus: integerSchema }))
  })
)

export type CharacterActionModelInput = z.infer<typeof characterActionModelInputSchema>
export type CharacterActionModelOutput = z.infer<typeof characterActionModelOutputSchema>
