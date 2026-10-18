import { z, lazySchema } from '../zod.js'
import {
  serverPublishedRuleDefinitionDtoSchema,
  type ServerPublishedRuleDefinitionDto
} from './ruleExecutionCore.js'
import {
  serverRuleExecutionD20EvidenceDtoSchema,
  serverRuleExecutionNestedD20EvidenceDtoSchema,
  type ServerRuleExecutionD20EvidenceDto,
  type ServerRuleExecutionNestedD20EvidenceDto
} from './ruleExecutionEvidence.js'
import {
  ruleExecutionChecksumSchema as checksumSchema,
  ruleExecutionUuidSchema as uuidSchema
} from './ruleExecutionPrimitives.js'
import {
  ruleExecutionPhaseReceiptsDtoSchema,
  serverCompletedRuleExecutionDtoSchema,
  type RuleExecutionPhaseReceiptsDto,
  type ServerCompletedRuleExecutionDto
} from './ruleExecutionProtocol.js'
import {
  MAX_FORCED_MOVEMENT_DESTINATIONS,
  spatialPointDtoSchema,
  type SpatialPointDto
} from './spatialFacts.js'

/**
 * An action whose outcome settled with a push its source chooses the destination of (D157): the
 * settled graphs, held unchanged until the destination is chosen, and the creature waiting with the
 * legal squares it may land on.
 */
export type EncounterForcedMovementOfferDto = {
  completion: {
    execution: ServerCompletedRuleExecutionDto
    published: ServerPublishedRuleDefinitionDto
    initialPublished: ServerPublishedRuleDefinitionDto
    initialFactsChecksum: string
    phaseReceipts: RuleExecutionPhaseReceiptsDto | null
    d20: ServerRuleExecutionD20EvidenceDto | null
    nestedD20: ServerRuleExecutionNestedD20EvidenceDto | null
  }
  targetActorId: string
  positions: SpatialPointDto[]
}

// Explicitly typed so the pending-context declarations stay within the compiler's size limit (TS7056).
export const encounterForcedMovementOfferDtoSchema: z.ZodMiniType<EncounterForcedMovementOfferDto> =
  lazySchema(() =>
    z.strictObject({
      completion: z.strictObject({
        execution: z.lazy(() => serverCompletedRuleExecutionDtoSchema),
        published: z.lazy(() => serverPublishedRuleDefinitionDtoSchema),
        initialPublished: z.lazy(() => serverPublishedRuleDefinitionDtoSchema),
        initialFactsChecksum: checksumSchema,
        phaseReceipts: z.nullable(z.lazy(() => ruleExecutionPhaseReceiptsDtoSchema)),
        d20: z.nullable(z.lazy(() => serverRuleExecutionD20EvidenceDtoSchema)),
        nestedD20: z.nullable(z.lazy(() => serverRuleExecutionNestedD20EvidenceDtoSchema))
      }),
      targetActorId: uuidSchema,
      positions: z
        .array(spatialPointDtoSchema)
        .check(z.minLength(2))
        .check(z.maxLength(MAX_FORCED_MOVEMENT_DESTINATIONS))
    })
  )
