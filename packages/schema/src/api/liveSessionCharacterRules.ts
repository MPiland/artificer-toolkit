import { z, lazySchema } from '../zod.js'
import {
  liveSessionActionCaptureScopeSchema,
  liveSessionTurnCaptureScopeSchema
} from './liveSessionCommandScopes.js'
import { characterSheetStateSchema } from '../projections/characterSheetState.js'
import { characterStoredRowSchema } from '../projections/characterPersistence.js'
import { campaignCharacterStateSchema } from '../projections/campaignCharacterState.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { characterSheetCurrencyOptionDtoSchema } from './characterSheetData.js'
import { liveSessionBootstrapInputSchema } from './liveSessionState.js'
import { resolveRuleOccurrenceInputDtoSchema } from './encounterRuleCommands.js'
import { liveSessionMovementCaptureScopeSchema } from './liveSessionEncounterMovement.js'

/** The Character rules scope a room command admits for one Character. */
export const liveSessionCharacterRulesInputSchema = lazySchema(() =>
  z.extend(liveSessionBootstrapInputSchema, {
    expectedRole: z.enum(['OWNER', 'PLAYER']),
    concentrationResponse: z.optional(resolveRuleOccurrenceInputDtoSchema),
    turnCommand: z.optional(liveSessionTurnCaptureScopeSchema),
    action: z.optional(liveSessionActionCaptureScopeSchema),
    movement: z.optional(
      z.extend(liveSessionMovementCaptureScopeSchema, { actorId: postgresUuidSchema })
    ),
    characterId: postgresUuidSchema
  })
)

/** A Character's stored rules inputs: its structure and play rows and its Campaign overlay. */
export const liveSessionCharacterInputsSchema = lazySchema(() =>
  z.strictObject({
    /** The Character's structure row with its play record; the reader joins them and verifies both checksums. */
    owner: characterStoredRowSchema,
    sheetState: characterSheetStateSchema,
    campaign: z.strictObject({
      id: postgresUuidSchema,
      status: z.literal('ACTIVE'),
      contentMaturity: z.enum(['STANDARD', 'MATURE']),
      attunementSlotOverride: z.nullable(z.number().check(z.int()).check(z.nonnegative())),
      state: campaignCharacterStateSchema,
      currencyOptions: z.array(characterSheetCurrencyOptionDtoSchema)
    })
  })
)

export type LiveSessionCharacterRulesInput = z.infer<typeof liveSessionCharacterRulesInputSchema>
export type LiveSessionCharacterInputs = z.infer<typeof liveSessionCharacterInputsSchema>
