import { z, lazySchema } from '../zod.js'
import { characterCurrencyAmountDtoSchema } from '../shared/characterCurrency.js'
import { characterConsequencesDtoSchema } from '../shared/consequenceRolls.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { speedDtoSchema } from '../shared/speed.js'
import { systemCoreCodeSchema } from '../shared/systemCoreCode.js'
import type { CharacterSpellSummonState } from '@artificer-toolkit/shared/authored'

import {
  CREATURE_ORIGIN_KIND_CODE,
  CREATURE_RELATIONSHIP_KIND_CODE,
  EQUIPPED_SLOT_CODES,
  HAND_CONFLICT_MESSAGE
} from '@artificer-toolkit/shared/core'

const characterEquipmentItemStateDtoSchemaRaw = lazySchema(() =>
  z.object({
    id: z.string(),
    equipmentId: z.string(),
    quantity: z.number().check(z.int()),
    containerId: z.optional(z.string()),
    customName: z.optional(z.string()),
    notes: z.optional(z.string()),
    retainedRulesJson: z.optional(z.string()),
    /** Corrosion play has put on the item; derived by `effectiveInventory`, never stored on the row. */
    degradation: z.optional(z.number().check(z.int()).check(z.positive()))
  })
)
const characterEquippedItemStateDtoSchemaRaw = lazySchema(() =>
  z.strictObject({
    itemId: z.string(),
    slot: z.enum(EQUIPPED_SLOT_CODES)
  })
)
/**
 * Each item is equipped once and each hand holds one item. Whether an item is two-handed is
 * Equipment data the schema does not know, so the Sheet reducer checks the full hand rule.
 */
const characterEquippedStateDtoSchema = lazySchema(() =>
  z.array(characterEquippedItemStateDtoSchemaRaw).check(
    z.superRefine((equipped, context) => {
      const itemIds = new Set<string>()
      const hands = new Set<string>()
      equipped.forEach(({ itemId, slot }, index) => {
        if (itemIds.has(itemId))
          context.addIssue({
            code: 'custom',
            path: [index, 'itemId'],
            message: 'An item can be equipped only once.'
          })
        itemIds.add(itemId)
        if (slot === 'WORN') return
        if (hands.has(slot))
          context.addIssue({
            code: 'custom',
            path: [index, 'slot'],
            message: HAND_CONFLICT_MESSAGE.HAND_OCCUPIED_TWICE
          })
        hands.add(slot)
      })
    })
  )
)
const characterEquipmentStateDtoSchemaRaw = lazySchema(() =>
  z.object({
    inventory: z.array(characterEquipmentItemStateDtoSchemaRaw),
    equipped: characterEquippedStateDtoSchema,
    attuned: z.array(z.string())
  })
)
const characterHitDiceUsageStateDtoSchemaRaw = lazySchema(() =>
  z
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
)
const characterHitDiceUsageStateDtoSchema = lazySchema(() =>
  z.array(characterHitDiceUsageStateDtoSchemaRaw).check(
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
)
const characterOwnedCreatureStateDtoSchemaRaw = lazySchema(() =>
  z.object({
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
)
/**
 * A creature a spell cast from the Sheet conjured outside an Encounter (D190): play state the Sheet
 * owns, holding the stat block values the cast resolved against the caster.
 */
const characterSpellSummonStateDtoSchemaRaw: z.ZodMiniType<CharacterSpellSummonState> = lazySchema(
  () =>
    z
      .object({
        id: postgresUuidSchema,
        spellId: z.string(),
        summonOutcomeId: z.string(),
        label: z.string().check(z.minLength(1)),
        /** The cast opened Concentration: this summon is the Sheet's Concentration and ends with it. */
        concentration: z.boolean(),
        size: z.optional(systemCoreCodeSchema),
        armorClass: z.nullable(z.number().check(z.int()).check(z.nonnegative())),
        abilityScores: z.optional(z.record(systemCoreCodeSchema, z.number().check(z.int()))),
        speeds: z.optional(z.array(speedDtoSchema)),
        passivePerception: z.optional(z.number().check(z.int())),
        /** Absent with `currentHitPoints` when the stat block gives no hit points: no pool. */
        maximumHitPoints: z.optional(z.number().check(z.int()).check(z.positive())),
        currentHitPoints: z.optional(z.number().check(z.int()).check(z.positive())),
        tempHitPoints: z.optional(z.number().check(z.int()).check(z.nonnegative())),
        customName: z.optional(z.string()),
        notes: z.optional(z.string()),
        castAt: z.iso.datetime()
      })
      .check(
        z.refine(
          (summon) =>
            (summon.maximumHitPoints === undefined) === (summon.currentHitPoints === undefined) &&
            (summon.maximumHitPoints !== undefined || summon.tempHitPoints === undefined),
          'A summon has current and maximum hit points together, or no hit point pool.'
        )
      )
)
const characterOwnedVehicleStateDtoSchemaRaw = lazySchema(() =>
  z.object({
    id: z.string(),
    vehicleId: z.string(),
    customName: z.optional(z.string()),
    notes: z.optional(z.string()),
    isActive: z.optional(z.boolean()),
    currentHitPoints: z.optional(z.number().check(z.int()).check(z.nonnegative()))
  })
)
const characterRosterEquipmentAssignmentStateDtoSchemaRaw = lazySchema(() =>
  z.object({
    equipmentItemId: z.string()
  })
)
const characterCurrencyGroupStateDtoSchemaRaw = lazySchema(() =>
  z.object({
    id: z.string(),
    containerId: z.optional(z.string()),
    currencies: z.array(characterCurrencyAmountDtoSchema)
  })
)
const characterClassSpellStateDtoSchemaRaw = lazySchema(() =>
  z.object({
    learned: z.optional(z.array(z.string())),
    prepared: z.optional(z.array(z.string()))
  })
)
const characterClassStateDtoSchemaRaw = lazySchema(() =>
  z.object({
    classId: z.string(),
    spells: z.optional(characterClassSpellStateDtoSchemaRaw)
  })
)
const characterResourceUsageStateDtoSchemaRaw = lazySchema(() =>
  z.object({
    resourceGrantId: z.string(),
    used: z.number().check(z.int())
  })
)
const characterSpellSlotUsageStateDtoSchemaRaw = lazySchema(() =>
  z.object({
    slotKey: z.string(),
    used: z.number().check(z.int()).check(z.gte(0))
  })
)
const characterConditionStateDtoSchemaRaw = lazySchema(() =>
  z.object({
    conditionTypeId: z.string(),
    notes: z.optional(z.string())
  })
)
const characterExhaustionStateDtoSchemaRaw = lazySchema(() =>
  z.object({
    level: z.number().check(z.int()).check(z.gte(0)).check(z.lte(6)),
    notes: z.optional(z.string())
  })
)
const characterNoteGroupStateDtoSchemaRaw = lazySchema(() =>
  z.object({
    id: z.string(),
    label: z.string(),
    sortOrder: z.number().check(z.int()),
    kind: z.enum(['SESSION', 'LOOT', 'CHARACTERS', 'PLACES', 'CUSTOM'])
  })
)
const characterNoteStateDtoSchemaRaw = lazySchema(() =>
  z.object({
    id: z.string(),
    title: z.string(),
    body: z.optional(z.string()),
    groupId: z.string(),
    pinned: z.optional(z.boolean()),
    createdAt: z.string(),
    updatedAt: z.string()
  })
)
/** Death saves (D96). Dying is 0 HP, not stable and under 3 failures; dead is 3 failures. */
export const characterDeathSavesDtoSchema = lazySchema(() =>
  z.strictObject({
    successes: z.number().check(z.int()).check(z.gte(0)).check(z.lte(3)),
    failures: z.number().check(z.int()).check(z.gte(0)).check(z.lte(3)),
    stable: z.boolean()
  })
)
/** A Character with no death save history: every creator starts here. */
export const NO_DEATH_SAVES: Readonly<z.infer<typeof characterDeathSavesDtoSchema>> = {
  successes: 0,
  failures: 0,
  stable: false
}
const characterHitpointsStateDtoSchemaRaw = lazySchema(() =>
  z.object({
    current: z.number().check(z.int()),
    temp: z.number().check(z.int()),
    /** The active effect whose temporary hit points `temp` holds; they end with it (D156). */
    tempSourceEffectId: z.optional(postgresUuidSchema),
    hitDice: characterHitDiceUsageStateDtoSchema,
    deathSaves: characterDeathSavesDtoSchema
  })
)
const characterStateDtoSchemaRaw = lazySchema(() =>
  z.object({
    equipment: characterEquipmentStateDtoSchemaRaw,
    currency: z.array(characterCurrencyGroupStateDtoSchemaRaw),
    hitpoints: characterHitpointsStateDtoSchemaRaw,
    inspiration: z.optional(z.boolean()),
    classes: z.optional(z.array(characterClassStateDtoSchemaRaw)),
    resources: z.optional(z.array(characterResourceUsageStateDtoSchemaRaw)),
    spellSlots: z.optional(z.array(characterSpellSlotUsageStateDtoSchemaRaw)),
    conditions: z.optional(z.array(characterConditionStateDtoSchemaRaw)),
    exhaustion: z.optional(characterExhaustionStateDtoSchemaRaw),
    /** Consequence table rows the GM accepted, such as lingering injuries; the GM removes them. */
    consequences: z.optional(characterConsequencesDtoSchema),
    spellSummons: z.optional(z.array(characterSpellSummonStateDtoSchemaRaw)),
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
)

export type CharacterStateDto = z.infer<typeof characterStateDtoSchemaRaw>

export const characterStateDtoSchema = characterStateDtoSchemaRaw
export const characterEquipmentItemStateDtoSchema = characterEquipmentItemStateDtoSchemaRaw
export const characterCurrencyGroupStateDtoSchema = characterCurrencyGroupStateDtoSchemaRaw
export const characterClassStateDtoSchema = characterClassStateDtoSchemaRaw
export const characterOwnedCreatureStateDtoSchema = characterOwnedCreatureStateDtoSchemaRaw
export const characterOwnedVehicleStateDtoSchema = characterOwnedVehicleStateDtoSchemaRaw
export const characterSpellSummonStateDtoSchema = characterSpellSummonStateDtoSchemaRaw
export type CharacterSpellSummonStateDto = z.infer<typeof characterSpellSummonStateDtoSchemaRaw>
export const characterNoteGroupStateDtoSchema = characterNoteGroupStateDtoSchemaRaw
export const characterNoteStateDtoSchema = characterNoteStateDtoSchemaRaw
