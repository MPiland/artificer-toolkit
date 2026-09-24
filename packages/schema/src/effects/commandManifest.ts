import { z } from '../zod.js'

import { effectKindSchema } from '../shared/enums.js'
import { authoredIdentifierSchema } from '../shared/authoredLimits.js'

export const commandManifestDtoSchema = z.object({
  id: authoredIdentifierSchema,
  effectKind: z.literal(effectKindSchema._zod.def.entries.COMMAND_MANIFEST),
  manifestId: authoredIdentifierSchema,
  behaviorId: z.optional(authoredIdentifierSchema)
})
