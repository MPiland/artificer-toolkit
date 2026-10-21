import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { EncounterPausePayload } from '@artificer-toolkit/schema/shared/encounterPause'

import type { EncounterSealedChoiceSelection } from './encounterSealedChoice.js'
import {
  continueNativeActionAfterTest,
  reconstructNativeActionTest,
  type ResumedNativeActionGraphs
} from './encounterActionExecution.js'
import { encounterTargetLegendaryResistance } from './encounterAreaLegendaryResistance.js'
import {
  decideEncounterLegendaryResistance,
  sameEncounterLegendaryResistanceCandidate,
  type EncounterLegendaryResistanceFeatureResource
} from './encounterLegendaryResistanceChoice.js'
import type { EncounterLegendaryResistanceCandidate } from './encounterLegendaryResistanceDiscovery.js'

type ActionSource = Omit<
  Parameters<typeof continueNativeActionAfterTest>[0],
  'boundary' | 'effectivePath' | 'legendaryResistance' | 'resume'
>
type RetainedOutcome = Extract<
  NonNullable<ResumedNativeActionGraphs['twoPhase']>,
  { phase: 'OUTCOME' }
>
type CurrentResistance = {
  candidate: EncounterLegendaryResistanceCandidate
  targetStateChecksum: string
  currentFeatureResource: EncounterLegendaryResistanceFeatureResource
}

/**
 * Answers a single-target action's held Legendary Resistance offer. The failed TEST is rebuilt from
 * the retained faces, the creature's decision is checked against the offer and its pool as they are
 * now, and the OUTCOME that decision selects continues. Nothing is spent here: the returned record
 * carries the charge for the action's commit.
 */
export async function resolveNativeActionLegendaryResistance(
  input: ActionSource &
    CurrentResistance & {
      offer: EncounterPausePayload<'LEGENDARY_RESISTANCE'>
      selection: EncounterSealedChoiceSelection
    }
) {
  const boundary = await reconstructNativeActionTest({
    ...input,
    execution: input.offer.originalExecution,
    d20: input.offer.originalD20
  })
  const { audit } = await decideEncounterLegendaryResistance({ ...input, boundary })
  return {
    execution: await continueNativeActionAfterTest({
      ...input,
      boundary,
      legendaryResistance: audit
    }),
    resistance: encounterTargetLegendaryResistance({
      audit,
      candidate: input.candidate,
      boundary,
      currentFeatureResource: input.currentFeatureResource
    })
  }
}

/**
 * Rebuilds the record of a decision a paused OUTCOME kept through its resume, so the completed action
 * still names the resistance it used and the charge it cost.
 */
export async function replayNativeActionLegendaryResistance(
  input: ActionSource & CurrentResistance & { outcome: RetainedOutcome }
) {
  const { outcome } = input
  const audit = outcome.legendaryResistance
  if (!audit) throw new Error('The retained action OUTCOME holds no Legendary Resistance decision.')
  const boundary = await reconstructNativeActionTest({
    ...input,
    execution: outcome.testExecution,
    d20: outcome.testRollEvidence
  })
  if (
    input.targetStateChecksum !== audit.targetStateChecksum ||
    !sameEncounterLegendaryResistanceCandidate(audit.resistance, input.candidate) ||
    checksumRuleDocument(boundary.d20Policy) !== checksumRuleDocument(audit.d20)
  )
    throw new Error('The retained Legendary Resistance decision is stale.')
  return encounterTargetLegendaryResistance({
    audit,
    candidate: input.candidate,
    boundary,
    currentFeatureResource: input.currentFeatureResource
  })
}
