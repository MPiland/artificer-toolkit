import type { EncounterOnHitOfferDto } from '@artificer-toolkit/schema/shared/ruleExecutionOnHitChoice'
import type { EncounterSealedChoiceSelection } from './encounterSealedChoice.js'
import {
  continueNativeActionAfterTest,
  reconstructNativeActionTest
} from './encounterActionExecution.js'
import {
  encounterOnHitAudit,
  settleEncounterOnHitChoice,
  type EncounterOnHitCandidate
} from './encounterOnHitChoice.js'

type ActionSource = Omit<
  Parameters<typeof continueNativeActionAfterTest>[0],
  | 'boundary'
  | 'effectivePath'
  | 'legendaryResistance'
  | 'reaction'
  | 'onHit'
  | 'onHitCandidates'
  | 'resume'
>
type CurrentOnHit = {
  /** The ways the attacker could pay for an optional on-hit rider, as things stand now. */
  candidates: readonly EncounterOnHitCandidate[]
  /** The attack's binding once the target's reaction applies; read only when that reaction was used. */
  adjustedBinding: ActionSource['binding'] | null
}

/** The binding the held hit was sealed against: the reaction's adjusted one when the target used a reaction. */
function heldHitBinding(
  input: ActionSource & CurrentOnHit,
  reaction: EncounterOnHitOfferDto['reaction']
) {
  if (!reaction?.adjustment) return input.binding
  if (!input.adjustedBinding) throw new Error('The reaction-adjusted attack is unavailable.')
  return input.adjustedBinding
}

/**
 * Answers a hit's held on-hit offer. The hit is rebuilt from the retained faces; the decision is sealed
 * into the OUTCOME that follows, which adds the chosen rider at the slot level paid. Nothing is spent
 * here: the returned audit names the way of paying for the action's commit.
 */
export async function resolveNativeActionOnHit(
  input: ActionSource &
    CurrentOnHit & {
      offer: EncounterOnHitOfferDto
      selection: EncounterSealedChoiceSelection
    }
) {
  const binding = heldHitBinding(input, input.offer.reaction)
  const boundary = await reconstructNativeActionTest({
    ...input,
    binding,
    execution: input.offer.testExecution,
    d20: input.offer.testD20
  })
  const option = await settleEncounterOnHitChoice({
    ...input,
    gameSystemId: boundary.initialPublished.gameSystemId,
    boundary
  })
  const audit = encounterOnHitAudit({ offer: input.offer, option })
  return {
    execution: await continueNativeActionAfterTest({
      ...input,
      binding,
      boundary,
      reaction: input.offer.reaction,
      onHit: audit
    }),
    audit
  }
}
