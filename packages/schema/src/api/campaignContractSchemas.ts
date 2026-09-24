import { z } from '../zod.js'

export const uuidSchema = z.guid()
export const versionSchema = z.number().check(z.int()).check(z.nonnegative())
export const timestampSchema = z.iso.datetime()
export const shortTextSchema = z
  .string()
  .check(z.trim())
  .check(z.minLength(1))
  .check(z.maxLength(120))
export const jsonSchema = z.json()
export const timeZoneSchema = z
  .string()
  .check(z.trim())
  .check(z.minLength(1))
  .check(z.maxLength(100))
  .check(
    z.refine((value) => {
      try {
        Intl.DateTimeFormat(undefined, { timeZone: value })
        return true
      } catch {
        return false
      }
    }, 'Use an IANA time zone, such as America/Chicago.')
  )
