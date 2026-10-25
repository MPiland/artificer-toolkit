import type { ChargeDto, ChargeUseDto } from '@artificer-toolkit/schema/shared'

export type SimpleChargeDto = Extract<ChargeDto, { limitKind: 'FIXED_AMOUNT'; scalingKind: 'NONE' }>

export const CHARGE_RESET_OPTIONS = [
  { value: 'SHORT_REST', label: 'Short rest' },
  { value: 'LONG_REST', label: 'Long rest' },
  { value: 'DAWN', label: 'Dawn' }
] as const satisfies readonly { value: SimpleChargeDto['resetKind']; label: string }[]

export function createCharge(): SimpleChargeDto {
  return {
    id: crypto.randomUUID(),
    amount: 1,
    resetKind: 'LONG_REST',
    limitKind: 'FIXED_AMOUNT',
    scalingKind: 'NONE'
  }
}

export function isSimpleCharge(charge: ChargeUseDto): charge is SimpleChargeDto {
  return charge.limitKind === 'FIXED_AMOUNT' && charge.scalingKind === 'NONE'
}
