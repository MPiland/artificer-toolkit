import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import type {
  StartingEquipmentAuthored,
  StartingEquipmentItemAuthored
} from '@artificer-toolkit/shared/authored'

type StartingGold = {
  currencyId: string
  dieConfig: string
  multiplier: number
}

type StartingEquipmentSource = 'CLASS' | 'BACKGROUND'
type StartingEquipmentItem = StartingEquipmentItemAuthored

export function materializeCharacterStartingEquipment(
  character: CharacterAuthored,
  sources: {
    classStartingEquipment?: StartingEquipmentAuthored
    classStartingGold?: StartingGold
    backgroundStartingEquipment?: StartingEquipmentAuthored
  }
): { character: CharacterAuthored; changed: boolean } {
  const next = structuredClone(character)
  const additions = new Map<string, number>()
  const currencyAdditions = new Map<string, number>()
  let changed = false

  changed =
    applyDecision(
      next,
      'CLASS',
      sources.classStartingEquipment,
      sources.classStartingGold,
      additions,
      currencyAdditions
    ) || changed
  changed =
    applyDecision(
      next,
      'BACKGROUND',
      sources.backgroundStartingEquipment,
      undefined,
      additions,
      currencyAdditions
    ) || changed

  if (!changed) return { character, changed: false }

  for (const [equipmentId, quantity] of additions) {
    const existing = next.state.equipment.inventory.find(
      (item) => !item.containerId && item.equipmentId === equipmentId
    )
    if (existing) {
      existing.quantity += quantity
    } else {
      next.state.equipment.inventory.push({
        id: crypto.randomUUID(),
        equipmentId,
        quantity
      })
    }
  }

  if (currencyAdditions.size > 0) {
    let group = next.state.currency.find((candidate) => !candidate.containerId)
    if (!group) {
      group = { id: crypto.randomUUID(), currencies: [] }
      next.state.currency.push(group)
    }
    for (const [currencyId, amount] of currencyAdditions) {
      const existing = group.currencies.find((currency) => currency.currencyId === currencyId)
      if (existing) existing.amount += amount
      else group.currencies.push({ currencyId, amount })
    }
  }

  return { character: next, changed: true }
}

function applyDecision(
  character: CharacterAuthored,
  source: StartingEquipmentSource,
  startingEquipment: StartingEquipmentAuthored | undefined,
  startingGold: StartingGold | undefined,
  equipmentAdditions: Map<string, number>,
  currencyAdditions: Map<string, number>
): boolean {
  const decision =
    source === 'CLASS'
      ? character.intent.startingEquipment?.class
      : character.intent.startingEquipment?.background
  if (!decision || decision.applied || !startingEquipment) return false

  if (decision.tookGold) {
    if (!decision.gold || !startingGold) return false
    addAmount(currencyAdditions, startingGold.currencyId, decision.gold.totalGold)
  } else {
    const selections = new Map(
      (decision.groups ?? []).map((selection) => [selection.groupId, selection])
    )
    for (const set of startingEquipment.sets) {
      for (const group of set.groups) {
        const selection = selections.get(group.id)
        const option = group.options.find((candidate) => candidate.id === selection?.optionId)
        if (!option) continue

        for (const item of option.items) {
          if (isCurrencyItem(item)) {
            for (const currency of item.currencies) {
              addAmount(currencyAdditions, currency.currencyId, currency.amount)
            }
            continue
          }
          if (item.selectionKind === 'GRANTED') {
            if (
              item.authoringModeKind !== 'SELECTED' ||
              !('equipmentIds' in item) ||
              !('quantity' in item)
            ) {
              continue
            }
            for (const equipmentId of item.equipmentIds) {
              addAmount(equipmentAdditions, equipmentId, item.quantity)
            }
            continue
          }
          for (const chosen of selection?.selections ?? []) {
            if (chosen.selectionKey === item.id) {
              addAmount(equipmentAdditions, chosen.equipmentId, chosen.quantity)
            }
          }
        }
      }
    }
  }

  decision.applied = true
  return true
}

function isCurrencyItem(
  item: StartingEquipmentItem
): item is StartingEquipmentItem & { currencies: { currencyId: string; amount: number }[] } {
  return item.startingEquipmentKind === 'CURRENCY' && 'currencies' in item
}

function addAmount(amounts: Map<string, number>, id: string, amount: number) {
  if (amount <= 0) return
  amounts.set(id, (amounts.get(id) ?? 0) + amount)
}
