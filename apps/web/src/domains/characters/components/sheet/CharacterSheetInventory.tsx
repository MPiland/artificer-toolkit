import { Button, NumberInput, Select, Text, Title } from '@mantine/core'
import { useState } from 'react'
import * as styles from './characterSheet.css'
import type { CharacterSheetSectionProps } from './CharacterSheet.types'
import { toNumber } from './characterSheet.utils'

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
          label='Add equipment'
          placeholder='Choose an item'
          searchable
          value={equipmentId}
          onChange={setEquipmentId}
        />
        <NumberInput
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
              <div className={styles.row} key={item.id}>
                <div>
                  <Text fw={700}>{item.label}</Text>
                  <Text className={styles.muted}>
                    Qty
                    {' '}
                    {item.quantity}
                    {item.equipped ? ', equipped' : ''}
                    {item.attuned ? ', attuned' : ''}
                  </Text>
                </div>
                <div className={styles.compactActions}>
                  <Button
                    aria-label={`Decrease ${item.label} quantity`}
                    disabled={pending}
                    size='xs'
                    variant='default'
                    onClick={() => submitCommand({
                      type: 'UPDATE_INVENTORY_ITEM',
                      itemId: item.id,
                      quantity: Math.max(item.quantity - 1, 0),
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
              </div>
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
          disabled={sheet.reference.currencyOptions.length === 0}
          label='Adjust currency'
          placeholder='Choose currency'
          searchable
          value={currencyId}
          onChange={setCurrencyId}
        />
        <NumberInput
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
