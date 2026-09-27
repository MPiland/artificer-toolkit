import { EQUIPMENT_CATEGORY_CODE } from '@artificer-toolkit/shared/subjects/core'
import { z, lazySchema } from '../zod.js'

import { capacityDtoSchema, containsDtoSchema, costDtoSchema, weightDtoSchema } from './shared.js'
import {
  authoredIdentifierSchema,
  authoredNestedCollectionSchema,
  authoredReferenceCollectionSchema,
  authoredRichTextSchema,
  authoredShortTextSchema
} from '../shared/authoredLimits.js'
import { chargeDtoSchema } from '../shared/charge.js'
import { characterFacetDtoSchema } from '../shared/facet.js'
import {
  authoredRecordStatusSchema,
  equipmentAttributeCodeSchema,
  equipmentPropertyCodeSchema
} from '../shared/enums.js'
import { equipmentEffectDtoSchema } from '../effects/effect.js'
import { featureDtoSchema } from '../features/feature.js'
import { modifierGrantDtoSchema } from '../grants/modifier.js'

const equipmentBaseDtoSchema = lazySchema(() =>
  z.object({
    kind: z.literal('EQUIPMENT'),
    id: authoredIdentifierSchema,
    label: authoredShortTextSchema,
    description: z.nullable(authoredRichTextSchema),
    status: z.optional(authoredRecordStatusSchema),
    quote: z.optional(authoredRichTextSchema),
    rarityId: authoredIdentifierSchema,
    userId: authoredIdentifierSchema,
    systemId: authoredIdentifierSchema
  })
)

const baseEquipmentAuthoredDtoSchemaBase = lazySchema(() =>
  z.extend(equipmentBaseDtoSchema, {
    attributes: z.optional(authoredReferenceCollectionSchema(equipmentAttributeCodeSchema)),
    cost: z.optional(costDtoSchema),
    weight: z.optional(weightDtoSchema),
    effects: z.optional(authoredNestedCollectionSchema(equipmentEffectDtoSchema)),
    charges: z.optional(chargeDtoSchema),
    capacity: z.optional(capacityDtoSchema),
    modifiers: z.optional(authoredNestedCollectionSchema(modifierGrantDtoSchema)),
    maxStack: z.optional(z.number().check(z.int())),
    armorClass: z.optional(z.number().check(z.int())),
    contains: z.optional(authoredNestedCollectionSchema(containsDtoSchema)),
    features: z.optional(authoredNestedCollectionSchema(featureDtoSchema)),
    restrictions: z.optional(characterFacetDtoSchema),
    requiresAttunement: z.optional(z.boolean()),
    properties: authoredReferenceCollectionSchema(equipmentPropertyCodeSchema),
    category: z.enum([
      EQUIPMENT_CATEGORY_CODE.WEAPON,
      EQUIPMENT_CATEGORY_CODE.ARMOR,
      EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
      EQUIPMENT_CATEGORY_CODE.TOOL,
      EQUIPMENT_CATEGORY_CODE.SHIELD
    ])
  })
)

const equipmentVariantAuthoredDtoSchemaBase = lazySchema(() =>
  z.extend(equipmentBaseDtoSchema, {
    category: z.literal(EQUIPMENT_CATEGORY_CODE.VARIANT),
    parentEquipmentId: authoredIdentifierSchema,
    properties: z.optional(authoredReferenceCollectionSchema(equipmentPropertyCodeSchema)),
    effects: z.optional(authoredNestedCollectionSchema(equipmentEffectDtoSchema)),
    charges: z.optional(chargeDtoSchema),
    modifiers: z.optional(authoredNestedCollectionSchema(modifierGrantDtoSchema)),
    features: z.optional(authoredNestedCollectionSchema(featureDtoSchema)),
    restrictions: z.optional(characterFacetDtoSchema),
    requiresAttunement: z.optional(z.boolean())
  })
)

const baseEquipmentAuthoringInputDtoSchemaBase = lazySchema(() =>
  z.extend(baseEquipmentAuthoredDtoSchemaBase, {
    userId: z.optional(authoredIdentifierSchema)
  })
)

const equipmentVariantAuthoringInputDtoSchemaBase = lazySchema(() =>
  z.extend(equipmentVariantAuthoredDtoSchemaBase, {
    userId: z.optional(authoredIdentifierSchema)
  })
)

export type BaseEquipmentAuthoredDto = z.infer<typeof baseEquipmentAuthoredDtoSchemaBase>
export type EquipmentVariantAuthoredDto = z.infer<typeof equipmentVariantAuthoredDtoSchemaBase>
export type EquipmentAuthoredDto = BaseEquipmentAuthoredDto | EquipmentVariantAuthoredDto
export type BaseEquipmentAuthoringInputDto = z.infer<
  typeof baseEquipmentAuthoringInputDtoSchemaBase
>
export type EquipmentVariantAuthoringInputDto = z.infer<
  typeof equipmentVariantAuthoringInputDtoSchemaBase
>
export type EquipmentAuthoringInputDto =
  | BaseEquipmentAuthoringInputDto
  | EquipmentVariantAuthoringInputDto
export const baseEquipmentAuthoredDtoSchema: z.ZodMiniType<BaseEquipmentAuthoredDto> =
  baseEquipmentAuthoredDtoSchemaBase
export const equipmentVariantAuthoredDtoSchema: z.ZodMiniType<EquipmentVariantAuthoredDto> =
  equipmentVariantAuthoredDtoSchemaBase
export const baseEquipmentAuthoringInputDtoSchema: z.ZodMiniType<BaseEquipmentAuthoringInputDto> =
  baseEquipmentAuthoringInputDtoSchemaBase
export const equipmentVariantAuthoringInputDtoSchema: z.ZodMiniType<EquipmentVariantAuthoringInputDto> =
  equipmentVariantAuthoringInputDtoSchemaBase
/**
 * A weapon's handedness bounds its attack grips: a TWO_HANDED weapon attacks only with two hands,
 * and only a VERSATILE or TWO_HANDED weapon may. A variant inherits its parent's properties, so
 * its grips are checked when it is resolved against that parent.
 */
const weaponGripsMatchHandedness = lazySchema(() =>
  z.superRefine((equipment: EquipmentAuthoredDto | EquipmentAuthoringInputDto, context) => {
    if (equipment.category === EQUIPMENT_CATEGORY_CODE.VARIANT) return
    const twoHanded = equipment.properties.includes('TWO_HANDED')
    const versatile = equipment.properties.includes('VERSATILE')
    for (const [index, effect] of (equipment.effects ?? []).entries()) {
      if (twoHanded ? effect.grip !== 'ONE_HANDED' : effect.grip !== 'TWO_HANDED' || versatile)
        continue
      context.addIssue({
        code: 'custom',
        path: ['effects', index, 'grip'],
        message: twoHanded
          ? 'A two-handed weapon attacks with two hands.'
          : 'Only a versatile or two-handed weapon attacks with two hands.'
      })
    }
  })
)

export const equipmentAuthoredDtoSchema: z.ZodMiniType<EquipmentAuthoredDto> = lazySchema(() =>
  z
    .discriminatedUnion('category', [
      baseEquipmentAuthoredDtoSchemaBase,
      equipmentVariantAuthoredDtoSchemaBase
    ])
    .check(weaponGripsMatchHandedness)
)
export const equipmentAuthoringInputDtoSchema: z.ZodMiniType<EquipmentAuthoringInputDto> =
  lazySchema(() =>
    z
      .discriminatedUnion('category', [
        baseEquipmentAuthoringInputDtoSchemaBase,
        equipmentVariantAuthoringInputDtoSchemaBase
      ])
      .check(weaponGripsMatchHandedness)
  )
