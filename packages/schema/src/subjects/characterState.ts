import { z } from '../zod.js'
import { characterCurrencyAmountDtoSchema } from '../shared/characterCurrency.js'

import {
  CREATURE_ORIGIN_KIND_CODE,
  CREATURE_RELATIONSHIP_KIND_CODE
} from '@artificer-toolkit/shared/core'

const characterEquipmentItemStateDtoSchemaRaw = z.object({
  id: z.string(),
  equipmentId: z.string(),
  quantity: z.number().check(z.int()),
  containerId: z.optional(z.string()),
  customName: z.optional(z.string()),
  notes: z.optional(z.string()),
  retainedRulesJson: z.optional(z.string())
})
const characterEquipmentStateDtoSchemaRaw = z.object({
  inventory: z.array(characterEquipmentItemStateDtoSchemaRaw),
  equipped: z.array(z.string()),
  attuned: z.array(z.string())
})
const characterHitDiceUsageStateDtoSchemaRaw = z
  .object({
    die: z.number().check(z.int()).check(z.positive()),
    total: z.number().check(z.int()).check(z.nonnegative()),
    used: z.number().check(z.int()).check(z.nonnegative())
  })
  .check(
    z.refine(({ total, used }) => used <= total, {
      message: 'Used hit dice cannot exceed the total.'
    })
  )
const characterHitDiceUsageStateDtoSchema = z.array(characterHitDiceUsageStateDtoSchemaRaw).check(
  z.superRefine((hitDice, context) => {
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
)
const characterOwnedCreatureStateDtoSchemaRaw = z.object({
  id: z.string(),
  creatureId: z.string(),
  relationshipKind: z.enum([
    CREATURE_RELATIONSHIP_KIND_CODE.COMPANION,
    CREATURE_RELATIONSHIP_KIND_CODE.MOUNT,
    CREATURE_RELATIONSHIP_KIND_CODE.OWNED
  ]),
  originKind: z.enum([CREATURE_ORIGIN_KIND_CODE.WORLD, CREATURE_ORIGIN_KIND_CODE.SUMMONED]),
  customName: z.optional(z.string()),
  notes: z.optional(z.string()),
  isActive: z.optional(z.boolean()),
  currentHitPoints: z.optional(z.number().check(z.int()).check(z.nonnegative())),
  tempHitPoints: z.optional(z.number().check(z.int()).check(z.nonnegative())),
  hitDice: z.optional(characterHitDiceUsageStateDtoSchema)
})
const characterOwnedVehicleStateDtoSchemaRaw = z.object({
  id: z.string(),
  vehicleId: z.string(),
  customName: z.optional(z.string()),
  notes: z.optional(z.string()),
  isActive: z.optional(z.boolean()),
  currentHitPoints: z.optional(z.number().check(z.int()).check(z.nonnegative()))
})
const characterRosterEquipmentAssignmentStateDtoSchemaRaw = z.object({
  equipmentItemId: z.string()
})
const characterCurrencyGroupStateDtoSchemaRaw = z.object({
  id: z.string(),
  containerId: z.optional(z.string()),
  currencies: z.array(characterCurrencyAmountDtoSchema)
})
const characterClassSpellStateDtoSchemaRaw = z.object({
  learned: z.optional(z.array(z.string())),
  prepared: z.optional(z.array(z.string()))
})
const characterClassStateDtoSchemaRaw = z.object({
  classId: z.string(),
  spells: z.optional(characterClassSpellStateDtoSchemaRaw)
})
const characterResourceUsageStateDtoSchemaRaw = z.object({
  resourceGrantId: z.string(),
  used: z.number().check(z.int())
})
const characterSpellSlotUsageStateDtoSchemaRaw = z.object({
  slotKey: z.string(),
  used: z.number().check(z.int()).check(z.gte(0))
})
const characterConditionStateDtoSchemaRaw = z.object({
  conditionTypeId: z.string(),
  notes: z.optional(z.string())
})
const characterExhaustionStateDtoSchemaRaw = z.object({
  level: z.number().check(z.int()).check(z.gte(0)).check(z.lte(6)),
  notes: z.optional(z.string())
})
const characterNoteGroupStateDtoSchemaRaw = z.object({
  id: z.string(),
  label: z.string(),
  sortOrder: z.number().check(z.int()),
  kind: z.enum(['SESSION', 'LOOT', 'CHARACTERS', 'PLACES', 'CUSTOM'])
})
const characterNoteStateDtoSchemaRaw = z.object({
  id: z.string(),
  title: z.string(),
  body: z.optional(z.string()),
  groupId: z.string(),
  pinned: z.optional(z.boolean()),
  createdAt: z.string(),
  updatedAt: z.string()
})
const characterHitpointsStateDtoSchemaRaw = z.object({
  current: z.number().check(z.int()),
  temp: z.optional(z.number().check(z.int())),
  hitDice: characterHitDiceUsageStateDtoSchema
})
const characterStateDtoSchemaRaw = z.object({
  equipment: characterEquipmentStateDtoSchemaRaw,
  currency: z.array(characterCurrencyGroupStateDtoSchemaRaw),
  hitpoints: characterHitpointsStateDtoSchemaRaw,
  inspiration: z.optional(z.boolean()),
  classes: z.optional(z.array(characterClassStateDtoSchemaRaw)),
  resources: z.optional(z.array(characterResourceUsageStateDtoSchemaRaw)),
  spellSlots: z.optional(z.array(characterSpellSlotUsageStateDtoSchemaRaw)),
  conditions: z.optional(z.array(characterConditionStateDtoSchemaRaw)),
  exhaustion: z.optional(characterExhaustionStateDtoSchemaRaw),
  noteGroups: z.optional(z.array(characterNoteGroupStateDtoSchemaRaw)),
  notes: z.optional(z.array(characterNoteStateDtoSchemaRaw)),
  creatures: z.optional(z.array(characterOwnedCreatureStateDtoSchemaRaw)),
  vehicles: z.optional(z.array(characterOwnedVehicleStateDtoSchemaRaw)),
  creatureEquipment: z.optional(
    z.record(z.string(), z.array(characterRosterEquipmentAssignmentStateDtoSchemaRaw))
  ),
  vehicleEquipment: z.optional(
    z.record(z.string(), z.array(characterRosterEquipmentAssignmentStateDtoSchemaRaw))
  )
})

export type CharacterStateDto = z.infer<typeof characterStateDtoSchemaRaw>

export const characterStateDtoSchema = characterStateDtoSchemaRaw
