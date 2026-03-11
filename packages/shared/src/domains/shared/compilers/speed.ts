import type { SpeedAuthored } from '#authored'
import type { MeasurementUnitCode } from '#core'

export type CompiledSpeed = {
  speedId: string
  amount: number
  unit: MeasurementUnitCode
}

export function compileSpeed(authored: SpeedAuthored) {
  return {
    speedId: authored.speedId,
    amount: authored.amount,
    unit: authored.unit
  }
}
