import { z } from '../zod.js'
import {
  characterMovementDisplayPreferenceDtoSchema,
  characterSheetAdjustmentDtoSchema,
  characterSpellSourceRefDtoSchema
} from '../api/characterSheet.js'
import { characterPartyVisibilityDtoSchema } from '../api/healthDisplay.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'

const identifier = z.string().check(z.minLength(1))
const sheetRecordMetadataSchema = z.strictObject({
  id: z.pipe(
    z.uuid(),
    z.transform((value) => value.toLowerCase())
  ),
  characterId: postgresUuidSchema,
  createdBy: postgresUuidSchema,
  updatedBy: postgresUuidSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime()
})
export const characterResourceUsageOwnerSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('AUTHORED_GRANT'), resourceGrantId: identifier }),
  z.strictObject({
    kind: z.literal('AUTHORED_SOURCE'),
    chargeId: identifier,
    sourceId: identifier
  }),
  z.extend(characterSpellSourceRefDtoSchema, {
    kind: z.literal('SPELL_SOURCE'),
    resourceGrantId: identifier
  }),
  z.strictObject({
    kind: z.literal('ITEM_INSTANCE'),
    chargeId: identifier,
    itemInstanceId: postgresUuidSchema
  }),
  z.strictObject({ kind: z.literal('SENSE_GRANT'), senseGrantId: identifier }),
  z.strictObject({
    kind: z.literal('COMPANION_FEATURE'),
    chargeId: identifier,
    companionInstanceId: postgresUuidSchema,
    featureId: postgresUuidSchema
  })
])
const resourceUsageSchema = z.extend(sheetRecordMetadataSchema, {
  owner: characterResourceUsageOwnerSchema,
  used: z.number().check(z.int()).check(z.nonnegative())
})
const spellCustomizationSchema = z.extend(sheetRecordMetadataSchema, {
  source: characterSpellSourceRefDtoSchema,
  customName: z.optional(z.string().check(z.trim()).check(z.maxLength(120))),
  notes: z.optional(z.string().check(z.trim()).check(z.maxLength(2000))),
  displayAsAttack: z.boolean()
})

/** Sheet-owned records stored beside, not inside, authored Builder intent. */
export const characterSheetStateSchema = z.strictObject({
  adjustments: z.array(characterSheetAdjustmentDtoSchema),
  movementDisplayPreference: characterMovementDisplayPreferenceDtoSchema,
  partyVisibility: characterPartyVisibilityDtoSchema,
  resourceUsage: z._default(z.array(resourceUsageSchema), []),
  spellCustomizations: z._default(z.array(spellCustomizationSchema), [])
})

export type CharacterSheetState = z.infer<typeof characterSheetStateSchema>
