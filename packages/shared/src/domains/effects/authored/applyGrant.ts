import type { ModifierGrantAuthored, ProficiencyGrantAuthored, SenseGrantAuthored } from '#authored'
import { EFFECT_KIND } from '#core'

export type ApplyGrantAuthored = {
  id: string
  effectKind: typeof EFFECT_KIND.APPLY_GRANT
  // TODO(Phase 8+ interactive runtime):
  // Keep permanent grants as default, then add temporary grant lifecycle metadata.
  //
  // Proposed authored shape (do not implement yet):
  // lifetime?: {
  //   mode: 'PERMANENT' | 'TEMPORARY'
  //   lastsUntil?:
  //     | 'NEXT_ATTACK'
  //     | 'END_OF_ROUND'
  //     | 'START_OF_NEXT_TURN'
  //     | 'END_OF_NEXT_TURN'
  //     | 'NEXT_SAVE'
  // }
  //
  // Notes:
  // - Do not overload existing Duration.durationKind.
  // - Keep this as APPLY_GRANT-local lifecycle semantics.
  // - Runtime consumption/expiry hooks are deferred until combat/event pipeline work.
  grants: {
    modifiers?: ModifierGrantAuthored[]
    proficiencies?: ProficiencyGrantAuthored[]
    senses?: SenseGrantAuthored[]
  }
}
