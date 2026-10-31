import type { CharacterRuleActionSystemAdapter } from './characterRuleActionSystemAdapter.js'
import type { NativeTwoPhase } from './encounterActionRequest.js'
import type { ServerPublishedRuleDefinitionDto } from '@artificer-toolkit/schema/shared/rulesExecution'
import type { RuleValue } from '@artificer-toolkit/shared/rules'

type NativeActionBinding = Omit<
  Parameters<CharacterRuleActionSystemAdapter['bindFacts']>[0],
  'published'
>

export type NativeActionOnHitAudit = NonNullable<
  Extract<NativeTwoPhase, { phase: 'OUTCOME' }>['onHit']
>

/**
 * The attack's binding as its OUTCOME sees it: a used optional on-hit rider is selected, at the slot
 * level paid when a slot pays it. The TEST stays bound to the unchosen binding it was sealed against.
 */
export function onHitOutcomeBinding(
  binding: NativeActionBinding,
  onHit: NativeActionOnHitAudit | null
): NativeActionBinding {
  return onHit?.option
    ? {
        ...binding,
        actionMechanic: {
          ...binding.actionMechanic,
          ...(onHit.option.kind === 'SPELL_SLOT' && { spellCastLevel: onHit.option.slotLevel }),
          selectedOptionalRiderIds: [onHit.option.riderId]
        }
      }
    : binding
}

/**
 * The facts that select and specialize the OUTCOME graph. A rider chosen at the held hit changes which
 * optional entries the OUTCOME contains, so they are bound to the choice, not to the unchosen TEST.
 */
export function outcomeSelectionFacts(input: {
  adapter: CharacterRuleActionSystemAdapter
  binding: NativeActionBinding
  published: ServerPublishedRuleDefinitionDto
  testFacts: Readonly<Record<string, RuleValue>>
  onHit: NativeActionOnHitAudit | null
}) {
  return input.onHit?.option
    ? input.adapter.bindFacts({
        ...onHitOutcomeBinding(input.binding, input.onHit),
        published: input.published
      }).facts
    : input.testFacts
}
