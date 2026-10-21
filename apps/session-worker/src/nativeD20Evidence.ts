import type { EncounterSettledAppRollDto } from '@artificer-toolkit/schema/api/encounterData'
import type { ResolveRuleOccurrenceInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import {
  withEncounterAppRoll,
  type EncounterEvidenceAnswer,
  type EncounterResponseAnswer
} from '@artificer-toolkit/rules-runtime/encounterEvidenceAnswer'

type D20EvidenceAnswer = Extract<EncounterResponseAnswer, { kind: 'ENTER_DICE' | 'SYSTEM_ROLL' }>

/** Narrows a bound answer to d20 evidence (entered dice or a recorded app roll), else refuses. */
export function requireEncounterD20Evidence(
  answer: EncounterResponseAnswer,
  refusal: string
): D20EvidenceAnswer {
  if (answer.kind !== 'ENTER_DICE' && answer.kind !== 'SYSTEM_ROLL') throw new Error(refusal)
  return answer
}

/**
 * The one Worker binding of a d20 response: an app roll settles with the faces Convex recorded for
 * it, never client-supplied values, and the bound answer must be d20 evidence. With no response,
 * `autoRollRequestId` names the request the server rolls itself.
 */
export function bindEncounterD20Evidence(input: {
  response: {
    resolution: ResolveRuleOccurrenceInputDto['resolution']
    appRoll: EncounterSettledAppRollDto | null
  } | null
  autoRollRequestId?: string
  refusal: string
}): D20EvidenceAnswer | Extract<EncounterEvidenceAnswer, { kind: 'AUTO_ROLL' }> {
  if (!input.response) {
    if (input.autoRollRequestId === undefined) throw new Error(input.refusal)
    return { kind: 'AUTO_ROLL', requestId: input.autoRollRequestId }
  }
  return requireEncounterD20Evidence(
    withEncounterAppRoll(input.response.resolution, input.response.appRoll),
    input.refusal
  )
}
