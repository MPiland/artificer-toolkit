import { z } from '../zod.js'
import {
  campaignSessionDtoSchema,
  campaignSessionNoteSectionDtoSchema,
  campaignSessionReferencePinDtoSchema,
  campaignClockDtoSchema
} from '../api/campaignSessions.js'
import { timestampSchema, uuidSchema } from '../api/campaignContractSchemas.js'

const campaignStoredCommandBaseSchema = z.strictObject({
  campaignId: uuidSchema,
  commandId: uuidSchema,
  inputFingerprint: z.string().check(z.regex(/^[a-f0-9]{64}$/)),
  createdAt: timestampSchema
})

export const campaignStoredSessionNoteSchema = z.extend(campaignSessionNoteSectionDtoSchema, {
  updatedBy: uuidSchema
})

export const campaignStoredSessionReferenceSchema = z.omit(campaignSessionReferencePinDtoSchema, {
  label: true
})

export const campaignStoredCommandSchema = z
  .discriminatedUnion('commandType', [
    z.extend(campaignStoredCommandBaseSchema, {
      commandType: z.literal('FINISH_SESSION'),
      resultPayload: campaignSessionDtoSchema
    }),
    z.extend(campaignStoredCommandBaseSchema, {
      commandType: z.enum([
        'INITIALIZE_CLOCK',
        'CONFIGURE_CLOCK',
        'START_CLOCK',
        'PAUSE_CLOCK',
        'ADVANCE_CLOCK',
        'REWIND_CLOCK',
        'RESET_CLOCK',
        'RECONCILE_CLOCK'
      ]),
      correctionReason: z.nullable(
        z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(500))
      ),
      resultPayload: campaignClockDtoSchema
    })
  ])
  .check(
    z.superRefine((command, context) => {
      if (command.commandType === 'FINISH_SESSION') return
      const isCorrection =
        command.commandType === 'REWIND_CLOCK' || command.commandType === 'RESET_CLOCK'
      if (isCorrection === (command.correctionReason !== null)) return
      context.addIssue({
        code: 'custom',
        message: 'Clock correction commands must retain a correction reason.'
      })
    })
  )
