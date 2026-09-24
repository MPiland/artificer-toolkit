import { z } from '../zod.js'
import { authoredSubjectKindSchema } from '../projections/identity.js'

// Route identity is shared with playable aggregates, not the authored-content domain union.
export const authoredRouteSubjectKindSchema = z.enum([
  ...authoredSubjectKindSchema.options,
  'CAMPAIGN',
  'CHARACTER'
])

export type AuthoredRouteSubjectKind = z.infer<typeof authoredRouteSubjectKindSchema>
