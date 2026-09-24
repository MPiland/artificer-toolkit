import { z } from '../zod.js'

import { authoredIdentifierSchema } from '../shared/authoredLimits.js'

export const telepathicLinkDtoSchema = z.object({
  id: authoredIdentifierSchema,
  effectKind: z.literal('TELEPATHIC_LINK'),
  maximumCreatures: z.number().check(z.int()).check(z.positive()),
  excludesIntelligenceAtOrBelow: z.number().check(z.int()).check(z.nonnegative()),
  anyDistance: z.boolean(),
  crossesPlanes: z.boolean(),
  requiresSharedLanguage: z.boolean()
})

export type TelepathicLinkDto = z.infer<typeof telepathicLinkDtoSchema>
