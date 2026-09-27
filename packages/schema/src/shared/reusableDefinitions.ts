import { z, lazySchema } from '../zod.js'

import { ruleGraphDefinitionDtoSchema } from '../api/rulesRuntime.js'
import { basicActionReusableDefinitionDocumentDtoSchema } from './basicActions.js'
import { senseReusableDefinitionDocumentDtoSchema } from './combatPerception.js'
import { initiativePolicyReusableDefinitionDocumentDtoSchema } from './initiativePolicy.js'
import { dnd5eEncounterLifecycleReusableDefinitionDocumentDtoSchema } from './encounterLifecycle.js'
import { dnd5eOptionalCombatReusableDefinitionDocumentDtoSchema } from './optionalCombat.js'
import { ruleMaintenanceReusableDefinitionDocumentDtoSchema } from './ruleMaintenance.js'
import {
  conditionRuleStateReusableDefinitionDocumentDtoSchema,
  ruleCapabilityReusableDefinitionDocumentDtoSchema
} from './ruleState.js'
import { postgresUuidSchema as serverUuidIdentityDtoSchema } from './postgresUuid.js'

import { reusableDefinitionFamilyKeyDtoSchema } from './reusableDefinitionIdentity.js'
export { reusableDefinitionFamilyKeyDtoSchema } from './reusableDefinitionIdentity.js'

const boundedLabelSchema = lazySchema(() =>
  z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(160))
)
const boundedDescriptionSchema = lazySchema(() => z.nullable(z.string().check(z.maxLength(4_000))))
const checksumSchema = lazySchema(() => z.string().check(z.regex(/^[a-f0-9]{64}$/)))
const versionSchema = lazySchema(() => z.number().check(z.int()).check(z.gte(0)))

export const contentSourceKindDtoSchema = lazySchema(() => z.enum(['PLATFORM', 'USER']))

export const reusableDefinitionDocumentDtoSchema = lazySchema(() =>
  z.union([
    ruleGraphDefinitionDtoSchema,
    initiativePolicyReusableDefinitionDocumentDtoSchema,
    dnd5eEncounterLifecycleReusableDefinitionDocumentDtoSchema,
    dnd5eOptionalCombatReusableDefinitionDocumentDtoSchema,
    senseReusableDefinitionDocumentDtoSchema,
    ruleCapabilityReusableDefinitionDocumentDtoSchema,
    conditionRuleStateReusableDefinitionDocumentDtoSchema,
    ruleMaintenanceReusableDefinitionDocumentDtoSchema,
    basicActionReusableDefinitionDocumentDtoSchema
  ])
)

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
  if (document.kind === 'RULE_MAINTENANCE') return 'rule-maintenance'
  if (document.kind === 'BASIC_ACTION') return 'basic-action'
  return 'condition-rule-state'
}

export const reusableDefinitionCurrentDtoSchema = lazySchema(() =>
  z
    .strictObject({
      id: serverUuidIdentityDtoSchema,
      gameSystemId: serverUuidIdentityDtoSchema,
      contentSourceId: serverUuidIdentityDtoSchema,
      definitionFamilyKey: reusableDefinitionFamilyKeyDtoSchema,
      label: boundedLabelSchema,
      description: boundedDescriptionSchema,
      document: reusableDefinitionDocumentDtoSchema,
      checksum: checksumSchema,
      contractVersion: z.number().check(z.int()).check(z.positive()).check(z.lte(10_000)),
      version: versionSchema,
      publishedAt: z.iso.datetime(),
      publishedBy: serverUuidIdentityDtoSchema
    })
    .check(
      z.superRefine((current, context) => {
        const documentFamilyKey = reusableDefinitionDocumentFamilyKey(current.document)
        if (current.definitionFamilyKey !== documentFamilyKey) {
          context.addIssue({
            code: 'custom',
            path: ['definitionFamilyKey'],
            message: 'Reusable definition family must match its document family.'
          })
        }
        if (current.id !== current.document.id) {
          context.addIssue({
            code: 'custom',
            path: ['document', 'id'],
            message: 'Reusable definition ID must match its document ID.'
          })
        }
        if (current.gameSystemId !== current.document.gameSystemId) {
          context.addIssue({
            code: 'custom',
            path: ['document', 'gameSystemId'],
            message: 'Reusable definition Game System must match its document Game System.'
          })
        }
      })
    )
)

export const reusableDefinitionDraftDtoSchema = lazySchema(() =>
  z
    .strictObject({
      definitionId: serverUuidIdentityDtoSchema,
      gameSystemId: serverUuidIdentityDtoSchema,
      authorUserId: serverUuidIdentityDtoSchema,
      document: reusableDefinitionDocumentDtoSchema,
      checksum: checksumSchema,
      baseDefinitionVersion: versionSchema,
      version: versionSchema,
      createdAt: z.iso.datetime(),
      updatedAt: z.iso.datetime()
    })
    .check(
      z.superRefine((draft, context) => {
        if (draft.definitionId !== draft.document.id) {
          context.addIssue({
            code: 'custom',
            path: ['document', 'id'],
            message: 'Reusable definition draft ID must match its document ID.'
          })
        }
        if (draft.gameSystemId !== draft.document.gameSystemId) {
          context.addIssue({
            code: 'custom',
            path: ['document', 'gameSystemId'],
            message: 'Reusable definition draft Game System must match its document Game System.'
          })
        }
      })
    )
)

export type ContentSourceKindDto = z.infer<typeof contentSourceKindDtoSchema>
export type ReusableDefinitionCurrentDto = z.infer<typeof reusableDefinitionCurrentDtoSchema>
export type ReusableDefinitionDraftDto = z.infer<typeof reusableDefinitionDraftDtoSchema>
export type ReusableDefinitionDocumentDto = z.infer<typeof reusableDefinitionDocumentDtoSchema>

export interface ReusableDefinitionRootRecord {
  id: string
  gameSystemId: string
  contentSourceId: string
  definitionFamilyKey: string
  label: string
  description: string | null
  version: number
  draftVersion: number | null
  sourceKind: ContentSourceKindDto
  sourceOwnerUserId: string | null
  current: ReusableDefinitionCurrentDto | null
}
