import { Button, Group, Stack, Text, Title } from '@mantine/core'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import type { CampaignDetailDto } from '@artificer-toolkit/schema/api/campaignCore'
import type { InventoryDto } from '@artificer-toolkit/schema/api/campaignInventory'
import { decodeCampaignInventoryAuditPage } from '@artificer-toolkit/schema/api/campaignInventoryPages'
import { usePaginatedQuery } from 'convex-helpers/react'
import { useQuery } from 'convex/react'
import { useState } from 'react'
import { useLoadAllPages } from '#app/data/useLoadAllPages'
import * as sharedStyles from '../campaigns.css'
import { isRecord } from '#app/forms/utils/valueGuards'

const inventoryEventLabels: Record<string, string> = {
  CUSTODY_TRANSFER: 'Inventory transferred',
  PARTY_CURRENCY_ADJUST: 'Party currency adjusted',
  PARTY_ITEM_ADD: 'Party item added',
  PARTY_ITEM_CONSUME: 'Party item consumed',
  PARTY_ITEM_REMOVE: 'Party item removed',
  PARTY_ITEM_UPDATE: 'Party item quantity changed'
}

export function CampaignInventoryAudit({ campaign }: { campaign: CampaignDetailDto }) {
  const items = usePaginatedQuery(
    convexApi.campaigns.partyInventory.items,
    { campaignId: campaign.id },
    { initialNumItems: 48 }
  )
  const currencies = usePaginatedQuery(
    convexApi.campaigns.partyInventory.currencies,
    { campaignId: campaign.id },
    { initialNumItems: 48 }
  )
  useLoadAllPages(items, 48)
  useLoadAllPages(currencies, 48)

  return (
    <section className={sharedStyles.panel} aria-labelledby='inventory-audit-title'>
      <div>
        <Title order={2} id='inventory-audit-title'>
          Inventory activity
        </Title>
        <Text c='dimmed' size='sm'>
          GM-only custody history retained for 180 days.
        </Text>
      </div>
      <InventoryAuditPage
        campaign={campaign}
        items={items.results}
        currencies={currencies.results}
      />
    </section>
  )
}

function InventoryAuditPage({
  campaign,
  items,
  currencies,
  cursor
}: {
  campaign: CampaignDetailDto
  items: InventoryDto['items']
  currencies: InventoryDto['currencies']
  cursor?: string
}) {
  const [showOlder, setShowOlder] = useState(false)
  const transport = useQuery(convexApi.campaigns.inventoryAudit.list, {
    campaignId: campaign.id,
    limit: 48,
    ...(cursor ? { cursor } : {})
  })
  const audit = transport === undefined ? undefined : decodeCampaignInventoryAuditPage(transport)
  const events = audit?.events ?? []

  return (
    <>
      <Stack gap='xs'>
        {audit === undefined ? <Text c='dimmed'>Loading activity…</Text> : null}
        {audit !== undefined && events.length === 0 ? (
          <Text c='dimmed'>No activity yet.</Text>
        ) : null}
        {events.map((event) => {
          const actor = campaign.memberships.find((member) => member.userId === event.actorUserId)
          const payload: Record<string, unknown> = isRecord(event.payload) ? event.payload : {}
          const before = payload.beforeQuantity ?? payload.beforeAmount
          const after =
            payload.afterQuantity ??
            payload.afterAmount ??
            payload.afterSourceQuantity ??
            payload.afterSourceAmount
          const currentItem = items.find((item) => item.id === payload.itemId)
          const currentCurrency = currencies.find(
            (currency) => currency.denominationId === payload.denominationId
          )
          const assetLabel =
            (typeof payload.itemLabel === 'string' && payload.itemLabel) ||
            (typeof payload.denominationLabel === 'string' && payload.denominationLabel) ||
            currentItem?.label ||
            currentCurrency?.label
          const eventLabel =
            inventoryEventLabels[event.kind] ?? event.kind.replaceAll('_', ' ').toLowerCase()
          return (
            <Group
              className={sharedStyles.memberRow}
              key={event.id}
              data-audit-event-id={event.id}
              justify='space-between'
            >
              <div>
                <Text fw={600}>{assetLabel ? `${eventLabel}: ${assetLabel}` : eventLabel}</Text>
                <Text c='dimmed' size='sm'>
                  {actor ? `@${actor.username}` : 'System'}
                  {before !== undefined || after !== undefined
                    ? ` · ${formatAuditValue(before)} → ${formatAuditValue(after)}`
                    : ''}
                </Text>
              </div>
              <Text c='dimmed' size='xs'>
                {new Date(event.createdAt).toLocaleString()}
              </Text>
            </Group>
          )
        })}
      </Stack>
      {audit?.nextCursor ? (
        showOlder ? (
          <InventoryAuditPage
            campaign={campaign}
            items={items}
            currencies={currencies}
            cursor={audit.nextCursor}
          />
        ) : (
          <Button variant='subtle' onClick={() => setShowOlder(true)}>
            Load older activity
          </Button>
        )
      ) : null}
    </>
  )
}

function formatAuditValue(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
    ? String(value)
    : '—'
}
