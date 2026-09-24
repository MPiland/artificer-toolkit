import { ruleGraphDefinitionDtoSchema } from '@artificer-toolkit/schema/api/rulesRuntime'
import {
  initiativePolicyReusableDefinitionDocumentDtoSchema,
  type InitiativePolicyReusableDefinitionDocumentDto,
  type InitiativePolicyTieResolverPinDto
} from '@artificer-toolkit/schema/shared/initiativePolicy'
import type { ReusableDefinitionCurrentDto } from '@artificer-toolkit/schema/shared/reusableDefinitions'
import { systemAuthoredDtoSchema } from '@artificer-toolkit/schema/vocabulary/system'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import type { CurrentReusableDefinitionSource } from './ruleCapabilityStateService.js'

export class InitiativePolicySourceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InitiativePolicySourceError'
  }
}

function requireExactGraph(input: {
  current: ReusableDefinitionCurrentDto
  gameSystemId: string
  pin: { definitionId: string; definitionVersion: number; definitionChecksum: string }
}) {
  const parsedDocument = ruleGraphDefinitionDtoSchema.safeParse(input.current.document)
  if (!parsedDocument.success) {
    throw new InitiativePolicySourceError('Initiative policy graph document is invalid.')
  }
  const document = parsedDocument.data
  if (
    input.current.definitionFamilyKey !== 'rules-runtime-graph' ||
    input.current.gameSystemId !== input.gameSystemId ||
    input.current.id !== input.pin.definitionId ||
    input.current.version !== input.pin.definitionVersion ||
    input.current.checksum !== input.pin.definitionChecksum ||
    checksumRuleDocument(document) !== input.current.checksum
  ) {
    throw new InitiativePolicySourceError(
      'Initiative policy graph is unavailable at its exact published version.'
    )
  }
  return { current: input.current, document }
}

export async function resolveCurrentInitiativePolicySources(input: {
  definitions: CurrentReusableDefinitionSource
  gameSystemId: string
  policyDefinitionId: string
  selectedTieDefinitionId: string | null
}): Promise<{
  policy: ReusableDefinitionCurrentDto
  policyDocument: InitiativePolicyReusableDefinitionDocumentDto
  evaluationGraph: ReturnType<typeof requireExactGraph>
  orderChoiceGraph: ReturnType<typeof requireExactGraph>
  tieResolvers: ReadonlyMap<string, ReturnType<typeof requireExactGraph>>
  selectedTie: ReturnType<typeof requireExactGraph>
  selectedTieResolver: InitiativePolicyTieResolverPinDto
  contentSourceIds: string[]
}> {
  let policy: ReusableDefinitionCurrentDto
  try {
    policy = await input.definitions.requireCurrent(input.policyDefinitionId)
  } catch {
    throw new InitiativePolicySourceError('Initiative policy is not currently available.')
  }
  const parsedPolicy = initiativePolicyReusableDefinitionDocumentDtoSchema.safeParse(
    policy.document
  )
  if (!parsedPolicy.success)
    throw new InitiativePolicySourceError('Initiative policy document is invalid.')
  const policyDocument = parsedPolicy.data
  if (
    policy.definitionFamilyKey !== 'initiative-policy' ||
    policy.gameSystemId !== input.gameSystemId ||
    policy.id !== policyDocument.id ||
    policy.gameSystemId !== policyDocument.gameSystemId ||
    policy.contractVersion !== 1 ||
    checksumRuleDocument(policyDocument) !== policy.checksum
  ) {
    throw new InitiativePolicySourceError(
      'Initiative policy does not match its current published definition.'
    )
  }
  const selectedTieDefinitionId =
    input.selectedTieDefinitionId ?? policyDocument.defaultTieResolverDefinitionId
  const selectedTieResolver = policyDocument.tieResolvers.find(
    (pin) => pin.definitionId === selectedTieDefinitionId
  )
  if (!selectedTieResolver) {
    throw new InitiativePolicySourceError(
      'Initiative tie resolver is not permitted by the selected policy.'
    )
  }
  const pins = [
    policyDocument.evaluationGraph,
    policyDocument.orderChoiceGraph,
    ...policyDocument.tieResolvers
  ]
  const currentById = new Map(
    await Promise.all(
      [...new Set(pins.map((pin) => pin.definitionId))]
        .sort((left, right) => left.localeCompare(right))
        .map(async (definitionId) => {
          try {
            return [definitionId, await input.definitions.requireCurrent(definitionId)] as const
          } catch {
            throw new InitiativePolicySourceError(
              'Initiative policy graph is not currently available.'
            )
          }
        })
    )
  )
  const resolvedById = new Map(
    pins.map((pin) => {
      const current = currentById.get(pin.definitionId)
      if (!current)
        throw new InitiativePolicySourceError('Initiative policy graph is not currently available.')
      return [
        pin.definitionId,
        requireExactGraph({ current, gameSystemId: input.gameSystemId, pin })
      ]
    })
  )
  const evaluationGraph = resolvedById.get(policyDocument.evaluationGraph.definitionId)
  const orderChoiceGraph = resolvedById.get(policyDocument.orderChoiceGraph.definitionId)
  const selectedTie = resolvedById.get(selectedTieDefinitionId)
  if (!evaluationGraph || !orderChoiceGraph || !selectedTie) {
    throw new InitiativePolicySourceError('Initiative policy graph is not currently available.')
  }
  return {
    policy,
    policyDocument,
    evaluationGraph,
    orderChoiceGraph,
    tieResolvers: resolvedById,
    selectedTie,
    selectedTieResolver,
    contentSourceIds: [
      ...new Set([
        policy.contentSourceId,
        ...[...resolvedById.values()].map(({ current }) => current.contentSourceId)
      ])
    ].sort((left, right) => left.localeCompare(right))
  }
}

export async function resolveEffectiveInitiativePolicySources(input: {
  definitions: CurrentReusableDefinitionSource
  readSystem: (gameSystemId: string) => Promise<unknown>
  gameSystemId: string
  configuredPolicyDefinitionId: string | null
  configuredTieDefinitionId: string | null
}) {
  let policyDefinitionId = input.configuredPolicyDefinitionId
  if (policyDefinitionId === null) {
    const parsedSystem = systemAuthoredDtoSchema.safeParse(
      await input.readSystem(input.gameSystemId)
    )
    if (!parsedSystem.success)
      throw new InitiativePolicySourceError('Encounter Game System is not currently available.')
    if ('schemaVersion' in parsedSystem.data && parsedSystem.data.schemaVersion === 3) {
      policyDefinitionId = parsedSystem.data.initiativePolicy.defaultDefinitionId
    } else if (
      'schemaVersion' in parsedSystem.data &&
      parsedSystem.data.schemaVersion === 4 &&
      parsedSystem.data.initiativePolicy !== undefined
    ) {
      policyDefinitionId = parsedSystem.data.initiativePolicy.defaultDefinitionId
    }
  }
  return policyDefinitionId === null
    ? null
    : resolveCurrentInitiativePolicySources({
        definitions: input.definitions,
        gameSystemId: input.gameSystemId,
        policyDefinitionId,
        selectedTieDefinitionId: input.configuredTieDefinitionId
      })
}
