import { z } from 'zod'

import { ruleGraphDefinitionDtoSchema } from '../api/rulesRuntime.js'
import {
  initiativeCadenceDtoSchema,
  initiativeProcedureDtoSchema,
  initiativePolicyReusableDefinitionDocumentDtoSchema,
  initiativePolicyExactGraphPinDtoSchema
} from './initiativePolicy.js'
import { serverUuidIdentityDtoSchema } from './rulesExecution.js'

const checksumSchema = z.string().regex(/^[a-f0-9]{64}$/)
const definitionVersionSchema = z.number().int().nonnegative().max(1_000_000)
const contractVersionSchema = z.number().int().positive().max(10_000)
const labelSchema = z.string().trim().min(1).max(160)

const initiativePolicySnapshotDefinitionBaseSchema = z.strictObject({
  definitionId: serverUuidIdentityDtoSchema,
  contentSourceId: serverUuidIdentityDtoSchema,
  definitionVersion: definitionVersionSchema,
  definitionChecksum: checksumSchema,
  contractVersion: contractVersionSchema,
  label: labelSchema
})

export const initiativePolicySnapshotPolicyDtoSchema =
  initiativePolicySnapshotDefinitionBaseSchema.extend({
    document: initiativePolicyReusableDefinitionDocumentDtoSchema
  })

export const initiativePolicySnapshotGraphDtoSchema =
  initiativePolicySnapshotDefinitionBaseSchema.extend({
    document: ruleGraphDefinitionDtoSchema
  })

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
  .superRefine((snapshot, context) => {
    if (
      snapshot.policy.document.id !== snapshot.policy.definitionId ||
      snapshot.policy.document.gameSystemId !== snapshot.gameSystemId
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
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
          code: z.ZodIssueCode.custom,
          path: [key, 'document'],
          message: 'Initiative graph snapshot identity must match its pinned definition.'
        })
      }
    }
    if (!pinMatchesSnapshot(snapshot.policy.document.evaluationGraph, snapshot.evaluationGraph)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['evaluationGraph'],
        message: 'Initiative evaluation graph must match the policy graph pin.'
      })
    }
    if (!pinMatchesSnapshot(snapshot.policy.document.orderChoiceGraph, snapshot.orderChoiceGraph)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
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
        code: z.ZodIssueCode.custom,
        path: ['tieResolver'],
        message: 'Initiative tie resolver must be permitted and pinned by the policy.'
      })
    }
  })

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
