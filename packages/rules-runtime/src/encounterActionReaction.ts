import type { EncounterReactionOfferDto } from '@artificer-toolkit/schema/shared/ruleExecutionReactionChoice'
import type { EncounterSealedChoiceSelection } from './encounterSealedChoice.js'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import {
  continueNativeActionAfterTest,
  reconstructNativeActionTest,
  type ResumedNativeActionGraphs
} from './encounterActionExecution.js'
import {
  encounterReactionAudit,
  sameEncounterReactionCandidate,
  settleEncounterReactionChoice,
  type EncounterAttackReactionCandidate
} from './encounterReactionChoice.js'

type ActionSource = Omit<
  Parameters<typeof continueNativeActionAfterTest>[0],
  'boundary' | 'effectivePath' | 'legendaryResistance' | 'reaction' | 'resume'
>
/** The decided reaction and the hit it answered, as a paused OUTCOME or a held on-hit offer keeps them. */
type RetainedOutcome = Pick<
  Extract<NonNullable<ResumedNativeActionGraphs['twoPhase']>, { phase: 'OUTCOME' }>,
  'reaction' | 'testExecution' | 'testRollEvidence'
>
type CurrentReaction = {
  candidate: EncounterAttackReactionCandidate
  targetStateChecksum: string
  /** The attack's binding once the reaction's effect applies; read only when the reaction was used. */
  adjustedBinding: ActionSource['binding']
}

/**
 * Answers a hit attack's held reaction offer. The hit is rebuilt from the retained faces; using the
 * reaction re-evaluates those same faces against the defense the reaction produces and seals that
 * change in the audit, so the OUTCOME that follows is bound to evidence the table can read back.
 * Nothing is spent here: the returned audit names the reaction for the action's commit.
 */
export async function resolveNativeActionReaction(
  input: ActionSource &
    CurrentReaction & {
      offer: EncounterReactionOfferDto
      selection: EncounterSealedChoiceSelection
    }
) {
  const original = await reconstructNativeActionTest({
    ...input,
    execution: input.offer.originalExecution,
    d20: input.offer.originalD20
  })
  const settled = await settleEncounterReactionChoice({ ...input, boundary: original })
  const adjusted = settled.use
    ? await reconstructNativeActionTest({
        ...input,
        binding: input.adjustedBinding,
        d20: input.offer.originalD20
      })
    : null
  // A reaction changes the attack by the defense it is rolled against or by how the target takes its damage.
  if (
    adjusted &&
    adjusted.twoPhase.boundFactsChecksum === original.twoPhase.boundFactsChecksum &&
    checksumRuleDocument(input.adjustedBinding.defenses) ===
      checksumRuleDocument(input.binding.defenses) &&
    input.adjustedBinding.incomingHalved === input.binding.incomingHalved
  )
    throw new Error('The reaction did not change the attack it answered.')
  const audit = encounterReactionAudit({
    offer: input.offer,
    reaction: settled.reaction,
    selection: settled.use ? 'USE' : 'DECLINE',
    choiceExecution: settled.choice,
    adjustment: adjusted && {
      defenseBefore: original.d20Policy.dc,
      defenseAfter: adjusted.d20Policy.dc,
      adjustedBoundFactsChecksum: adjusted.twoPhase.boundFactsChecksum
    }
  })
  return {
    execution: await continueNativeActionAfterTest({
      ...input,
      binding: adjusted ? input.adjustedBinding : input.binding,
      boundary: adjusted ?? original,
      reaction: audit
    }),
    audit
  }
}

/**
 * Rebuilds the record of a decision a paused OUTCOME kept through its resume, so the completed action
 * still names the reaction it used and what that changed.
 */
export async function replayNativeActionReaction(
  input: ActionSource & CurrentReaction & { outcome: RetainedOutcome }
) {
  const { outcome } = input
  const audit = outcome.reaction
  if (!audit) throw new Error('The retained action OUTCOME holds no reaction decision.')
  const boundary = await reconstructNativeActionTest({
    ...input,
    binding: audit.adjustment ? input.adjustedBinding : input.binding,
    execution: outcome.testExecution,
    d20: outcome.testRollEvidence
  })
  if (
    input.targetStateChecksum !== audit.targetStateChecksum ||
    !sameEncounterReactionCandidate(audit.reaction, input.candidate) ||
    (audit.adjustment
      ? audit.adjustment.adjustedBoundFactsChecksum !== boundary.twoPhase.boundFactsChecksum ||
        audit.adjustment.defenseAfter !== boundary.d20Policy.dc
      : audit.d20.dc !== boundary.d20Policy.dc)
  )
    throw new Error('The retained reaction decision is stale.')
  return audit
}
