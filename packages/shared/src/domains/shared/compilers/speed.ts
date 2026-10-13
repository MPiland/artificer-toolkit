import type { SpeedAuthored } from '#authored'
import type { LengthUnitCode } from '#core'

export type CompiledSpeed = {
  speedId: string
  amount: number
  unit: LengthUnitCode
}

export function compileSpeed(authored: SpeedAuthored) {
  return {
    speedId: authored.speedId,
    amount: authored.amount,
    unit: authored.unit
  }
}
