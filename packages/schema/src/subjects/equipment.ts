import { EQUIPMENT_CATEGORY_CODE } from '@artificer-toolkit/shared'
import { z } from 'zod'

import {
  capacityDtoSchema,
  containsDtoSchema,
  costDtoSchema,
  equipmentAbilityDtoSchema,
  weightDtoSchema
} from './shared.js'
import {
  chargeDtoSchema,
  facetDtoSchema,
  speedDtoSchema
} from '../shared/index.js'
import { capabilityDtoSchema } from '../effects/index.js'
import { featureDtoSchema } from '../features/index.js'
import { modifierGrantDtoSchema } from '../grants/index.js'

const equipmentBaseDtoSchema = z.object({
  kind: z.literal('EQUIPMENT'),
  id: z.string(),
  label: z.string(),
  description: z.string().nullable(),
  attributes: z.array(z.string()).optional(),
  quote: z.string().optional(),
  cost: costDtoSchema.optional(),
  weight: weightDtoSchema,
  capabilities: z.array(capabilityDtoSchema).optional(),
  effects: z.array(capabilityDtoSchema).optional(),
  charges: chargeDtoSchema.optional(),
  capacity: capacityDtoSchema.optional(),
  modifiers: z.array(modifierGrantDtoSchema).optional(),
  maxStack: z.number().int().optional(),
  rarityId: z.string(),
  maxBonus: z.number().int().optional(),
  armorClass: z.number().int().optional(),
  contains: z.array(containsDtoSchema).optional(),
  features: z.array(featureDtoSchema).optional(),
  restrictions: facetDtoSchema.optional(),
  userId: z.string(),
  systemId: z.string()
})

const equipmentAuthoredDtoSchemaBase = equipmentBaseDtoSchema.extend({
  properties: z.array(z.string()),
  category: z.string(),
  abilities: z.array(equipmentAbilityDtoSchema),
  speed: speedDtoSchema.optional()
})

const equipmentVariantAuthoredDtoSchemaBase = equipmentBaseDtoSchema.extend({
  category: z.literal(EQUIPMENT_CATEGORY_CODE.VARIANT),
  parentEquipmentId: z.string(),
  properties: z.array(z.string()).optional()
})

export type EquipmentAuthoredDto = z.infer<typeof equipmentAuthoredDtoSchemaBase>
export type EquipmentVariantAuthoredDto = z.infer<typeof equipmentVariantAuthoredDtoSchemaBase>
export const equipmentAuthoredDtoSchema: z.ZodType<EquipmentAuthoredDto> = equipmentAuthoredDtoSchemaBase
export const equipmentVariantAuthoredDtoSchema: z.ZodType<EquipmentVariantAuthoredDto> = equipmentVariantAuthoredDtoSchemaBase
