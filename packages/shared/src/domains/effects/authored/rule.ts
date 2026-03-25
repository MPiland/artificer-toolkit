import { EFFECT_KIND } from '#core'

export type RuleAuthored = {
  id: string
  effectKind: typeof EFFECT_KIND.RULE
}
