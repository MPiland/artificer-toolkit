import { Badge, Button, Drawer, NumberInput, Select, Tabs, Text } from '@mantine/core'
import { useDisclosure, useMediaQuery } from '@mantine/hooks'
import { IconSettings } from '@tabler/icons-react'
import { useState } from 'react'
import {
  CharacterSheetCompactActions,
  CharacterSheetDetailPanel,
  CharacterSheetDetailRow
} from './CharacterSheetDetailPanel'
import * as styles from './characterSheet.css'
import type { CharacterSheet, CharacterSheetSectionProps } from './CharacterSheet.types'
import { getInventoryCurrencyTotals } from './characterSheetInventory.utils'
import { toNumber } from './characterSheet.utils'

function CharacterSheetInventoryItemRow({
  item,
  openPanel,
  resources
}: {
  item: CharacterSheet['inventory']['items'][number]
  openPanel: CharacterSheetSectionProps['openPanel']
  resources: CharacterSheet['resources']['items']
}) {
  const resourceSummary = resources
    .filter(
      (resource) =>
        resource.owner.kind === 'ITEM_INSTANCE' && resource.owner.itemInstanceId === item.id
    )
    .map((resource) => `${resource.remaining} / ${resource.max}`)
    .join(' · ')
  const state = [item.equipped ? 'Equipped' : undefined, item.attuned ? 'Attuned' : undefined]
    .filter(Boolean)
    .join(' · ')

  return (
    <button
      aria-label={`Open ${item.label} details`}
      className={styles.inventoryDataRow}
      disabled={!openPanel}
      type='button'
      onClick={() => openPanel?.({ kind: 'ITEM', itemInstanceId: item.id })}
    >
      <span className={styles.inventoryItemIdentity}>
        <strong>{item.label}</strong>
        {item.customName && item.equipmentLabel ? <small>{item.equipmentLabel}</small> : null}
      </span>
      <span className={styles.inventoryDataCell}>
        <small>Qty</small>
        <strong>{item.quantity}</strong>
      </span>
      <span className={styles.inventoryDataCell}>
        <small>Weight</small>
        <strong>
          {item.weight ? `${item.weight.amount} ${item.weight.unit.toLocaleLowerCase()}` : '—'}
        </strong>
      </span>
      <span className={styles.inventoryDataCell}>
        <small>State</small>
        <strong>{state || 'Carried'}</strong>
      </span>
      <span className={styles.inventoryDataCell}>
        <small>Uses</small>
        <strong>{resourceSummary || '—'}</strong>
      </span>
    </button>
  )
}

function CharacterSheetInventoryTable({
  emptyLabel,
  items,
  openPanel,
  resources
}: {
  emptyLabel: string
  items: CharacterSheet['inventory']['items']
  openPanel: CharacterSheetSectionProps['openPanel']
  resources: CharacterSheet['resources']['items']
}) {
  if (!items.length) return <Text className={styles.muted}>{emptyLabel}</Text>

  return (
    <div className={styles.inventoryDataTable}>
      <div aria-hidden='true' className={styles.inventoryDataHeader}>
        <span>Item</span>
        <span>Qty</span>
        <span>Weight</span>
        <span>State</span>
        <span>Uses</span>
      </div>
      {items.map((item) => (
        <CharacterSheetInventoryItemRow
          item={item}
          key={item.id}
          openPanel={openPanel}
          resources={resources}
        />
      ))}
    </div>
  )
}

export function CharacterSheetInventory({
  openPanel,
  pending,
  sheet,
  submitCommand
}: CharacterSheetSectionProps) {
  const version = sheet.meta.streamVersion
  const isMobile = useMediaQuery('(max-width: 760px)', false)
  const [manageOpened, manage] = useDisclosure(false)
  const [equipmentId, setEquipmentId] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [currencyId, setCurrencyId] = useState<string | null>(
    sheet.reference.currencyOptions[0]?.id ?? null
  )
  const [currencyAmount, setCurrencyAmount] = useState(1)
  const [containerId, setContainerId] = useState<string | null>(null)
  const [currencyFromContainerId, setCurrencyFromContainerId] = useState('carried')
  const [currencyToContainerId, setCurrencyToContainerId] = useState('carried')
  const containers = sheet.inventory.containers ?? []
  const currencyTotals = getInventoryCurrencyTotals(sheet)
  const selectedEquipment = sheet.reference.equipmentOptions.find(
    (option) => option.id === equipmentId
  )
  const containerOptions = [
    { value: 'carried', label: 'Carried' },
    ...containers.map((container) => ({ value: container.id, label: container.label }))
  ]

  return (
    <CharacterSheetDetailPanel
      ariaId='character-sheet-inventory'
      title='Equipment'
      headerActions={
        <Button
          leftSection={<IconSettings size={16} />}
          size='xs'
          variant='default'
          onClick={manage.open}
        >
          Manage Equipment
        </Button>
      }
    >
      <div aria-label='Currency' className={styles.inventorySummary}>
        {currencyTotals.map((currency) => (
          <span key={currency.id}>
            <strong>{currency.amount}</strong>
            <small>{currency.label}</small>
          </span>
        ))}
      </div>

      <Tabs defaultValue='carried' styles={{ tab: { borderWidth: 0 } }}>
        <Tabs.List className={styles.subsectionTabs}>
          <Tabs.Tab className={styles.tab} value='carried'>
            Carried
          </Tabs.Tab>
          <Tabs.Tab className={styles.tab} value='containers'>
            Containers
          </Tabs.Tab>
          <Tabs.Tab className={styles.tab} value='consumables'>
            Consumables
          </Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value='carried' pt='md'>
          <CharacterSheetInventoryTable
            emptyLabel='No gear is being carried.'
            items={sheet.inventory.items.filter((item) => !item.containerId)}
            openPanel={openPanel}
            resources={sheet.resources.items}
          />
        </Tabs.Panel>
        <Tabs.Panel value='containers' pt='md'>
          <div className={styles.containerList}>
            {containers.map((container) => (
              <section className={styles.containerSection} key={container.id}>
                <div className={styles.containerHeading}>
                  <div>
                    <Text fw={700}>{container.label}</Text>
                    <Text className={styles.muted} size='sm'>
                      {container.capacity
                        ? `${container.capacity.amount} ${container.capacity.unit.toLocaleLowerCase()} capacity`
                        : 'Container'}
                    </Text>
                  </div>
                  <Badge variant='default'>{container.itemIds.length} items</Badge>
                </div>
                <CharacterSheetInventoryTable
                  emptyLabel='This container is empty.'
                  items={sheet.inventory.items.filter((item) => item.containerId === container.id)}
                  openPanel={openPanel}
                  resources={sheet.resources.items}
                />
                {container.currencies.length ? (
                  <div
                    aria-label={`${container.label} currency`}
                    className={styles.inventorySummary}
                  >
                    {container.currencies.map((currency) => (
                      <span key={currency.currencyId}>
                        <strong>{currency.amount}</strong>
                        <small>{currency.label}</small>
                      </span>
                    ))}
                  </div>
                ) : null}
              </section>
            ))}
          </div>
        </Tabs.Panel>
        <Tabs.Panel value='consumables' pt='md'>
          <CharacterSheetInventoryTable
            emptyLabel='No consumables are being carried.'
            items={sheet.inventory.items.filter((item) =>
              item.category?.toLocaleLowerCase().includes('consumable')
            )}
            openPanel={openPanel}
            resources={sheet.resources.items}
          />
        </Tabs.Panel>
      </Tabs>

      <Drawer
        opened={manageOpened}
        onClose={manage.close}
        position={isMobile ? 'bottom' : 'right'}
        size={isMobile ? '92%' : 'lg'}
        title='Manage Equipment'
      >
        <div className={styles.drawerStack}>
          <section className={styles.drawerSection}>
            <Text fw={700}>Add an item</Text>
            <Select
              data={sheet.reference.equipmentOptions.map((option) => ({
                value: option.id,
                label: option.label
              }))}
              disabled={pending}
              label='Equipment'
              placeholder='Choose an item'
              searchable
              value={equipmentId}
              onChange={(value) => {
                setEquipmentId(value)
                if (
                  sheet.reference.equipmentOptions.find((option) => option.id === value)
                    ?.isContainer
                ) {
                  setContainerId(null)
                }
              }}
            />
            <div className={styles.inlineControlRow}>
              <NumberInput
                disabled={pending}
                label='Quantity'
                min={1}
                value={quantity}
                onChange={(value) => setQuantity(Math.max(toNumber(value), 1))}
              />
              <Select
                data={
                  selectedEquipment?.isContainer
                    ? [{ value: 'carried', label: 'Carried' }]
                    : containerOptions
                }
                disabled={pending || selectedEquipment?.isContainer}
                label='Add to'
                value={containerId ?? 'carried'}
                onChange={(value) => setContainerId(value === 'carried' ? null : value)}
              />
            </div>
            <Button
              disabled={pending || !equipmentId}
              onClick={() => {
                if (!equipmentId) return
                void submitCommand({
                  type: 'ADD_INVENTORY_ITEM',
                  equipmentId,
                  quantity,
                  containerId: containerId ?? undefined,
                  expectedVersion: version
                })
                setEquipmentId(null)
                setQuantity(1)
              }}
            >
              Add Item
            </Button>
          </section>

          <section className={styles.drawerSection}>
            <Text fw={700}>Move currency</Text>
            <Select
              data={containerOptions}
              disabled={pending}
              label='From'
              value={currencyFromContainerId}
              onChange={(value) => setCurrencyFromContainerId(value ?? 'carried')}
            />
            <Select
              data={containerOptions}
              disabled={pending}
              label='To'
              value={currencyToContainerId}
              onChange={(value) => setCurrencyToContainerId(value ?? 'carried')}
            />
            <Select
              data={sheet.reference.currencyOptions.map((option) => ({
                value: option.id,
                label: option.label
              }))}
              disabled={pending}
              label='Currency type to move'
              value={currencyId}
              onChange={setCurrencyId}
            />
            <NumberInput
              disabled={pending}
              label='Amount to move'
              min={1}
              value={currencyAmount}
              onChange={(value) => setCurrencyAmount(Math.max(toNumber(value), 1))}
            />
            <Button
              disabled={pending || !currencyId || currencyFromContainerId === currencyToContainerId}
              onClick={async () => {
                if (!currencyId || currencyFromContainerId === currencyToContainerId) return
                await submitCommand({
                  type: 'MOVE_CURRENCY',
                  currencyId,
                  amount: currencyAmount,
                  fromContainerId:
                    currencyFromContainerId === 'carried' ? undefined : currencyFromContainerId,
                  toContainerId:
                    currencyToContainerId === 'carried' ? undefined : currencyToContainerId,
                  expectedVersion: version
                })
              }}
            >
              Move Currency
            </Button>
          </section>

          <section className={styles.drawerSection}>
            <Text fw={700}>Move items</Text>
            {sheet.inventory.items.map((item) => (
              <div className={styles.itemManagementRow} key={item.id}>
                <Text>{item.label}</Text>
                <Select
                  aria-label={`Move ${item.label}`}
                  data={item.capacity ? [{ value: 'carried', label: 'Carried' }] : containerOptions}
                  disabled={pending || Boolean(item.capacity && !item.containerId)}
                  value={item.containerId ?? 'carried'}
                  onChange={(value) =>
                    submitCommand({
                      type: 'UPDATE_INVENTORY_ITEM',
                      itemId: item.id,
                      containerId: value === 'carried' ? null : value,
                      expectedVersion: version
                    })
                  }
                />
              </div>
            ))}
          </section>

          <section className={styles.drawerSection}>
            <Text fw={700}>Currency</Text>
            {sheet.inventory.currencies.map((currency) => (
              <CharacterSheetDetailRow
                key={`${currency.containerId ?? 'carried'}:${currency.currencyId}`}
                left={
                  <>
                    <Text fw={700}>{currency.label}</Text>
                    <Text className={styles.muted}>{currency.amount}</Text>
                  </>
                }
                right={
                  <CharacterSheetCompactActions>
                    <Button
                      className={styles.compactActionControl}
                      disabled={pending}
                      size='xs'
                      variant='default'
                      onClick={() =>
                        submitCommand({
                          type: 'ADJUST_CURRENCY',
                          currencyId: currency.currencyId,
                          amount: -1,
                          containerId: currency.containerId,
                          expectedVersion: version
                        })
                      }
                    >
                      -1
                    </Button>
                    <Button
                      className={styles.compactActionControl}
                      disabled={pending}
                      size='xs'
                      onClick={() =>
                        submitCommand({
                          type: 'ADJUST_CURRENCY',
                          currencyId: currency.currencyId,
                          amount: 1,
                          containerId: currency.containerId,
                          expectedVersion: version
                        })
                      }
                    >
                      +1
                    </Button>
                  </CharacterSheetCompactActions>
                }
              />
            ))}
          </section>

          <section className={styles.drawerSection}>
            <Select
              data={sheet.reference.currencyOptions.map((option) => ({
                value: option.id,
                label: option.label
              }))}
              disabled={pending || sheet.reference.currencyOptions.length === 0}
              label='Currency type'
              placeholder='Choose currency'
              searchable
              value={currencyId}
              onChange={setCurrencyId}
            />
            <NumberInput
              disabled={pending}
              label='Amount'
              value={currencyAmount}
              onChange={(value) => setCurrencyAmount(toNumber(value))}
            />
            <Button
              disabled={pending || !currencyId || currencyAmount === 0}
              variant='default'
              onClick={() => {
                if (!currencyId || currencyAmount === 0) return
                void submitCommand({
                  type: 'ADJUST_CURRENCY',
                  currencyId,
                  amount: currencyAmount,
                  expectedVersion: version
                })
                setCurrencyAmount(1)
              }}
            >
              Apply Currency
            </Button>
          </section>
        </div>
      </Drawer>
    </CharacterSheetDetailPanel>
  )
}
