import { sql } from 'kysely'

import type { DBLike } from '#types'

interface OwnerRow {
  id: string
  kind: string
  campaign_id: string | null
  vehicle_id: string | null
  version: number
}

interface ItemRow {
  id: string
  container_id: string | null
}

interface GroupRow {
  id: string
  container_item_id: string | null
}

interface BalanceRow {
  id: string
  group_id: string | null
  ruleset_currency_id: string | null
  campaign_denomination_id: string | null
  amount: string | number | bigint
}

export interface CampaignVehicleCurrencyTransfer {
  sourceBalanceId: string
  sourceOwnerId: string
  denominationId: string
  amount: string
  destinationBalanceId: string
  destinationAmount: string
  explicitGroupId: string | null
}

export interface CampaignVehicleEvacuationResult {
  formerVehicleId: string
  sourceOwnerId: string
  destinationOwnerId: string
  transferredTopLevelItemIds: string[]
  transferredCurrencyGroupIds: string[]
  currencyTransfers: CampaignVehicleCurrencyTransfer[]
  sourceOwnerVersion: number
  destinationOwnerVersion: number
}

function amountString(value: BalanceRow['amount']): string {
  return BigInt(value).toString()
}

export function createCampaignVehicleEvacuationRepository(db: DBLike) {
  return {
    async lockOwners(input: { campaignId: string; vehicleIds: readonly string[] }): Promise<{
      campaignOwner: OwnerRow | null
      vehicleOwners: Map<string, OwnerRow>
    }> {
      const vehicleIds = [...new Set(input.vehicleIds)].sort()
      const rows = await db
        .selectFrom('inventory_owners')
        .select(['id', 'kind', 'campaign_id', 'vehicle_id', 'version'])
        .where((eb) =>
          eb.or([
            eb.and([eb('kind', '=', 'CAMPAIGN'), eb('campaign_id', '=', input.campaignId)]),
            ...(vehicleIds.length > 0
              ? [eb.and([eb('kind', '=', 'VEHICLE'), eb('vehicle_id', 'in', vehicleIds)])]
              : [])
          ])
        )
        .orderBy('id', 'asc')
        .forUpdate()
        .execute()
      const campaignOwner = rows.find(
        (row) => row.kind === 'CAMPAIGN' && row.campaign_id === input.campaignId
      )
      return {
        campaignOwner: campaignOwner ?? null,
        vehicleOwners: new Map(
          rows.flatMap((row) =>
            row.kind === 'VEHICLE' && row.vehicle_id ? [[row.vehicle_id, row]] : []
          )
        )
      }
    },

    async lockOwnerGraphs(ownerIds: readonly string[]): Promise<void> {
      const ids = [...new Set(ownerIds)].sort()
      if (ids.length === 0) return
      await sql`set constraints all deferred`.execute(db)
      await sql`select id from public.inventory_items where owner_id in (${sql.join(
        ids.map((id) => sql`${id}::uuid`)
      )}) order by id for update`.execute(db)
      await sql`select id from public.inventory_currency_groups where owner_id in (${sql.join(
        ids.map((id) => sql`${id}::uuid`)
      )}) order by id for update`.execute(db)
      await sql`select id from public.inventory_currency_balances where owner_id in (${sql.join(
        ids.map((id) => sql`${id}::uuid`)
      )}) order by id for update`.execute(db)
    },

    async evacuate(input: {
      campaignId: string
      vehicleId: string
      sourceOwnerId: string
      destinationOwnerId: string
    }): Promise<CampaignVehicleEvacuationResult> {
      const [itemsResult, groupsResult, balancesResult] = await Promise.all([
        sql<ItemRow>`select id, container_id from public.inventory_items where owner_id = ${input.sourceOwnerId}::uuid order by id`.execute(
          db
        ),
        sql<GroupRow>`select id, container_item_id from public.inventory_currency_groups where owner_id = ${input.sourceOwnerId}::uuid order by id`.execute(
          db
        ),
        sql<BalanceRow>`select id, group_id, ruleset_currency_id, campaign_denomination_id, amount::text as amount from public.inventory_currency_balances where owner_id = ${input.sourceOwnerId}::uuid order by id`.execute(
          db
        )
      ])
      const items = itemsResult.rows
      const groups = groupsResult.rows
      const balances = balancesResult.rows
      const transfers: CampaignVehicleCurrencyTransfer[] = []

      for (const balance of balances.filter((entry) => entry.group_id === null)) {
        const denominationColumn = balance.ruleset_currency_id
          ? sql`ruleset_currency_id`
          : sql`campaign_denomination_id`
        const denominationId = balance.ruleset_currency_id ?? balance.campaign_denomination_id
        if (!denominationId)
          throw new Error(`Currency balance "${balance.id}" has no denomination.`)
        const existing = await sql<BalanceRow>`
          select id, group_id, ruleset_currency_id, campaign_denomination_id, amount::text as amount
          from public.inventory_currency_balances
          where owner_id = ${input.destinationOwnerId}::uuid
            and group_id is null
            and ${denominationColumn} = ${denominationId}::uuid
          for update
        `.execute(db)
        const destination = existing.rows[0]
        if (destination) {
          const updated = await sql<BalanceRow>`
            update public.inventory_currency_balances
            set amount = amount + ${amountString(balance.amount)}::bigint, updated_at = now()
            where id = ${destination.id}::uuid
            returning id, group_id, ruleset_currency_id, campaign_denomination_id, amount::text as amount
          `.execute(db)
          const deletedSource = await db
            .deleteFrom('inventory_currency_balances')
            .where('id', '=', balance.id)
            .where('owner_id', '=', input.sourceOwnerId)
            .returning('id')
            .executeTakeFirst()
          if (!deletedSource) {
            throw new Error(`Source balance "${balance.id}" was not removed after its transfer.`)
          }
          const result = updated.rows[0]
          if (!result) throw new Error(`Destination balance "${destination.id}" was not updated.`)
          transfers.push({
            sourceBalanceId: balance.id,
            sourceOwnerId: input.sourceOwnerId,
            denominationId,
            amount: amountString(balance.amount),
            destinationBalanceId: result.id,
            destinationAmount: amountString(result.amount),
            explicitGroupId: null
          })
        } else {
          const moved = await sql<BalanceRow>`
            update public.inventory_currency_balances
            set owner_id = ${input.destinationOwnerId}::uuid, updated_at = now()
            where id = ${balance.id}::uuid and owner_id = ${input.sourceOwnerId}::uuid
            returning id, group_id, ruleset_currency_id, campaign_denomination_id, amount::text as amount
          `.execute(db)
          const result = moved.rows[0]
          if (!result) throw new Error(`Currency balance "${balance.id}" was not evacuated.`)
          transfers.push({
            sourceBalanceId: balance.id,
            sourceOwnerId: input.sourceOwnerId,
            denominationId,
            amount: amountString(balance.amount),
            destinationBalanceId: result.id,
            destinationAmount: amountString(result.amount),
            explicitGroupId: null
          })
        }
      }

      await sql`
        update public.inventory_items
        set owner_id = ${input.destinationOwnerId}::uuid,
          placement_kind = case when placement_kind = 'VEHICLE' and placement_id = ${input.vehicleId}::uuid then null else placement_kind end,
          placement_id = case when placement_kind = 'VEHICLE' and placement_id = ${input.vehicleId}::uuid then null else placement_id end,
          updated_at = now()
        where owner_id = ${input.sourceOwnerId}::uuid
      `.execute(db)

      for (const group of groups) {
        const groupBalances = balances.filter((balance) => balance.group_id === group.id)
        if (groupBalances.length > 0) {
          await db
            .updateTable('inventory_currency_balances')
            .set({ group_id: null, updated_at: sql`now()` })
            .where('owner_id', '=', input.sourceOwnerId)
            .where('group_id', '=', group.id)
            .execute()
        }
        const movedGroup = await db
          .updateTable('inventory_currency_groups')
          .set({ owner_id: input.destinationOwnerId, updated_at: sql`now()` })
          .where('owner_id', '=', input.sourceOwnerId)
          .where('id', '=', group.id)
          .returning('id')
          .executeTakeFirst()
        if (!movedGroup) throw new Error(`Currency group "${group.id}" was not evacuated.`)
        for (const balance of groupBalances) {
          const moved = await sql<BalanceRow>`
            update public.inventory_currency_balances
            set owner_id = ${input.destinationOwnerId}::uuid,
              group_id = ${group.id}::uuid,
              updated_at = now()
            where id = ${balance.id}::uuid and owner_id = ${input.sourceOwnerId}::uuid
            returning id, group_id, ruleset_currency_id, campaign_denomination_id, amount::text as amount
          `.execute(db)
          const result = moved.rows[0]
          const denominationId = balance.ruleset_currency_id ?? balance.campaign_denomination_id
          if (!result || !denominationId) {
            throw new Error(`Grouped currency balance "${balance.id}" was not evacuated.`)
          }
          transfers.push({
            sourceBalanceId: balance.id,
            sourceOwnerId: input.sourceOwnerId,
            denominationId,
            amount: amountString(balance.amount),
            destinationBalanceId: result.id,
            destinationAmount: amountString(result.amount),
            explicitGroupId: group.id
          })
        }
      }

      const remaining = await sql<{
        item_count: number
        group_count: number
        balance_count: number
      }>`
        select
          (select count(*)::int from public.inventory_items where owner_id = ${input.sourceOwnerId}::uuid) as item_count,
          (select count(*)::int from public.inventory_currency_groups where owner_id = ${input.sourceOwnerId}::uuid) as group_count,
          (select count(*)::int from public.inventory_currency_balances where owner_id = ${input.sourceOwnerId}::uuid) as balance_count
      `.execute(db)
      const counts = remaining.rows[0]
      if (
        !counts ||
        counts.item_count !== 0 ||
        counts.group_count !== 0 ||
        counts.balance_count !== 0
      ) {
        throw new Error(`Vehicle inventory owner "${input.sourceOwnerId}" was not emptied.`)
      }
      const versions = await db
        .updateTable('inventory_owners')
        .set((eb) => ({ version: eb('version', '+', 1), updated_at: sql`now()` }))
        .where('id', 'in', [input.sourceOwnerId, input.destinationOwnerId].sort())
        .returning(['id', 'version'])
        .execute()
      const sourceVersion = versions.find((row) => row.id === input.sourceOwnerId)?.version
      const destinationVersion = versions.find(
        (row) => row.id === input.destinationOwnerId
      )?.version
      if (sourceVersion === undefined || destinationVersion === undefined) {
        throw new Error('Vehicle evacuation did not advance both inventory owner versions.')
      }
      const deleted = await db
        .deleteFrom('campaign_vehicles')
        .where('campaign_id', '=', input.campaignId)
        .where('id', '=', input.vehicleId)
        .returning('id')
        .executeTakeFirst()
      if (!deleted) throw new Error(`Campaign Vehicle "${input.vehicleId}" was not removed.`)
      return {
        formerVehicleId: input.vehicleId,
        sourceOwnerId: input.sourceOwnerId,
        destinationOwnerId: input.destinationOwnerId,
        transferredTopLevelItemIds: items
          .filter((item) => item.container_id === null)
          .map((item) => item.id),
        transferredCurrencyGroupIds: groups.map((group) => group.id),
        currencyTransfers: transfers,
        sourceOwnerVersion: sourceVersion,
        destinationOwnerVersion: destinationVersion
      }
    }
  }
}
