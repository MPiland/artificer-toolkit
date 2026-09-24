import { z } from '../zod.js'

// Pool keys compose encoded source/access identities; a UUID-backed subclass spell key is 426 characters.
export const characterResourcePoolIdentitySchema = z
  .string()
  .check(z.trim())
  .check(z.minLength(1))
  .check(z.maxLength(1_000))
