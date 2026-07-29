import { Text } from '@mantine/core'
import type { CharacterSheet, OpenSheetPanel } from '../core/CharacterSheet.types'
import * as panelStyles from '../shared/panel.css'
import * as inventoryStyles from './inventory.css'

function CharacterSheetInventoryItemRow({
  item,
  openPanel,
  resources
}: {
  item: CharacterSheet['inventory']['items'][number]
  openPanel?: OpenSheetPanel
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
      className={inventoryStyles.inventoryDataRow}
      disabled={!openPanel}
      type='button'
      onClick={() => openPanel?.({ kind: 'ITEM', itemInstanceId: item.id })}
    >
      <span className={inventoryStyles.inventoryItemIdentity}>
        <strong>{item.label}</strong>
        {item.customName && item.equipmentLabel ? <small>{item.equipmentLabel}</small> : null}
      </span>
      <span className={inventoryStyles.inventoryDataCell}>
        <small>Qty</small>
        <strong>{item.quantity}</strong>
      </span>
      <span className={inventoryStyles.inventoryDataCell}>
        <small>Weight</small>
        <strong>
          {item.weight ? `${item.weight.amount} ${item.weight.unit.toLocaleLowerCase()}` : '—'}
        </strong>
      </span>
      <span className={inventoryStyles.inventoryDataCell}>
        <small>State</small>
        <strong>{state || 'Carried'}</strong>
      </span>
      <span className={inventoryStyles.inventoryDataCell}>
        <small>Uses</small>
        <strong>{resourceSummary || '—'}</strong>
      </span>
    </button>
  )
}

export function CharacterSheetInventoryList({
  emptyLabel,
  items,
  openPanel,
  resources
}: {
  emptyLabel: string
  items: CharacterSheet['inventory']['items']
  openPanel?: OpenSheetPanel
  resources: CharacterSheet['resources']['items']
}) {
  if (!items.length) return <Text className={panelStyles.muted}>{emptyLabel}</Text>

  return (
    <div className={inventoryStyles.inventoryDataTable}>
      <div aria-hidden='true' className={inventoryStyles.inventoryDataHeader}>
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
