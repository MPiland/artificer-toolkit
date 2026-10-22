import { z, lazySchema } from '../zod.js'
import { findLootRangeRefusal } from '@artificer-toolkit/shared/vtt/lootTable'
import { postgresUuidSchema } from '../shared/postgresUuid.js'

const uuid = postgresUuidSchema
const positiveInt = (maximum: number) =>
  z.number().check(z.int()).check(z.gte(1)).check(z.lte(maximum))

export const SCENE_LOOT_LIMITS = {
  tables: 20,
  rangesPerTable: 20,
  entriesPerRange: 20,
  quantity: 9_999,
  coins: 1_000_000_000
} as const

/** A reference only: the app never resolves a roll against a table or grants its entries. */
export const sceneLootEntrySchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.strictObject({
      kind: z.literal('ITEM'),
      itemId: uuid,
      quantity: positiveInt(SCENE_LOOT_LIMITS.quantity)
    }),
    z.strictObject({
      kind: z.literal('COIN'),
      denominationId: uuid,
      amount: positiveInt(SCENE_LOOT_LIMITS.coins)
    })
  ])
)

export const sceneLootRangeSchema = lazySchema(() =>
  z.strictObject({
    id: uuid,
    min: z.number().check(z.int()),
    max: z.nullable(z.number().check(z.int())),
    entries: z.array(sceneLootEntrySchema).check(z.maxLength(SCENE_LOOT_LIMITS.entriesPerRange)),
    note: z.optional(z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(500)))
  })
)

export const sceneLootTableSchema = lazySchema(() =>
  z
    .strictObject({
      id: uuid,
      name: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(80)),
      /** A skill id from the Campaign System's vocabulary. */
      skillId: z.optional(uuid),
      ranges: z
        .array(sceneLootRangeSchema)
        .check(z.minLength(1))
        .check(z.maxLength(SCENE_LOOT_LIMITS.rangesPerTable))
    })
    .check(
      z.superRefine((table, ctx) => {
        const refusal = findLootRangeRefusal(table.ranges)
        if (refusal) ctx.addIssue({ code: 'custom', path: ['ranges'], message: refusal.message })
      })
    )
)

const sceneLootTablesSchema = lazySchema(() =>
  z.array(sceneLootTableSchema).check(
    z.maxLength(SCENE_LOOT_LIMITS.tables),
    z.superRefine((tables, ctx) => {
      if (new Set(tables.map((table) => table.id)).size !== tables.length)
        ctx.addIssue({ code: 'custom', message: 'Loot table ids must be unique.' })
    })
  )
)

export const sceneLootLookupInputSchema = lazySchema(() =>
  z.strictObject({ campaignId: uuid, sceneId: uuid })
)

/** `version` 0 with no tables is a Scene that has never had loot saved. */
export const sceneLootDocumentSchema = lazySchema(() =>
  z.strictObject({
    campaignId: uuid,
    sceneId: uuid,
    version: z.number().check(z.int()).check(z.nonnegative()),
    tables: sceneLootTablesSchema
  })
)

export const saveSceneLootInputSchema = lazySchema(() =>
  z.strictObject({
    campaignId: uuid,
    sceneId: uuid,
    expectedVersion: z.number().check(z.int()).check(z.nonnegative()),
    tables: sceneLootTablesSchema
  })
)

export type SceneLootEntry = z.infer<typeof sceneLootEntrySchema>
export type SceneLootRange = z.infer<typeof sceneLootRangeSchema>
export type SceneLootTable = z.infer<typeof sceneLootTableSchema>
export type SceneLootDocument = z.infer<typeof sceneLootDocumentSchema>
export type SaveSceneLootInput = z.infer<typeof saveSceneLootInputSchema>
