import { z } from '../zod.js'

export const entitlementTierDtoSchema = z.enum(['FREE', 'PLAYER', 'GM', 'PRO_GM'])
