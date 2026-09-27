import { z, lazySchema } from '../zod.js'

export const entitlementTierDtoSchema = lazySchema(() => z.enum(['FREE', 'PLAYER', 'GM', 'PRO_GM']))
