import { z, lazySchema } from '../zod.js'

import { ruleGraphDefinitionDtoSchema } from '../api/rulesRuntime.js'
import { basicActionReusableDefinitionDocumentDtoSchema } from './basicActions.js'
import { senseReusableDefinitionDocumentDtoSchema } from './combatPerception.js'
import { initiativePolicyReusableDefinitionDocumentDtoSchema } from './initiativePolicy.js'
import { ruleMaintenanceReusableDefinitionDocumentDtoSchema } from './ruleMaintenance.js'
import {
  conditionRuleStateReusableDefinitionDocumentDtoSchema,
  ruleCapabilityReusableDefinitionDocumentDtoSchema
} from './ruleState.js'
import { postgresUuidSchema as serverUuidIdentityDtoSchema } from './postgresUuid.js'
import { installedDefinitionDocumentFamilies } from '../systems/installedSystemDefinitionDocuments.js'

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
    ...installedDefinitionDocumentFamilies.map(({ documentSchema }) => documentSchema),
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
  const systemFamily = installedDefinitionDocumentFamilies.find(({ documentKinds }) => {
    const kinds: readonly string[] = documentKinds
    return kinds.includes(document.kind)
  })
  if (systemFamily) return systemFamily.familyKey
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
