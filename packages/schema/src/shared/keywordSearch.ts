import { z, lazySchema } from '../zod.js'

export const keywordSearchSchema = lazySchema(() =>
  z
    .string()
    .check(z.trim())
    .check(z.minLength(1))
    .check(
      z.refine((value) => {
        const terms = value.match(/[\p{L}\p{N}]+/gu) ?? []
        return terms.length > 0 && terms.length <= 16
      }, 'Enter between 1 and 16 search terms.')
    )
)
