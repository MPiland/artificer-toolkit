import { z, lazySchema } from '../zod.js'
import { postgresUuidSchema } from './postgresUuid.js'

export const serverUuidIdentityDtoSchema = lazySchema(() =>
  z.pipe(
    postgresUuidSchema,
    z.transform((value) => value.toLowerCase())
  )
)
