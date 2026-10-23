import { z, lazySchema } from '../zod.js'

import { RULE_GRAPH_LIMITS } from '@artificer-toolkit/shared/rules/contracts'

import { combatPerceptionRequirementDtoSchema } from './combatPerception.js'
import {
  abilityModifierReferenceSchema,
  pathLifecycleEndTriggerAgainstSchema,
  pathLifecycleEndTriggerOfSchema,
  pathLifecycleEndTriggerBySchema
} from './enums.js'
import { postgresUuidSchema } from './postgresUuid.js'
import { spatialPointDtoSchema } from './spatialFacts.js'
import {
  AUTHORED_LIMITS,
  MAX_ENCOUNTER_ACTORS,
  authoredPositiveLengthAmountSchema,
  authoredReferenceCollectionSchema
} from './authoredLimits.js'

const checksumSchema = lazySchema(() => z.string().check(z.regex(/^[a-f0-9]{64}$/)))
const actionIdentitySchema = lazySchema(() =>
  z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(240))
)

/**
 * An authored reaction can bind to a movement lifecycle stage. The referenced
 * eligibility graph supplies all policy beyond this factual event boundary.
 */
export const reactionMovementTriggerBindingDtoSchema = lazySchema(() =>
  z.strictObject({
    kind: z.literal('MOVEMENT'),
    stage: z.enum(['BEFORE_LEAVE_REACH', 'ENTER_REACH']),
    perceptionRequirement: z.nullable(combatPerceptionRequirementDtoSchema),
    eligibilityDefinitionId: postgresUuidSchema,
    /** Explicit authored movement-only directive; no outcome/name inference. */
    movementInterruption: z._default(
      z.union([
        z.null(),
        z.strictObject({
          kind: z.literal('STOP'),
          whenResultPath: z.enum([
            'PASSIVE',
            'ON_USE',
            'ON_CAST',
            'ON_ATTACK',
            'ON_HIT',
            'ON_MISS',
            'ON_CRIT',
            'ON_CHECK_SUCCESS',
            'ON_SAVE_FAIL',
            'ON_SAVE_SUCCESS',
            'START_OF_TURN',
            'END_OF_TURN',
            'ON_MOVE',
            'ON_HP_ZERO'
          ])
        })
      ]),
      null
    )
  })
)

/**
 * The damage types a damage-taken trigger filters on: a non-empty set of damage-type ids. A
 * reaction (`DAMAGE_TAKEN`) and an end trigger (`endOnTriggers`) share it.
 */
export const damageTypeFilterDtoSchema = lazySchema(() =>
  z
    .array(postgresUuidSchema)
    .check(z.minLength(1))
    .check(z.maxLength(AUTHORED_LIMITS.nestedCollectionItems))
)

/** The basic-action definitions an end trigger names. */
export const basicActionFilterDtoSchema = lazySchema(() =>
  z
    .array(postgresUuidSchema)
    .check(z.minLength(1))
    .check(z.maxLength(AUTHORED_LIMITS.nestedCollectionItems))
)

/** Structured events that end an authored effect early, each with its own filter. */
export const pathLifecycleEndTriggersDtoSchema = lazySchema(() =>
  authoredReferenceCollectionSchema(
    z.discriminatedUnion('event', [
      z.strictObject({
        event: z.literal('DAMAGE_TAKEN'),
        by: pathLifecycleEndTriggerBySchema,
        damageTypeIds: z.optional(damageTypeFilterDtoSchema)
      }),
      z.strictObject({
        event: z.enum(['ATTACK_ROLL', 'SPELL_CAST']),
        against: pathLifecycleEndTriggerAgainstSchema
      }),
      z.strictObject({
        event: z.literal('ACTION_USED_ON_HOLDER'),
        actionDefinitionIds: basicActionFilterDtoSchema
      }),
      z.strictObject({
        event: z.literal('INCAPACITATED'),
        of: pathLifecycleEndTriggerOfSchema
      }),
      z.strictObject({
        event: z.literal('SEPARATED'),
        from: pathLifecycleEndTriggerOfSchema,
        beyondFeet: authoredPositiveLengthAmountSchema
      })
    ])
  )
)

/**
 * The authored content (a Spell, Feature, Option, Feat or equipment id) an action must come from for a
 * source-filtered trigger or defense to apply. Empty or absent means any source.
 */
export const sourceEffectIdsFilterDtoSchema = lazySchema(() =>
  z.array(postgresUuidSchema).check(z.maxLength(AUTHORED_LIMITS.nestedCollectionItems))
)

/** An authored reaction can bind to any supported factual event; each arm is one event kind. */
export const reactionTriggerBindingDtoSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    reactionMovementTriggerBindingDtoSchema,
    z.strictObject({
      kind: z.literal('ATTACKED_SELF'),
      /** Answers only a melee attack. */
      attackRange: z.optional(z.literal('MELEE')),
      /** Answers only an attacker the reactor sees. */
      requiresSight: z.optional(z.boolean())
    }),
    z.strictObject({
      kind: z.literal('SPELL_CAST'),
      higherLevelCheck: z.optional(
        z.strictObject({
          ability: abilityModifierReferenceSchema,
          baseDc: z.number().check(z.int()).check(z.nonnegative())
        })
      )
    }),
    z.strictObject({
      kind: z.literal('DAMAGE_TAKEN'),
      damageTypeIds: damageTypeFilterDtoSchema
    }),
    z.strictObject({
      kind: z.literal('TARGETED_SELF'),
      sourceEffectIds: z.optional(sourceEffectIdsFilterDtoSchema)
    })
  ])
)

/** Encounter-owned factual relationship. Game System policy interprets it. */
export const encounterActorRelationshipKindDtoSchema = lazySchema(() =>
  z.enum(['ALLIED', 'NEUTRAL', 'HOSTILE'])
)

/**
 * Closed System-policy output consumed by the Encounter application layer.
 * The shared Kernel does not interpret these values; it only executes the
 * UUID-selected graph that produced them.
 */
export const movementReactionEligibilityOutputDtoSchema = lazySchema(() =>
  z
    .strictObject({
      eligible: z.boolean(),
      allowanceDefinitionId: postgresUuidSchema,
      allowanceMaximum: z.number().check(z.int()).check(z.positive()).check(z.lte(10_000)),
      allowanceRefreshBoundary: z.literal('START_OF_TURN'),
      selectionPolicy: z.enum(['AUTOMATIC', 'CHOICE']),
      choiceDefinitionId: z.nullable(postgresUuidSchema),
      targetPolicy: z.literal('MOVER')
    })
    .check(
      z.superRefine((policy, context) => {
        if ((policy.selectionPolicy === 'CHOICE') !== (policy.choiceDefinitionId !== null)) {
          context.addIssue({
            code: 'custom',
            path: ['choiceDefinitionId'],
            message: 'A movement reaction choice must bind exactly one published choice definition.'
          })
        }
      })
    )
)

export const movementReactionContactDtoSchema = lazySchema(() =>
  z.strictObject({
    contact: spatialPointDtoSchema,
    movingActorId: postgresUuidSchema,
    pathDistance: z.number().check(z.nonnegative()),
    reactorActorId: postgresUuidSchema,
    reactorTokenId: postgresUuidSchema,
    sourceId: checksumSchema,
    stage: z.enum(['BEFORE_LEAVE_REACH', 'ENTER_REACH'])
  })
)

const movementReactionAuthorityDtoSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.strictObject({
      kind: z.literal('CHARACTER_CONTROLLER'),
      characterId: postgresUuidSchema
    }),
    z.strictObject({ kind: z.literal('GM') })
  ])
)

export const movementReactionChoiceOptionDtoSchema = lazySchema(() =>
  z.strictObject({
    optionId: checksumSchema,
    contactSourceId: checksumSchema,
    actionId: actionIdentitySchema,
    actionSourceKind: z.enum(['CHARACTER_ACTION', 'ENCOUNTER_FEATURE']),
    actionSourceCurrentnessChecksum: checksumSchema,
    candidate: movementReactionContactDtoSchema,
    binding: reactionMovementTriggerBindingDtoSchema,
    policy: movementReactionEligibilityOutputDtoSchema,
    eligibilityEvidenceChecksum: checksumSchema,
    authority: movementReactionAuthorityDtoSchema,
    visibility: z.enum(['CONTROLLER', 'GM_ONLY'])
  })
)

export const movementReactionChoiceSelectionDtoSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('DECLINE') }),
    z.strictObject({ kind: z.literal('OPTION'), optionId: checksumSchema })
  ])
)

/**
 * One controller decision at one exact reach contact. Kernel index zero is the
 * code-owned Decline control; action options map to indices one through N.
 */
export const movementReactionChoiceGroupDtoSchema = lazySchema(() =>
  z
    .strictObject({
      pathDistance: z.number().check(z.nonnegative()),
      reactorActorId: postgresUuidSchema,
      reactorTokenId: postgresUuidSchema,
      options: z
        .array(movementReactionChoiceOptionDtoSchema)
        .check(z.minLength(1))
        .check(z.maxLength(RULE_GRAPH_LIMITS.NODES - 1))
    })
    .check(
      z.superRefine((group, context) => {
        const optionIds = new Set<string>()
        for (const [index, option] of group.options.entries()) {
          if (
            option.candidate.pathDistance !== group.pathDistance ||
            option.candidate.reactorActorId !== group.reactorActorId ||
            option.candidate.reactorTokenId !== group.reactorTokenId ||
            option.candidate.stage !== option.binding.stage ||
            option.candidate.sourceId !== option.contactSourceId
          ) {
            context.addIssue({
              code: 'custom',
              path: ['options', index],
              message: 'Movement reaction choice option does not match its exact contact group.'
            })
          }
          if (optionIds.has(option.optionId)) {
            context.addIssue({
              code: 'custom',
              path: ['options', index, 'optionId'],
              message: 'Movement reaction choice option identities must be unique.'
            })
          }
          optionIds.add(option.optionId)
          const prior = group.options[index - 1]
          if (
            prior &&
            (prior.actionId.localeCompare(option.actionId) > 0 ||
              (prior.actionId === option.actionId &&
                prior.optionId.localeCompare(option.optionId) >= 0))
          ) {
            context.addIssue({
              code: 'custom',
              path: ['options', index],
              message: 'Movement reaction choices must retain canonical action order.'
            })
          }
        }
      })
    )
)

/**
 * Server-owned movement reaction timeline. Every eligible reaction is a
 * controller choice; Assisted play never uses a reaction on anyone's behalf.
 */
export const movementReactionTimelineEntryDtoSchema = lazySchema(() =>
  z
    .strictObject({
      kind: z.literal('CONTROLLER_CHOICE'),
      group: movementReactionChoiceGroupDtoSchema
    })
    .check(
      z.superRefine((entry, context) => {
        const definitionId = entry.group.options[0]?.policy.choiceDefinitionId
        if (
          !definitionId ||
          entry.group.options.some(
            (option) =>
              option.policy.selectionPolicy !== 'CHOICE' ||
              option.policy.choiceDefinitionId !== definitionId
          )
        ) {
          context.addIssue({
            code: 'custom',
            path: ['group'],
            message:
              'Controller reaction timeline entries require one exact choice policy definition.'
          })
        }
      })
    )
)

export const movementReactionTimelineDtoSchema = lazySchema(() =>
  z
    .array(movementReactionTimelineEntryDtoSchema)
    .check(z.maxLength(MAX_ENCOUNTER_ACTORS))
    .check(
      z.superRefine((timeline, context) => {
        let prior: {
          pathDistance: number
          reactorActorId: string
          reactorTokenId: string
          actionId: string
          optionId: string
        } | null = null
        for (const [index, entry] of timeline.entries()) {
          const option = entry.group.options[0]!
          const current = {
            pathDistance: option.candidate.pathDistance,
            reactorActorId: option.candidate.reactorActorId,
            reactorTokenId: option.candidate.reactorTokenId,
            actionId: option.actionId,
            optionId: option.optionId
          }
          if (
            prior &&
            (current.pathDistance < prior.pathDistance ||
              (current.pathDistance === prior.pathDistance &&
                (current.reactorActorId < prior.reactorActorId ||
                  (current.reactorActorId === prior.reactorActorId &&
                    (current.reactorTokenId < prior.reactorTokenId ||
                      (current.reactorTokenId === prior.reactorTokenId &&
                        (current.actionId < prior.actionId ||
                          (current.actionId === prior.actionId &&
                            current.optionId <= prior.optionId))))))))
          ) {
            context.addIssue({
              code: 'custom',
              path: [index],
              message: 'Movement reaction timeline entries must retain strict canonical order.'
            })
          }
          prior = current
        }
      })
    )
)

export type ReactionMovementTriggerBindingDto = z.infer<
  typeof reactionMovementTriggerBindingDtoSchema
>
export type EncounterActorRelationshipKindDto = z.infer<
  typeof encounterActorRelationshipKindDtoSchema
>
export type MovementReactionEligibilityOutputDto = z.infer<
  typeof movementReactionEligibilityOutputDtoSchema
>
export type MovementReactionContactDto = z.infer<typeof movementReactionContactDtoSchema>
export type MovementReactionChoiceOptionDto = z.infer<typeof movementReactionChoiceOptionDtoSchema>
export type MovementReactionChoiceSelectionDto = z.infer<
  typeof movementReactionChoiceSelectionDtoSchema
>
export type MovementReactionChoiceGroupDto = z.infer<typeof movementReactionChoiceGroupDtoSchema>
export type MovementReactionTimelineEntryDto = z.infer<
  typeof movementReactionTimelineEntryDtoSchema
>
export type MovementReactionTimelineDto = z.infer<typeof movementReactionTimelineDtoSchema>
