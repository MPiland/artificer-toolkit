import type { SpellAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { shield } from '@artificer-toolkit/source-data/srd/spells/shield.js'

type EffectAuthored = NonNullable<SpellAuthored['effects']>[number]
type ReactionInvocation = Extract<EffectAuthored['invocation'], { reactionTrigger: object }>

const isTargetedSelf = (
  invocation: EffectAuthored['invocation']
): invocation is ReactionInvocation =>
  'reactionTrigger' in invocation && invocation.reactionTrigger?.kind === 'TARGETED_SELF'

/** Shield with the cast filter taken off its "chosen as a target" reaction: it answers any cast. */
export const unfilteredShield: SpellAuthored = {
  ...shield,
  effects: shield.effects?.map((effect): EffectAuthored =>
    isTargetedSelf(effect.invocation)
      ? {
          ...effect,
          invocation: { ...effect.invocation, reactionTrigger: { kind: 'TARGETED_SELF' } }
        }
      : effect
  )
}
