import { Badge, Button, Drawer, NumberInput, Select, Tabs, Text } from '@mantine/core'
import { useDisclosure, useMediaQuery } from '@mantine/hooks'
import { IconSettings } from '@tabler/icons-react'
import { useState } from 'react'
import {
  CharacterSheetCompactActions,
  CharacterSheetDetailPanel,
  CharacterSheetDetailRow
} from '../shared/CharacterSheetDetailPanel'
import * as coreStyles from '../core/sheetShell.css'
import { CharacterSheetInventoryList } from './CharacterSheetInventoryList'
import * as inventoryStyles from './inventory.css'
import * as detailStyles from '../shared/detail.css'
import * as panelStyles from '../shared/panel.css'
import * as rowStyles from '../shared/rows.css'
import type {
  CharacterSheet,
  OpenSheetPanel,
  SubmitSheetCommand
} from '../core/CharacterSheet.types'
import { getInventoryCurrencyTotals } from './characterSheetInventory.utils'
import { toNumber } from '../core/characterSheet.utils'

export function CharacterSheetInventory({
  hideTitle,
  openPanel,
  pending,
  sheet,
  submitCommand
}: {
  hideTitle?: boolean
  openPanel?: OpenSheetPanel
  pending: boolean
  sheet: CharacterSheet
  submitCommand: SubmitSheetCommand
}) {
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
      hideTitle={hideTitle}
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
      <div aria-label='Currency' className={inventoryStyles.inventorySummary}>
        {currencyTotals.map((currency) => (
          <span key={currency.id}>
            <strong>{currency.amount}</strong>
            <small>{currency.label}</small>
          </span>
        ))}
      </div>

      <Tabs defaultValue='carried'>
        <Tabs.List className={inventoryStyles.subsectionTabs}>
          <Tabs.Tab className={coreStyles.tab} value='carried'>
            Carried
          </Tabs.Tab>
          <Tabs.Tab className={coreStyles.tab} value='containers'>
            Containers
          </Tabs.Tab>
          <Tabs.Tab className={coreStyles.tab} value='consumables'>
            Consumables
          </Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value='carried' pt='md'>
          <CharacterSheetInventoryList
            emptyLabel='No gear is being carried.'
            items={sheet.inventory.items.filter((item) => !item.containerId)}
            openPanel={openPanel}
            resources={sheet.resources.items}
          />
        </Tabs.Panel>
        <Tabs.Panel value='containers' pt='md'>
          <div className={inventoryStyles.containerList}>
            {containers.map((container) => (
              <section className={inventoryStyles.containerSection} key={container.id}>
                <div className={inventoryStyles.containerHeading}>
                  <div>
                    <Text fw={700}>{container.label}</Text>
                    <Text className={panelStyles.muted} size='sm'>
                      {container.capacity
                        ? `${container.capacity.amount} ${container.capacity.unit.toLocaleLowerCase()} capacity`
                        : 'Container'}
                    </Text>
                  </div>
                  <Badge variant='default'>{container.itemIds.length} items</Badge>
                </div>
                <CharacterSheetInventoryList
                  emptyLabel='This container is empty.'
                  items={sheet.inventory.items.filter((item) => item.containerId === container.id)}
                  openPanel={openPanel}
                  resources={sheet.resources.items}
                />
                {container.currencies.length ? (
                  <div
                    aria-label={`${container.label} currency`}
                    className={inventoryStyles.inventorySummary}
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
          <CharacterSheetInventoryList
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
        <div className={detailStyles.drawerStack}>
          <section className={detailStyles.drawerSection}>
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
            <div className={detailStyles.inlineControlRow}>
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

          <section className={detailStyles.drawerSection}>
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

          <section className={detailStyles.drawerSection}>
            <Text fw={700}>Move items</Text>
            {sheet.inventory.items.map((item) => (
              <div className={inventoryStyles.itemManagementRow} key={item.id}>
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

          <section className={detailStyles.drawerSection}>
            <Text fw={700}>Currency</Text>
            {sheet.inventory.currencies.map((currency) => (
              <CharacterSheetDetailRow
                key={`${currency.containerId ?? 'carried'}:${currency.currencyId}`}
                left={
                  <>
                    <Text fw={700}>{currency.label}</Text>
                    <Text className={panelStyles.muted}>{currency.amount}</Text>
                  </>
                }
                right={
                  <CharacterSheetCompactActions>
                    <Button
                      className={rowStyles.compactActionControl}
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
                      className={rowStyles.compactActionControl}
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

          <section className={detailStyles.drawerSection}>
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
