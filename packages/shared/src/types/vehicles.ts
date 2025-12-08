import type { Hitpoint } from './classes'
import type { ArmorClass, Speed, Actions } from './shared'

/*
──────────────────────────────────────────────────────────────────────────────
VEHICLE TYPE — NON-LIVING TRANSPORTATION (LAND, WATER, AIR)
──────────────────────────────────────────────────────────────────────────────

Purpose:
--------
Defines objects used for transport or travel, such as ships, wagons, or airships.

Structure:
----------
• `categoryId` — Type of vehicle (land, water, air).
• `crew` — Minimum and maximum crew requirements.
• `capacity` — Passenger or cargo capacity.
• `speed` — Travel speed and units.
• `armorClass`, `hitPoints` — Represent structural resilience.
• `actions` — For vehicles with weaponry or controllable systems.
──────────────────────────────────────────────────────────────────────────────
*/
export interface Vehicle {
  id: string
  label: string
  description: string | null
  categoryId: string
  crew: VehicleCrew
  capacity: VehicleCapacity
  speed: Speed[]
  armorClass: ArmorClass
  hitPoints: Hitpoint
  actions: Actions
  userId: string
  systemId: string
}

export interface VehicleCrew {
  min: number // int
  max: number // int
}

export interface VehicleCapacity {
  passengers: number // int
  cargoWeight: number // int
  unitId: string
}
