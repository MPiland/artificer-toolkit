import { z } from '../zod.js'
import { encounterBasicActionEffectsDtoSchema } from '../shared/basicActions.js'
import { encounterRuleWarningsDtoSchema } from '../shared/encounterRuleWarnings.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { encounterActionEconomyTransitionDtoSchema } from '../shared/ruleExecutionEncounterApplications.js'
import { encounterActorRuleOutputSchema } from './encounterActorRules.js'
import { useEncounterBasicActionInputDtoSchema } from './encounterRuleCommands.js'
import { liveSessionEncounterRulesInputSchema } from './liveSessionEncounterRules.js'
import { liveSessionRulesRevisionsSchema } from './liveSessionRulesRevisions.js'

/**
 * A room-planned basic action (Q11). Convex checks it against the current Run and records it: the
 * allowance use, the effects added to the actor and a movement bonus for the current turn. It never
 * evaluates the action's rules.
 */
export const liveSessionEncounterBasicActionCommitInputSchema = z.extend(
  z.omit(liveSessionEncounterRulesInputSchema, {
    request: true,
    concentrationResponse: true,
    turnCommand: true,
    action: true,
    movement: true
  }),
  {
    command: useEncounterBasicActionInputDtoSchema,
    revisions: liveSessionRulesRevisionsSchema,
    occurredAt: z.iso.datetime(),
    /** The exact published catalogue entry the room planned with. */
    definition: z.strictObject({
      id: postgresUuidSchema,
      version: z.number().check(z.int()).check(z.positive()),
      checksum: z.string().check(z.regex(/^[a-f0-9]{64}$/))
    }),
    actionEconomy: z.nullable(encounterActionEconomyTransitionDtoSchema),
    /** Warnings the command acknowledged and the room overrode. */
    ruleOverrides: encounterRuleWarningsDtoSchema,
    /** Effects appended to the actor's Run resources. */
    effects: encounterBasicActionEffectsDtoSchema,
    /** Adds the actor's speed to its movement budget for the current turn. */
    speedMovementBonus: z.boolean(),
    rules: encounterActorRuleOutputSchema
  }
)

export type LiveSessionEncounterBasicActionCommitInput = z.infer<
  typeof liveSessionEncounterBasicActionCommitInputSchema
>
