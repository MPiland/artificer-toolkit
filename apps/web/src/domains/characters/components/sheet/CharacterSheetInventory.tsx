import { Button, Collapse, NumberInput, Select, Text, Textarea, TextInput, Title } from '@mantine/core'
import { useState } from 'react'
import { AuthoredDetailProse } from '#app/components/AuthoredDetail'
import * as styles from './characterSheet.css'
import type { CharacterSheet, CharacterSheetSectionProps, SubmitSheetCommand } from './CharacterSheet.types'
import { formatInventoryItemProperties, formatInventoryItemSummary } from './characterSheetInventory.utils'
import { toNumber } from './characterSheet.utils'

function CharacterSheetInventoryItemRow({
  item,
  pending,
  submitCommand,
  version
}: {
  item: CharacterSheet['inventory']['items'][number]
  pending: boolean
  submitCommand: SubmitSheetCommand
  version: number
}) {
  const [expanded, setExpanded] = useState(false)
  const [customName, setCustomName] = useState(item.customName ?? '')
  const [notes, setNotes] = useState(item.notes ?? '')
  const properties = formatInventoryItemProperties(item)

  return (
    <div className={styles.row}>
      <div>
        <Text fw={700}>{item.label}</Text>
        {item.customName && item.equipmentLabel ? <Text className={styles.muted}>{item.equipmentLabel}</Text> : null}
        <Text className={styles.muted}>{formatInventoryItemSummary(item)}</Text>
        {properties
          ? (
              <Text className={styles.muted}>
                Properties:
                {' '}
                {properties}
              </Text>
            )
          : null}
        {item.notes ? <Text className={styles.muted}>{item.notes}</Text> : null}
      </div>
      <div className={styles.compactActions}>
        <Button
          aria-label={`Decrease ${item.label} quantity`}
          disabled={pending || item.quantity <= 0}
          size='xs'
          variant='default'
          onClick={() => submitCommand({
            type: 'REMOVE_INVENTORY_ITEM',
            itemId: item.id,
            quantity: 1,
            expectedVersion: version
          })}
        >
          -1
        </Button>
        <Button
          aria-label={`Increase ${item.label} quantity`}
          disabled={pending}
          size='xs'
          variant='default'
          onClick={() => submitCommand({
            type: 'UPDATE_INVENTORY_ITEM',
            itemId: item.id,
            quantity: item.quantity + 1,
            expectedVersion: version
          })}
        >
          +1
        </Button>
        <Button
          aria-label={`${item.equipped ? 'Unequip' : 'Equip'} ${item.label}`}
          disabled={pending}
          size='xs'
          variant={item.equipped ? 'default' : 'filled'}
          onClick={() => submitCommand({
            type: item.equipped ? 'UNEQUIP_ITEM' : 'EQUIP_ITEM',
            itemId: item.id,
            expectedVersion: version
          })}
        >
          {item.equipped ? 'Unequip' : 'Equip'}
        </Button>
        <Button
          aria-label={`${item.attuned ? 'Unattune' : 'Attune'} ${item.label}`}
          disabled={pending}
          size='xs'
          variant={item.attuned ? 'default' : 'light'}
          onClick={() => submitCommand({
            type: item.attuned ? 'UNATTUNE_ITEM' : 'ATTUNE_ITEM',
            itemId: item.id,
            expectedVersion: version
          })}
        >
          {item.attuned ? 'Unattune' : 'Attune'}
        </Button>
        <Button
          aria-label={`Edit ${item.label} details`}
          disabled={pending}
          size='xs'
          variant='default'
          onClick={() => setExpanded((current) => !current)}
        >
          Details
        </Button>
        <Button
          aria-label={`Remove ${item.label}`}
          disabled={pending}
          size='xs'
          color='red'
          variant='subtle'
          onClick={() => submitCommand({
            type: 'REMOVE_INVENTORY_ITEM',
            itemId: item.id,
            expectedVersion: version
          })}
        >
          Remove
        </Button>
      </div>
      <Collapse className={styles.inlineEditorShell} in={expanded}>
        <div className={styles.inlineEditor}>
          {item.description ? <AuthoredDetailProse html={item.description} fallback='' /> : null}
          <TextInput
            disabled={pending}
            label='Custom name'
            placeholder={item.label}
            value={customName}
            onChange={(event) => setCustomName(event.currentTarget.value)}
          />
          <Textarea
            autosize
            disabled={pending}
            label='Item notes'
            minRows={2}
            placeholder='Track charges, placement, ownership, or table notes.'
            value={notes}
            onChange={(event) => setNotes(event.currentTarget.value)}
          />
          <div className={styles.compactActions}>
            <Button
              disabled={pending}
              size='xs'
              onClick={() => submitCommand({
                type: 'UPDATE_INVENTORY_ITEM',
                itemId: item.id,
                customName: customName.trim() || null,
                notes: notes.trim() || null,
                expectedVersion: version
              })}
            >
              Save Details
            </Button>
          </div>
        </div>
      </Collapse>
    </div>
  )
}

export function CharacterSheetInventory({
  pending,
  sheet,
  submitCommand
}: CharacterSheetSectionProps) {
  const version = sheet.meta.streamVersion
  const [equipmentId, setEquipmentId] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [currencyId, setCurrencyId] = useState<string | null>(sheet.reference.currencyOptions[0]?.id ?? null)
  const [currencyAmount, setCurrencyAmount] = useState(1)

  return (
    <section className={styles.panel} aria-labelledby='character-sheet-inventory'>
      <div className={styles.panelHeader}>
        <div>
          <Title id='character-sheet-inventory' className={styles.panelTitle}>Inventory</Title>
          <Text className={styles.muted}>Equipment, attunement, and currency.</Text>
        </div>
      </div>

      <div className={styles.hpControls}>
        <Select
          data={sheet.reference.equipmentOptions.map((option) => ({
            value: option.id,
            label: option.label
          }))}
          disabled={pending}
          label='Add equipment'
          placeholder='Choose an item'
          searchable
          value={equipmentId}
          onChange={setEquipmentId}
        />
        <NumberInput
          disabled={pending}
          label='Quantity'
          min={1}
          value={quantity}
          onChange={(value) => setQuantity(Math.max(toNumber(value), 1))}
        />
        <Button
          disabled={pending || !equipmentId}
          onClick={() => {
            if (!equipmentId) return
            submitCommand({
              type: 'ADD_INVENTORY_ITEM',
              equipmentId,
              quantity,
              expectedVersion: version
            })
            setEquipmentId(null)
            setQuantity(1)
          }}
        >
          Add Item
        </Button>
      </div>

      <div className={styles.rowList}>
        {sheet.inventory.items.length
          ? sheet.inventory.items.map((item) => (
              <CharacterSheetInventoryItemRow
                item={item}
                key={`${version}:${item.id}:${item.customName ?? ''}:${item.notes ?? ''}`}
                pending={pending}
                submitCommand={submitCommand}
                version={version}
              />
            ))
          : <Text className={styles.muted}>No inventory has been added yet.</Text>}
      </div>

      <div className={styles.rowList}>
        {sheet.inventory.currencies.length
          ? sheet.inventory.currencies.map((currency) => (
              <div className={styles.row} key={`${currency.containerId ?? 'carried'}:${currency.currencyId}`}>
                <div>
                  <Text fw={700}>{currency.label}</Text>
                  <Text className={styles.muted}>{currency.amount}</Text>
                </div>
                <div className={styles.compactActions}>
                  <Button
                    disabled={pending}
                    size='xs'
                    variant='default'
                    onClick={() => submitCommand({
                      type: 'ADJUST_CURRENCY',
                      currencyId: currency.currencyId,
                      amount: -1,
                      containerId: currency.containerId,
                      expectedVersion: version
                    })}
                  >
                    -1
                  </Button>
                  <Button
                    disabled={pending}
                    size='xs'
                    onClick={() => submitCommand({
                      type: 'ADJUST_CURRENCY',
                      currencyId: currency.currencyId,
                      amount: 1,
                      containerId: currency.containerId,
                      expectedVersion: version
                    })}
                  >
                    +1
                  </Button>
                </div>
              </div>
            ))
          : null}
      </div>

      <div className={styles.hpControls}>
        <Select
          data={sheet.reference.currencyOptions.map((option) => ({
            value: option.id,
            label: option.label
          }))}
          disabled={pending || sheet.reference.currencyOptions.length === 0}
          label='Adjust currency'
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
            submitCommand({
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
      </div>
    </section>
  )
}
