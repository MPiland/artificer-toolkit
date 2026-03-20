import { VEHICLE_IDS } from '../ids.js'
import { SRD_SYSTEM_ID, SRD_USER_ID } from '../vocabulary.js'

const CURRENCY_GP = '00000000-0000-0000-0003-000400000000'

export function gp(amount: number) {
  return { amount, currencyId: CURRENCY_GP }
}

export { VEHICLE_IDS, SRD_SYSTEM_ID, SRD_USER_ID }