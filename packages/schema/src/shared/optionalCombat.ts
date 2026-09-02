import { z } from 'zod'

import { ruleCapabilityKeyDtoSchema } from '../api/rulesRuntime.js'
import { serverUuidIdentityDtoSchema } from './rulesExecution.js'

const checksumSchema = z.string().regex(/^[a-f0-9]{64}$/)
const positiveVersionSchema = z.number().int().positive().max(10_000)
const optionalCombatGroupKeyDtoSchema = z.string().regex(/^[a-z][a-z0-9.-]{0,79}$/)
const boundedD20Schema = z.number().int().min(1).max(20)
const boundedPositiveIntegerSchema = z.number().int().positive().max(1_000_000)

/** Family-owned identity for the D&D adapter; the shared kernel never dispatches on these kinds. */
export const DND5E_OPTIONAL_COMBAT_DEFINITION_FAMILY_KEY = 'dnd5e-optional-combat' as const
/** Code-owned operation contract used by the D&D adapter; source documents only pin it. */
export const DND5E_ALTERNATING_DIAGONALS_OPERATION_KEY =
  'scene.grid.square.alternating-diagonals' as const
export const DND5E_ALTERNATING_DIAGONALS_DEFINITION_ID =
  '00000000-0000-4000-8000-0000000000f1' as const
export const DND5E_FLANKING_OPERATION_KEY = 'd20.attack.flanking-opposition' as const
export const DND5E_FLANKING_DEFINITION_ID = '00000000-0000-4000-8000-0000000000f3' as const
export const DND5E_FLANKING_PARTICIPANT_CAPABILITY_DEFINITION_ID =
  '00000000-0000-4000-8000-0000000000d5' as const
export const DND5E_FACING_OPERATION_KEY = 'scene.grid.square.facing' as const
export const DND5E_FACING_DEFINITION_ID = '00000000-0000-4000-8000-0000000000f4' as const
export const DND5E_CLIMB_ONTO_LARGER_CREATURE_OPERATION_KEY =
  'd20.action.climb-onto-larger-creature' as const
export const DND5E_CLIMB_ONTO_LARGER_CREATURE_DEFINITION_ID =
  '00000000-0000-4000-8000-0000000000f5' as const
export const DND5E_DISARM_OPERATION_KEY = 'd20.action.disarm' as const
export const DND5E_DISARM_DEFINITION_ID = '00000000-0000-4000-8000-0000000000f6' as const
export const DND5E_MARK_OPERATION_KEY = 'd20.attack.mark' as const
export const DND5E_MARK_DEFINITION_ID = '00000000-0000-4000-8000-0000000000f7' as const
export const DND5E_OVERRUN_OPERATION_KEY = 'scene.movement.overrun' as const
export const DND5E_OVERRUN_DEFINITION_ID = '00000000-0000-4000-8000-0000000000f8' as const
export const DND5E_SHOVE_ASIDE_OPERATION_KEY = 'scene.movement.shove-aside' as const
export const DND5E_SHOVE_ASIDE_DEFINITION_ID = '00000000-0000-4000-8000-0000000000f9' as const
export const DND5E_TUMBLE_OPERATION_KEY = 'scene.movement.tumble' as const
export const DND5E_TUMBLE_DEFINITION_ID = '00000000-0000-4000-8000-0000000000fa' as const
export const DND5E_HITTING_COVER_OPERATION_KEY = 'd20.attack.hitting-cover' as const
export const DND5E_HITTING_COVER_DEFINITION_ID = '00000000-0000-4000-8000-0000000000fb' as const
export const DND5E_CLEAVING_OPERATION_KEY = 'damage.outcome.cleaving' as const
export const DND5E_CLEAVING_DEFINITION_ID = '00000000-0000-4000-8000-0000000000fc' as const
export const DND5E_INJURIES_OPERATION_KEY = 'character.consequence.injuries' as const
export const DND5E_INJURIES_DEFINITION_ID = '00000000-0000-4000-8000-0000000000fd' as const
export const DND5E_MASSIVE_DAMAGE_OPERATION_KEY = 'damage.consequence.massive-damage' as const
export const DND5E_MASSIVE_DAMAGE_DEFINITION_ID = '00000000-0000-4000-8000-0000000000fe' as const
export const DND5E_MORALE_OPERATION_KEY = 'encounter.morale' as const
export const DND5E_MORALE_DEFINITION_ID = '00000000-0000-4000-8000-0000000000ff' as const

export const dnd5eOptionalCombatRuleKindDtoSchema = z.enum([
  'FLANKING',
  'ALTERNATING_DIAGONALS',
  'FACING',
  'CLIMB_ONTO_LARGER_CREATURE',
  'DISARM',
  'MARK',
  'OVERRUN',
  'SHOVE_ASIDE',
  'TUMBLE',
  'HITTING_COVER',
  'CLEAVING',
  'INJURIES',
  'MASSIVE_DAMAGE',
  'MORALE'
])

export const optionalCombatModulePinDtoSchema = z.strictObject({
  policyModuleKey: ruleCapabilityKeyDtoSchema,
  contractVersion: positiveVersionSchema
})

const dnd5eOptionalCombatOperationTargetDtoSchema = z.enum(['SUBJECT', 'GROUP'])
const dnd5eOptionalCombatOperationDurationDtoSchema = z.enum([
  'PERMANENT',
  'UNTIL_END_OF_NEXT_TURN',
  'UNTIL_CLEARED'
])

const dnd5eOptionalCombatCheckEffectDtoSchema = z.discriminatedUnion('effect', [
  z.strictObject({ effect: z.literal('RETAIN_INJURY') }),
  z.strictObject({ effect: z.literal('ALLOW_ATTEMPTED_COMBAT_ACTION') }),
  z.strictObject({ effect: z.literal('DENY_AND_LOSE_ATTEMPTED_COMBAT_ACTION') }),
  z.strictObject({
    effect: z.literal('SET_REACTION_AVAILABILITY'),
    available: z.literal(false),
    duration: z.literal('UNTIL_START_OF_NEXT_TURN')
  })
])
export const dnd5eOptionalCombatOperationDtoSchema = z.discriminatedUnion('primitive', [
  z.strictObject({
    id: serverUuidIdentityDtoSchema,
    primitive: z.literal('SET_HIT_POINTS'),
    target: z.literal('SUBJECT'),
    value: z.number().int().max(0),
    duration: z.null()
  }),
  z.strictObject({
    id: serverUuidIdentityDtoSchema,
    primitive: z.literal('SET_STABLE'),
    target: z.literal('SUBJECT'),
    duration: z.null()
  }),
  z.strictObject({
    id: serverUuidIdentityDtoSchema,
    primitive: z.literal('APPLY_CONDITION'),
    target: z.literal('SUBJECT'),
    conditionDefinitionId: serverUuidIdentityDtoSchema,
    duration: dnd5eOptionalCombatOperationDurationDtoSchema
  }),
  z.strictObject({
    id: serverUuidIdentityDtoSchema,
    primitive: z.literal('SET_REACTION_AVAILABILITY'),
    target: z.literal('SUBJECT'),
    available: z.literal(false),
    duration: z.literal('UNTIL_END_OF_NEXT_TURN')
  }),
  z.strictObject({
    id: serverUuidIdentityDtoSchema,
    primitive: z.literal('APPLY_ROLL_MODE'),
    target: z.literal('SUBJECT'),
    rollMode: z.literal('DISADVANTAGE'),
    rollContexts: z
      .array(z.enum(['ATTACK_ROLL', 'ABILITY_CHECK', 'SAVING_THROW']))
      .min(1)
      .max(3),
    duration: dnd5eOptionalCombatOperationDurationDtoSchema
  }),
  z.strictObject({
    id: serverUuidIdentityDtoSchema,
    primitive: z.literal('CREATE_INJURY_RECORD'),
    target: z.literal('SUBJECT'),
    injuryDefinitionId: serverUuidIdentityDtoSchema,
    duration: z.enum(['PERMANENT', 'UNTIL_CLEARED'])
  }),
  z.strictObject({
    id: serverUuidIdentityDtoSchema,
    primitive: z.literal('APPLY_RESTRICTION'),
    target: z.literal('SUBJECT'),
    restrictionDefinitionId: serverUuidIdentityDtoSchema,
    duration: dnd5eOptionalCombatOperationDurationDtoSchema
  }),
  z.strictObject({
    id: serverUuidIdentityDtoSchema,
    primitive: z.literal('APPLY_MODIFIER'),
    target: z.literal('SUBJECT'),
    modifierDefinitionId: serverUuidIdentityDtoSchema,
    value: z.number().int().min(-1_000_000).max(1_000_000),
    duration: dnd5eOptionalCombatOperationDurationDtoSchema
  }),
  z.strictObject({
    id: serverUuidIdentityDtoSchema,
    primitive: z.literal('SCHEDULE_PERIODIC_EFFECT'),
    target: z.literal('SUBJECT'),
    effectDefinitionId: serverUuidIdentityDtoSchema,
    cadence: z.enum(['DAILY', 'REST']),
    duration: z.enum(['PERMANENT', 'UNTIL_CLEARED'])
  }),
  z
    .strictObject({
      id: serverUuidIdentityDtoSchema,
      primitive: z.literal('REQUIRE_CHECK'),
      target: z.literal('SUBJECT'),
      abilityDefinitionId: serverUuidIdentityDtoSchema,
      difficultyClass: boundedPositiveIntegerSchema.max(100),
      trigger: z.literal('BEFORE_COMBAT_ACTION'),
      successEffects: z.array(dnd5eOptionalCombatCheckEffectDtoSchema).length(2),
      failureEffects: z.array(dnd5eOptionalCombatCheckEffectDtoSchema).length(3)
    })
    .superRefine((operation, context) => {
      const effects = (items: readonly { readonly effect: string }[]) =>
        items.map((item) => item.effect).sort()
      if (
        effects(operation.successEffects).join('|') !==
          'ALLOW_ATTEMPTED_COMBAT_ACTION|RETAIN_INJURY' ||
        effects(operation.failureEffects).join('|') !==
          'DENY_AND_LOSE_ATTEMPTED_COMBAT_ACTION|RETAIN_INJURY|SET_REACTION_AVAILABILITY'
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['failureEffects'],
          message: 'Combat-action checks require their exact closed success and failure effects.'
        })
      }
    }),
  z.strictObject({
    id: serverUuidIdentityDtoSchema,
    primitive: z.literal('JUDGMENT_REQUIRED'),
    target: dnd5eOptionalCombatOperationTargetDtoSchema,
    reason: z.enum(['UNNORMALIZED_INJURY_CONSEQUENCE', 'UNNORMALIZED_RECOVERY'])
  }),
  z.strictObject({
    id: serverUuidIdentityDtoSchema,
    primitive: z.literal('SET_MORALE_DISPOSITION'),
    target: dnd5eOptionalCombatOperationTargetDtoSchema,
    disposition: z.enum(['CONTINUE', 'FLEE', 'SURRENDER']),
    duration: z.null()
  })
])

const dnd5eOptionalCombatOutcomeDescriptorDtoSchema = z.strictObject({
  id: serverUuidIdentityDtoSchema,
  kind: z.enum([
    'REACTIONS_SUPPRESSED_UNTIL_END_OF_NEXT_TURN',
    'DROP_TO_ZERO',
    'STABLE_AT_ZERO',
    'STUNNED_UNTIL_END_OF_NEXT_TURN',
    'IMPAIRED_UNTIL_END_OF_NEXT_TURN',
    'LOSE_EYE',
    'LOSE_ARM_OR_HAND',
    'LOSE_FOOT_OR_LEG',
    'LIMP',
    'INTERNAL_INJURY',
    'BROKEN_RIBS',
    'HORRIBLE_SCAR',
    'FESTERING_WOUND',
    'MINOR_SCAR',
    'CONTINUE',
    'FLEE',
    'SURRENDER'
  ]),
  operations: z.array(dnd5eOptionalCombatOperationDtoSchema).min(1).max(8)
})

const dnd5eOptionalCombatRecoveryDescriptorDtoSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    id: serverUuidIdentityDtoSchema,
    kind: z.literal('NONE'),
    operations: z.array(dnd5eOptionalCombatOperationDtoSchema).length(0)
  }),
  z.strictObject({
    id: serverUuidIdentityDtoSchema,
    kind: z.enum([
      'MAGICAL_RESTORATION',
      'MEDICAL_TREATMENT',
      'NATURAL_HEALING',
      'JUDGMENT_REQUIRED'
    ]),
    operations: z.array(dnd5eOptionalCombatOperationDtoSchema).min(1).max(4)
  })
])

const dnd5eOptionalCombatBandDtoSchema = z
  .strictObject({
    minimum: boundedD20Schema,
    maximum: boundedD20Schema,
    outcome: dnd5eOptionalCombatOutcomeDescriptorDtoSchema,
    recovery: dnd5eOptionalCombatRecoveryDescriptorDtoSchema.nullable()
  })
  .superRefine((band, context) => {
    if (band.minimum > band.maximum) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['maximum'],
        message: 'Optional combat outcome band maximum must not precede its minimum.'
      })
    }
  })

const dnd5eOptionalCombatBandsDtoSchema = z
  .array(dnd5eOptionalCombatBandDtoSchema)
  .min(1)
  .max(20)
  .superRefine((bands, context) => {
    let previousMaximum = 0
    const outcomeIds = new Set<string>()
    const recoveryIds = new Set<string>()
    for (const [index, band] of bands.entries()) {
      if (band.minimum <= previousMaximum) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, 'minimum'],
          message: 'Optional combat outcome bands must be ordered and non-overlapping.'
        })
      }
      if (outcomeIds.has(band.outcome.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, 'outcome', 'id'],
          message: 'Optional combat outcome identities must be unique.'
        })
      }
      if (band.recovery !== null && recoveryIds.has(band.recovery.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, 'recovery', 'id'],
          message: 'Optional combat recovery identities must be unique.'
        })
      }
      outcomeIds.add(band.outcome.id)
      if (band.recovery !== null) recoveryIds.add(band.recovery.id)
      previousMaximum = band.maximum
    }
  })

/**
 * Each supported D&D optional-rule kind has a closed parameter arm. The policy
 * module owns interpretation; authoring cannot supply an arbitrary parameter map.
 */
const boundedCheckDefinitionChoicesSchema = z
  .array(serverUuidIdentityDtoSchema)
  .min(1)
  .max(4)
  .superRefine((definitionIds, context) => {
    const seen = new Set<string>()
    definitionIds.forEach((definitionId, index) => {
      if (seen.has(definitionId)) {
        context.addIssue({
          code: 'custom',
          path: [index],
          message: 'Optional combat check-definition choices must be unique.'
        })
      }
      seen.add(definitionId)
    })
  })

export const dnd5eOptionalCombatRuleParametersDtoSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('FLANKING'),
    participantCapabilityDefinitionId: serverUuidIdentityDtoSchema
  }),
  z.strictObject({ kind: z.literal('ALTERNATING_DIAGONALS') }),
  z.strictObject({ kind: z.literal('FACING') }),
  z.strictObject({ kind: z.literal('CLIMB_ONTO_LARGER_CREATURE') }),
  z.strictObject({
    kind: z.literal('DISARM'),
    defenderCheckDefinitionIds: boundedCheckDefinitionChoicesSchema
  }),
  z.strictObject({ kind: z.literal('MARK') }),
  z.strictObject({
    kind: z.literal('OVERRUN'),
    initiatorCheckDefinitionId: serverUuidIdentityDtoSchema,
    targetCheckDefinitionId: serverUuidIdentityDtoSchema
  }),
  z.strictObject({
    kind: z.literal('SHOVE_ASIDE'),
    initiatorCheckDefinitionId: serverUuidIdentityDtoSchema,
    defenderCheckDefinitionIds: boundedCheckDefinitionChoicesSchema
  }),
  z.strictObject({
    kind: z.literal('TUMBLE'),
    initiatorCheckDefinitionId: serverUuidIdentityDtoSchema,
    targetCheckDefinitionId: serverUuidIdentityDtoSchema
  }),
  z.strictObject({
    kind: z.literal('HITTING_COVER'),
    qualifyingAttackKind: z.literal('RANGED'),
    redirectCoverProviderKinds: z.array(z.literal('CREATURE')).length(1),
    redirectRequiresStrictAttackTotalOverProviderArmorClass: z.literal(true)
  }),
  z.strictObject({
    kind: z.literal('CLEAVING'),
    qualifyingAttackKind: z.literal('MELEE'),
    requiresUndamagedInitialTarget: z.literal(true)
  }),
  z.strictObject({
    kind: z.literal('INJURIES'),
    triggerKinds: z
      .array(z.enum(['CRITICAL_HIT', 'DROP_TO_ZERO', 'FAIL_DEATH_SAVE_BY_FIVE_OR_MORE']))
      .min(1)
      .max(3),
    bands: dnd5eOptionalCombatBandsDtoSchema
  }),
  z.strictObject({
    kind: z.literal('MASSIVE_DAMAGE'),
    threshold: z.strictObject({
      numerator: boundedPositiveIntegerSchema,
      denominator: boundedPositiveIntegerSchema
    }),
    savingThrowAbilityDefinitionId: serverUuidIdentityDtoSchema,
    savingThrowDifficultyClass: boundedPositiveIntegerSchema.max(100),
    bands: dnd5eOptionalCombatBandsDtoSchema
  }),
  z.strictObject({
    kind: z.literal('MORALE'),
    triggerKinds: z
      .array(
        z.enum([
          'INDIVIDUAL_SURPRISED',
          'INDIVIDUAL_REDUCED_TO_HALF',
          'INDIVIDUAL_CANNOT_HARM_OPPOSITION',
          'GROUP_SURPRISED',
          'GROUP_HALF_REMOVED',
          'GROUP_LEADER_REMOVED',
          'GROUP_LEADER_INCAPACITATED',
          'GROUP_LEADER_TAKEN_PRISONER'
        ])
      )
      .min(1)
      .max(9),
    savingThrowAbilityDefinitionId: serverUuidIdentityDtoSchema,
    savingThrowDifficultyClass: boundedPositiveIntegerSchema.max(100),
    requiresGroupLeaderOrFallback: z.literal(true),
    overwhelmingOpposition: z.strictObject({
      rollMode: z.enum(['NORMAL', 'DISADVANTAGE']),
      automaticFailure: z.boolean()
    }),
    individualOutcomes: z
      .array(dnd5eOptionalCombatOutcomeDescriptorDtoSchema)
      .length(3)
      .superRefine((outcomes, context) => {
        const kinds = outcomes.map((outcome) => outcome.kind).sort()
        if (kinds.join('|') !== 'CONTINUE|FLEE|SURRENDER') {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Morale definitions must supply Continue, Flee, and Surrender outcomes.'
          })
        }
      }),
    groupOutcomes: z
      .array(dnd5eOptionalCombatOutcomeDescriptorDtoSchema)
      .length(3)
      .superRefine((outcomes, context) => {
        const kinds = outcomes.map((outcome) => outcome.kind).sort()
        if (kinds.join('|') !== 'CONTINUE|FLEE|SURRENDER') {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Morale definitions must supply Continue, Flee, and Surrender outcomes.'
          })
        }
      })
  })
])

/**
 * A System-owned adapter document. It deliberately contains no rendered text,
 * execution graph body, or free-form configuration: the policy module key/version
 * is the only later execution seam at this foundation stage.
 */
export const dnd5eOptionalCombatReusableDefinitionDocumentDtoSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    kind: dnd5eOptionalCombatRuleKindDtoSchema,
    id: serverUuidIdentityDtoSchema,
    gameSystemId: serverUuidIdentityDtoSchema,
    module: optionalCombatModulePinDtoSchema,
    parameters: dnd5eOptionalCombatRuleParametersDtoSchema,
    mutuallyExclusiveGroup: optionalCombatGroupKeyDtoSchema.nullable()
  })
  .superRefine((document, context) => {
    if (document.kind !== document.parameters.kind) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['parameters', 'kind'],
        message: 'Optional combat definition parameters must match the definition kind.'
      })
    }
  })

export const optionalCombatDefinitionSnapshotDtoSchema = z.strictObject({
  definitionId: serverUuidIdentityDtoSchema,
  contentSourceId: serverUuidIdentityDtoSchema,
  definitionVersion: positiveVersionSchema,
  definitionChecksum: checksumSchema,
  contractVersion: positiveVersionSchema,
  label: z.string().trim().min(1).max(160),
  document: dnd5eOptionalCombatReusableDefinitionDocumentDtoSchema
})

export const encounterOptionalCombatSnapshotDtoSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    gameSystemId: serverUuidIdentityDtoSchema,
    definitions: z.array(optionalCombatDefinitionSnapshotDtoSchema).max(14)
  })
  .superRefine((snapshot, context) => {
    const definitionIds = new Set<string>()
    const kinds = new Set<string>()
    const groups = new Set<string>()
    for (const [index, definition] of snapshot.definitions.entries()) {
      if (definition.document.id !== definition.definitionId) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['definitions', index, 'document', 'id'],
          message: 'Optional combat snapshot definition identity must match its document.'
        })
      }
      if (definition.document.gameSystemId !== snapshot.gameSystemId) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['definitions', index, 'document', 'gameSystemId'],
          message: 'Optional combat snapshot definitions must use the Encounter Game System.'
        })
      }
      if (definitionIds.has(definition.definitionId) || kinds.has(definition.document.kind)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['definitions', index],
          message: 'Optional combat snapshots cannot contain duplicate definitions or kinds.'
        })
      }
      const group = definition.document.mutuallyExclusiveGroup
      if (group !== null && groups.has(group)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['definitions', index, 'document', 'mutuallyExclusiveGroup'],
          message: 'Optional combat snapshots cannot contain conflicting definition groups.'
        })
      }
      definitionIds.add(definition.definitionId)
      kinds.add(definition.document.kind)
      if (group !== null) groups.add(group)
    }
  })

export const encounterOptionalCombatSummaryDtoSchema = z.strictObject({
  definitionId: serverUuidIdentityDtoSchema,
  label: z.string().trim().min(1).max(160),
  kind: dnd5eOptionalCombatRuleKindDtoSchema
})

export function activeOptionalCombatDefinitions(input: {
  automationMode: 'AUTOMATIC' | 'ASSISTED' | 'MANUAL'
  snapshot: z.infer<typeof encounterOptionalCombatSnapshotDtoSchema> | null
}) {
  return input.automationMode === 'MANUAL' || input.snapshot === null
    ? []
    : input.snapshot.definitions
}

export type Dnd5eOptionalCombatRuleKindDto = z.infer<typeof dnd5eOptionalCombatRuleKindDtoSchema>
export type Dnd5eOptionalCombatOperationDto = z.infer<typeof dnd5eOptionalCombatOperationDtoSchema>
export type Dnd5eOptionalCombatOutcomeDescriptorDto = z.infer<
  typeof dnd5eOptionalCombatOutcomeDescriptorDtoSchema
>
export type Dnd5eOptionalCombatRecoveryDescriptorDto = z.infer<
  typeof dnd5eOptionalCombatRecoveryDescriptorDtoSchema
>
export type Dnd5eOptionalCombatReusableDefinitionDocumentDto = z.infer<
  typeof dnd5eOptionalCombatReusableDefinitionDocumentDtoSchema
>
export type EncounterOptionalCombatSnapshotDto = z.infer<
  typeof encounterOptionalCombatSnapshotDtoSchema
>
