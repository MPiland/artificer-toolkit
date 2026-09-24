import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import type { Validator } from 'convex/values'
import type { z } from 'zod'
import {
  createEncounterBlueprintInputDtoSchema,
  updateEncounterBlueprintInputDtoSchema,
  encounterBlueprintDtoSchema,
  type EncounterBlueprintDto
} from '@artificer-toolkit/schema/api/encounterData'
import {
  encounterStoredBlueprintSchema,
  encounterStoredBlueprintUpdateSchema
} from '@artificer-toolkit/schema/projections/encounterBlueprintPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import {
  encounterBlueprintListInputSchema,
  encounterBlueprintPageSchema,
  type EncounterBlueprintPage
} from '@artificer-toolkit/schema/api/encounterBlueprintPages'
import { ENTITLEMENT_LIMITS } from '@artificer-toolkit/shared/account/entitlements'
import { query } from '../_generated/server'
import { mutation } from '../lib/mutations'
import type { Doc } from '../_generated/dataModel'
import { requireIdentity } from '../lib/identity'
import { syncAccountUsage } from '../lib/accountUsage'
import { snapshotBlueprintEnemies } from './blueprintSnapshots'

// Keep recursive JSON field paths inside the validator boundary; every result is schema-parsed.
const blueprintValidator: Validator<EncounterBlueprintDto, 'required', string> = zodToConvex<
  z.core.$ZodType<EncounterBlueprintDto>
>(encounterBlueprintDtoSchema)

export function readBlueprint(row: Doc<'encounterBlueprints'>): EncounterBlueprintDto {
  const {
    _id,
    _creationTime,
    ownerUserId: _ownerUserId,
    commandId: _commandId,
    commandFingerprint: _commandFingerprint,
    enemiesJson,
    ...metadata
  } = row
  const result = encounterBlueprintDtoSchema.parse({
    ...metadata,
    enemies: JSON.parse(enemiesJson)
  })
  if (
    checksumCanonicalJson({ name: result.name, enemies: result.enemies }) !== result.setupChecksum
  ) {
    throw new Error('Stored Encounter Blueprint checksum mismatch.')
  }
  return result
}

export const list = query({
  args: zodToConvexFields(encounterBlueprintListInputSchema.shape),
  returns: zodToConvex<z.core.$ZodType<EncounterBlueprintPage>>(encounterBlueprintPageSchema),
  handler: async (ctx, args): Promise<EncounterBlueprintPage> => {
    const { userId } = await requireIdentity(ctx)
    const { gameSystemId, paginationOpts } = encounterBlueprintListInputSchema.parse(args)
    const result = await ctx.db
      .query('encounterBlueprints')
      .withIndex('by_ownerUserId_gameSystemId_createdAt_id', (q) =>
        q.eq('ownerUserId', userId).eq('gameSystemId', gameSystemId)
      )
      .order('desc')
      .paginate({ ...paginationOpts, maximumRowsRead: 8, maximumBytesRead: 1024 * 1024 })
    return encounterBlueprintPageSchema.parse({ ...result, page: result.page.map(readBlueprint) })
  }
})

export const create = mutation({
  args: zodToConvexFields(createEncounterBlueprintInputDtoSchema.shape),
  returns: blueprintValidator,
  handler: async (ctx, args): Promise<EncounterBlueprintDto> => {
    const { userId } = await requireIdentity(ctx)
    const input = createEncounterBlueprintInputDtoSchema.parse(args)
    const commandFingerprint = checksumCanonicalJson(input)
    const prior = await ctx.db
      .query('encounterBlueprints')
      .withIndex('by_ownerUserId_commandId', (q) =>
        q.eq('ownerUserId', userId).eq('commandId', input.commandId)
      )
      .unique()
    if (prior) {
      if (prior.commandFingerprint !== commandFingerprint)
        throw new Error('Command ID was already used with different input.')
      return readBlueprint(prior)
    }
    const entitlement = await ctx.db
      .query('accountEntitlements')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .unique()
    const limit = ENTITLEMENT_LIMITS[entitlement?.tier ?? 'FREE'].savedEncounters
    if (limit !== null) {
      const owned = await ctx.db
        .query('encounterBlueprints')
        .withIndex('by_ownerUserId_gameSystemId_createdAt_id', (q) => q.eq('ownerUserId', userId))
        .take(limit)
      if (owned.length >= limit)
        throw new Error('Your account has reached its savedEncounters limit.')
    }
    const enemies = await snapshotBlueprintEnemies(ctx, userId, input)
    const now = new Date().toISOString()
    const result = encounterBlueprintDtoSchema.parse({
      id: crypto.randomUUID(),
      gameSystemId: input.gameSystemId,
      name: input.name,
      version: 1,
      enemies,
      createdAt: now,
      updatedAt: now,
      setupChecksum: checksumCanonicalJson({ name: input.name, enemies })
    })
    const { enemies: _enemies, ...metadata } = result
    await ctx.db.insert(
      'encounterBlueprints',
      encounterStoredBlueprintSchema.parse({
        ...metadata,
        ownerUserId: userId,
        commandId: input.commandId,
        commandFingerprint,
        enemiesJson: JSON.stringify(enemies)
      })
    )
    await syncAccountUsage(ctx, 'savedEncounters', result.id)
    return result
  }
})

export const update = mutation({
  args: zodToConvexFields(updateEncounterBlueprintInputDtoSchema.shape),
  returns: blueprintValidator,
  handler: async (ctx, args): Promise<EncounterBlueprintDto> => {
    const { userId } = await requireIdentity(ctx)
    const input = updateEncounterBlueprintInputDtoSchema.parse(args)
    const row = await ctx.db
      .query('encounterBlueprints')
      .withIndex('by_publicId', (q) => q.eq('id', input.blueprintId))
      .unique()
    if (!row || row.ownerUserId !== userId) throw new Error('Encounter Blueprint is unavailable.')
    const commandFingerprint = checksumCanonicalJson(input)
    const prior = await ctx.db
      .query('encounterBlueprintUpdates')
      .withIndex('by_ownerUserId_commandId', (q) =>
        q.eq('ownerUserId', userId).eq('commandId', input.commandId)
      )
      .unique()
    if (prior) {
      if (prior.commandFingerprint !== commandFingerprint)
        throw new Error('Command ID was already used with different input.')
      return encounterBlueprintDtoSchema.parse(JSON.parse(prior.resultJson))
    }
    const current = readBlueprint(row)
    if (current.version !== input.expectedVersion)
      throw new Error('Encounter Blueprint version is stale.')
    const enemies = await snapshotBlueprintEnemies(ctx, userId, {
      gameSystemId: current.gameSystemId,
      enemies: input.enemies
    })
    const result = encounterBlueprintDtoSchema.parse({
      ...current,
      name: input.name,
      enemies,
      version: current.version + 1,
      updatedAt: new Date().toISOString(),
      setupChecksum: checksumCanonicalJson({ name: input.name, enemies })
    })
    await ctx.db.patch(row._id, {
      name: result.name,
      enemiesJson: JSON.stringify(enemies),
      version: result.version,
      updatedAt: result.updatedAt,
      setupChecksum: result.setupChecksum
    })
    await ctx.db.insert(
      'encounterBlueprintUpdates',
      encounterStoredBlueprintUpdateSchema.parse({
        blueprintId: row.id,
        ownerUserId: userId,
        commandId: input.commandId,
        commandFingerprint,
        resultJson: JSON.stringify(result),
        createdAt: result.updatedAt
      })
    )
    return result
  }
})
