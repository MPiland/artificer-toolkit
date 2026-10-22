import { z, lazySchema } from '../zod.js'
import { findLootRangeRefusal } from '@artificer-toolkit/shared/vtt/lootTable'
import { postgresUuidSchema } from '../shared/postgresUuid.js'

const uuid = postgresUuidSchema
const positiveInt = (maximum: number) =>
  z.number().check(z.int()).check(z.gte(1)).check(z.lte(maximum))

export const LOOT_LIMITS = {
  tables: 20,
  rangesPerTable: 20,
  entriesPerRange: 20,
  quantity: 9_999,
  coins: 1_000_000_000
} as const

/** A reference only: the app never resolves a roll against a table or grants its entries. */
export const lootEntrySchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.strictObject({
      kind: z.literal('ITEM'),
      itemId: uuid,
      quantity: positiveInt(LOOT_LIMITS.quantity)
    }),
    z.strictObject({
      kind: z.literal('COIN'),
      denominationId: uuid,
      amount: positiveInt(LOOT_LIMITS.coins)
    })
  ])
)

export const lootRangeSchema = lazySchema(() =>
  z.strictObject({
    id: uuid,
    min: z.number().check(z.int()),
    max: z.nullable(z.number().check(z.int())),
    entries: z.array(lootEntrySchema).check(z.maxLength(LOOT_LIMITS.entriesPerRange)),
    note: z.optional(z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(500)))
  })
)

export const lootTableSchema = lazySchema(() =>
  z
    .strictObject({
      id: uuid,
      name: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(80)),
      /** A skill id from the Campaign System's vocabulary. */
      skillId: z.optional(uuid),
      ranges: z
        .array(lootRangeSchema)
        .check(z.minLength(1))
        .check(z.maxLength(LOOT_LIMITS.rangesPerTable))
    })
    .check(
      z.superRefine((table, ctx) => {
        const refusal = findLootRangeRefusal(table.ranges)
        if (refusal) ctx.addIssue({ code: 'custom', path: ['ranges'], message: refusal.message })
      })
    )
)

const lootTablesSchema = lazySchema(() =>
  z.array(lootTableSchema).check(
    z.maxLength(LOOT_LIMITS.tables),
    z.superRefine((tables, ctx) => {
      if (new Set(tables.map((table) => table.id)).size !== tables.length)
        ctx.addIssue({ code: 'custom', message: 'Loot table ids must be unique.' })
    })
  )
)

/** Who the loot reference belongs to. Encounter placement adds its own kind here, not a second table. */
export const lootOwnerSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.strictObject({
      kind: z.literal('SCENE'),
      campaignId: uuid,
      sceneDefinitionId: uuid
    })
  ])
)

export const lootLookupInputSchema = lazySchema(() => z.strictObject({ owner: lootOwnerSchema }))

/** `version` 0 with no tables is an owner that has never had loot saved. */
export const lootDocumentSchema = lazySchema(() =>
  z.strictObject({
    owner: lootOwnerSchema,
    version: z.number().check(z.int()).check(z.nonnegative()),
    tables: lootTablesSchema
  })
)

export const saveLootInputSchema = lazySchema(() =>
  z.strictObject({
    owner: lootOwnerSchema,
    expectedVersion: z.number().check(z.int()).check(z.nonnegative()),
    tables: lootTablesSchema
  })
)

export type LootEntry = z.infer<typeof lootEntrySchema>
export type LootRange = z.infer<typeof lootRangeSchema>
export type LootTable = z.infer<typeof lootTableSchema>
export type LootOwner = z.infer<typeof lootOwnerSchema>
export type LootDocument = z.infer<typeof lootDocumentSchema>
export type SaveLootInput = z.infer<typeof saveLootInputSchema>
