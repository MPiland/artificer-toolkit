import type { Creature } from './creatures'
import type { EquipmentCurrency } from './shared'

/*
──────────────────────────────────────────────────────────────────────────────
MOUNT TYPE — RIDEABLE CREATURES
──────────────────────────────────────────────────────────────────────────────

Purpose:
--------
Represents rideable creatures such as horses, griffons, or drakes.
Extends Creature with mount-specific properties.

Structure:
----------
• `carryingCapacity` — Max load or weight (may depend on size).
• `trained` — Whether it is combat-trained or not.
• `price` — Standard cost in system currencies.
──────────────────────────────────────────────────────────────────────────────
*/
export interface Mount extends Creature {
  carryingCapacity: number | null // int
  trained: boolean | null
  price: EquipmentCurrency[] | null
}
