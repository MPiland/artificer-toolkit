import { z } from 'zod'

import { effectKindSchema } from '../shared/enums.js'

export const commandManifestDtoSchema = z.object({
  id: z.string(),
  effectKind: z.literal(effectKindSchema.enum.COMMAND_MANIFEST),
  manifestId: z.string()
})
