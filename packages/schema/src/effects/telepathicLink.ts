import { z, lazySchema } from '../zod.js'

import { authoredIdentifierSchema } from '../shared/authoredLimits.js'
import { systemCoreCodeSchema } from '../shared/systemCoreCode.js'

export const telepathicLinkDtoSchema = lazySchema(() =>
  z.object({
    id: authoredIdentifierSchema,
    effectKind: z.literal('TELEPATHIC_LINK'),
    maximumCreatures: z.number().check(z.int()).check(z.positive()),
    excludesAbilityAtOrBelow: z.object({
      ability: systemCoreCodeSchema,
      score: z.number().check(z.int()).check(z.nonnegative())
    }),
    anyDistance: z.boolean(),
    crossesPlanes: z.boolean(),
    requiresSharedLanguage: z.boolean()
  })
)

export type TelepathicLinkDto = z.infer<typeof telepathicLinkDtoSchema>
