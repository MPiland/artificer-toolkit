import { z } from 'zod'

import { ruleGraphDefinitionDtoSchema } from '../api/rulesRuntime.js'
import { senseReusableDefinitionDocumentDtoSchema } from './combatPerception.js'
import { initiativePolicyReusableDefinitionDocumentDtoSchema } from './initiativePolicy.js'
import { dnd5eEncounterLifecycleReusableDefinitionDocumentDtoSchema } from './encounterLifecycle.js'
import { dnd5eOptionalCombatReusableDefinitionDocumentDtoSchema } from './optionalCombat.js'
import {
  conditionRuleStateReusableDefinitionDocumentDtoSchema,
  ruleCapabilityReusableDefinitionDocumentDtoSchema
} from './ruleState.js'
import { serverUuidIdentityDtoSchema } from './rulesExecution.js'

const boundedCodeSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z][a-z0-9.-]{0,79}$/)
const boundedLabelSchema = z.string().trim().min(1).max(160)
const boundedDescriptionSchema = z.string().max(4_000).nullable()
const checksumSchema = z.string().regex(/^[a-f0-9]{64}$/)
const versionSchema = z.number().int().min(0)

export const contentSourceKindDtoSchema = z.enum(['PLATFORM', 'USER'])
export const reusableDefinitionFamilyKeyDtoSchema = boundedCodeSchema

export const reusableDefinitionDocumentDtoSchema = z.union([
  ruleGraphDefinitionDtoSchema,
  initiativePolicyReusableDefinitionDocumentDtoSchema,
  dnd5eEncounterLifecycleReusableDefinitionDocumentDtoSchema,
  dnd5eOptionalCombatReusableDefinitionDocumentDtoSchema,
  senseReusableDefinitionDocumentDtoSchema,
  ruleCapabilityReusableDefinitionDocumentDtoSchema,
  conditionRuleStateReusableDefinitionDocumentDtoSchema
])

export function reusableDefinitionDocumentFamilyKey(
  document: z.infer<typeof reusableDefinitionDocumentDtoSchema>
): string {
  if ('definitionFamilyKey' in document) return document.definitionFamilyKey
  if (document.kind === 'INITIATIVE_POLICY') return 'initiative-policy'
  if (
    document.kind === 'LEGENDARY_ACTION' ||
    document.kind === 'LEGENDARY_RESISTANCE' ||
    document.kind === 'RECHARGE'
  ) {
    return 'dnd5e-encounter-lifecycle'
  }
  if (
    document.kind === 'FLANKING' ||
    document.kind === 'ALTERNATING_DIAGONALS' ||
    document.kind === 'FACING' ||
    document.kind === 'CLIMB_ONTO_LARGER_CREATURE' ||
    document.kind === 'DISARM' ||
    document.kind === 'MARK' ||
    document.kind === 'OVERRUN' ||
    document.kind === 'SHOVE_ASIDE' ||
    document.kind === 'TUMBLE' ||
    document.kind === 'HITTING_COVER' ||
    document.kind === 'CLEAVING' ||
    document.kind === 'INJURIES' ||
    document.kind === 'MASSIVE_DAMAGE' ||
    document.kind === 'MORALE'
  ) {
    return 'dnd5e-optional-combat'
  }
  if (document.kind === 'SENSE') return 'sense'
  if (document.kind === 'RULE_CAPABILITY') return 'rule-capability'
  return 'condition-rule-state'
}

export const reusableDefinitionCurrentDtoSchema = z
  .strictObject({
    id: serverUuidIdentityDtoSchema,
    gameSystemId: serverUuidIdentityDtoSchema,
    contentSourceId: serverUuidIdentityDtoSchema,
    definitionFamilyKey: reusableDefinitionFamilyKeyDtoSchema,
    label: boundedLabelSchema,
    description: boundedDescriptionSchema,
    document: reusableDefinitionDocumentDtoSchema,
    checksum: checksumSchema,
    contractVersion: z.number().int().positive().max(10_000),
    version: versionSchema,
    publishedAt: z.string().datetime(),
    publishedBy: serverUuidIdentityDtoSchema
  })
  .superRefine((current, context) => {
    const documentFamilyKey = reusableDefinitionDocumentFamilyKey(current.document)
    if (current.definitionFamilyKey !== documentFamilyKey) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['definitionFamilyKey'],
        message: 'Reusable definition family must match its document family.'
      })
    }
    if (current.id !== current.document.id) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['document', 'id'],
        message: 'Reusable definition ID must match its document ID.'
      })
    }
    if (current.gameSystemId !== current.document.gameSystemId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['document', 'gameSystemId'],
        message: 'Reusable definition Game System must match its document Game System.'
      })
    }
  })

export const reusableDefinitionDraftDtoSchema = z
  .strictObject({
    definitionId: serverUuidIdentityDtoSchema,
    gameSystemId: serverUuidIdentityDtoSchema,
    authorUserId: serverUuidIdentityDtoSchema,
    document: reusableDefinitionDocumentDtoSchema,
    checksum: checksumSchema,
    baseDefinitionVersion: versionSchema,
    version: versionSchema,
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime()
  })
  .superRefine((draft, context) => {
    if (draft.definitionId !== draft.document.id) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['document', 'id'],
        message: 'Reusable definition draft ID must match its document ID.'
      })
    }
    if (draft.gameSystemId !== draft.document.gameSystemId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['document', 'gameSystemId'],
        message: 'Reusable definition draft Game System must match its document Game System.'
      })
    }
  })

export type ContentSourceKindDto = z.infer<typeof contentSourceKindDtoSchema>
export type ReusableDefinitionCurrentDto = z.infer<typeof reusableDefinitionCurrentDtoSchema>
export type ReusableDefinitionDraftDto = z.infer<typeof reusableDefinitionDraftDtoSchema>
export type ReusableDefinitionDocumentDto = z.infer<typeof reusableDefinitionDocumentDtoSchema>
