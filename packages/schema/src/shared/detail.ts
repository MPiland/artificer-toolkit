import { z } from 'zod'

export const detailDtoSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
  order: z.number().int()
})

export type DetailDto = z.infer<typeof detailDtoSchema>
