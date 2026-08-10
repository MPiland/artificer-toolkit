import { sql } from 'kysely'
import type { DBLike } from '#types'
import {
  CampaignDenominationRow,
  CurrencyBalanceRow,
  CurrencyDebit,
  CurrencyDenomination,
  CurrencyDenominationRef,
  InventoryCurrencyBalance
} from './inventoryTypes.js'

const MAX_SAFE_CURRENCY_AMOUNT = BigInt(Number.MAX_SAFE_INTEGER)
export class InsufficientInventoryCurrencyError extends Error {
  constructor() {
    super('The inventory does not contain enough of that denomination.')
    this.name = 'InsufficientInventoryCurrencyError'
  }
}
function toDenomination(row: CurrencyBalanceRow): CurrencyDenomination {
  if (row.ruleset_currency_id) {
    if (!row.ruleset_system_id || !row.ruleset_label || !row.ruleset_abbreviation)
      throw new Error(`Ruleset currency "${row.ruleset_currency_id}" is missing metadata.`)
    return {
      kind: 'RULESET',
      id: row.ruleset_currency_id,
      systemId: row.ruleset_system_id,
      label: row.ruleset_label,
      abbreviation: row.ruleset_abbreviation,
      scaleInReference: null
    }
  }
  if (
    !row.campaign_denomination_id ||
    !row.campaign_system_id ||
    !row.campaign_label ||
    !row.campaign_abbreviation ||
    row.campaign_scale === null
  )
    throw new Error(`Campaign currency balance "${row.id}" is missing denomination metadata.`)
  return {
    kind: 'CAMPAIGN',
    id: row.campaign_denomination_id,
    systemId: row.campaign_system_id,
    label: row.campaign_label,
    abbreviation: row.campaign_abbreviation,
    scaleInReference: BigInt(row.campaign_scale)
  }
}
function toBalance(row: CurrencyBalanceRow): InventoryCurrencyBalance {
  return {
    id: row.id,
    ownerId: row.owner_id,
    groupId: row.group_id,
    containerId: row.container_item_id ?? null,
    denomination: toDenomination(row),
    amount: BigInt(row.amount)
  }
}

export function createInventoryCurrencyRepository(db: DBLike) {
  async function listCurrencyBalances(ownerId: string): Promise<InventoryCurrencyBalance[]> {
    const result =
      await sql<CurrencyBalanceRow>`select balance.id, balance.owner_id, balance.group_id, group_record.container_item_id, balance.amount::text as amount, balance.ruleset_currency_id, balance.campaign_denomination_id, ruleset.system_id as ruleset_system_id, ruleset.label as ruleset_label, coalesce(ruleset.short, ruleset.code) as ruleset_abbreviation, denomination.system_id as campaign_system_id, denomination.name as campaign_label, denomination.abbreviation as campaign_abbreviation, denomination.scale_in_reference::text as campaign_scale from inventory_currency_balances balance left join inventory_currency_groups group_record on group_record.owner_id = balance.owner_id and group_record.id = balance.group_id left join currencies ruleset on ruleset.id = balance.ruleset_currency_id left join campaign_currency_denominations denomination on denomination.id = balance.campaign_denomination_id where balance.owner_id = ${ownerId}::uuid order by coalesce(balance.ruleset_currency_id, balance.campaign_denomination_id), balance.id`.execute(
        db
      )
    return result.rows.map(toBalance)
  }
  async function lockCurrencyBalances(
    ownerId: string,
    denomination: CurrencyDenominationRef
  ): Promise<InventoryCurrencyBalance[]> {
    const predicate =
      denomination.kind === 'RULESET'
        ? sql`balance.ruleset_currency_id = ${denomination.id}::uuid`
        : sql`balance.campaign_denomination_id = ${denomination.id}::uuid`
    const result =
      await sql<CurrencyBalanceRow>`select balance.id, balance.owner_id, balance.group_id, balance.amount::text as amount, balance.ruleset_currency_id, balance.campaign_denomination_id, ruleset.system_id as ruleset_system_id, ruleset.label as ruleset_label, coalesce(ruleset.short, ruleset.code) as ruleset_abbreviation, campaign_denomination.system_id as campaign_system_id, campaign_denomination.name as campaign_label, campaign_denomination.abbreviation as campaign_abbreviation, campaign_denomination.scale_in_reference::text as campaign_scale from inventory_currency_balances balance left join currencies ruleset on ruleset.id = balance.ruleset_currency_id left join campaign_currency_denominations campaign_denomination on campaign_denomination.id = balance.campaign_denomination_id where balance.owner_id = ${ownerId}::uuid and ${predicate} order by balance.id for update of balance`.execute(
        db
      )
    return result.rows.map(toBalance)
  }
  async function upsertUngroupedCurrencyBalance(
    ownerId: string,
    denomination: CurrencyDenominationRef,
    amount: bigint
  ): Promise<InventoryCurrencyBalance> {
    if (amount < 0n) throw new RangeError('Currency amount cannot be negative.')
    if (amount > MAX_SAFE_CURRENCY_AMOUNT)
      throw new RangeError('Currency amount exceeds the supported range.')
    const maximumExistingAmount = (MAX_SAFE_CURRENCY_AMOUNT - amount).toString()
    const result =
      denomination.kind === 'RULESET'
        ? await sql<CurrencyBalanceRow>`insert into inventory_currency_balances (owner_id, group_id, ruleset_currency_id, campaign_denomination_id, amount) values (${ownerId}::uuid, null, ${denomination.id}::uuid, null, ${amount.toString()}::bigint) on conflict (owner_id, (coalesce(group_id, '00000000-0000-0000-0000-000000000000'::uuid)), ruleset_currency_id) where ruleset_currency_id is not null do update set amount = inventory_currency_balances.amount + excluded.amount, updated_at = now() where inventory_currency_balances.amount <= ${maximumExistingAmount}::bigint returning id, owner_id, group_id, amount::text as amount, ruleset_currency_id, campaign_denomination_id, (select system_id from currencies where id = ruleset_currency_id) as ruleset_system_id, (select label from currencies where id = ruleset_currency_id) as ruleset_label, (select coalesce(short, code) from currencies where id = ruleset_currency_id) as ruleset_abbreviation, null::uuid as campaign_system_id, null::text as campaign_label, null::text as campaign_abbreviation, null::text as campaign_scale`.execute(
            db
          )
        : await sql<CurrencyBalanceRow>`insert into inventory_currency_balances (owner_id, group_id, ruleset_currency_id, campaign_denomination_id, amount) values (${ownerId}::uuid, null, null, ${denomination.id}::uuid, ${amount.toString()}::bigint) on conflict (owner_id, (coalesce(group_id, '00000000-0000-0000-0000-000000000000'::uuid)), campaign_denomination_id) where campaign_denomination_id is not null do update set amount = inventory_currency_balances.amount + excluded.amount, updated_at = now() where inventory_currency_balances.amount <= ${maximumExistingAmount}::bigint returning id, owner_id, group_id, amount::text as amount, ruleset_currency_id, campaign_denomination_id, null::uuid as ruleset_system_id, null::text as ruleset_label, null::text as ruleset_abbreviation, (select system_id from campaign_currency_denominations where id = campaign_denomination_id) as campaign_system_id, (select name from campaign_currency_denominations where id = campaign_denomination_id) as campaign_label, (select abbreviation from campaign_currency_denominations where id = campaign_denomination_id) as campaign_abbreviation, (select scale_in_reference::text from campaign_currency_denominations where id = campaign_denomination_id) as campaign_scale`.execute(
            db
          )
    const row = result.rows[0]
    if (!row) throw new RangeError('Currency amount exceeds the supported range.')
    return toBalance(row)
  }
  return {
    listCurrencyBalances,
    lockCurrencyBalances,
    async findDenomination(ref: CurrencyDenominationRef): Promise<CurrencyDenomination | null> {
      if (ref.kind === 'RULESET') {
        const row = await db
          .selectFrom('currencies')
          .select(['id', 'system_id', 'label', 'short', 'code'])
          .where('id', '=', ref.id)
          .executeTakeFirst()
        return row
          ? {
              kind: 'RULESET',
              id: row.id,
              systemId: row.system_id,
              label: row.label,
              abbreviation: row.short ?? row.code,
              scaleInReference: null
            }
          : null
      }
      const result =
        await sql<CampaignDenominationRow>`select id, system_id, name, abbreviation, scale_in_reference::text as scale_in_reference, sort_order from campaign_currency_denominations where id = ${ref.id}::uuid`.execute(
          db
        )
      const row = result.rows[0]
      return row
        ? {
            kind: 'CAMPAIGN',
            id: row.id,
            systemId: row.system_id,
            label: row.name,
            abbreviation: row.abbreviation,
            scaleInReference: BigInt(row.scale_in_reference)
          }
        : null
    },
    async decrementCurrency(input: {
      ownerId: string
      denomination: CurrencyDenominationRef
      amount: bigint
    }): Promise<CurrencyDebit[]> {
      if (input.amount <= 0n) throw new RangeError('Currency decrement must be positive.')
      const balances = await lockCurrencyBalances(input.ownerId, input.denomination)
      let remaining = input.amount
      const debits: CurrencyDebit[] = []
      for (const balance of balances) {
        if (remaining === 0n) break
        const amount = balance.amount < remaining ? balance.amount : remaining
        if (amount === 0n) continue
        const nextAmount = balance.amount - amount
        if (nextAmount === 0n)
          await db.deleteFrom('inventory_currency_balances').where('id', '=', balance.id).execute()
        else
          await db
            .updateTable('inventory_currency_balances')
            .set({ amount: sql<number>`${nextAmount.toString()}::bigint`, updated_at: sql`now()` })
            .where('id', '=', balance.id)
            .execute()
        debits.push({ balanceId: balance.id, groupId: balance.groupId, amount })
        remaining -= amount
      }
      if (remaining !== 0n) throw new InsufficientInventoryCurrencyError()
      return debits
    },
    upsertUngroupedCurrencyBalance
  }
}
