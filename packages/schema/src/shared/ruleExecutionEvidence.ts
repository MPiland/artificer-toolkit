import { z, lazySchema } from '../zod.js'

import {
  compareCanonicalD20Contributors,
  ROLL_MODE_CONTRIBUTOR_SOURCE_KINDS,
  type D20Contributor
} from '@artificer-toolkit/shared/rules/contributors'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules/checksum'
import { RULE_GRAPH_LIMITS } from '@artificer-toolkit/shared/rules/contracts'

import {
  ruleExecutionChecksumSchema as checksumSchema,
  ruleExecutionIdentifierSchema as identifierSchema,
  ruleExecutionIntegerSchema as integerSchema,
  ruleExecutionLocalNodeIdSchema as localNodeIdSchema,
  ruleExecutionReceiptD20FaceSchema as receiptD20FaceSchema
} from './ruleExecutionPrimitives.js'
import {
  d20AddedDiceDtoSchema,
  d20AddedDiceTotal,
  d20RolledAddedDiceDtoSchema,
  type D20RolledAddedDieDto
} from './d20AddedDice.js'

export const serverRuleEvidenceResponseDtoSchema = lazySchema(() =>
  z.strictObject({
    requestId: z.string().check(z.minLength(1)).check(z.maxLength(256)),
    value: integerSchema
  })
)

const resolvedIntentKeySchema = lazySchema(() =>
  z.string().check(z.regex(/^[a-z][a-zA-Z0-9_-]{0,79}$/))
)
const resolvedIntentValueSchema = lazySchema(() =>
  z.union([z.boolean(), z.number(), z.string().check(z.maxLength(256))])
)
export const resolvedStartIntentRecordDtoSchema = lazySchema(() =>
  z.record(resolvedIntentKeySchema, resolvedIntentValueSchema).check(
    z.refine((intent) => Object.keys(intent).length <= RULE_GRAPH_LIMITS.RUNTIME_FACTS, {
      message: `Resolved rule execution intents support at most ${RULE_GRAPH_LIMITS.RUNTIME_FACTS} values.`
    })
  )
)

/** One bounded TEST/OUTCOME execution may consume no more than this many server evidence requests. */
export const MAX_RULE_EXECUTION_AUTOMATIC_EVIDENCE_REQUESTS = 32

export const rollModeContributorSourceDtoSchema = lazySchema(() =>
  z.strictObject({
    kind: z.enum(ROLL_MODE_CONTRIBUTOR_SOURCE_KINDS),
    id: identifierSchema,
    holderActorId: z.nullable(identifierSchema)
  })
)

/** One recorded d20 contributor: its canonical identity and the typed source its reason label reads. */
export const receiptD20ContributorSchema = lazySchema(() =>
  z.strictObject({
    sourceId: identifierSchema,
    grantId: z.nullable(identifierSchema),
    domainKey: z.nullable(identifierSchema),
    influence: z.enum(['ADVANTAGE', 'DISADVANTAGE']),
    source: rollModeContributorSourceDtoSchema
  })
)

export const canonicalConcentrationContributorsDtoSchema = lazySchema(() =>
  z
    .array(receiptD20ContributorSchema)
    .check(z.maxLength(RULE_GRAPH_LIMITS.NODES))
    .check(
      z.superRefine((contributors, context) => {
        let prior: z.infer<typeof receiptD20ContributorSchema> | null = null
        for (const [index, contributor] of contributors.entries()) {
          if (prior !== null && compareCanonicalD20Contributors(prior, contributor) >= 0)
            context.addIssue({
              code: 'custom',
              path: [index],
              message: 'Concentration contributors must be unique and in canonical order.'
            })
          prior = contributor
        }
      })
    )
)

/** The d20 a single-roll check freezes before it is rolled: the roller's mode, contributors and modifier. */
export const frozenCheckD20DtoSchema = lazySchema(() =>
  z.strictObject({
    rollMode: z.enum(['NORMAL', 'ADVANTAGE', 'DISADVANTAGE']),
    contributors: canonicalConcentrationContributorsDtoSchema,
    contributorChecksum: checksumSchema,
    modifier: integerSchema,
    /** Dice the check rolls beside its d20 (D156), from the roller's active effects. */
    addedDice: z.optional(d20AddedDiceDtoSchema)
  })
)

/** Server-only policy for one frozen d20 evidence node. */
export const serverRuleExecutionD20PolicyDtoSchema = lazySchema(() =>
  z
    .strictObject({
      requestNodeId: localNodeIdSchema,
      rollMode: z.enum(['NORMAL', 'ADVANTAGE', 'DISADVANTAGE']),
      contributors: z
        .array(receiptD20ContributorSchema)
        .check(z.maxLength(RULE_GRAPH_LIMITS.NODES)),
      contributorChecksum: checksumSchema,
      modifier: integerSchema,
      dc: integerSchema,
      /** Dice the test rolls beside its d20 (D156), from the roller's active effects. */
      addedDice: z.optional(d20AddedDiceDtoSchema)
    })
    .check(
      z.superRefine((value, context) => {
        if (
          value.contributors.some(
            (contributor, index) =>
              index > 0 &&
              compareCanonicalD20Contributors(value.contributors[index - 1]!, contributor) >= 0
          )
        ) {
          context.addIssue({
            code: 'custom',
            path: ['contributors'],
            message: 'd20 policy contributors must be strictly sorted and unique.'
          })
        }
      })
    )
)

const d20RollModeSchema = lazySchema(() => z.enum(['NORMAL', 'ADVANTAGE', 'DISADVANTAGE']))

const d20CaptionSchema = lazySchema(() =>
  z.nullable(z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(160)))
)

/** The mode a contributor set derives, as its owning resolver does: mixed or empty is Normal. */
function contributorRollMode(
  contributors: readonly { influence: 'ADVANTAGE' | 'DISADVANTAGE' }[]
): 'NORMAL' | 'ADVANTAGE' | 'DISADVANTAGE' {
  const influences = new Set(contributors.map((contributor) => contributor.influence))
  return influences.size === 1 ? [...influences][0]! : 'NORMAL'
}

/**
 * The roll mode a roller's own facts imply (ATTACK-10.1): what the roll prompt shows before the
 * server applies the true mode. Retained beside the true d20 policy of a pending action.
 */
// Explicitly typed: inferred, these shapes repeat through every pending-state declaration that
// embeds a d20 policy or receipt and overflow the compiler's declaration size (TS7056).
export type ServerRuleExecutionD20BeliefDto = {
  rollMode: 'NORMAL' | 'ADVANTAGE' | 'DISADVANTAGE'
  contributors: D20Contributor[]
  contributorChecksum: string
}

export const serverRuleExecutionD20BeliefDtoSchema: z.ZodMiniType<ServerRuleExecutionD20BeliefDto> =
  lazySchema(() =>
    z
      .strictObject({
        rollMode: d20RollModeSchema,
        contributors: z
          .array(receiptD20ContributorSchema)
          .check(z.maxLength(RULE_GRAPH_LIMITS.NODES)),
        contributorChecksum: checksumSchema
      })
      .check(
        z.superRefine((value, context) => {
          if (
            value.contributors.some(
              (contributor, index) =>
                index > 0 &&
                compareCanonicalD20Contributors(value.contributors[index - 1]!, contributor) >= 0
            )
          )
            context.addIssue({
              code: 'custom',
              path: ['contributors'],
              message: 'd20 belief contributors must be strictly sorted and unique.'
            })
          if (checksumRuleDocument(value.contributors) !== value.contributorChecksum)
            context.addIssue({
              code: 'custom',
              path: ['contributorChecksum'],
              message: 'd20 belief contributor checksum is invalid.'
            })
          if (contributorRollMode(value.contributors) !== value.rollMode)
            context.addIssue({
              code: 'custom',
              path: ['rollMode'],
              message: 'd20 belief roll mode must match its contributors.'
            })
        })
      )
  )

/**
 * A d20 the server settled in a mode other than the one the roller rolled for: the dice as rolled,
 * the die the server added, and which of all dice (rolled then added) were cancelled or added.
 * `rawFaces` of the evidence stay the applied faces, so a reader needs no adjustment logic.
 */
export type ServerRuleExecutionD20ModeAdjustmentDto = {
  rolledMode: 'NORMAL' | 'ADVANTAGE' | 'DISADVANTAGE'
  rolledFaces: number[]
  addedFaces: number[]
  cancelledRollIndexes: number[]
  addedRollIndexes: number[]
  playerCaption: string | null
  gmReason: string | null
}

export const serverRuleExecutionD20ModeAdjustmentDtoSchema: z.ZodMiniType<ServerRuleExecutionD20ModeAdjustmentDto> =
  lazySchema(() =>
    z.strictObject({
      rolledMode: d20RollModeSchema,
      rolledFaces: z.array(receiptD20FaceSchema).check(z.minLength(1)).check(z.maxLength(2)),
      addedFaces: z.array(receiptD20FaceSchema).check(z.maxLength(1)),
      cancelledRollIndexes: z.array(z.number().check(z.int()).check(z.gte(0)).check(z.lte(2))),
      addedRollIndexes: z.array(z.number().check(z.int()).check(z.gte(0)).check(z.lte(2))),
      /** Shown to every viewer of the table card; never names a Sense. */
      playerCaption: d20CaptionSchema,
      /** Shown only to the GM; names the specific reason. */
      gmReason: d20CaptionSchema
    })
  )

const serverRuleExecutionD20EvidenceShape = lazySchema(() =>
  z.strictObject({
    requestId: z.string().check(z.minLength(1)).check(z.maxLength(256)),
    /**
     * The mode the faces were settled with. Without `modeAdjustment` it is the mode the roller
     * rolled with (the roller may change the recommended mode).
     */
    rollMode: d20RollModeSchema,
    /** The rules-derived mode the roll prompt recommended. */
    derivedRollMode: d20RollModeSchema,
    rawFaces: z.array(receiptD20FaceSchema).check(z.minLength(1)).check(z.maxLength(2)),
    selectedNatural: receiptD20FaceSchema,
    contributors: z.array(receiptD20ContributorSchema).check(z.maxLength(RULE_GRAPH_LIMITS.NODES)),
    contributorChecksum: checksumSchema,
    modifier: integerSchema,
    total: integerSchema,
    defenseOrDc: integerSchema,
    resultPath: identifierSchema,
    modeAdjustment: z.optional(serverRuleExecutionD20ModeAdjustmentDtoSchema),
    /** The added dice with the faces they rolled; `total` includes their signed sum. */
    addedDice: z.optional(d20RolledAddedDiceDtoSchema)
  })
)

function validateServerRuleExecutionD20Evidence(
  value: z.infer<typeof serverRuleExecutionD20EvidenceShape>,
  context: z.core.$RefinementCtx
): void {
  const expectedFaces = value.rollMode === 'NORMAL' ? 1 : 2
  if (value.rawFaces.length !== expectedFaces)
    context.addIssue({
      code: 'custom',
      path: ['rawFaces'],
      message: 'd20 evidence face count is invalid.'
    })
  const expectedSelected =
    value.rollMode === 'ADVANTAGE'
      ? Math.max(...value.rawFaces)
      : value.rollMode === 'DISADVANTAGE'
        ? Math.min(...value.rawFaces)
        : value.rawFaces[0]
  if (value.selectedNatural !== expectedSelected)
    context.addIssue({
      code: 'custom',
      path: ['selectedNatural'],
      message: 'd20 evidence selected face is invalid.'
    })
  if (value.total !== value.selectedNatural + value.modifier + d20AddedDiceTotal(value.addedDice))
    context.addIssue({
      code: 'custom',
      path: ['total'],
      message: 'd20 evidence total is invalid.'
    })
  if (
    value.contributors.some(
      (contributor, index) =>
        index > 0 &&
        compareCanonicalD20Contributors(value.contributors[index - 1]!, contributor) >= 0
    )
  )
    context.addIssue({
      code: 'custom',
      path: ['contributors'],
      message: 'd20 evidence contributors must be strictly sorted and unique.'
    })
  if (checksumRuleDocument(value.contributors) !== value.contributorChecksum)
    context.addIssue({
      code: 'custom',
      path: ['contributorChecksum'],
      message: 'd20 evidence contributor checksum is invalid.'
    })
  const adjustment = value.modeAdjustment
  if (adjustment) {
    const dice = [...adjustment.rolledFaces, ...adjustment.addedFaces]
    const cancelled = adjustment.cancelledRollIndexes
    const consistent =
      adjustment.rolledFaces.length === (adjustment.rolledMode === 'NORMAL' ? 1 : 2) &&
      cancelled.every(
        (index, position) =>
          index < adjustment.rolledFaces.length &&
          (position === 0 || index > cancelled[position - 1]!)
      ) &&
      adjustment.addedRollIndexes.length === adjustment.addedFaces.length &&
      adjustment.addedRollIndexes.every(
        (index, position) => index === adjustment.rolledFaces.length + position
      ) &&
      dice.filter((_, index) => !cancelled.includes(index)).join() === value.rawFaces.join() &&
      (adjustment.rolledMode !== value.rollMode ||
        cancelled.length > 0 ||
        adjustment.addedFaces.length > 0)
    if (!consistent)
      context.addIssue({
        code: 'custom',
        path: ['modeAdjustment'],
        message: 'd20 evidence mode adjustment is inconsistent with its faces.'
      })
  }
}

// Explicitly typed for the same reason as the belief: inferred, the evidence repeats through every
// pending-state declaration that embeds it and overflows the declaration size (TS7056).
export type ServerRuleExecutionD20EvidenceDto = {
  requestId: string
  rollMode: 'NORMAL' | 'ADVANTAGE' | 'DISADVANTAGE'
  derivedRollMode: 'NORMAL' | 'ADVANTAGE' | 'DISADVANTAGE'
  rawFaces: number[]
  selectedNatural: number
  contributors: ServerRuleExecutionD20BeliefDto['contributors']
  contributorChecksum: string
  modifier: number
  total: number
  defenseOrDc: number
  resultPath: string
  modeAdjustment?: ServerRuleExecutionD20ModeAdjustmentDto
  addedDice?: D20RolledAddedDieDto[]
}
export type ServerRuleExecutionNestedD20EvidenceDto = ServerRuleExecutionD20EvidenceDto & {
  requestNodeId: string
}

export const serverRuleExecutionD20EvidenceDtoSchema: z.ZodMiniType<ServerRuleExecutionD20EvidenceDto> =
  lazySchema(() =>
    serverRuleExecutionD20EvidenceShape.check(z.superRefine(validateServerRuleExecutionD20Evidence))
  )

/** Exact graph binding retained only for a direct-action OUTCOME nested d20. */
export const serverRuleExecutionNestedD20EvidenceDtoSchema: z.ZodMiniType<ServerRuleExecutionNestedD20EvidenceDto> =
  lazySchema(() =>
    z
      .extend(serverRuleExecutionD20EvidenceShape, { requestNodeId: localNodeIdSchema })
      .check(z.superRefine(validateServerRuleExecutionD20Evidence))
      .check(
        z.superRefine((value, context) => {
          const influences = new Set(value.contributors.map((contributor) => contributor.influence))
          const expectedRollMode =
            influences.size === 1
              ? [...influences][0] === 'ADVANTAGE'
                ? 'ADVANTAGE'
                : 'DISADVANTAGE'
              : 'NORMAL'
          if (value.derivedRollMode !== expectedRollMode)
            context.addIssue({
              code: 'custom',
              path: ['derivedRollMode'],
              message: 'Nested d20 evidence roll mode must match its contributors.'
            })
        })
      )
  )

export type ServerRuleExecutionD20PolicyDto = z.infer<typeof serverRuleExecutionD20PolicyDtoSchema>
