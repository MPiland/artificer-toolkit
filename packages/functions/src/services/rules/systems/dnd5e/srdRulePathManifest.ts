import { createHash } from 'node:crypto'

import {
  readSrdSemanticLedgerEntries,
  srdBaselineContent,
  SRD_SYSTEM_ID,
  type SrdSemanticLedgerEntry
} from '@artificer-toolkit/db'
import {
  rulePathManifestDtoSchema,
  type RulePathManifestDto
} from '@artificer-toolkit/schema/shared/rulePathManifest'
import { type CompiledEffectGroup } from '@artificer-toolkit/shared/compilers'
import {
  compileRuleGraph,
  coreRuleOperations,
  createRuleOperationRegistry,
  type RuleOperationReference
} from '@artificer-toolkit/shared/rules'
import {
  compileSubjectWithMechanicsIndex,
  type CompiledSubjectKind,
  type CompiledSubjectMechanicsNode
} from '@artificer-toolkit/shared/subjects/compilers'

import { CharacterRuleActionUnsupportedCompilationError } from '../../characterRuleActionSystemAdapter.js'
import {
  compileDnd5eEffectAction,
  compileDnd5eEffectActionTestTemplate,
  DND5E_EFFECT_ACTION_FAMILY_KEY,
  dnd5eAttackTestOperation,
  dnd5eConditionApplyProposalOperation,
  dnd5eDamageProposalOperation,
  dnd5eDamageTotalOperation,
  dnd5eEffectActionCapability,
  dnd5eHealProposalOperation,
  dnd5eSaveTestOperation,
  dnd5eTemporaryHitPointsProposalOperation,
  dnd5eTestConditionProposalOperation,
  dnd5eTestDamageProposalOperation,
  dnd5eTestHealProposalOperation,
  dnd5eTestTemporaryHitPointsProposalOperation
} from './effectActionCompiler.js'

type Leaf = RulePathManifestDto['leaves'][number]
type ExecutionPin = NonNullable<Leaf['executionPin']>
type RecordValue = Record<string, unknown>
const DOMAIN_KIND: Record<string, CompiledSubjectKind> = {
  backgrounds: 'BACKGROUND',
  classes: 'CLASS',
  creatures: 'CREATURE',
  equipment: 'EQUIPMENT',
  feats: 'FEAT',
  races: 'RACE',
  spells: 'SPELL',
  vehicles: 'VEHICLE'
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const dnd5eEffectGraphOperations = createRuleOperationRegistry([
  ...coreRuleOperations,
  dnd5eHealProposalOperation,
  dnd5eTemporaryHitPointsProposalOperation,
  dnd5eDamageProposalOperation,
  dnd5eDamageTotalOperation,
  dnd5eConditionApplyProposalOperation,
  dnd5eAttackTestOperation,
  dnd5eSaveTestOperation,
  dnd5eTestHealProposalOperation,
  dnd5eTestTemporaryHitPointsProposalOperation,
  dnd5eTestDamageProposalOperation,
  dnd5eTestConditionProposalOperation
])

function record(value: unknown): value is RecordValue {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (!record(value)) return value
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => [key, canonical(item)])
  )
}
function checksum(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(canonical(value)))
    .digest('hex')
}
function rootKey(domain: string, id: string): string {
  return `${domain}:${id}`
}
function manifestLeafIdentity(leaf: Leaf): string {
  const entryPoint = leaf.entryPoint
  const entryIdentity =
    entryPoint.kind === 'EFFECT_ENTRY'
      ? `${entryPoint.kind}:${entryPoint.effectId}:${entryPoint.entryId}:${entryPoint.resultBlockId}`
      : entryPoint.kind === 'UUID_BACKED_TYPED_MECHANICS'
        ? `${entryPoint.kind}:${entryPoint.sourceId}:${entryPoint.nodeKind}`
        : `${entryPoint.kind}:${entryPoint.nodeKind}`
  return `${rootKey(leaf.domain, leaf.rootId)}:${leaf.sourcePath.join('/')}:${entryIdentity}`
}
export function validateRulePathManifestCompleteness(
  manifest: RulePathManifestDto
): RulePathManifestDto {
  const roots = new Set<string>()
  for (const root of manifest.roots) {
    const key = rootKey(root.domain, root.rootId)
    if (roots.has(key)) throw new Error(`Duplicate manifest root ${key}.`)
    roots.add(key)
  }
  const leaves = new Set<string>()
  for (const leaf of manifest.leaves) {
    const key = manifestLeafIdentity(leaf)
    if (leaves.has(key)) throw new Error(`Duplicate manifest leaf ${key}.`)
    leaves.add(key)
    const executable = leaf.capability === 'AUTOMATIC' || leaf.capability === 'ASSISTED'
    if (executable && (leaf.executionPin === null || leaf.reason !== 'SUPPORTED_SYSTEM_CAPABILITY'))
      throw new Error(`Executable manifest leaf ${key} lacks a supported execution pin.`)
    if (!executable && leaf.executionPin !== null)
      throw new Error(`Non-executable manifest leaf ${key} retains an execution pin.`)
  }
  for (const leaf of manifest.leaves) {
    const key = rootKey(leaf.domain, leaf.rootId)
    if (!roots.has(key)) throw new Error(`Manifest leaf ${key} lacks a root summary.`)
  }
  for (const root of manifest.roots) {
    const owned = manifest.leaves.filter(
      (leaf) => rootKey(leaf.domain, leaf.rootId) === rootKey(root.domain, root.rootId)
    )
    if (root.leafCount !== owned.length)
      throw new Error(
        `Manifest root ${rootKey(root.domain, root.rootId)} has an incomplete leaf count.`
      )
  }
  return manifest
}
export function validateDnd5eExecutionPins(manifest: RulePathManifestDto): RulePathManifestDto {
  for (const leaf of manifest.leaves) {
    if (leaf.executionPin === null) continue
    if (leaf.entryPoint.kind !== 'EFFECT_ENTRY')
      throw new Error('D&D execution pins require an exact Effect entry point.')
    if (leaf.executionPin.definitionId !== leaf.entryPoint.effectId)
      throw new Error('D&D execution pins must bind the exact Effect identity.')
    if (leaf.executionPin.definitionFamilyKey !== DND5E_EFFECT_ACTION_FAMILY_KEY)
      throw new Error('D&D execution pins must use the Effect action definition family.')
    if (leaf.executionPin.capabilityContractVersion !== dnd5eEffectActionCapability.contractVersion)
      throw new Error('D&D execution pins must use the current Effect action capability contract.')
  }
  return manifest
}
function outcomeKind(value: unknown): string {
  return record(value) && typeof value.effectKind === 'string' ? value.effectKind : 'NO_OUTCOME'
}
function resultBlockId(entry: CompiledEffectGroup['entries'][number]): string {
  return 'resultBlockId' in entry && UUID.test(entry.resultBlockId) ? entry.resultBlockId : entry.id
}
function conditionIds(): string[] {
  const systems = srdBaselineContent.vocabulary.systems as unknown as RecordValue[]
  return systems
    .flatMap((system) => (Array.isArray(system.conditionTypes) ? system.conditionTypes : []))
    .map((value) => (record(value) && typeof value.id === 'string' ? value.id.toLowerCase() : null))
    .filter((value): value is string => value !== null)
    .sort()
}
function supportedEffectExecutionPin(
  effect: CompiledEffectGroup,
  conditionDefinitionIds: readonly string[]
): ExecutionPin | null {
  try {
    const action = {
      gameSystemId: SRD_SYSTEM_ID,
      entryPointDefinitionId: effect.id,
      effectId: effect.id,
      conditionDefinitionIds: [...conditionDefinitionIds],
      savingThrowAbilityDefinitionId:
        'savingThrow' in effect.invocation
          ? effect.invocation.savingThrow?.abilityDefinitionId
          : undefined,
      compiledEffect: effect
    }
    const published = (() => {
      try {
        return compileDnd5eEffectActionTestTemplate({ action }).published
      } catch (error) {
        if (!(error instanceof CharacterRuleActionUnsupportedCompilationError)) throw error
        return compileDnd5eEffectAction({ action })
      }
    })()
    const compiled = compileRuleGraph({
      definition: published.definition,
      sourceChecksum: published.checksum,
      capability: dnd5eEffectActionCapability,
      operations: dnd5eEffectGraphOperations
    })
    if (!compiled.ok)
      throw new Error(
        `D&D compiled Effect graph did not validate: ${compiled.diagnostics
          .map((diagnostic) => diagnostic.code)
          .join(', ')}`
      )
    const operationContracts = [...compiled.value.nodes]
      .map((node) => node.operation)
      .sort(
        (left, right) =>
          left.key.localeCompare(right.key) || left.contractVersion - right.contractVersion
      )
      .filter(
        (operation, index, operations) =>
          index === 0 ||
          operation.key !== operations[index - 1]!.key ||
          operation.contractVersion !== operations[index - 1]!.contractVersion
      )
      .map((operation): RuleOperationReference => ({ ...operation }))
    return {
      kind: 'COMPILED_RULE_GRAPH',
      definitionId: published.id,
      definitionFamilyKey: published.definitionFamilyKey,
      definitionChecksum: published.checksum,
      definitionSchemaVersion: published.definition.schemaVersion,
      capabilityContractVersion: compiled.value.capabilityContractVersion,
      operationContracts
    }
  } catch (error) {
    if (error instanceof CharacterRuleActionUnsupportedCompilationError) return null
    throw error
  }
}

function effectCapability(input: {
  outcome: unknown
  executionPin: ExecutionPin | null
}): Pick<Leaf, 'capability' | 'reason' | 'executionPin'> {
  const kind = outcomeKind(input.outcome)
  if (kind === 'MANUAL_ADJUDICATION')
    return {
      capability: 'JUDGMENT_REQUIRED',
      reason: 'OPEN_JUDGMENT',
      executionPin: null
    }
  if (kind === 'NO_OUTCOME')
    return { capability: 'MANUAL', reason: 'NO_MECHANICAL_OUTCOME', executionPin: null }
  return input.executionPin
    ? {
        capability: 'AUTOMATIC',
        reason: 'SUPPORTED_SYSTEM_CAPABILITY',
        executionPin: input.executionPin
      }
    : {
        capability: 'JUDGMENT_REQUIRED',
        reason: 'UNSUPPORTED_SYSTEM_CAPABILITY',
        executionPin: null
      }
}
/** Walk only the closed compiled outcome contracts that can contain further outcomes. */
function nestedCompiledOutcomes(outcome: unknown): readonly RecordValue[] {
  if (!record(outcome)) return []
  const nested: RecordValue[] = []
  const addBranch = (branch: unknown) => {
    if (!record(branch) || branch.kind !== 'OUTCOMES' || !Array.isArray(branch.outcomes)) return
    for (const child of branch.outcomes) if (record(child)) nested.push(child)
  }
  switch (outcome.effectKind) {
    case 'FOLLOW_UP_SAVE':
      addBranch(outcome.onSuccess)
      addBranch(outcome.onFailure)
      addBranch(outcome.onDurationComplete)
      break
    case 'FOLLOW_UP_CHECK':
      addBranch(outcome.onSuccess)
      addBranch(outcome.onFailure)
      break
    default:
      break
  }
  return nested
}
function nestedCompiledEffectGroups(outcome: unknown): readonly CompiledEffectGroup[] {
  if (!record(outcome) || outcome.effectKind !== 'MANIFEST') return []
  const groups: CompiledEffectGroup[] = []
  const add = (value: unknown) => {
    if (record(value) && typeof value.id === 'string' && Array.isArray(value.entries))
      groups.push(value as unknown as CompiledEffectGroup)
  }
  if (Array.isArray(outcome.behaviors)) for (const behavior of outcome.behaviors) add(behavior)
  if (Array.isArray(outcome.components))
    for (const component of outcome.components) {
      if (!record(component) || !Array.isArray(component.behaviors)) continue
      for (const behavior of component.behaviors) add(behavior)
    }
  if (record(outcome.proximityRule)) add(outcome.proximityRule.behavior)
  return groups
}
function addEffectOutcomeLeaf(input: {
  leaves: Leaf[]
  domain: string
  rootId: string
  rootChecksum: string
  node: Extract<CompiledSubjectMechanicsNode, { kind: 'COMPILED_EFFECT_GROUP' }>
  entry: CompiledEffectGroup['entries'][number]
  outcome: unknown
  sourcePath: readonly string[]
  executionPin: ExecutionPin | null
}): void {
  input.leaves.push({
    domain: input.domain,
    rootId: input.rootId,
    rootChecksum: input.rootChecksum,
    sourcePath: [...input.sourcePath],
    descriptorChecksum: checksum({
      effect: input.node.compiledEffect,
      entry: input.entry,
      outcome: input.outcome
    }),
    entryPoint: {
      kind: 'EFFECT_ENTRY',
      effectId: input.node.compiledEffect.id,
      entryId: input.entry.entryId,
      resultBlockId: resultBlockId(input.entry),
      pathGroupId: input.entry.pathGroupId,
      pathCode: input.entry.pathCode,
      resolutionKind: input.entry.resolutionKind,
      groupKind: input.entry.groupKind,
      triggerCode: input.node.compiledEffect.invocation.triggerCode,
      activationCode:
        'activation' in input.node.compiledEffect.invocation
          ? input.node.compiledEffect.invocation.activation.code
          : 'PASSIVE',
      targetSelectionKind: input.node.compiledEffect.invocation.targeting?.selectionKind ?? null,
      rangeKind: input.node.compiledEffect.invocation.range.rangeKind,
      shapeKind: input.node.compiledEffect.invocation.shape?.shapeKind ?? null,
      outcomeKind: outcomeKind(input.outcome)
    },
    ...effectCapability({ outcome: input.outcome, executionPin: input.executionPin })
  })
  for (const nested of nestedCompiledOutcomes(input.outcome)) {
    if (typeof nested.id !== 'string')
      throw new Error('Nested compiled outcome must retain its UUID.')
    addEffectOutcomeLeaf({
      ...input,
      outcome: nested,
      sourcePath: [...input.sourcePath, nested.id]
    })
  }
}
function addEffectLeaves(input: {
  leaves: Leaf[]
  domain: string
  rootId: string
  rootChecksum: string
  node: Extract<CompiledSubjectMechanicsNode, { kind: 'COMPILED_EFFECT_GROUP' }>
  conditionDefinitionIds: readonly string[]
}): void {
  const requiresExecutionPin = input.node.compiledEffect.entries.some((entry) => {
    const outcome = 'outcome' in entry ? entry.outcome : null
    return (
      outcome !== null &&
      outcomeKind(outcome) !== 'MANUAL_ADJUDICATION' &&
      outcomeKind(outcome) !== 'NO_OUTCOME'
    )
  })
  const executionPin = requiresExecutionPin
    ? supportedEffectExecutionPin(input.node.compiledEffect, input.conditionDefinitionIds)
    : null
  for (const entry of input.node.compiledEffect.entries) {
    const outcome = 'outcome' in entry ? entry.outcome : { effectKind: 'NO_OUTCOME' }
    const entryPath =
      entry.id === entry.entryId
        ? [...input.node.sourcePath, entry.id]
        : [...input.node.sourcePath, entry.id, entry.entryId]
    addEffectOutcomeLeaf({
      ...input,
      entry,
      outcome,
      sourcePath: entryPath,
      executionPin
    })
    const outcomeRecord = outcome as unknown as RecordValue
    if (record(outcomeRecord) && typeof outcomeRecord.id === 'string') {
      for (const nestedEffect of nestedCompiledEffectGroups(outcome))
        addEffectLeaves({
          ...input,
          node: {
            kind: 'COMPILED_EFFECT_GROUP',
            nodeKind: 'EFFECT_GROUP',
            effectId: nestedEffect.id,
            sourcePath: [...input.node.sourcePath, outcomeRecord.id, nestedEffect.id],
            compiledEffect: nestedEffect
          }
        })
    }
  }
}
function addTypedMechanicsLeaf(input: {
  leaves: Leaf[]
  domain: string
  rootId: string
  rootChecksum: string
  node: Exclude<CompiledSubjectMechanicsNode, { kind: 'COMPILED_EFFECT_GROUP' }>
}): void {
  const descriptor = input.node.semanticDescriptor
  input.leaves.push({
    domain: input.domain,
    rootId: input.rootId,
    rootChecksum: input.rootChecksum,
    sourcePath: [...input.node.sourcePath],
    descriptorChecksum: checksum(descriptor),
    entryPoint:
      input.node.kind === 'ROOT_COMPILED_SEMANTICS'
        ? {
            kind: 'ROOT_OWNED_TYPED_MECHANICS',
            nodeKind: 'ROOT_COMPILED_SEMANTICS',
            outcomeKind: null
          }
        : {
            kind: 'UUID_BACKED_TYPED_MECHANICS',
            sourceId: input.node.nodeId,
            nodeKind: input.node.nodeKind,
            outcomeKind: null
          },
    capability: 'JUDGMENT_REQUIRED',
    reason: 'UNMODELED_TYPED_MECHANICS',
    executionPin: null
  })
}
function summary(domain: string, rootId: string, rootChecksum: string, leaves: readonly Leaf[]) {
  const capabilities = { AUTOMATIC: 0, ASSISTED: 0, MANUAL: 0, JUDGMENT_REQUIRED: 0 }
  for (const leaf of leaves) capabilities[leaf.capability] += 1
  return {
    domain,
    rootId,
    rootChecksum,
    coverage: leaves.length ? ('MECHANICS' as const) : ('NO_MECHANICS' as const),
    leafCount: leaves.length,
    capabilities
  }
}

/** Source auditing consumes the shared compiler index, never a raw authored-object traversal. */
export function generateRulePathManifest(input: {
  content: typeof srdBaselineContent
  systemId: string
  ledgerEntries: readonly SrdSemanticLedgerEntry[]
}): RulePathManifestDto {
  const sourceRoots = new Map<string, { domain: string; root: unknown }>()
  for (const [domain, roots] of Object.entries(input.content.subjects))
    for (const root of roots as readonly { id: string }[]) {
      const key = rootKey(domain, root.id.toLowerCase())
      if (sourceRoots.has(key)) throw new Error(`Duplicate source root ${key}.`)
      sourceRoots.set(key, { domain, root })
    }
  const ledger = new Map<string, SrdSemanticLedgerEntry>()
  for (const entry of input.ledgerEntries) {
    const key = rootKey(entry.domain, entry.id.toLowerCase())
    if (ledger.has(key)) throw new Error(`Duplicate semantic ledger root ${key}.`)
    ledger.set(key, entry)
  }
  if (ledger.size !== sourceRoots.size)
    throw new Error('SRD source and semantic ledger root identities differ.')
  for (const key of ledger.keys())
    if (!sourceRoots.has(key)) throw new Error(`Ledger root ${key} is absent from source.`)
  const leaves: Leaf[] = []
  const roots: RulePathManifestDto['roots'] = []
  const conditions = conditionIds()
  for (const [key, ledgerEntry] of [...ledger.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const source = sourceRoots.get(key)!
    const subjectKind = DOMAIN_KIND[source.domain]
    if (!subjectKind) throw new Error(`Unknown SRD subject domain ${source.domain}.`)
    const compilation = compileSubjectWithMechanicsIndex({ subjectKind, authored: source.root })
    const rootChecksum = checksum(source.root)
    const start = leaves.length
    for (const node of compilation.mechanicsIndex.nodes) {
      if (node.kind === 'COMPILED_EFFECT_GROUP')
        addEffectLeaves({
          leaves,
          domain: source.domain,
          rootId: ledgerEntry.id,
          rootChecksum,
          node,
          conditionDefinitionIds: conditions
        })
      else
        addTypedMechanicsLeaf({
          leaves,
          domain: source.domain,
          rootId: ledgerEntry.id,
          rootChecksum,
          node
        })
    }
    const owned = leaves.slice(start)
    for (const manualId of ledgerEntry.manualExceptionIds)
      if (
        !owned.some((leaf) => leaf.sourcePath.includes(manualId) && leaf.reason === 'OPEN_JUDGMENT')
      )
        throw new Error(`${key} manual exception ${manualId} lacks an exact OPEN_JUDGMENT leaf.`)
    roots.push(summary(source.domain, ledgerEntry.id, rootChecksum, owned))
  }
  leaves.sort(
    (a, b) =>
      a.domain.localeCompare(b.domain) ||
      a.rootId.localeCompare(b.rootId) ||
      a.sourcePath.join('/').localeCompare(b.sourcePath.join('/')) ||
      a.entryPoint.kind.localeCompare(b.entryPoint.kind)
  )
  roots.sort((a, b) => a.domain.localeCompare(b.domain) || a.rootId.localeCompare(b.rootId))
  return validateRulePathManifestCompleteness(
    validateDnd5eExecutionPins(
      rulePathManifestDtoSchema.parse({ version: 1, systemId: input.systemId, leaves, roots })
    )
  )
}
export function generateSrdRulePathManifest(): RulePathManifestDto {
  return generateRulePathManifest({
    content: srdBaselineContent,
    systemId: SRD_SYSTEM_ID,
    ledgerEntries: readSrdSemanticLedgerEntries()
  })
}
export function canonicalRulePathManifestJson(manifest: RulePathManifestDto): string {
  return `${JSON.stringify(canonical(validateRulePathManifestCompleteness(rulePathManifestDtoSchema.parse(manifest))))}\n`
}
export function assertRulePathManifestFresh(
  artifact: RulePathManifestDto,
  generated: RulePathManifestDto
): void {
  if (canonicalRulePathManifestJson(artifact) !== canonicalRulePathManifestJson(generated))
    throw new Error('SRD rule-path manifest is stale. Run generate:srd:rule-path-manifest.')
}
export function summarizeSrdRulePathManifest(
  manifest: RulePathManifestDto
): Record<Leaf['capability'], number> {
  return manifest.leaves.reduce<Record<Leaf['capability'], number>>(
    (totals, leaf) => ({ ...totals, [leaf.capability]: totals[leaf.capability] + 1 }),
    { AUTOMATIC: 0, ASSISTED: 0, MANUAL: 0, JUDGMENT_REQUIRED: 0 }
  )
}
