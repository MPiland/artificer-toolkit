import { z } from '../zod.js'
import { postgresUuidSchema } from './postgresUuid.js'

export const serverUuidIdentityDtoSchema = z.pipe(
  postgresUuidSchema,
  z.transform((value) => value.toLowerCase())
)
