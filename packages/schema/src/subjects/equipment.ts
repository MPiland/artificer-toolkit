import { EQUIPMENT_CATEGORY_CODE } from '@artificer-toolkit/shared'
import { z } from 'zod'

import { capacityDtoSchema, containsDtoSchema, costDtoSchema, weightDtoSchema } from './shared.js'
import {
  authoredRecordStatusSchema,
  chargeDtoSchema,
  equipmentAttributeCodeSchema,
  equipmentPropertyCodeSchema,
  characterFacetDtoSchema
} from '../shared/index.js'
import { effectDtoSchema } from '../effects/index.js'
import { featureDtoSchema } from '../features/index.js'
import { modifierGrantDtoSchema } from '../grants/index.js'

const equipmentBaseDtoSchema = z.object({
  kind: z.literal('EQUIPMENT'),
  id: z.string(),
  label: z.string(),
  description: z.string().nullable(),
  status: authoredRecordStatusSchema.optional(),
  quote: z.string().optional(),
  rarityId: z.string(),
  userId: z.string(),
  systemId: z.string()
})

const baseEquipmentAuthoredDtoSchemaBase = equipmentBaseDtoSchema.extend({
  attributes: z.array(equipmentAttributeCodeSchema).optional(),
  cost: costDtoSchema.optional(),
  weight: weightDtoSchema,
  effects: z.array(effectDtoSchema).optional(),
  charges: chargeDtoSchema.optional(),
  capacity: capacityDtoSchema.optional(),
  modifiers: z.array(modifierGrantDtoSchema).optional(),
  maxStack: z.number().int().optional(),
  maxBonus: z.number().int().optional(),
  armorClass: z.number().int().optional(),
  contains: z.array(containsDtoSchema).optional(),
  features: z.array(featureDtoSchema).optional(),
  restrictions: characterFacetDtoSchema.optional(),
  requiresAttunement: z.boolean().optional(),
  properties: z.array(equipmentPropertyCodeSchema),
  category: z.enum([
    EQUIPMENT_CATEGORY_CODE.WEAPON,
    EQUIPMENT_CATEGORY_CODE.ARMOR,
    EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
    EQUIPMENT_CATEGORY_CODE.TOOL,
    EQUIPMENT_CATEGORY_CODE.SHIELD
  ])
})

const equipmentVariantAuthoredDtoSchemaBase = equipmentBaseDtoSchema.extend({
  category: z.literal(EQUIPMENT_CATEGORY_CODE.VARIANT),
  parentEquipmentId: z.string(),
  properties: z.array(equipmentPropertyCodeSchema).optional(),
  effects: z.array(effectDtoSchema).optional(),
  charges: chargeDtoSchema.optional(),
  modifiers: z.array(modifierGrantDtoSchema).optional(),
  maxBonus: z.number().int().optional(),
  features: z.array(featureDtoSchema).optional(),
  restrictions: characterFacetDtoSchema.optional(),
  requiresAttunement: z.boolean().optional()
})

const baseEquipmentAuthoringInputDtoSchemaBase = baseEquipmentAuthoredDtoSchemaBase.extend({
  userId: z.string().optional()
})

const equipmentVariantAuthoringInputDtoSchemaBase = equipmentVariantAuthoredDtoSchemaBase.extend({
  userId: z.string().optional()
})

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
export const baseEquipmentAuthoredDtoSchema: z.ZodType<BaseEquipmentAuthoredDto> =
  baseEquipmentAuthoredDtoSchemaBase
export const equipmentVariantAuthoredDtoSchema: z.ZodType<EquipmentVariantAuthoredDto> =
  equipmentVariantAuthoredDtoSchemaBase
export const baseEquipmentAuthoringInputDtoSchema: z.ZodType<BaseEquipmentAuthoringInputDto> =
  baseEquipmentAuthoringInputDtoSchemaBase
export const equipmentVariantAuthoringInputDtoSchema: z.ZodType<EquipmentVariantAuthoringInputDto> =
  equipmentVariantAuthoringInputDtoSchemaBase
export const equipmentAuthoredDtoSchema: z.ZodType<EquipmentAuthoredDto> = z.union([
  baseEquipmentAuthoredDtoSchema,
  equipmentVariantAuthoredDtoSchema
])
export const equipmentAuthoringInputDtoSchema: z.ZodType<EquipmentAuthoringInputDto> = z.union([
  baseEquipmentAuthoringInputDtoSchema,
  equipmentVariantAuthoringInputDtoSchema
])
