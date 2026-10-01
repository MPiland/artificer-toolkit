import { z, lazySchema } from '../zod.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import {
  characterIntentDtoSchema,
  characterProfileAuthoredDtoSchema
} from '../subjects/characterIntent.js'
import {
  characterClassStateDtoSchema,
  characterCurrencyGroupStateDtoSchema,
  characterEquipmentItemStateDtoSchema,
  characterNoteGroupStateDtoSchema,
  characterNoteStateDtoSchema,
  characterOwnedCreatureStateDtoSchema,
  characterOwnedVehicleStateDtoSchema
} from '../subjects/characterState.js'
import { characterSheetStructureSchema } from './characterPlayState.js'
import { characterSpellCustomizationSchema } from './characterSheetState.js'
import { projectionChecksumSchema } from './identity.js'

/** Retains absent versus present empty optional collections when assembling a complete Character. */
export const characterOptionalStateKeySchema = lazySchema(() =>
  z.enum([
    'classes',
    'noteGroups',
    'notes',
    'creatures',
    'vehicles',
    'creatureEquipment',
    'vehicleEquipment'
  ])
)

export const characterStoredBuildStateSchema = lazySchema(() =>
  z.strictObject({
    characterId: postgresUuidSchema,
    description: z.optional(z.string()),
    profile: characterProfileAuthoredDtoSchema,
    intent: characterIntentDtoSchema,
    adjustments: characterSheetStructureSchema.shape.adjustments,
    movementDisplayPreference: characterSheetStructureSchema.shape.movementDisplayPreference,
    optionalStateKeys: z.array(characterOptionalStateKeySchema),
    // Selected collection reads must detect missing tail rows without assembling the Character.
    collectionCounts: z.strictObject({
      characterInventoryItems: z.number().check(z.int()).check(z.nonnegative()),
      characterCurrencyGroups: z.number().check(z.int()).check(z.nonnegative()),
      characterClassSpellStates: z.number().check(z.int()).check(z.nonnegative()),
      characterSpellCustomizations: z.number().check(z.int()).check(z.nonnegative()),
      characterCreatureInstances: z.number().check(z.int()).check(z.nonnegative()),
      characterVehicleInstances: z.number().check(z.int()).check(z.nonnegative()),
      characterNotes: z.number().check(z.int()).check(z.nonnegative()),
      characterNoteGroups: z.number().check(z.int()).check(z.nonnegative()),
      characterExtraEquipment: z.number().check(z.int()).check(z.nonnegative())
    }),
    checksum: projectionChecksumSchema
  })
)

// The value is bounded by its domain contract. Position preserves existing array ordering;
// id is the original public instance/group ID, never a replacement Convex document ID.
function collectionRecord<Schema extends z.ZodMiniType>(value: Schema) {
  return lazySchema(() =>
    z.strictObject({
      characterId: postgresUuidSchema,
      id: z.string().check(z.minLength(1)),
      position: z.number().check(z.int()).check(z.nonnegative()),
      value,
      checksum: projectionChecksumSchema
    })
  )
}

export const characterStoredInventoryItemSchema = collectionRecord(
  characterEquipmentItemStateDtoSchema
)
export const characterStoredCurrencyGroupSchema = collectionRecord(
  characterCurrencyGroupStateDtoSchema
)
export const characterStoredClassSpellStateSchema = collectionRecord(characterClassStateDtoSchema)
export const characterStoredSpellCustomizationSchema = collectionRecord(
  characterSpellCustomizationSchema
)
export const characterStoredCreatureInstanceSchema = collectionRecord(
  characterOwnedCreatureStateDtoSchema
)
export const characterStoredVehicleInstanceSchema = collectionRecord(
  characterOwnedVehicleStateDtoSchema
)
export const characterStoredNoteSchema = collectionRecord(characterNoteStateDtoSchema)
export const characterStoredNoteGroupSchema = collectionRecord(characterNoteGroupStateDtoSchema)

/** One relationship record per instance; IDs preserve the existing optional assignment maps. */
export const characterStoredExtraEquipmentSchema = collectionRecord(
  lazySchema(() =>
    z.strictObject({
      kind: z.enum(['CREATURE', 'VEHICLE']),
      instanceId: z.string().check(z.minLength(1)),
      equipmentItemIds: z.array(z.string())
    })
  )
)

export const characterCollectionSchemas = {
  characterInventoryItems: characterStoredInventoryItemSchema,
  characterCurrencyGroups: characterStoredCurrencyGroupSchema,
  characterClassSpellStates: characterStoredClassSpellStateSchema,
  characterSpellCustomizations: characterStoredSpellCustomizationSchema,
  characterCreatureInstances: characterStoredCreatureInstanceSchema,
  characterVehicleInstances: characterStoredVehicleInstanceSchema,
  characterNotes: characterStoredNoteSchema,
  characterNoteGroups: characterStoredNoteGroupSchema,
  characterExtraEquipment: characterStoredExtraEquipmentSchema
}

export type CharacterCollectionTable = keyof typeof characterCollectionSchemas
export type CharacterCollectionRecords = {
  [Table in CharacterCollectionTable]: Array<z.infer<(typeof characterCollectionSchemas)[Table]>>
}
export type CharacterStoredBuildState = z.infer<typeof characterStoredBuildStateSchema>
