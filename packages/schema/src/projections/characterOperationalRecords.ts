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
    /** The structure clock: it advances only when the document or the Sheet structure changes. */
    updatedAt: z.iso.datetime(),
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

const characterStoredInventoryItemSchema = collectionRecord(characterEquipmentItemStateDtoSchema)
const characterStoredCurrencyGroupSchema = collectionRecord(characterCurrencyGroupStateDtoSchema)
const characterStoredClassSpellStateSchema = collectionRecord(characterClassStateDtoSchema)
const characterStoredSpellCustomizationSchema = collectionRecord(characterSpellCustomizationSchema)
const characterStoredCreatureInstanceSchema = collectionRecord(characterOwnedCreatureStateDtoSchema)
const characterStoredVehicleInstanceSchema = collectionRecord(characterOwnedVehicleStateDtoSchema)
const characterStoredNoteSchema = collectionRecord(characterNoteStateDtoSchema)
const characterStoredNoteGroupSchema = collectionRecord(characterNoteGroupStateDtoSchema)

/** One relationship record per instance; IDs preserve the existing optional assignment maps. */
const characterStoredExtraEquipmentSchema = collectionRecord(
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
