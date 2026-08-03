import { z } from 'zod'

import { effectKindSchema } from '../shared/enums.js'
import { authoredIdentifierSchema } from '../shared/authoredLimits.js'

export const commandManifestDtoSchema = z.object({
  id: authoredIdentifierSchema,
  effectKind: z.literal(effectKindSchema.enum.COMMAND_MANIFEST),
  manifestId: authoredIdentifierSchema,
  behaviorId: authoredIdentifierSchema.optional()
})
