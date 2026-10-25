import { FACING_ARCS, type FacingArc } from '@artificer-toolkit/shared/vtt/facingArc'

import { z, lazySchema } from '../zod.js'

import type { AutomationModeDto } from '../api/campaignSettings.js'
import { ruleCapabilityKeyDtoSchema } from '../api/rulesRuntime.js'
import { consequenceRollTriggersDtoSchema } from './consequenceRolls.js'
import { postgresUuidSchema as serverUuidIdentityDtoSchema } from './postgresUuid.js'
import { systemCoreCodeSchema } from './systemCoreCode.js'
import { dnd5eOptionalCombatRuleKindDtoSchema } from './reusableDefinitionIdentity.js'
export { dnd5eOptionalCombatRuleKindDtoSchema }
export { DND5E_OPTIONAL_COMBAT_DEFINITION_FAMILY_KEY } from './reusableDefinitionIdentity.js'

const checksumSchema = lazySchema(() => z.string().check(z.regex(/^[a-f0-9]{64}$/)))
const positiveVersionSchema = lazySchema(() =>
  z.number().check(z.int()).check(z.positive()).check(z.lte(10_000))
)
const optionalCombatGroupKeyDtoSchema = lazySchema(() =>
  z.string().check(z.regex(/^[a-z][a-z0-9.-]{0,79}$/))
)
const boundedD20Schema = lazySchema(() =>
  z.number().check(z.int()).check(z.gte(1)).check(z.lte(20))
)
const boundedPositiveIntegerSchema = lazySchema(() =>
  z.number().check(z.int()).check(z.positive()).check(z.lte(1_000_000))
)
export const moraleTriggerKindDtoSchema = lazySchema(() =>
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
export const moraleDispositionDtoSchema = lazySchema(() =>
  z.enum(['CONTINUE', 'FLEE', 'SURRENDER'])
)

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

export const optionalCombatModulePinDtoSchema = lazySchema(() =>
  z.strictObject({
    policyModuleKey: ruleCapabilityKeyDtoSchema,
    contractVersion: positiveVersionSchema
  })
)

export const dnd5eOptionalCombatOperationTargetDtoSchema = lazySchema(() =>
  z.enum(['SUBJECT', 'GROUP'])
)
const dnd5eOptionalCombatOperationDurationDtoSchema = lazySchema(() =>
  z.enum(['PERMANENT', 'UNTIL_END_OF_NEXT_TURN', 'UNTIL_CLEARED'])
)

const dnd5eOptionalCombatCheckEffectDtoSchema = lazySchema(() =>
  z.discriminatedUnion('effect', [
    z.strictObject({ effect: z.literal('RETAIN_INJURY') }),
    z.strictObject({ effect: z.literal('ALLOW_ATTEMPTED_COMBAT_ACTION') }),
    z.strictObject({ effect: z.literal('DENY_AND_LOSE_ATTEMPTED_COMBAT_ACTION') }),
    z.strictObject({
      effect: z.literal('SET_REACTION_AVAILABILITY'),
      available: z.literal(false),
      duration: z.literal('UNTIL_START_OF_NEXT_TURN')
    })
  ])
)
export const dnd5eOptionalCombatOperationDtoSchema = lazySchema(() =>
  z.discriminatedUnion('primitive', [
    z.strictObject({
      id: serverUuidIdentityDtoSchema,
      primitive: z.literal('SET_HIT_POINTS'),
      target: z.literal('SUBJECT'),
      value: z.number().check(z.int()).check(z.lte(0)),
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
        .check(z.minLength(1))
        .check(z.maxLength(3)),
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
      value: z.number().check(z.int()).check(z.gte(-1_000_000)).check(z.lte(1_000_000)),
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
        difficultyClass: boundedPositiveIntegerSchema.check(z.lte(100)),
        trigger: z.literal('BEFORE_COMBAT_ACTION'),
        successEffects: z.array(dnd5eOptionalCombatCheckEffectDtoSchema).check(z.length(2)),
        failureEffects: z.array(dnd5eOptionalCombatCheckEffectDtoSchema).check(z.length(3))
      })
      .check(
        z.superRefine((operation, context) => {
          const effects = (items: readonly { readonly effect: string }[]) =>
            items.map((item) => item.effect).sort()
          if (
            effects(operation.successEffects).join('|') !==
              'ALLOW_ATTEMPTED_COMBAT_ACTION|RETAIN_INJURY' ||
            effects(operation.failureEffects).join('|') !==
              'DENY_AND_LOSE_ATTEMPTED_COMBAT_ACTION|RETAIN_INJURY|SET_REACTION_AVAILABILITY'
          ) {
            context.addIssue({
              code: 'custom',
              path: ['failureEffects'],
              message:
                'Combat-action checks require their exact closed success and failure effects.'
            })
          }
        })
      ),
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
      disposition: moraleDispositionDtoSchema,
      duration: z.null()
    })
  ])
)

const dnd5eOptionalCombatOutcomeDescriptorDtoSchema = lazySchema(() =>
  z.strictObject({
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
    operations: z
      .array(dnd5eOptionalCombatOperationDtoSchema)
      .check(z.minLength(1))
      .check(z.maxLength(8))
  })
)

const dnd5eOptionalCombatRecoveryDescriptorDtoSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.strictObject({
      id: serverUuidIdentityDtoSchema,
      kind: z.literal('NONE'),
      operations: z.array(dnd5eOptionalCombatOperationDtoSchema).check(z.length(0))
    }),
    z.strictObject({
      id: serverUuidIdentityDtoSchema,
      kind: z.enum([
        'MAGICAL_RESTORATION',
        'MEDICAL_TREATMENT',
        'NATURAL_HEALING',
        'JUDGMENT_REQUIRED'
      ]),
      operations: z
        .array(dnd5eOptionalCombatOperationDtoSchema)
        .check(z.minLength(1))
        .check(z.maxLength(4))
    })
  ])
)

const dnd5eOptionalCombatBandDtoSchema = lazySchema(() =>
  z
    .strictObject({
      minimum: boundedD20Schema,
      maximum: boundedD20Schema,
      outcome: dnd5eOptionalCombatOutcomeDescriptorDtoSchema,
      recovery: z.nullable(dnd5eOptionalCombatRecoveryDescriptorDtoSchema)
    })
    .check(
      z.superRefine((band, context) => {
        if (band.minimum > band.maximum) {
          context.addIssue({
            code: 'custom',
            path: ['maximum'],
            message: 'Optional combat outcome band maximum must not precede its minimum.'
          })
        }
      })
    )
)

const dnd5eOptionalCombatBandsDtoSchema = lazySchema(() =>
  z
    .array(dnd5eOptionalCombatBandDtoSchema)
    .check(z.minLength(1))
    .check(z.maxLength(20))
    .check(
      z.superRefine((bands, context) => {
        let previousMaximum = 0
        const outcomeIds = new Set<string>()
        const recoveryIds = new Set<string>()
        for (const [index, band] of bands.entries()) {
          if (band.minimum <= previousMaximum) {
            context.addIssue({
              code: 'custom',
              path: [index, 'minimum'],
              message: 'Optional combat outcome bands must be ordered and non-overlapping.'
            })
          }
          if (outcomeIds.has(band.outcome.id)) {
            context.addIssue({
              code: 'custom',
              path: [index, 'outcome', 'id'],
              message: 'Optional combat outcome identities must be unique.'
            })
          }
          if (band.recovery !== null && recoveryIds.has(band.recovery.id)) {
            context.addIssue({
              code: 'custom',
              path: [index, 'recovery', 'id'],
              message: 'Optional combat recovery identities must be unique.'
            })
          }
          outcomeIds.add(band.outcome.id)
          if (band.recovery !== null) recoveryIds.add(band.recovery.id)
          previousMaximum = band.maximum
        }
      })
    )
)

/**
 * Each supported D&D optional-rule kind has a closed parameter arm. The policy
 * module owns interpretation; authoring cannot supply an arbitrary parameter map.
 */
const boundedCheckDefinitionChoicesSchema = lazySchema(() =>
  z
    .array(serverUuidIdentityDtoSchema)
    .check(z.minLength(1))
    .check(z.maxLength(4))
    .check(
      z.superRefine((definitionIds, context) => {
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
    )
)

const facingArcDtoSchema = lazySchema(() => z.enum(FACING_ARCS))

function uniqueFacingArcs<T>(arcOf: (entry: T) => FacingArc) {
  return z.superRefine<T[]>((entries, context) => {
    if (new Set(entries.map(arcOf)).size !== entries.length)
      context.addIssue({ code: 'custom', message: 'Facing arcs must be unique.' })
  })
}

/**
 * Clockwise offsets from a token's facing. The arcs tile the full circle without overlap, so every
 * direction belongs to exactly one arc; a direction on a shared edge belongs to the arc nearer the front.
 */
const facingArcTableDtoSchema = lazySchema(() =>
  z
    .array(
      z
        .strictObject({
          arc: facingArcDtoSchema,
          fromDegrees: z.number().check(z.int()).check(z.gte(-360)).check(z.lt(360)),
          toDegrees: z.number().check(z.int()).check(z.gt(-360)).check(z.lte(720))
        })
        .check(
          z.superRefine((range, context) => {
            if (range.toDegrees <= range.fromDegrees || range.toDegrees - range.fromDegrees > 360)
              context.addIssue({
                code: 'custom',
                message: 'A facing arc spans more than zero and at most 360 degrees.'
              })
          })
        )
    )
    .check(z.minLength(1))
    .check(z.maxLength(FACING_ARCS.length))
    .check(uniqueFacingArcs((range) => range.arc))
    .check(
      z.superRefine((arcs, context) => {
        const wrap = (degrees: number) => ((degrees % 360) + 360) % 360
        const ordered = [...arcs].sort(
          (left, right) => wrap(left.fromDegrees) - wrap(right.fromDegrees)
        )
        const span = ordered.reduce(
          (total, range) => total + range.toDegrees - range.fromDegrees,
          0
        )
        const contiguous = ordered.every(
          (range, index) =>
            wrap(range.toDegrees) === wrap(ordered[(index + 1) % ordered.length]!.fromDegrees)
        )
        if (span !== 360 || !contiguous)
          context.addIssue({
            code: 'custom',
            message: 'Facing arcs must cover the full circle without gaps or overlap.'
          })
      })
    )
)

export const dnd5eOptionalCombatRuleParametersDtoSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.strictObject({
      kind: z.literal('FLANKING'),
      participantCapabilityDefinitionId: serverUuidIdentityDtoSchema
    }),
    z.strictObject({ kind: z.literal('ALTERNATING_DIAGONALS') }),
    z.strictObject({
      kind: z.literal('FACING'),
      /** A facing is a whole multiple of this step from north; it divides 360. */
      facingStepDegrees: z
        .number()
        .check(z.int())
        .check(z.positive())
        .check(z.lte(360))
        .check(
          z.superRefine((step, context) => {
            if (360 % step !== 0)
              context.addIssue({
                code: 'custom',
                message: 'A facing step must divide 360 degrees.'
              })
          })
        ),
      arcs: facingArcTableDtoSchema,
      attackerInTargetArc: z
        .array(z.strictObject({ arc: facingArcDtoSchema, influence: systemCoreCodeSchema }))
        .check(z.maxLength(FACING_ARCS.length))
        .check(uniqueFacingArcs((entry) => entry.arc)),
      sourceCannotTargetInOwnArcs: z
        .array(facingArcDtoSchema)
        .check(z.maxLength(FACING_ARCS.length))
        .check(uniqueFacingArcs((arc) => arc))
    }),
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
      redirectCoverProviderKinds: z.array(z.literal('CREATURE')).check(z.length(1)),
      redirectRequiresStrictAttackTotalOverProviderArmorClass: z.literal(true)
    }),
    z.strictObject({
      kind: z.literal('CLEAVING'),
      qualifyingAttackKind: z.literal('MELEE'),
      requiresUndamagedInitialTarget: z.literal(true)
    }),
    z.strictObject({
      kind: z.literal('INJURIES'),
      triggers: consequenceRollTriggersDtoSchema,
      bands: dnd5eOptionalCombatBandsDtoSchema
    }),
    z.strictObject({
      kind: z.literal('MASSIVE_DAMAGE'),
      threshold: z.strictObject({
        numerator: boundedPositiveIntegerSchema,
        denominator: boundedPositiveIntegerSchema
      }),
      savingThrowAbilityDefinitionId: serverUuidIdentityDtoSchema,
      savingThrowDifficultyClass: boundedPositiveIntegerSchema.check(z.lte(100)),
      bands: dnd5eOptionalCombatBandsDtoSchema
    }),
    z.strictObject({
      kind: z.literal('MORALE'),
      triggerKinds: z.array(moraleTriggerKindDtoSchema).check(z.minLength(1)).check(z.maxLength(9)),
      savingThrowAbilityDefinitionId: serverUuidIdentityDtoSchema,
      savingThrowDifficultyClass: boundedPositiveIntegerSchema.check(z.lte(100)),
      requiresGroupLeaderOrFallback: z.literal(true),
      overwhelmingOpposition: z.strictObject({
        rollMode: z.enum(['NORMAL', 'DISADVANTAGE']),
        automaticFailure: z.boolean()
      }),
      individualOutcomes: z
        .array(dnd5eOptionalCombatOutcomeDescriptorDtoSchema)
        .check(z.length(3))
        .check(
          z.superRefine((outcomes, context) => {
            const kinds = outcomes.map((outcome) => outcome.kind).sort()
            if (kinds.join('|') !== 'CONTINUE|FLEE|SURRENDER') {
              context.addIssue({
                code: 'custom',
                message: 'Morale definitions must supply Continue, Flee, and Surrender outcomes.'
              })
            }
          })
        ),
      groupOutcomes: z
        .array(dnd5eOptionalCombatOutcomeDescriptorDtoSchema)
        .check(z.length(3))
        .check(
          z.superRefine((outcomes, context) => {
            const kinds = outcomes.map((outcome) => outcome.kind).sort()
            if (kinds.join('|') !== 'CONTINUE|FLEE|SURRENDER') {
              context.addIssue({
                code: 'custom',
                message: 'Morale definitions must supply Continue, Flee, and Surrender outcomes.'
              })
            }
          })
        )
    })
  ])
)

/**
 * A System-owned adapter document. It deliberately contains no rendered text,
 * execution graph body, or free-form configuration: the policy module key/version
 * is the only later execution seam at this foundation stage.
 */
export const dnd5eOptionalCombatReusableDefinitionDocumentDtoSchema = lazySchema(() =>
  z
    .strictObject({
      schemaVersion: z.literal(1),
      kind: dnd5eOptionalCombatRuleKindDtoSchema,
      id: serverUuidIdentityDtoSchema,
      gameSystemId: serverUuidIdentityDtoSchema,
      module: optionalCombatModulePinDtoSchema,
      parameters: dnd5eOptionalCombatRuleParametersDtoSchema,
      mutuallyExclusiveGroup: z.nullable(optionalCombatGroupKeyDtoSchema)
    })
    .check(
      z.superRefine((document, context) => {
        if (document.kind !== document.parameters.kind) {
          context.addIssue({
            code: 'custom',
            path: ['parameters', 'kind'],
            message: 'Optional combat definition parameters must match the definition kind.'
          })
        }
      })
    )
)

export const optionalCombatDefinitionSnapshotDtoSchema = lazySchema(() =>
  z.strictObject({
    definitionId: serverUuidIdentityDtoSchema,
    contentSourceId: serverUuidIdentityDtoSchema,
    definitionVersion: positiveVersionSchema,
    definitionChecksum: checksumSchema,
    contractVersion: positiveVersionSchema,
    label: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(160)),
    document: dnd5eOptionalCombatReusableDefinitionDocumentDtoSchema
  })
)

export const encounterOptionalCombatSnapshotDtoSchema = lazySchema(() =>
  z
    .strictObject({
      schemaVersion: z.literal(1),
      gameSystemId: serverUuidIdentityDtoSchema,
      definitions: z.array(optionalCombatDefinitionSnapshotDtoSchema).check(z.maxLength(14))
    })
    .check(
      z.superRefine((snapshot, context) => {
        const definitionIds = new Set<string>()
        const kinds = new Set<string>()
        const groups = new Set<string>()
        for (const [index, definition] of snapshot.definitions.entries()) {
          if (definition.document.id !== definition.definitionId) {
            context.addIssue({
              code: 'custom',
              path: ['definitions', index, 'document', 'id'],
              message: 'Optional combat snapshot definition identity must match its document.'
            })
          }
          if (definition.document.gameSystemId !== snapshot.gameSystemId) {
            context.addIssue({
              code: 'custom',
              path: ['definitions', index, 'document', 'gameSystemId'],
              message: 'Optional combat snapshot definitions must use the Encounter Game System.'
            })
          }
          if (definitionIds.has(definition.definitionId) || kinds.has(definition.document.kind)) {
            context.addIssue({
              code: 'custom',
              path: ['definitions', index],
              message: 'Optional combat snapshots cannot contain duplicate definitions or kinds.'
            })
          }
          const group = definition.document.mutuallyExclusiveGroup
          if (group !== null && groups.has(group)) {
            context.addIssue({
              code: 'custom',
              path: ['definitions', index, 'document', 'mutuallyExclusiveGroup'],
              message: 'Optional combat snapshots cannot contain conflicting definition groups.'
            })
          }
          definitionIds.add(definition.definitionId)
          kinds.add(definition.document.kind)
          if (group !== null) groups.add(group)
        }
      })
    )
)

export const encounterOptionalCombatSummaryDtoSchema = lazySchema(() =>
  z.strictObject({
    definitionId: serverUuidIdentityDtoSchema,
    label: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(160)),
    kind: dnd5eOptionalCombatRuleKindDtoSchema
  })
)

export function activeOptionalCombatDefinitions(input: {
  automationMode: AutomationModeDto
  snapshot: z.infer<typeof encounterOptionalCombatSnapshotDtoSchema> | null
}) {
  return input.automationMode === 'MANUAL' || input.snapshot === null
    ? []
    : input.snapshot.definitions
}

export type Dnd5eOptionalCombatRuleKindDto = z.infer<typeof dnd5eOptionalCombatRuleKindDtoSchema>
export type MoraleTriggerKindDto = z.infer<typeof moraleTriggerKindDtoSchema>
export type MoraleDispositionDto = z.infer<typeof moraleDispositionDtoSchema>
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

/** Server-only snapshot facts consumed by an installed System's Scene-grid policy. */
export interface EncounterOptionalCombatPolicyFacts {
  gameSystemId: string
  automationMode: Parameters<typeof activeOptionalCombatDefinitions>[0]['automationMode']
  optionalCombatSnapshot?: EncounterOptionalCombatSnapshotDto | null
  optionalCombatSnapshotChecksum?: string | null
}
