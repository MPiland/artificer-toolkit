import { z } from 'zod'

export const uuidSchema = z.string().uuid()
export const versionSchema = z.number().int().nonnegative()
export const timestampSchema = z.string().datetime()
export const shortTextSchema = z.string().trim().min(1).max(120)
export const jsonSchema = z.json()
export const timeZoneSchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .refine((value) => {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: value })
      return true
    } catch {
      return false
    }
  }, 'Use an IANA time zone, such as America/Chicago.')
