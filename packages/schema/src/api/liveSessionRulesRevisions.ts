import { z } from '../zod.js'
import { sceneVisionRevisionSchema } from '../projections/sceneVisionRevisions.js'
import { MAX_ENCOUNTER_ACTORS } from '../shared/authoredLimits.js'
import { MAX_MAINTAINED_RULE_EFFECT_DEPENDENTS_PER_ACTOR } from '../shared/activeRuleEffects.js'

export const MAX_LIVE_SESSION_RULES_REVISIONS =
  MAX_ENCOUNTER_ACTORS + MAX_MAINTAINED_RULE_EFFECT_DEPENDENTS_PER_ACTOR + 3

/** Compact observations of stored inputs, including empty source and effect ranges. */
export const liveSessionRulesRevisionsSchema = z
  .array(
    z.extend(sceneVisionRevisionSchema, {
      revision: z.nullable(sceneVisionRevisionSchema.shape.revision)
    })
  )
  .check(z.minLength(3))
  .check(z.maxLength(MAX_LIVE_SESSION_RULES_REVISIONS))

export type LiveSessionRulesRevisions = z.infer<typeof liveSessionRulesRevisionsSchema>
