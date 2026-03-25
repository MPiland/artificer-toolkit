import { z } from 'zod'
import { effectDtoSchema } from './effect.js'
import { shapeDtoSchema } from '../shared/shape.js'

export const manifestDtoSchema: z.ZodTypeAny = z.lazy(() => z.object({
  id: z.string(),
  effectKind: z.literal('MANIFEST'),
  manifestKind: z.enum(['CREATURE', 'ZONE', 'SENSOR', 'WEAPON', 'HAND', 'OBJECT', 'ILLUSION']),
  detail: z.string().optional(),
  shape: shapeDtoSchema.optional(),
  creatureId: z.string().optional(),
  capabilities: z.array(effectDtoSchema).optional()
}))

export type ManifestDto = z.infer<typeof manifestDtoSchema>
