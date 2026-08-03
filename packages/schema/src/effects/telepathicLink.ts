import { z } from 'zod'

import { authoredIdentifierSchema } from '../shared/authoredLimits.js'

export const telepathicLinkDtoSchema = z.object({
  id: authoredIdentifierSchema,
  effectKind: z.literal('TELEPATHIC_LINK'),
  maximumCreatures: z.number().int().positive(),
  excludesIntelligenceAtOrBelow: z.number().int().nonnegative(),
  anyDistance: z.boolean(),
  crossesPlanes: z.boolean(),
  requiresSharedLanguage: z.boolean()
})

export type TelepathicLinkDto = z.infer<typeof telepathicLinkDtoSchema>
