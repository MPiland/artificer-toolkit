import { sql } from 'kysely'
import type { DBLike } from '#types'
import {
  CampaignCurrencyCleanup,
  CampaignCurrencyDenomination,
  CampaignCurrencySystem,
  CampaignDenominationRow,
  CurrencyBalanceRewrite,
  CurrencyBalanceRow,
  CurrencySystemRow,
  orderedIds
} from './inventoryTypes.js'

function toDenomination(row: CampaignDenominationRow): CampaignCurrencyDenomination {
  return {
    id: row.id,
    systemId: row.system_id,
    name: row.name,
    abbreviation: row.abbreviation,
    scaleInReference: BigInt(row.scale_in_reference),
    sortOrder: row.sort_order
  }
}
function toSystem(
  row: CurrencySystemRow,
  denominations: CampaignCurrencyDenomination[]
): CampaignCurrencySystem {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    name: row.name,
    isReference: row.is_reference,
    version: row.version,
    denominations
  }
}

export function createCampaignCurrencySystemRepository(
  db: DBLike,
  upsertUngroupedCurrencyBalance: (
    ownerId: string,
    denomination: { kind: 'CAMPAIGN'; id: string },
    amount: bigint
  ) => Promise<unknown>
) {
  async function listDenominations(systemId: string): Promise<CampaignCurrencyDenomination[]> {
    const result =
      await sql<CampaignDenominationRow>`select id, system_id, name, abbreviation, scale_in_reference::text as scale_in_reference, sort_order from campaign_currency_denominations where system_id = ${systemId}::uuid order by sort_order, id`.execute(
        db
      )
    return result.rows.map(toDenomination)
  }
  async function lockCurrencySystemBalances(systemId: string): Promise<CurrencyBalanceRewrite[]> {
    const result = await sql<{
      id: string
      owner_id: string
      group_id: string | null
      denomination_id: string
      amount: string | number | bigint
    }>`select balance.id, balance.owner_id, balance.group_id, balance.campaign_denomination_id as denomination_id, balance.amount::text as amount from inventory_currency_balances balance join campaign_currency_denominations denomination on denomination.id = balance.campaign_denomination_id where denomination.system_id = ${systemId}::uuid order by balance.id for update of balance`.execute(
      db
    )
    return result.rows.map((row) => ({
      id: row.id,
      ownerId: row.owner_id,
      groupId: row.group_id,
      denominationId: row.denomination_id,
      amount: BigInt(row.amount)
    }))
  }
  return {
    async listCurrencySystems(campaignId: string) {
      const rows = await db
        .selectFrom('campaign_currency_systems')
        .selectAll()
        .where('campaign_id', '=', campaignId)
        .orderBy('name', 'asc')
        .orderBy('id', 'asc')
        .execute()
      return Promise.all(rows.map(async (row) => toSystem(row, await listDenominations(row.id))))
    },
    async getCurrencySystem(systemId: string) {
      const row = await db
        .selectFrom('campaign_currency_systems')
        .selectAll()
        .where('id', '=', systemId)
        .executeTakeFirst()
      return row ? toSystem(row, await listDenominations(row.id)) : null
    },
    async lockCurrencySystem(systemId: string) {
      const row = await db
        .selectFrom('campaign_currency_systems')
        .selectAll()
        .where('id', '=', systemId)
        .forUpdate()
        .executeTakeFirst()
      return row ? toSystem(row, await listDenominations(row.id)) : null
    },
    async insertCurrencySystem(input: { campaignId: string; name: string; isReference: boolean }) {
      return toSystem(
        await db
          .insertInto('campaign_currency_systems')
          .values({
            campaign_id: input.campaignId,
            name: input.name,
            is_reference: input.isReference
          })
          .returningAll()
          .executeTakeFirstOrThrow(),
        []
      )
    },
    async updateCurrencySystem(input: {
      id: string
      expectedVersion: number
      name: string
      isReference: boolean
    }) {
      const row = await db
        .updateTable('campaign_currency_systems')
        .set({
          name: input.name,
          is_reference: input.isReference,
          version: input.expectedVersion + 1,
          updated_at: sql`now()`
        })
        .where('id', '=', input.id)
        .where('version', '=', input.expectedVersion)
        .returningAll()
        .executeTakeFirst()
      return row ? toSystem(row, await listDenominations(row.id)) : null
    },
    async deleteCurrencySystem(systemId: string) {
      return Boolean(
        await db
          .deleteFrom('campaign_currency_systems')
          .where('id', '=', systemId)
          .returning('id')
          .executeTakeFirst()
      )
    },
    lockCurrencySystemBalances,
    async replaceCurrencyDenominations(input: {
      systemId: string
      denominations: CampaignCurrencyDenomination[]
      balanceRewrites: CurrencyBalanceRewrite[]
    }) {
      const existing = await lockCurrencySystemBalances(input.systemId)
      const existingIds = orderedIds(existing.map((balance) => balance.id))
      const replacementIds = orderedIds(input.balanceRewrites.map((balance) => balance.id))
      if (
        existingIds.length !== replacementIds.length ||
        existingIds.some((id, index) => id !== replacementIds[index])
      )
        throw new Error('Every existing balance must have exactly one replacement.')
      const denominationIds = new Set(input.denominations.map((denomination) => denomination.id))
      if (
        input.denominations.some((denomination) => denomination.systemId !== input.systemId) ||
        input.balanceRewrites.some(
          (balance) => balance.amount < 0n || !denominationIds.has(balance.denominationId)
        )
      )
        throw new Error('Currency replacement contains an invalid denomination or balance.')
      if (existingIds.length)
        await db.deleteFrom('inventory_currency_balances').where('id', 'in', existingIds).execute()
      await db
        .deleteFrom('campaign_currency_denominations')
        .where('system_id', '=', input.systemId)
        .execute()
      if (input.denominations.length)
        await db
          .insertInto('campaign_currency_denominations')
          .values(
            input.denominations.map((denomination) => ({
              id: denomination.id,
              system_id: input.systemId,
              name: denomination.name,
              abbreviation: denomination.abbreviation,
              scale_in_reference: sql<number>`${denomination.scaleInReference.toString()}::bigint`,
              sort_order: denomination.sortOrder
            }))
          )
          .execute()
      if (input.balanceRewrites.length)
        await db
          .insertInto('inventory_currency_balances')
          .values(
            input.balanceRewrites.map((balance) => ({
              id: balance.id,
              owner_id: balance.ownerId,
              group_id: balance.groupId,
              ruleset_currency_id: null,
              campaign_denomination_id: balance.denominationId,
              amount: sql<number>`${balance.amount.toString()}::bigint`
            }))
          )
          .execute()
      return listDenominations(input.systemId)
    },
    async findCampaignReferenceDenomination(campaignId: string) {
      const result =
        await sql<CampaignDenominationRow>`select denomination.id, denomination.system_id, denomination.name, denomination.abbreviation, denomination.scale_in_reference::text as scale_in_reference, denomination.sort_order from campaign_currency_denominations denomination join campaign_currency_systems system on system.id = denomination.system_id where system.campaign_id = ${campaignId}::uuid and system.is_reference and denomination.scale_in_reference = 1`.execute(
          db
        )
      const row = result.rows[0]
      return row ? toDenomination(row) : null
    },
    async moveCharacterCampaignCurrencyToCampaign(input: {
      campaignId: string
      characterOwnerId: string
      campaignOwnerId: string
    }): Promise<CampaignCurrencyCleanup[]> {
      const result =
        await sql<CurrencyBalanceRow>`select balance.id, balance.owner_id, balance.group_id, balance.amount::text as amount, balance.ruleset_currency_id, balance.campaign_denomination_id, null::uuid as ruleset_system_id, null::text as ruleset_label, null::text as ruleset_abbreviation, denomination.system_id as campaign_system_id, denomination.name as campaign_label, denomination.abbreviation as campaign_abbreviation, denomination.scale_in_reference::text as campaign_scale from inventory_currency_balances balance join campaign_currency_denominations denomination on denomination.id = balance.campaign_denomination_id join campaign_currency_systems system on system.id = denomination.system_id where balance.owner_id = ${input.characterOwnerId}::uuid and system.campaign_id = ${input.campaignId}::uuid order by denomination.id, balance.id for update of balance`.execute(
          db
        )
      const cleanup = new Map<string, CampaignCurrencyCleanup>()
      for (const balance of result.rows) {
        if (
          !balance.campaign_denomination_id ||
          !balance.campaign_system_id ||
          !balance.campaign_label ||
          !balance.campaign_abbreviation ||
          balance.campaign_scale === null
        ) {
          throw new Error(
            `Campaign currency balance "${balance.id}" is missing denomination metadata.`
          )
        }
        const denomination = {
          kind: 'CAMPAIGN' as const,
          id: balance.campaign_denomination_id,
          systemId: balance.campaign_system_id,
          label: balance.campaign_label,
          abbreviation: balance.campaign_abbreviation,
          scaleInReference: BigInt(balance.campaign_scale)
        }
        const current = cleanup.get(denomination.id)
        cleanup.set(denomination.id, {
          denomination,
          amount: (current?.amount ?? 0n) + BigInt(balance.amount),
          sourceBalanceIds: [...(current?.sourceBalanceIds ?? []), balance.id]
        })
      }
      const sourceIds = result.rows.map((balance) => balance.id)
      if (sourceIds.length)
        await db.deleteFrom('inventory_currency_balances').where('id', 'in', sourceIds).execute()
      for (const moved of cleanup.values())
        await upsertUngroupedCurrencyBalance(
          input.campaignOwnerId,
          { kind: 'CAMPAIGN', id: moved.denomination.id },
          moved.amount
        )
      return [...cleanup.values()]
    }
  }
}
