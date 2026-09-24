import { z } from '../zod.js'

import { ruleGraphDefinitionDtoSchema } from '../api/rulesRuntime.js'
import {
  initiativeCadenceDtoSchema,
  initiativeProcedureDtoSchema,
  initiativePolicyReusableDefinitionDocumentDtoSchema,
  initiativePolicyExactGraphPinDtoSchema
} from './initiativePolicy.js'
import { postgresUuidSchema as serverUuidIdentityDtoSchema } from './postgresUuid.js'

const checksumSchema = z.string().check(z.regex(/^[a-f0-9]{64}$/))
const definitionVersionSchema = z
  .number()
  .check(z.int())
  .check(z.nonnegative())
  .check(z.lte(1_000_000))
const contractVersionSchema = z.number().check(z.int()).check(z.positive()).check(z.lte(10_000))
const labelSchema = z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(160))

const initiativePolicySnapshotDefinitionBaseSchema = z.strictObject({
  definitionId: serverUuidIdentityDtoSchema,
  contentSourceId: serverUuidIdentityDtoSchema,
  definitionVersion: definitionVersionSchema,
  definitionChecksum: checksumSchema,
  contractVersion: contractVersionSchema,
  label: labelSchema
})

export const initiativePolicySnapshotPolicyDtoSchema = z.extend(
  initiativePolicySnapshotDefinitionBaseSchema,
  {
    document: initiativePolicyReusableDefinitionDocumentDtoSchema
  }
)

export const initiativePolicySnapshotGraphDtoSchema = z.extend(
  initiativePolicySnapshotDefinitionBaseSchema,
  {
    document: ruleGraphDefinitionDtoSchema
  }
)

function pinMatchesSnapshot(
  pin: z.infer<typeof initiativePolicyExactGraphPinDtoSchema>,
  snapshot: z.infer<typeof initiativePolicySnapshotGraphDtoSchema>
): boolean {
  return (
    pin.definitionId === snapshot.definitionId &&
    pin.definitionVersion === snapshot.definitionVersion &&
    pin.definitionChecksum === snapshot.definitionChecksum
  )
}

export const encounterInitiativePolicySnapshotDtoSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    gameSystemId: serverUuidIdentityDtoSchema,
    policy: initiativePolicySnapshotPolicyDtoSchema,
    evaluationGraph: initiativePolicySnapshotGraphDtoSchema,
    orderChoiceGraph: initiativePolicySnapshotGraphDtoSchema,
    tieResolver: initiativePolicySnapshotGraphDtoSchema
  })
  .check(
    z.superRefine((snapshot, context) => {
      if (
        snapshot.policy.document.id !== snapshot.policy.definitionId ||
        snapshot.policy.document.gameSystemId !== snapshot.gameSystemId
      ) {
        context.addIssue({
          code: 'custom',
          path: ['policy', 'document'],
          message: 'Initiative policy snapshot identity must match its pinned policy definition.'
        })
      }
      for (const [key, graph] of [
        ['evaluationGraph', snapshot.evaluationGraph],
        ['orderChoiceGraph', snapshot.orderChoiceGraph],
        ['tieResolver', snapshot.tieResolver]
      ] as const) {
        if (
          graph.document.id !== graph.definitionId ||
          graph.document.gameSystemId !== snapshot.gameSystemId
        ) {
          context.addIssue({
            code: 'custom',
            path: [key, 'document'],
            message: 'Initiative graph snapshot identity must match its pinned definition.'
          })
        }
      }
      if (!pinMatchesSnapshot(snapshot.policy.document.evaluationGraph, snapshot.evaluationGraph)) {
        context.addIssue({
          code: 'custom',
          path: ['evaluationGraph'],
          message: 'Initiative evaluation graph must match the policy graph pin.'
        })
      }
      if (
        !pinMatchesSnapshot(snapshot.policy.document.orderChoiceGraph, snapshot.orderChoiceGraph)
      ) {
        context.addIssue({
          code: 'custom',
          path: ['orderChoiceGraph'],
          message: 'Initiative order-choice graph must match the policy graph pin.'
        })
      }
      if (
        !snapshot.policy.document.tieResolvers.some((pin) =>
          pinMatchesSnapshot(pin, snapshot.tieResolver)
        )
      ) {
        context.addIssue({
          code: 'custom',
          path: ['tieResolver'],
          message: 'Initiative tie resolver must be permitted and pinned by the policy.'
        })
      }
    })
  )

export const encounterInitiativePolicySummaryDtoSchema = z.strictObject({
  definitionId: serverUuidIdentityDtoSchema,
  label: labelSchema,
  procedure: initiativeProcedureDtoSchema,
  cadence: initiativeCadenceDtoSchema,
  tieResolverDefinitionId: serverUuidIdentityDtoSchema,
  tieResolverLabel: labelSchema
})

export type EncounterInitiativePolicySnapshotDto = z.infer<
  typeof encounterInitiativePolicySnapshotDtoSchema
>
export type EncounterInitiativePolicySummaryDto = z.infer<
  typeof encounterInitiativePolicySummaryDtoSchema
>
