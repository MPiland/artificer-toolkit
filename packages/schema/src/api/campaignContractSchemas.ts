import { z, lazySchema } from '../zod.js'

export const uuidSchema = lazySchema(() => z.guid())
export const versionSchema = lazySchema(() => z.number().check(z.int()).check(z.nonnegative()))
export const timestampSchema = lazySchema(() => z.iso.datetime())
export const shortTextSchema = lazySchema(() =>
  z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(120))
)
/** An author's current username, or `deletedCampaignAuthorLabel` once their account is deleted. */
export const campaignAuthorLabelSchema = lazySchema(() =>
  z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(30))
)
export const jsonSchema = z.json()
export const timeZoneSchema = lazySchema(() =>
  z
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
)
