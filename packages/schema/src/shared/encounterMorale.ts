import { z, lazySchema } from '../zod.js'
import {
  dnd5eOptionalCombatOperationTargetDtoSchema,
  moraleDispositionDtoSchema,
  moraleTriggerKindDtoSchema,
  type MoraleTriggerKindDto
} from './optionalCombat.js'
import { postgresUuidSchema } from './postgresUuid.js'
import { ruleCheckD20EvidenceDtoSchema } from './ruleExecutionEncounterApplications.js'

/** Whom a morale trigger's check covers: the creature alone, or its whole side. */
export const MORALE_TRIGGER_SCOPE: Readonly<
  Record<MoraleTriggerKindDto, z.infer<typeof dnd5eOptionalCombatOperationTargetDtoSchema>>
> = {
  INDIVIDUAL_SURPRISED: 'SUBJECT',
  INDIVIDUAL_REDUCED_TO_HALF: 'SUBJECT',
  INDIVIDUAL_CANNOT_HARM_OPPOSITION: 'SUBJECT',
  GROUP_SURPRISED: 'GROUP',
  GROUP_HALF_REMOVED: 'GROUP',
  GROUP_LEADER_REMOVED: 'GROUP',
  GROUP_LEADER_INCAPACITATED: 'GROUP',
  GROUP_LEADER_TAKEN_PRISONER: 'GROUP'
}

/**
 * An actor's latest morale check (ENCOUNTER-6.2). A later check replaces it; the command receipts
 * keep the history. `firedTriggerKinds` remembers every trigger already checked for this actor, so
 * the GM projection does not offer it again.
 */
export const encounterActorMoraleDtoSchema = lazySchema(() =>
  z.strictObject({
    /** The GM's MORALE_SAVE command; every member of one group check shares it. */
    commandId: postgresUuidSchema,
    definitionId: postgresUuidSchema,
    triggerKind: moraleTriggerKindDtoSchema,
    scope: dnd5eOptionalCombatOperationTargetDtoSchema,
    rollerActorId: postgresUuidSchema,
    /** The leader named on the actor's latest group check, kept through later individual checks. */
    groupLeaderActorId: z.nullable(postgresUuidSchema),
    /** Null when overwhelming opposition failed the check without a roll. */
    save: z.nullable(ruleCheckD20EvidenceDtoSchema),
    proposed: moraleDispositionDtoSchema,
    /** Null until the GM confirms an outcome. */
    disposition: z.nullable(moraleDispositionDtoSchema),
    firedTriggerKinds: z
      .array(moraleTriggerKindDtoSchema)
      .check(z.minLength(1))
      .check(z.maxLength(8))
      .check(
        z.superRefine((kinds, context) => {
          if (kinds.some((kind, index) => index > 0 && kinds[index - 1]! >= kind))
            context.addIssue({
              code: 'custom',
              message: 'Fired morale triggers must be unique and sorted.'
            })
        })
      )
  })
)

/**
 * A morale trigger the GM may check for an actor: derived from Run state, or one the Run holds no
 * facts for, which the GM declares.
 */
export const encounterMoraleOfferDtoSchema = lazySchema(() =>
  z.strictObject({
    triggerKind: moraleTriggerKindDtoSchema,
    origin: z.enum(['RUN_STATE', 'GM_DECLARED'])
  })
)

export type EncounterActorMoraleDto = z.infer<typeof encounterActorMoraleDtoSchema>
export type EncounterMoraleOfferDto = z.infer<typeof encounterMoraleOfferDtoSchema>
