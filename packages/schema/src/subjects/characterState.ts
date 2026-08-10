import { z } from 'zod'

import {
  CREATURE_ORIGIN_KIND_CODE,
  CREATURE_RELATIONSHIP_KIND_CODE
} from '@artificer-toolkit/shared/core'

const characterEquipmentItemStateDtoSchemaRaw = z.object({
  id: z.string(),
  equipmentId: z.string(),
  quantity: z.number().int(),
  containerId: z.string().optional(),
  customName: z.string().optional(),
  notes: z.string().optional()
})
const characterEquipmentStateDtoSchemaRaw = z.object({
  inventory: z.array(characterEquipmentItemStateDtoSchemaRaw),
  equipped: z.array(z.string()),
  attuned: z.array(z.string())
})
const characterHitDiceUsageStateDtoSchemaRaw = z
  .object({
    die: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    used: z.number().int().nonnegative()
  })
  .refine(({ total, used }) => used <= total, { message: 'Used hit dice cannot exceed the total.' })
const characterHitDiceUsageStateDtoSchema = z
  .array(characterHitDiceUsageStateDtoSchemaRaw)
  .superRefine((hitDice, context) => {
    const seen = new Set<number>()
    hitDice.forEach(({ die }, index) => {
      if (seen.has(die))
        context.addIssue({
          code: 'custom',
          path: [index, 'die'],
          message: 'Hit dice denominations must be unique.'
        })
      seen.add(die)
    })
  })
const characterOwnedCreatureStateDtoSchemaRaw = z.object({
  id: z.string(),
  creatureId: z.string(),
  relationshipKind: z.enum([
    CREATURE_RELATIONSHIP_KIND_CODE.COMPANION,
    CREATURE_RELATIONSHIP_KIND_CODE.MOUNT,
    CREATURE_RELATIONSHIP_KIND_CODE.OWNED
  ]),
  originKind: z.enum([CREATURE_ORIGIN_KIND_CODE.WORLD, CREATURE_ORIGIN_KIND_CODE.SUMMONED]),
  customName: z.string().optional(),
  notes: z.string().optional(),
  isActive: z.boolean().optional(),
  currentHitPoints: z.number().int().nonnegative().optional(),
  tempHitPoints: z.number().int().nonnegative().optional(),
  hitDice: characterHitDiceUsageStateDtoSchema.optional()
})
const characterOwnedVehicleStateDtoSchemaRaw = z.object({
  id: z.string(),
  vehicleId: z.string(),
  customName: z.string().optional(),
  notes: z.string().optional(),
  isActive: z.boolean().optional(),
  currentHitPoints: z.number().int().nonnegative().optional()
})
const characterRosterEquipmentAssignmentStateDtoSchemaRaw = z.object({
  equipmentItemId: z.string()
})
const characterCurrencyAmountStateDtoSchemaRaw = z.object({
  currencyId: z.string(),
  amount: z.number()
})
const characterCurrencyGroupStateDtoSchemaRaw = z.object({
  id: z.string(),
  containerId: z.string().optional(),
  currencies: z.array(characterCurrencyAmountStateDtoSchemaRaw)
})
const characterClassSpellStateDtoSchemaRaw = z.object({
  learned: z.array(z.string()).optional(),
  prepared: z.array(z.string()).optional()
})
const characterClassStateDtoSchemaRaw = z.object({
  classId: z.string(),
  spells: characterClassSpellStateDtoSchemaRaw.optional()
})
const characterResourceUsageStateDtoSchemaRaw = z.object({
  resourceGrantId: z.string(),
  used: z.number().int()
})
const characterSpellSlotUsageStateDtoSchemaRaw = z.object({
  slotKey: z.string(),
  used: z.number().int().min(0)
})
const characterConditionStateDtoSchemaRaw = z.object({
  conditionTypeId: z.string(),
  notes: z.string().optional()
})
const characterExhaustionStateDtoSchemaRaw = z.object({
  level: z.number().int().min(0).max(6),
  notes: z.string().optional()
})
const characterNoteGroupStateDtoSchemaRaw = z.object({
  id: z.string(),
  label: z.string(),
  sortOrder: z.number().int(),
  kind: z.enum(['SESSION', 'LOOT', 'CHARACTERS', 'PLACES', 'CUSTOM'])
})
const characterNoteStateDtoSchemaRaw = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string().optional(),
  groupId: z.string(),
  pinned: z.boolean().optional(),
  createdAt: z.string(),
  updatedAt: z.string()
})
const characterHitpointsStateDtoSchemaRaw = z.object({
  current: z.number().int(),
  temp: z.number().int().optional(),
  hitDice: characterHitDiceUsageStateDtoSchema
})
const characterStateDtoSchemaRaw = z.object({
  equipment: characterEquipmentStateDtoSchemaRaw,
  currency: z.array(characterCurrencyGroupStateDtoSchemaRaw),
  hitpoints: characterHitpointsStateDtoSchemaRaw,
  inspiration: z.boolean().optional(),
  classes: z.array(characterClassStateDtoSchemaRaw).optional(),
  resources: z.array(characterResourceUsageStateDtoSchemaRaw).optional(),
  spellSlots: z.array(characterSpellSlotUsageStateDtoSchemaRaw).optional(),
  conditions: z.array(characterConditionStateDtoSchemaRaw).optional(),
  exhaustion: characterExhaustionStateDtoSchemaRaw.optional(),
  noteGroups: z.array(characterNoteGroupStateDtoSchemaRaw).optional(),
  notes: z.array(characterNoteStateDtoSchemaRaw).optional(),
  creatures: z.array(characterOwnedCreatureStateDtoSchemaRaw).optional(),
  vehicles: z.array(characterOwnedVehicleStateDtoSchemaRaw).optional(),
  creatureEquipment: z
    .record(z.string(), z.array(characterRosterEquipmentAssignmentStateDtoSchemaRaw))
    .optional(),
  vehicleEquipment: z
    .record(z.string(), z.array(characterRosterEquipmentAssignmentStateDtoSchemaRaw))
    .optional()
})

export type CharacterStateDto = z.infer<typeof characterStateDtoSchemaRaw>

export const characterStateDtoSchema = characterStateDtoSchemaRaw
