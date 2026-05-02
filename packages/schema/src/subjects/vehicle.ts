import { z } from 'zod'
import { detailDtoSchema } from '../shared/index.js'
import { featureDtoSchema } from '../features/index.js'
import { costDtoSchema } from './shared.js'
import { authoredRecordStatusSchema } from '../shared/enums.js'

export const vehicleAuthoredDtoSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string().optional(),
  status: authoredRecordStatusSchema.optional(),
  details: z.array(detailDtoSchema).optional(),
  userId: z.string(),
  systemId: z.string(),
  category: z.enum([
    'LAND',
    'WATER',
    'AIR',
    'SPELLJAMMER'
  ]),
  size: z.string().optional(),
  armorClass: z.number().int()
    .nonnegative()
    .optional(),
  hitPoints: z.number().int()
    .nonnegative()
    .optional(),
  speed: z.number().int()
    .nonnegative()
    .optional(),
  speedNote: z.string().optional(),
  crewMin: z.number().int()
    .nonnegative()
    .optional(),
  crewMax: z.number().int()
    .nonnegative()
    .optional(),
  passengerCapacity: z.number().int()
    .nonnegative()
    .optional(),
  cargoCapacity: z.string().optional(),
  cost: costDtoSchema.optional(),
  properties: z.array(z.string()).optional(),
  features: z.array(featureDtoSchema).optional()
})

export const vehicleAuthoringInputDtoSchema = vehicleAuthoredDtoSchema.extend({
  userId: z.string().optional()
})

export type VehicleAuthoredDto = z.infer<typeof vehicleAuthoredDtoSchema>
export type VehicleAuthoringInputDto = z.infer<typeof vehicleAuthoringInputDtoSchema>
