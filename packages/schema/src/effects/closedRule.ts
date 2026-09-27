import { CLOSED_RULE_KIND } from '@artificer-toolkit/shared/core'
import { z, lazySchema } from '../zod.js'

import { authoredIdentifierSchema } from '../shared/authoredLimits.js'

const closedRuleKinds = Object.values(CLOSED_RULE_KIND) as [string, ...string[]]

export const closedRuleDtoSchema = lazySchema(() =>
  z.object({
    id: authoredIdentifierSchema,
    effectKind: z.literal('CLOSED_RULE'),
    ruleKind: z.enum(closedRuleKinds)
  })
)

export type ClosedRuleDto = z.infer<typeof closedRuleDtoSchema>
