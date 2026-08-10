import { Button, Group, Stack, Text, Title } from '@mantine/core'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import type { CampaignDetailDto } from '#app/lib/api'
import { getCampaignInventory, getCampaignInventoryAudit } from '#app/data/campaigns/queries'
import * as sharedStyles from '../campaigns.css'

const inventoryEventLabels: Record<string, string> = {
  CUSTODY_TRANSFER: 'Inventory transferred',
  PARTY_CURRENCY_ADJUST: 'Party currency adjusted',
  PARTY_ITEM_ADD: 'Party item added',
  PARTY_ITEM_CONSUME: 'Party item consumed',
  PARTY_ITEM_REMOVE: 'Party item removed',
  PARTY_ITEM_UPDATE: 'Party item quantity changed'
}

export function CampaignInventoryAudit({ campaign }: { campaign: CampaignDetailDto }) {
  const audit = useInfiniteQuery(getCampaignInventoryAudit(campaign.id))
  const partyInventory = useQuery(
    getCampaignInventory(campaign.id, { kind: 'CAMPAIGN', campaignId: campaign.id })
  )
  const events = audit.data?.pages.flatMap((page) => page.events) ?? []

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
      <Stack gap='xs'>
        {audit.isPending ? <Text c='dimmed'>Loading activity…</Text> : null}
        {!audit.isPending && events.length === 0 ? <Text c='dimmed'>No activity yet.</Text> : null}
        {events.map((event) => {
          const actor = campaign.memberships.find((member) => member.userId === event.actorUserId)
          const payload: Record<string, unknown> =
            typeof event.payload === 'object' &&
            event.payload !== null &&
            !Array.isArray(event.payload)
              ? (event.payload as Record<string, unknown>)
              : {}
          const before = payload.beforeQuantity ?? payload.beforeAmount
          const after =
            payload.afterQuantity ??
            payload.afterAmount ??
            payload.afterSourceQuantity ??
            payload.afterSourceAmount
          const currentItem = partyInventory.data?.items.find((item) => item.id === payload.itemId)
          const currentCurrency = partyInventory.data?.currencies.find(
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
            <Group className={sharedStyles.memberRow} key={event.id} justify='space-between'>
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
      {audit.hasNextPage ? (
        <Button
          loading={audit.isFetchingNextPage}
          variant='subtle'
          onClick={() => void audit.fetchNextPage()}
        >
          Load older activity
        </Button>
      ) : null}
    </section>
  )
}

function formatAuditValue(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
    ? String(value)
    : '—'
}
