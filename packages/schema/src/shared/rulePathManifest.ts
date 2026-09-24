import { z } from '../zod.js'

import { RULE_GRAPH_LIMITS } from '@artificer-toolkit/shared/rules'

import { ruleCapabilityKeyDtoSchema } from '../api/rulesRuntime.js'
import { postgresUuidSchema } from './postgresUuid.js'

const uuidSchema = z.pipe(
  postgresUuidSchema,
  z.transform((value) => value.toLowerCase())
)
const checksumSchema = z.string().check(z.regex(/^[a-f0-9]{64}$/))
const codeSchema = z.string().check(z.regex(/^[A-Z][A-Z0-9_]*$/))

export const rulePathManifestCapabilityDtoSchema = z.enum([
  'AUTOMATIC',
  'ASSISTED',
  'MANUAL',
  'JUDGMENT_REQUIRED'
])
export const rulePathManifestReasonDtoSchema = z.enum([
  'SUPPORTED_SYSTEM_CAPABILITY',
  'MANUAL_REMINDER',
  'OPEN_JUDGMENT',
  'UNSUPPORTED_SYSTEM_CAPABILITY',
  'UNMODELED_TYPED_MECHANICS',
  'NO_MECHANICAL_OUTCOME'
])

const rulePathManifestOperationContractDtoSchema = z.strictObject({
  key: ruleCapabilityKeyDtoSchema,
  contractVersion: z.number().check(z.int()).check(z.positive()).check(z.lte(10_000))
})

export const rulePathManifestExecutionPinDtoSchema = z.discriminatedUnion('kind', [
  z
    .strictObject({
      kind: z.literal('COMPILED_RULE_GRAPH'),
      definitionId: uuidSchema,
      definitionFamilyKey: ruleCapabilityKeyDtoSchema,
      definitionChecksum: checksumSchema,
      definitionSchemaVersion: z.literal(1),
      capabilityContractVersion: z.number().check(z.int()).check(z.positive()).check(z.lte(10_000)),
      operationContracts: z
        .array(rulePathManifestOperationContractDtoSchema)
        .check(z.minLength(1))
        .check(z.maxLength(RULE_GRAPH_LIMITS.OPERATION_CONTRACTS))
    })
    .check(
      z.superRefine((pin, context) => {
        const identities = pin.operationContracts.map(
          (operation) => `${operation.key}@${operation.contractVersion}`
        )
        if (new Set(identities).size !== identities.length)
          context.addIssue({
            code: 'custom',
            path: ['operationContracts'],
            message: 'Execution-pin operation contracts must be unique.'
          })
        if (
          pin.operationContracts.some((operation, index) => {
            if (index === 0) return false
            const previous = pin.operationContracts[index - 1]!
            return (
              previous.key.localeCompare(operation.key) > 0 ||
              (previous.key === operation.key &&
                previous.contractVersion >= operation.contractVersion)
            )
          })
        )
          context.addIssue({
            code: 'custom',
            path: ['operationContracts'],
            message: 'Execution-pin operation contracts must be sorted by key and contract version.'
          })
      })
    )
])

const effectEntryPointDtoSchema = z.strictObject({
  kind: z.literal('EFFECT_ENTRY'),
  effectId: uuidSchema,
  entryId: uuidSchema,
  resultBlockId: uuidSchema,
  pathGroupId: uuidSchema,
  pathCode: codeSchema,
  resolutionKind: codeSchema,
  groupKind: codeSchema,
  triggerCode: codeSchema,
  activationCode: codeSchema,
  targetSelectionKind: z.nullable(codeSchema),
  rangeKind: codeSchema,
  shapeKind: z.nullable(codeSchema),
  outcomeKind: codeSchema
})
const unmodeledEntryPointDtoSchema = z.strictObject({
  kind: z.literal('UUID_BACKED_TYPED_MECHANICS'),
  sourceId: uuidSchema,
  nodeKind: codeSchema,
  outcomeKind: z.null()
})
const rootOwnedTypedMechanicsEntryPointDtoSchema = z.strictObject({
  kind: z.literal('ROOT_OWNED_TYPED_MECHANICS'),
  nodeKind: z.literal('ROOT_COMPILED_SEMANTICS'),
  outcomeKind: z.null()
})
export const rulePathManifestLeafDtoSchema = z.strictObject({
  domain: z.string().check(z.regex(/^[a-z][a-z0-9-]*$/)),
  rootId: uuidSchema,
  rootChecksum: checksumSchema,
  sourcePath: z.array(uuidSchema).check(z.minLength(1)).check(z.maxLength(64)),
  descriptorChecksum: z.nullable(checksumSchema),
  entryPoint: z.discriminatedUnion('kind', [
    effectEntryPointDtoSchema,
    unmodeledEntryPointDtoSchema,
    rootOwnedTypedMechanicsEntryPointDtoSchema
  ]),
  capability: rulePathManifestCapabilityDtoSchema,
  reason: rulePathManifestReasonDtoSchema,
  executionPin: z.nullable(rulePathManifestExecutionPinDtoSchema)
})
export const rulePathManifestRootSummaryDtoSchema = z.strictObject({
  domain: z.string().check(z.regex(/^[a-z][a-z0-9-]*$/)),
  rootId: uuidSchema,
  rootChecksum: checksumSchema,
  coverage: z.enum(['MECHANICS', 'NO_MECHANICS']),
  leafCount: z.number().check(z.int()).check(z.nonnegative()),
  capabilities: z.strictObject({
    AUTOMATIC: z.number().check(z.int()).check(z.nonnegative()),
    ASSISTED: z.number().check(z.int()).check(z.nonnegative()),
    MANUAL: z.number().check(z.int()).check(z.nonnegative()),
    JUDGMENT_REQUIRED: z.number().check(z.int()).check(z.nonnegative())
  })
})
function rootKey(domain: string, rootId: string): string {
  return `${domain}:${rootId}`
}

export const rulePathManifestDtoSchema = z
  .strictObject({
    version: z.literal(1),
    systemId: uuidSchema,
    leaves: z.array(rulePathManifestLeafDtoSchema),
    roots: z.array(rulePathManifestRootSummaryDtoSchema)
  })
  .check(
    z.superRefine((manifest, context) => {
      const summaries = new Map<string, z.infer<typeof rulePathManifestRootSummaryDtoSchema>>()
      for (const [index, root] of manifest.roots.entries()) {
        const key = rootKey(root.domain, root.rootId)
        if (summaries.has(key))
          context.addIssue({
            code: 'custom',
            path: ['roots', index],
            message: 'Root summaries must be unique.'
          })
        summaries.set(key, root)
      }
      const leafKeys = new Set<string>()
      const leavesByRoot = new Map<string, z.infer<typeof rulePathManifestLeafDtoSchema>[]>()
      for (const [index, leaf] of manifest.leaves.entries()) {
        const key = rootKey(leaf.domain, leaf.rootId)
        const nodeKind = 'nodeKind' in leaf.entryPoint ? leaf.entryPoint.nodeKind : ''
        const leafKey = `${key}:${leaf.sourcePath.join('/')}:${leaf.entryPoint.kind}:${nodeKind}`
        if (leafKeys.has(leafKey))
          context.addIssue({
            code: 'custom',
            path: ['leaves', index],
            message: 'Rule-path manifest leaf identities must be unique.'
          })
        leafKeys.add(leafKey)
        const executable = leaf.capability === 'AUTOMATIC' || leaf.capability === 'ASSISTED'
        if (
          executable &&
          (leaf.reason !== 'SUPPORTED_SYSTEM_CAPABILITY' || leaf.executionPin === null)
        )
          context.addIssue({
            code: 'custom',
            path: ['leaves', index, 'executionPin'],
            message: 'Automatic and assisted leaves require a supported-system execution pin.'
          })
        if (!executable && leaf.executionPin !== null)
          context.addIssue({
            code: 'custom',
            path: ['leaves', index, 'executionPin'],
            message: 'Manual and judgment-required leaves cannot retain an execution pin.'
          })
        if (!executable && leaf.reason === 'SUPPORTED_SYSTEM_CAPABILITY')
          context.addIssue({
            code: 'custom',
            path: ['leaves', index, 'reason'],
            message: 'Only executable leaves can claim a supported-system capability.'
          })
        if (leaf.executionPin !== null && leaf.entryPoint.kind !== 'EFFECT_ENTRY')
          context.addIssue({
            code: 'custom',
            path: ['leaves', index, 'executionPin'],
            message: 'Execution pins currently bind only exact Effect entry points.'
          })
        if (
          leaf.executionPin !== null &&
          leaf.entryPoint.kind === 'EFFECT_ENTRY' &&
          leaf.executionPin.definitionId !== leaf.entryPoint.effectId
        )
          context.addIssue({
            code: 'custom',
            path: ['leaves', index, 'executionPin', 'definitionId'],
            message: 'Execution-pin definitions must bind the exact Effect identity.'
          })
        if (
          leaf.sourcePath[0] !== leaf.rootId ||
          leaf.sourcePath.filter((id) => id === leaf.rootId).length !== 1
        )
          context.addIssue({
            code: 'custom',
            path: ['leaves', index, 'sourcePath'],
            message: 'A leaf path must begin with its root identity exactly once.'
          })
        if (leaf.entryPoint.kind === 'EFFECT_ENTRY') {
          const effectEntryPoint = leaf.entryPoint as {
            effectId: string
            entryId: string
          }
          const effectIndex = leaf.sourcePath.indexOf(effectEntryPoint.effectId)
          const entryIndex = leaf.sourcePath.indexOf(effectEntryPoint.entryId)
          const sharedIdentity = effectEntryPoint.effectId === effectEntryPoint.entryId
          if (
            effectIndex < 1 ||
            (!sharedIdentity && entryIndex <= effectIndex) ||
            leaf.sourcePath.filter((id) => id === effectEntryPoint.effectId).length !== 1 ||
            leaf.sourcePath.filter((id) => id === effectEntryPoint.entryId).length !== 1
          )
            context.addIssue({
              code: 'custom',
              path: ['leaves', index, 'sourcePath'],
              message: 'Effect paths must bind exact effect and entry identities in order.'
            })
        }
        if (leaf.entryPoint.kind === 'ROOT_OWNED_TYPED_MECHANICS' && leaf.sourcePath.length !== 1)
          context.addIssue({
            code: 'custom',
            path: ['leaves', index, 'sourcePath'],
            message: 'Root-owned mechanics require a root-only path.'
          })
        if (leaf.entryPoint.kind !== 'ROOT_OWNED_TYPED_MECHANICS' && leaf.sourcePath.length < 2)
          context.addIssue({
            code: 'custom',
            path: ['leaves', index, 'sourcePath'],
            message: 'Referenced mechanics require a nested UUID path.'
          })
        const summary = summaries.get(key)
        if (!summary)
          context.addIssue({
            code: 'custom',
            path: ['leaves', index],
            message: 'Every leaf requires its exact root summary.'
          })
        else if (summary.rootChecksum !== leaf.rootChecksum)
          context.addIssue({
            code: 'custom',
            path: ['leaves', index, 'rootChecksum'],
            message: 'Leaf and root summary checksums must match.'
          })
        const owned = leavesByRoot.get(key) ?? []
        owned.push(leaf)
        leavesByRoot.set(key, owned)
      }
      for (const [key, summary] of summaries) {
        const leaves = leavesByRoot.get(key) ?? []
        const capabilities = { AUTOMATIC: 0, ASSISTED: 0, MANUAL: 0, JUDGMENT_REQUIRED: 0 }
        for (const leaf of leaves) capabilities[leaf.capability] += 1
        if (
          summary.leafCount !== leaves.length ||
          JSON.stringify(summary.capabilities) !== JSON.stringify(capabilities)
        )
          context.addIssue({
            code: 'custom',
            path: ['roots'],
            message: `Root summary ${key} must derive exactly from its leaves.`
          })
        if ((summary.coverage === 'NO_MECHANICS') !== (leaves.length === 0))
          context.addIssue({
            code: 'custom',
            path: ['roots'],
            message: `Root summary ${key} coverage does not match its leaves.`
          })
      }
    })
  )
export type RulePathManifestDto = z.infer<typeof rulePathManifestDtoSchema>
