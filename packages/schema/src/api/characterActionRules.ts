import { z } from 'zod'

import { characterMechanicSourceSchema } from './characterGrantFoldRules.js'
import { characterResourcesSchema } from './characterResourceRules.js'
import { abilityCodeSchema } from '../shared/enums.js'

const identitySchema = z.string().trim().min(1).max(240)
const spellCandidateIdentitySchema = z.string().trim().min(1).max(1_000)

const actionEquipmentStateSchema = z.strictObject({
  itemInstanceId: identitySchema,
  equipped: z.boolean(),
  attuned: z.boolean(),
  requiresAttunement: z.boolean(),
  requiresEquipped: z.boolean(),
  requiresAttuned: z.boolean()
})

const actionResourceUseSchema = z.strictObject({
  chargeId: identitySchema,
  cost: z.number().int().min(1).max(2_147_483_647),
  poolId: identitySchema.nullable()
})

const actionMechanicsOwnerSchema = z.strictObject({
  kind: z.enum(['FEATURE', 'FEATURE_OPTION', 'FEAT', 'EQUIPMENT']),
  id: identitySchema
})

const actionDamageBonusSchema = z.discriminatedUnion('bonusKind', [
  z.strictObject({
    bonusKind: z.literal('ABILITY_BONUS'),
    ability: identitySchema,
    order: z.number().int(),
    min: z.number().finite().nullable(),
    max: z.number().finite().nullable(),
    multiplier: z.number().finite().nullable()
  }),
  z.strictObject({
    bonusKind: z.literal('SKILL_BONUS'),
    skillId: identitySchema,
    order: z.number().int(),
    min: z.number().finite().nullable(),
    max: z.number().finite().nullable(),
    multiplier: z.number().finite().nullable()
  }),
  z.strictObject({
    bonusKind: z.literal('PROFICIENCY_BONUS'),
    order: z.number().int(),
    min: z.number().finite().nullable(),
    max: z.number().finite().nullable(),
    multiplier: z.number().finite().nullable()
  })
])

const actionDamageFactSchema = z.strictObject({
  kind: z.literal('DAMAGE'),
  pathCode: identitySchema,
  label: z.string().trim().min(1).max(500).nullable(),
  damageTypeId: identitySchema,
  valueKind: z.enum(['DICE', 'FIXED', 'POOL']),
  scalingKind: z.enum(['NONE', 'PER_LEVEL', 'BREAKPOINTS']),
  scalingSource: z
    .enum(['CHARACTER_LEVEL', 'CLASS_LEVEL', 'PARENT_CLASS_LEVEL', 'SPELL_CAST_LEVEL'])
    .nullable(),
  classId: identitySchema.nullable(),
  amountKind: z.enum(['FULL', 'HALF', 'DOUBLE']).nullable(),
  amountMultiplier: z.number().finite().nullable(),
  values: z
    .array(
      z.strictObject({
        level: z.number().int().min(0).max(20).nullable(),
        order: z.number().int(),
        amount: z.number().finite().nullable(),
        dice: z.string().trim().min(1).max(240).nullable(),
        multiplier: z.number().finite().nullable(),
        minimum: z.number().finite().nullable(),
        maximum: z.number().finite().nullable()
      })
    )
    .min(1)
    .max(100),
  bonuses: z.array(actionDamageBonusSchema).max(100)
})

const actionHealBonusSchema = z.discriminatedUnion('bonusKind', [
  z.strictObject({
    bonusKind: z.literal('ABILITY_BONUS'),
    ability: identitySchema,
    order: z.number().int(),
    min: z.number().finite().nullable(),
    max: z.number().finite().nullable(),
    multiplier: z.number().finite().nullable()
  }),
  z.strictObject({
    bonusKind: z.literal('PROFICIENCY_BONUS'),
    order: z.number().int(),
    min: z.number().finite().nullable(),
    max: z.number().finite().nullable(),
    multiplier: z.number().finite().nullable()
  }),
  z.strictObject({
    bonusKind: z.literal('CLASS_LEVEL'),
    classId: identitySchema,
    order: z.number().int(),
    min: z.number().finite().nullable(),
    max: z.number().finite().nullable(),
    multiplier: z.number().finite().nullable()
  })
])

const actionHealFactSchema = z.strictObject({
  kind: z.literal('HEAL'),
  pathCode: identitySchema,
  label: z.string().trim().min(1).max(500).nullable(),
  valueKind: z.enum(['DICE', 'FIXED', 'POOL']),
  scalingKind: z.enum(['NONE', 'PER_LEVEL', 'BREAKPOINTS']),
  scalingSource: z
    .enum(['CHARACTER_LEVEL', 'CLASS_LEVEL', 'PARENT_CLASS_LEVEL', 'SPELL_CAST_LEVEL'])
    .nullable(),
  classId: identitySchema.nullable(),
  temporary: z.boolean(),
  values: z
    .array(
      z.strictObject({
        level: z.number().int().min(0).max(20).nullable(),
        order: z.number().int(),
        amount: z.number().finite().nullable(),
        dice: z.string().trim().min(1).max(240).nullable(),
        multiplier: z.number().finite().nullable(),
        minimum: z.number().finite().nullable(),
        maximum: z.number().finite().nullable()
      })
    )
    .min(1)
    .max(100),
  bonuses: z.array(actionHealBonusSchema).max(100)
})

const actionSavingThrowBonusSchema = z.discriminatedUnion('bonusKind', [
  z.strictObject({ bonusKind: z.literal('ABILITY_MODIFIER'), ability: identitySchema }),
  z.strictObject({ bonusKind: z.literal('PROFICIENCY_BONUS') }),
  z.strictObject({ bonusKind: z.literal('STATIC_BONUS'), amount: z.number().int() })
])

const actionInvocationFactSchema = z.strictObject({
  triggerCode: identitySchema,
  activation: z
    .strictObject({ code: identitySchema, amount: z.number().finite().nullable() })
    .nullable(),
  range: z.strictObject({
    rangeKind: identitySchema,
    amount: z.number().finite().nullable(),
    unit: identitySchema.nullable()
  }),
  savingThrow: z
    .strictObject({
      dcMethod: z.enum(['SOURCE_SAVE_DC', 'FIXED_DC', 'DERIVED_DC']),
      ability: identitySchema,
      baseDc: z.number().int().nullable(),
      bonuses: z.array(actionSavingThrowBonusSchema).max(100)
    })
    .nullable()
})

export const characterActionMechanicFactSchema = z.strictObject({
  invocation: actionInvocationFactSchema,
  outcomes: z
    .array(
      z.discriminatedUnion('kind', [
        actionDamageFactSchema,
        actionHealFactSchema,
        z.strictObject({
          kind: z.literal('CONDITION'),
          pathCode: identitySchema,
          conditionId: identitySchema
        }),
        z.strictObject({
          kind: z.literal('EFFECT'),
          pathCode: identitySchema,
          effectKind: identitySchema,
          label: z.string().trim().min(1).max(500).nullable()
        })
      ])
    )
    .max(1_000)
})

const actionOutcomeScalingSchema = z.strictObject({
  level: z.number().int().positive(),
  expression: z.string().trim().min(1).max(500)
})

export const characterResolvedActionMechanicSchema = z.strictObject({
  effectId: identitySchema,
  trigger: identitySchema,
  activation: z
    .strictObject({ kind: identitySchema, amount: z.number().int().positive() })
    .nullable(),
  rangeLabel: z.string().trim().min(1).max(500).nullable(),
  attackBonus: z.number().int().nullable(),
  attackRollMode: z.enum(['NORMAL', 'ADVANTAGE', 'DISADVANTAGE']).nullable(),
  save: z.strictObject({ ability: abilityCodeSchema, dc: z.number().int().nullable() }).nullable(),
  outcomes: z
    .array(
      z.discriminatedUnion('kind', [
        z.strictObject({
          kind: z.literal('DAMAGE'),
          pathCode: identitySchema,
          expression: z.string().trim().min(1).max(500),
          damageTypeId: identitySchema,
          scaling: z.array(actionOutcomeScalingSchema).max(100)
        }),
        z.strictObject({
          kind: z.literal('HEAL'),
          pathCode: identitySchema,
          expression: z.string().trim().min(1).max(500),
          temporary: z.boolean(),
          scaling: z.array(actionOutcomeScalingSchema).max(100)
        }),
        z.strictObject({
          kind: z.literal('CONDITION'),
          pathCode: identitySchema,
          conditionId: identitySchema
        }),
        z.strictObject({
          kind: z.literal('EFFECT'),
          pathCode: identitySchema,
          effectKind: identitySchema,
          label: z.string().trim().min(1).max(500).nullable()
        })
      ])
    )
    .max(1_000)
})

export const characterActionCandidatesSchema = z
  .array(
    z.strictObject({
      sequence: z.number().int().min(0).max(9_999),
      actionId: identitySchema,
      effectId: identitySchema,
      sourceId: identitySchema,
      source: characterMechanicSourceSchema,
      mechanicsOwner: actionMechanicsOwnerSchema,
      activationSourceKind: z.enum(['ACTIVE_SOURCE', 'ACTIVE_EQUIPMENT']),
      equipment: actionEquipmentStateSchema.nullable(),
      resourceUse: actionResourceUseSchema.nullable(),
      mechanicFacts: characterActionMechanicFactSchema
    })
  )
  .max(1_000)
  .superRefine((candidates, context) => {
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
      if (candidate.activationSourceKind === 'ACTIVE_EQUIPMENT' && candidate.equipment === null) {
        context.addIssue({
          code: 'custom',
          message: 'Equipment action candidates must include exact equipment state',
          path: [index, 'equipment']
        })
      }
      actionIds.add(candidate.actionId)
    }
  })

export const characterActionReasonCodeSchema = z.enum([
  'SOURCE_NOT_EQUIPPED',
  'SOURCE_NOT_ATTUNED',
  'SOURCE_REQUIREMENTS_NOT_MET',
  'RESOURCE_MISSING',
  'INSUFFICIENT_RESOURCE'
])

export const characterActionDecisionsSchema = z
  .array(
    z.strictObject({
      sequence: z.number().int().min(0).max(9_999),
      actionId: identitySchema,
      effectId: identitySchema,
      sourceId: identitySchema,
      source: characterMechanicSourceSchema,
      mechanicsOwner: actionMechanicsOwnerSchema,
      status: z.enum(['AVAILABLE', 'UNAVAILABLE']),
      reasonCode: characterActionReasonCodeSchema.nullable(),
      resourcePoolId: identitySchema.nullable(),
      resourceCost: z.number().int().min(1).max(2_147_483_647).nullable(),
      mechanic: characterResolvedActionMechanicSchema
    })
  )
  .max(1_000)
  .superRefine((decisions, context) => {
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

export type CharacterActionCandidate = z.infer<typeof characterActionCandidatesSchema>[number]
export type CharacterActionDecision = z.infer<typeof characterActionDecisionsSchema>[number]
export type CharacterResolvedActionMechanic = z.infer<typeof characterResolvedActionMechanicSchema>

export const characterActionSpellSourceSchema = z.strictObject({
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

export const characterSpellActionFactsSchema = z
  .array(
    z.strictObject({
      spellId: identitySchema,
      effects: z
        .array(
          z.strictObject({
            effectId: identitySchema,
            mechanicFacts: characterActionMechanicFactSchema
          })
        )
        .max(100)
    })
  )
  .max(1_000)
  .superRefine((spells, context) => {
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

export const characterSpellCastCandidateIdSchema = z.string().trim().min(1).max(1_000)

export const characterSpellCastCandidateSchema = z.strictObject({
  sequence: z.number().int().min(0).max(4_999),
  candidateId: characterSpellCastCandidateIdSchema,
  spellId: identitySchema,
  source: characterActionSpellSourceSchema,
  spellLevel: z.number().int().min(0).max(9),
  castMode: z.enum(['SPELL_SLOT', 'AT_WILL', 'RITUAL', 'FIXED_LEVEL', 'LIMITED_USE']),
  castLevel: z.number().int().min(0).max(9),
  baseEntry: z.boolean(),
  resourceOwnerKey: identitySchema.nullable()
})

export const characterSpellCastCandidatesSchema = z
  .array(characterSpellCastCandidateSchema)
  .max(5_000)
  .superRefine((candidates, context) => {
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

export const characterSpellCastSlotsSchema = z
  .array(
    z.strictObject({
      slotKey: identitySchema,
      label: identitySchema,
      level: z.number().int().min(1).max(9),
      max: z.number().int().min(0).max(99),
      remaining: z.number().int().min(0).max(99)
    })
  )
  .max(99)
  .superRefine((slots, context) => {
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

export const characterSpellCastReasonSchema = z.enum([
  'CANTRIP',
  'AT_WILL',
  'RITUAL',
  'FIXED_LEVEL_WITHOUT_RESOURCE',
  'RESOURCE_REMAINING',
  'RESOURCE_OWNER_MISSING',
  'RESOURCE_EXHAUSTED',
  'SPELL_SLOT_REMAINING',
  'SPELL_SLOT_EXHAUSTED',
  'NO_ELIGIBLE_SPELL_SLOT'
])

export const characterSpellCastDecisionsSchema = z
  .array(
    z.strictObject({
      candidateId: characterSpellCastCandidateIdSchema,
      status: z.enum(['AVAILABLE', 'UNAVAILABLE']),
      reasonCode: characterSpellCastReasonSchema,
      slotKey: identitySchema.nullable()
    })
  )
  .max(5_000)

const characterSpellSourceMechanicsSchema = z
  .array(
    z.strictObject({
      source: characterActionSpellSourceSchema,
      attackBonus: z.number().int().nullable(),
      saveDc: z.number().int().nullable(),
      damageBonus: z.number().finite()
    })
  )
  .max(1_000)

export const characterSpellCastMechanicsSchema = z
  .array(
    z.strictObject({
      sequence: z.number().int().min(0).max(4_999),
      candidateId: spellCandidateIdentitySchema,
      spellId: identitySchema,
      source: characterActionSpellSourceSchema,
      castLevel: z.number().int().min(0).max(9),
      mechanics: z.array(characterResolvedActionMechanicSchema).max(100)
    })
  )
  .max(5_000)
  .superRefine((mechanics, context) => {
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

export const characterSpellReferenceMechanicsSchema = z
  .array(
    z.strictObject({
      sequence: z.number().int().min(0).max(999),
      spellId: identitySchema,
      mechanics: z.array(characterResolvedActionMechanicSchema).max(100)
    })
  )
  .max(1_000)
  .superRefine((mechanics, context) => {
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

export const characterActionModelOutputSchema = z.strictObject({
  actionDecisions: characterActionDecisionsSchema,
  spellCastMechanics: characterSpellCastMechanicsSchema,
  spellReferenceMechanics: characterSpellReferenceMechanicsSchema,
  spellCastDecisions: characterSpellCastDecisionsSchema.default([])
})

export const CHARACTER_ACTION_MODEL_KEY = 'character-action-resolve'

export const characterActionModelInputSchema = z.strictObject({
  candidates: characterActionCandidatesSchema,
  spellCandidates: characterSpellCastCandidatesSchema.default([]),
  spellSlots: characterSpellCastSlotsSchema.default([]),
  spellEffects: characterSpellActionFactsSchema.default([]),
  spellMechanics: characterSpellSourceMechanicsSchema.default([]),
  activeSourceIds: z.array(identitySchema).max(10_000),
  activeEquipmentInstanceIds: z.array(identitySchema).max(1_000),
  resources: characterResourcesSchema,
  totalLevel: z.number().int().min(0).max(20),
  classLevels: z
    .array(z.strictObject({ classId: identitySchema, level: z.number().int().min(0).max(20) }))
    .max(20),
  proficiencyBonus: z.number().int(),
  abilities: z
    .array(z.strictObject({ abilityId: identitySchema, modifier: z.number().int() }))
    .max(32),
  skills: z.array(z.strictObject({ skillId: identitySchema, total: z.number().int() })).max(500),
  spellcasting: z
    .strictObject({ saveDc: z.number().int(), attackBonus: z.number().int() })
    .nullable(),
  attackRollModes: z.strictObject({
    MELEE: z.enum(['NORMAL', 'ADVANTAGE', 'DISADVANTAGE']),
    RANGED: z.enum(['NORMAL', 'ADVANTAGE', 'DISADVANTAGE']),
    SPELL: z.enum(['NORMAL', 'ADVANTAGE', 'DISADVANTAGE']),
    UNARMED: z.enum(['NORMAL', 'ADVANTAGE', 'DISADVANTAGE'])
  })
})
