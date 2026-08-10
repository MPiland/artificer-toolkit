import {
  Accordion,
  Alert,
  Button,
  Group,
  Loader,
  NumberInput,
  Select,
  Stack,
  Text,
  Title
} from '@mantine/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { InventoryDto } from '@artificer-toolkit/schema/api/campaigns'
import type { CampaignDetailDto, InventoryOwnerRefDto } from '#app/lib/api'
import { api } from '#app/lib/api'
import { getCampaignCurrencySystems, getCampaignInventory } from '#app/data/campaigns/queries'
import { CurrencySystemEditor } from './CurrencySystemEditor'
import { CampaignInventoryAudit } from './CampaignInventoryAudit'
import { CampaignPartyInventoryActions } from './CampaignPartyInventoryActions'
import * as sharedStyles from '../campaigns.css'
import * as inventoryStyles from './inventory.css'

export function CampaignInventory({
  campaign,
  currentUserId,
  partyOnly = false
}: {
  campaign: CampaignDetailDto
  currentUserId: string
  partyOnly?: boolean
}) {
  const queryClient = useQueryClient()
  const ownerOptions = getAuthorizedSourceOwners(campaign, currentUserId)
  const destinationOptions = getTransferDestinationOwners(campaign)
  const [ownerValue, setOwnerValue] = useState('PARTY')
  const [destinationValue, setDestinationValue] = useState(destinationOptions[1]?.value ?? '')
  const [assetValue, setAssetValue] = useState('')
  const [amount, setAmount] = useState(1)
  const sourceOwner = parseOwner(ownerValue, campaign.id)
  const destinationOwner = destinationValue ? parseOwner(destinationValue, campaign.id) : null
  const inventory = useQuery(getCampaignInventory(campaign.id, sourceOwner))
  const currencySystems = useQuery({
    ...getCampaignCurrencySystems(campaign.id),
    enabled: !partyOnly && campaign.role === 'OWNER'
  })
  const canTransfer =
    campaign.capabilities.managePartyInventory || campaign.capabilities.transferOwnInventory
  const carriedItems = (inventory.data?.items ?? []).filter((item) => !item.containerId)
  const carriedCurrencies = (inventory.data?.currencies ?? []).filter(
    (currency) => !currency.containerId
  )
  const containers = (inventory.data?.items ?? []).filter((item) => item.isContainer)
  const transferableCurrencies = Array.from(
    (inventory.data?.currencies ?? [])
      .reduce((byDenomination, currency) => {
        const current = byDenomination.get(currency.denominationId)
        byDenomination.set(currency.denominationId, {
          ...currency,
          amount: (current?.amount ?? 0) + currency.amount,
          containerId: null
        })
        return byDenomination
      }, new Map<string, InventoryDto['currencies'][number]>())
      .values()
  )
  const assetOptions = [
    ...(inventory.data?.items ?? []).map((item) => ({
      value: `ITEM:${item.id}`,
      label: `${item.label} (${item.quantity})`
    })),
    ...transferableCurrencies.map((currency) => ({
      value: `CURRENCY:${currency.denominationId}`,
      label: `${currency.label} (${currency.amount} ${currency.abbreviation})`
    }))
  ]
  const transfer = useMutation({
    mutationFn: async () => {
      if (!inventory.data || !destinationOwner)
        throw new Error('Choose a different destination inventory.')
      const destinationInventory = await api.campaigns.inventory.get(campaign.id, destinationOwner)
      const [kind, assetId] = assetValue.split(':') as ['ITEM' | 'CURRENCY', string]
      const common = {
        campaignId: campaign.id,
        source: sourceOwner,
        destination: destinationOwner,
        amount,
        expectedSourceVersion: inventory.data.version,
        expectedDestinationVersion: destinationInventory.version,
        idempotencyKey: crypto.randomUUID()
      }
      return kind === 'ITEM'
        ? api.campaigns.inventory.transfer({ ...common, kind, itemId: assetId })
        : api.campaigns.inventory.transfer({
            ...common,
            kind,
            denominationId: assetId
          })
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ['campaigns', campaign.id, 'inventory']
      })
  })

  return (
    <div className={partyOnly ? undefined : inventoryStyles.inventoryWorkspace}>
      <section
        className={`${sharedStyles.panel} ${inventoryStyles.inventoryPanel}`}
        aria-labelledby='inventory-title'
      >
        {!partyOnly ? (
          <>
            <div>
              <Title order={2} id='inventory-title'>
                Inventory
              </Title>
              <Text c='dimmed' size='sm'>
                Party custody and authorized assigned Characters.
              </Text>
            </div>
            <Select
              data={ownerOptions}
              classNames={{ input: sharedStyles.input }}
              label='Inventory owner'
              value={ownerValue}
              onChange={(value) => {
                transfer.reset()
                setOwnerValue(value ?? 'PARTY')
                setAssetValue('')
              }}
            />
          </>
        ) : null}
        {inventory.error ? <Alert color='red'>{inventory.error.message}</Alert> : null}
        {inventory.isPending ? (
          <Loader size='sm' />
        ) : partyOnly ? (
          <Accordion multiple defaultValue={['carried']}>
            <Accordion.Item value='carried'>
              <Accordion.Control>Carried</Accordion.Control>
              <Accordion.Panel>
                <InventoryEntries items={carriedItems} currencies={carriedCurrencies} />
              </Accordion.Panel>
            </Accordion.Item>
            {containers.map((container) => (
              <Accordion.Item key={container.id} value={container.id}>
                <Accordion.Control>{container.label}</Accordion.Control>
                <Accordion.Panel>
                  <InventoryEntries
                    items={(inventory.data?.items ?? []).filter(
                      (item) => item.containerId === container.id
                    )}
                    currencies={(inventory.data?.currencies ?? []).filter(
                      (currency) => currency.containerId === container.id
                    )}
                  />
                </Accordion.Panel>
              </Accordion.Item>
            ))}
          </Accordion>
        ) : ownerValue === 'PARTY' && inventory.data && campaign.status === 'ACTIVE' ? null : (
          <InventoryEntries
            items={inventory.data?.items ?? []}
            currencies={inventory.data?.currencies ?? []}
          />
        )}
        {ownerValue === 'PARTY' && inventory.data && campaign.status === 'ACTIVE' ? (
          <CampaignPartyInventoryActions campaignId={campaign.id} inventory={inventory.data} />
        ) : null}
        {canTransfer && campaign.status === 'ACTIVE' ? (
          <Stack gap='sm'>
            <Title order={3}>Transfer</Title>
            {transfer.error ? <Alert color='red'>{transfer.error.message}</Alert> : null}
            <div className={inventoryStyles.inventoryTransferGrid}>
              <Select
                data={assetOptions}
                classNames={{ input: sharedStyles.input }}
                label='Item or currency'
                value={assetValue}
                onChange={(value) => {
                  transfer.reset()
                  setAssetValue(value ?? '')
                }}
              />
              <Select
                data={destinationOptions.filter((option) => option.value !== ownerValue)}
                classNames={{ input: sharedStyles.input }}
                label='Destination'
                value={destinationValue === ownerValue ? null : destinationValue}
                onChange={(value) => {
                  setDestinationValue(value ?? '')
                  transfer.reset()
                }}
              />
              <NumberInput
                label='Amount'
                classNames={{ input: sharedStyles.input }}
                min={1}
                step={1}
                value={amount}
                onChange={(value) => setAmount(Number(value) || 1)}
              />
              <Button
                disabled={!assetValue || !destinationValue || destinationValue === ownerValue}
                loading={transfer.isPending}
                onClick={() => transfer.mutate()}
              >
                Transfer
              </Button>
            </div>
          </Stack>
        ) : null}
      </section>

      {!partyOnly && campaign.role === 'OWNER' ? (
        <section className={sharedStyles.panel} aria-labelledby='currency-systems-title'>
          <div>
            <Title order={2} id='currency-systems-title'>
              Currency systems
            </Title>
            <Text c='dimmed' size='sm'>
              Each system has one to five denominations and exactly one scale of 1.
            </Text>
          </div>
          {campaign.status === 'ACTIVE' ? (
            <CurrencySystemEditor campaignId={campaign.id} systems={currencySystems.data ?? []} />
          ) : (
            <Stack gap='xs'>
              {currencySystems.data?.map((system) => (
                <div key={system.id}>
                  <Text fw={600}>{system.label}</Text>
                  <Text c='dimmed' size='sm'>
                    {system.denominations
                      .map(
                        (denomination) => `${denomination.label} (${denomination.scaleInReference})`
                      )
                      .join(', ')}
                  </Text>
                </div>
              ))}
            </Stack>
          )}
        </section>
      ) : null}
      {!partyOnly && campaign.role === 'OWNER' ? (
        <CampaignInventoryAudit campaign={campaign} />
      ) : null}
    </div>
  )
}

function InventoryEntries({
  items,
  currencies
}: {
  items: InventoryDto['items']
  currencies: InventoryDto['currencies']
}) {
  if (items.length === 0 && currencies.length === 0) return <Text c='dimmed'>Empty.</Text>
  return (
    <Stack gap='xs'>
      {items.map((item) => (
        <Group justify='space-between' key={item.id}>
          <Text>{item.label}</Text>
          <Text>{item.quantity}</Text>
        </Group>
      ))}
      {currencies.map((currency) => (
        <Group
          justify='space-between'
          key={`${currency.kind}:${currency.denominationId}:${currency.containerId ?? 'carried'}`}
        >
          <Text>{currency.label}</Text>
          <Text>
            {currency.amount} {currency.abbreviation}
          </Text>
        </Group>
      ))}
    </Stack>
  )
}

function getAuthorizedSourceOwners(campaign: CampaignDetailDto, currentUserId: string) {
  const memberships =
    campaign.role === 'OWNER'
      ? campaign.memberships
      : campaign.memberships.filter((member) => member.userId === currentUserId)
  return [
    { value: 'PARTY', label: 'Party inventory' },
    ...memberships.flatMap((member) =>
      member.assignedCharacter
        ? [
            {
              value: `CHARACTER:${member.assignedCharacter.id}`,
              label: member.assignedCharacter.label
            }
          ]
        : []
    )
  ]
}

function getTransferDestinationOwners(campaign: CampaignDetailDto) {
  return [
    { value: 'PARTY', label: 'Party inventory' },
    ...campaign.memberships.flatMap((member) =>
      member.assignedCharacter
        ? [
            {
              value: `CHARACTER:${member.assignedCharacter.id}`,
              label: member.assignedCharacter.label
            }
          ]
        : []
    )
  ]
}

function parseOwner(value: string, campaignId: string): InventoryOwnerRefDto {
  return value === 'PARTY'
    ? { kind: 'CAMPAIGN', campaignId }
    : { kind: 'CHARACTER', characterId: value.slice('CHARACTER:'.length) }
}
