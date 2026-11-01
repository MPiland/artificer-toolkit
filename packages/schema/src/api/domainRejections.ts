import { z, lazySchema } from '../zod.js'
import { encounterRuleWarningsDtoSchema } from '../shared/encounterRuleWarnings.js'

const reasonsWithoutPayload = [
  'ACTIVE_ENCOUNTER_EXISTS',
  'ACTOR_DEFEATED',
  'ASSISTED_ONLY',
  'CAMPAIGN_NOT_ACTIVE',
  'CAMPAIGN_NOT_FOUND',
  'COMMAND_ID_REUSED',
  'DECISION_NOT_PENDING',
  'DECISION_REQUIRES_ANSWER',
  'ENCOUNTER_NOT_ACTIVE',
  'FACING_UNAVAILABLE',
  'GM_ONLY',
  'LEGENDARY_WINDOW_ONLY',
  'MOVEMENT_BLOCKED',
  'NOT_ACTOR_CONTROLLER',
  'NOT_CURRENT_ACTOR',
  'PENDING_DECISION',
  'REACTION_TRIGGER_ONLY',
  'REACTION_UNSUPPORTED',
  'REVERT_UNAVAILABLE',
  'ROLL_UNAVAILABLE',
  'SCENE_NOT_PRESENTED',
  'SOURCE_REQUIREMENTS_NOT_MET',
  'TARGET_UNAVAILABLE',
  'TELEPORT_UNAVAILABLE',
  'UNDECLARED_ACTION',
  'VERSION_STALE'
] as const

/** The user-safe message for each reason unless a refusal names something more specific. */
export const DOMAIN_REJECTION_MESSAGES: Record<(typeof reasonsWithoutPayload)[number], string> = {
  ACTIVE_ENCOUNTER_EXISTS: 'Campaign already has an active Encounter.',
  ACTOR_DEFEATED: 'This actor is defeated. Raise its hit points above 0 to revive it.',
  ASSISTED_ONLY: "Manual Encounters don't resolve actions. Resolve it at the table.",
  CAMPAIGN_NOT_ACTIVE: 'Archived Campaigns are read-only.',
  CAMPAIGN_NOT_FOUND: 'Campaign not found.',
  COMMAND_ID_REUSED: 'Command ID was already used with different input.',
  DECISION_NOT_PENDING: 'This decision is already settled.',
  DECISION_REQUIRES_ANSWER: 'This decision must be answered before play can continue.',
  ENCOUNTER_NOT_ACTIVE: 'Completed Encounters are read-only.',
  FACING_UNAVAILABLE: "This Encounter doesn't use facing, or tokens can't face that way.",
  GM_ONLY: 'Only the GM can do that.',
  LEGENDARY_WINDOW_ONLY: "Legendary Actions are taken at the end of another creature's turn.",
  MOVEMENT_BLOCKED: "You can't end your move there.",
  NOT_ACTOR_CONTROLLER: "You don't control this actor.",
  NOT_CURRENT_ACTOR: 'The selected actor does not have the turn.',
  PENDING_DECISION: 'An Encounter rule occurrence is awaiting resolution.',
  REACTION_TRIGGER_ONLY: 'A reaction is used when its trigger happens, not as an action.',
  REACTION_UNSUPPORTED: 'That reaction cannot answer this attack.',
  REVERT_UNAVAILABLE: "The last action can't be undone; adjust manually.",
  ROLL_UNAVAILABLE: 'That roll no longer applies to this decision; roll again.',
  SCENE_NOT_PRESENTED: 'Present this Scene to move Encounter tokens.',
  SOURCE_REQUIREMENTS_NOT_MET: "This actor doesn't meet the requirements to take that action.",
  TARGET_UNAVAILABLE: 'The target is unavailable.',
  TELEPORT_UNAVAILABLE: 'A teleport spell must be cast first, and it must be unspent.',
  UNDECLARED_ACTION: 'This actor declared a different action for this round.',
  VERSION_STALE: 'Encounter version is stale.'
}

/** Why an expected Encounter command was refused; unexpected failures never carry a reason. */
export const domainRejectionReasonDtoSchema = lazySchema(() =>
  z.enum([...reasonsWithoutPayload, 'RULE_WARNINGS', 'MAINTAINED_REPLACEMENT_REQUIRED'])
)
export type DomainRejectionReasonDto = z.infer<typeof domainRejectionReasonDtoSchema>

/** The maintained effects a caster at capacity can end to make room, oldest first (SPELLS-12). */
export const maintainedReplacementChoicesDtoSchema = lazySchema(() =>
  z
    .array(
      z.strictObject({
        id: z.guid(),
        /** What the effect keeps alive; null for a hidden source or when nothing depends on it. */
        label: z.nullable(z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(500)))
      })
    )
    .check(z.minLength(2))
)
export type MaintainedReplacementChoicesDto = z.infer<typeof maintainedReplacementChoicesDtoSchema>

const messageSchema = lazySchema(() => z.string().check(z.minLength(1)).check(z.maxLength(200)))

/**
 * `ConvexError` data for an expected domain rejection. The message is safe to show to users.
 * `RULE_WARNINGS` also lists the overridable warnings the command did not acknowledge, and
 * `MAINTAINED_REPLACEMENT_REQUIRED` the held effects the caster picks one of to end.
 */
export const domainRejectionErrorDataSchema = lazySchema(() =>
  z.discriminatedUnion('reason', [
    z.strictObject({
      code: z.literal('DOMAIN_REJECTED'),
      reason: z.enum(reasonsWithoutPayload),
      message: messageSchema
    }),
    z.strictObject({
      code: z.literal('DOMAIN_REJECTED'),
      reason: z.literal('RULE_WARNINGS'),
      message: messageSchema,
      warnings: encounterRuleWarningsDtoSchema.check(z.minLength(1))
    }),
    z.strictObject({
      code: z.literal('DOMAIN_REJECTED'),
      reason: z.literal('MAINTAINED_REPLACEMENT_REQUIRED'),
      message: messageSchema,
      heldStates: maintainedReplacementChoicesDtoSchema
    })
  ])
)
export type DomainRejectionErrorData = z.infer<typeof domainRejectionErrorDataSchema>
