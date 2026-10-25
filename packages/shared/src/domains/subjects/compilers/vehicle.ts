import type { VehicleAuthored } from '#authored'
import { compileFeature, type CompiledFeature } from '#compilers'
import type { CompiledCost, CompiledWeight } from './equipment.js'

export interface CompiledVehicle {
  id: string
  category: string
  size?: string
  armorClass?: number
  hitPoints?: number
  speed?: number
  speedNote?: string
  crewMin?: number
  crewMax?: number
  passengerCapacity?: number
  cargoCapacity?: string
  weight?: CompiledWeight
  cost?: CompiledCost
  properties?: string[]
  features?: CompiledFeature[]
}

export function compileVehicle(authored: VehicleAuthored): CompiledVehicle {
  return {
    id: authored.id,
    category: authored.category,
    size: authored.size,
    armorClass: authored.armorClass,
    hitPoints: authored.hitPoints,
    speed: authored.speed,
    speedNote: authored.speedNote,
    crewMin: authored.crewMin,
    crewMax: authored.crewMax,
    passengerCapacity: authored.passengerCapacity,
    cargoCapacity: authored.cargoCapacity,
    weight: authored.weight,
    cost: authored.cost,
    properties: authored.properties,
    features: authored.features?.map(compileFeature)
  }
}
