import type { InitiativeDeclarationFactsDto } from '@artificer-toolkit/schema/shared/initiativeState'
import type { ServerInitiativeDeclarationRequestDto } from '@artificer-toolkit/schema/shared/rulesExecution'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import {
  assertEncounterFeatureActionCapabilityCurrent,
  type EncounterFeatureActionCapabilityDescriptor
} from '../rules/encounterFeatureActionCapabilityDiscovery.js'
import { discoverEncounterFeatureActionCapabilities } from '../rules/encounterFeatureActionCapabilityDiscoveryRegistry.js'
import type {
  LockedEncounterInitiativeActorSource,
  LockedEncounterInitiativeCharacterSource
} from './encounterInitiativeFactSources.js'
import { EncounterConflictError, EncounterValidationError } from './encounterErrors.js'

export type InitiativeDeclarationSelection =
  | { kind: 'CHARACTER_ACTION'; optionId: string }
  | { kind: 'CHARACTER_SPELL_CAST'; optionId: string }
  | { kind: 'CREATURE_FEATURE_ACTION'; optionId: string }
  | {
      kind: 'GM_ADJUDICATED'
      optionId: 'GM_ADJUDICATED'
      actorSize: string
      actionFactors: readonly (
        | 'MELEE_HEAVY'
        | 'MELEE_LIGHT_OR_FINESSE'
        | 'MELEE_TWO_HANDED'
        | 'RANGED_LOADING'
      )[]
      spellLevel: number | null
    }

type DeclarationOption = ServerInitiativeDeclarationRequestDto['primaryOptions'][number]
type CharacterActionEntry =
  LockedEncounterInitiativeCharacterSource['mechanics']['compiledActionEntryPoints'][number]

function publishedActionDefinition(entry: CharacterActionEntry) {
  if (entry.compilation.kind !== 'COMPILED') {
    throw new EncounterValidationError('The declared Character action is not executable.')
  }
  if (entry.schemaVersion === 4) {
    return entry.compilation.executionPlan.kind === 'SINGLE_GRAPH'
      ? entry.compilation.executionPlan.published
      : entry.compilation.executionPlan.test.published
  }
  return entry.compilation.published
}

function featureOptions(
  source: Extract<LockedEncounterInitiativeActorSource, { kind: 'CREATURE' }>
): {
  primaryOptions: DeclarationOption[]
  bonusOptions: DeclarationOption[]
  sourceOptionsChecksum: string
} {
  const capabilities = discoverEncounterFeatureActionCapabilities({ actor: source.actor })
  const primaryOptions = capabilities
    .map((capability) => ({
      kind: 'CREATURE_FEATURE_ACTION' as const,
      optionId: capability.actionId,
      label: 'Feature action',
      selectionContract: checksumRuleDocument({
        kind: 'CREATURE_FEATURE_ACTION',
        actionId: capability.actionId,
        creatureSourceId: capability.creatureSourceId,
        sourceRevision: capability.sourceRevision,
        sourceVersionId: capability.sourceVersionId,
        sourceChecksum: capability.sourceChecksum,
        compiledEffectChecksum: capability.compiledEffectChecksum
      })
    }))
    .sort((left, right) => left.optionId.localeCompare(right.optionId))
  if (primaryOptions.length === 0) {
    throw new EncounterValidationError('The Creature has no exact initiative declaration options.')
  }
  return {
    primaryOptions,
    bonusOptions: [],
    sourceOptionsChecksum: checksumRuleDocument({ primaryOptions, bonusOptions: [] })
  }
}

function customOptions(source: Extract<LockedEncounterInitiativeActorSource, { kind: 'CUSTOM' }>): {
  primaryOptions: DeclarationOption[]
  bonusOptions: DeclarationOption[]
  sourceOptionsChecksum: string
} {
  const primaryOptions: DeclarationOption[] = [
    {
      kind: 'GM_ADJUDICATED',
      optionId: 'GM_ADJUDICATED',
      label: 'GM adjudication',
      selectionContract: checksumRuleDocument({ kind: 'GM_ADJUDICATED', actorId: source.actor.id })
    }
  ]
  return {
    primaryOptions,
    bonusOptions: [],
    sourceOptionsChecksum: checksumRuleDocument({ primaryOptions, bonusOptions: [] })
  }
}

function declarationOptions(source: LockedEncounterInitiativeActorSource): {
  primaryOptions: DeclarationOption[]
  bonusOptions: DeclarationOption[]
  sourceOptionsChecksum: string
} {
  if (source.kind === 'CREATURE') return featureOptions(source)
  if (source.kind === 'CUSTOM') return customOptions(source)
  const options: Array<DeclarationOption & { bonus: boolean }> = []
  for (const candidate of source.mechanics.rulePolicyInput.actionCandidates) {
    const entry = source.mechanics.compiledActionEntryPoints.find(
      (value) => value.actionId === candidate.actionId
    )
    if (!entry || entry.compilation.kind !== 'COMPILED') continue
    const activationCode = candidate.mechanicFacts.invocation.activation?.code ?? null
    options.push({
      kind: 'CHARACTER_ACTION',
      optionId: candidate.actionId,
      label: activationCode === 'BONUS_ACTION' ? 'Bonus action' : 'Action',
      selectionContract: checksumRuleDocument({
        kind: 'CHARACTER_ACTION',
        optionId: candidate.actionId,
        sourceChecksum: publishedActionDefinition(entry).checksum,
        activationCode
      }),
      bonus: activationCode === 'BONUS_ACTION'
    })
  }
  for (const candidate of source.mechanics.rulePolicyInput.spellCastCandidates) {
    const mechanic = source.mechanics.rulePolicyOutput.spellCastMechanics.find(
      (value) => value.candidateId === candidate.candidateId
    )
    if (!mechanic) continue
    options.push({
      kind: 'CHARACTER_SPELL_CAST',
      optionId: candidate.candidateId,
      label: 'Spell cast',
      selectionContract: checksumRuleDocument({
        kind: 'CHARACTER_SPELL_CAST',
        optionId: candidate.candidateId,
        spellId: candidate.spellId,
        castLevel: candidate.castLevel
      }),
      bonus: false
    })
  }
  const canonical = options.sort((left, right) => left.optionId.localeCompare(right.optionId))
  const primaryOptions = canonical.map(({ bonus: _bonus, ...option }) => option)
  const bonusOptions = canonical
    .filter((option) => option.bonus)
    .map(({ bonus: _bonus, ...option }) => option)
  if (primaryOptions.length === 0)
    throw new EncounterValidationError('The Character has no exact initiative declaration options.')
  return {
    primaryOptions,
    bonusOptions,
    sourceOptionsChecksum: checksumRuleDocument({ primaryOptions, bonusOptions })
  }
}

/** Builds the sanitized, exact option set sealed in the aggregate choice. */
export function createEncounterInitiativeDeclarationRequest(input: {
  requestId: string
  encounterId: string
  round: number
  actorId: string
  participantExpectedVersion: number
  controllerUserId: string | null
  source: LockedEncounterInitiativeActorSource
}): ServerInitiativeDeclarationRequestDto {
  const options = declarationOptions(input.source)
  return {
    requestId: input.requestId,
    kind: 'INITIATIVE_DECLARATION',
    encounterId: input.encounterId,
    round: input.round,
    actorId: input.actorId,
    participantExpectedVersion: input.participantExpectedVersion,
    primaryOptions: options.primaryOptions,
    bonusOptions: options.bonusOptions,
    controllerUserId: input.controllerUserId,
    sourceOptionsChecksum: options.sourceOptionsChecksum
  }
}

function spellVersion(
  source: Extract<LockedEncounterInitiativeActorSource, { kind: 'CHARACTER' }>,
  spellId: string
) {
  const matches = source.mechanics.authoredVersionVector.filter(
    (entry) => entry.subjectKind === 'SPELL' && entry.subjectId === spellId
  )
  if (matches.length !== 1) {
    throw new EncounterValidationError(
      'The declared spell lacks one exact pinned authored version.'
    )
  }
  return matches[0]!
}

function compileCharacterOne(input: {
  source: Extract<LockedEncounterInitiativeActorSource, { kind: 'CHARACTER' }>
  selection: InitiativeDeclarationSelection
}): Extract<
  InitiativeDeclarationFactsDto['primary'],
  { kind: 'CHARACTER_ACTION' | 'CHARACTER_SPELL_CAST' }
> {
  if (input.selection.kind === 'CHARACTER_ACTION') {
    const candidate = input.source.mechanics.rulePolicyInput.actionCandidates.find(
      (value) => value.actionId === input.selection.optionId
    )
    const entry = input.source.mechanics.compiledActionEntryPoints.find(
      (value) => value.actionId === input.selection.optionId
    )
    if (!candidate || !entry || entry.compilation.kind !== 'COMPILED') {
      throw new EncounterValidationError(
        'The declared Character action is not an exact executable option.'
      )
    }
    const item = candidate.equipment
      ? input.source.mechanics.initiativeActorFacts.equippedItems.find(
          (value) => value.itemInstanceId === candidate.equipment!.itemInstanceId
        )
      : null
    if (candidate.equipment && !item) {
      throw new EncounterConflictError('The declared Character action equipment facts are stale.')
    }
    return {
      kind: 'CHARACTER_ACTION',
      optionId: candidate.actionId,
      effectId: candidate.effectId,
      sourceId: candidate.sourceId,
      sourceChecksum: publishedActionDefinition(entry).checksum,
      activationCode: candidate.mechanicFacts.invocation.activation?.code ?? null,
      equipmentInstanceId: item?.itemInstanceId ?? null,
      equipmentProperties: item?.properties ?? []
    }
  }
  const candidate = input.source.mechanics.rulePolicyInput.spellCastCandidates.find(
    (value) => value.candidateId === input.selection.optionId
  )
  const mechanic = input.source.mechanics.rulePolicyOutput.spellCastMechanics.find(
    (value) => value.candidateId === input.selection.optionId
  )
  if (!candidate || !mechanic || mechanic.spellId !== candidate.spellId) {
    throw new EncounterValidationError('The declared spell cast is not an exact current option.')
  }
  const version = spellVersion(input.source, candidate.spellId)
  return {
    kind: 'CHARACTER_SPELL_CAST',
    optionId: candidate.candidateId,
    spellId: candidate.spellId,
    spellVersionId: version.versionId,
    spellVersion: version.version,
    spellChecksum: version.checksum,
    sourceKind: candidate.source.sourceKind,
    sourceInstanceId: candidate.source.sourceInstanceId,
    castLevel: candidate.castLevel
  }
}

function creatureSize(
  source: Extract<LockedEncounterInitiativeActorSource, { kind: 'CREATURE' }>
): string {
  const snapshot = source.actor.snapshot
  if (typeof snapshot !== 'object' || snapshot === null || Array.isArray(snapshot)) {
    throw new EncounterConflictError('Creature initiative source is stale.')
  }
  const payload = (snapshot as Record<string, unknown>).payload
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    throw new EncounterConflictError('Creature initiative source is stale.')
  }
  const size = (payload as Record<string, unknown>).size
  if (typeof size !== 'string')
    throw new EncounterConflictError('Creature initiative size is unavailable.')
  return size
}

function currentCreatureCapability(input: {
  source: Extract<LockedEncounterInitiativeActorSource, { kind: 'CREATURE' }>
  optionId: string
}): EncounterFeatureActionCapabilityDescriptor {
  const capability = discoverEncounterFeatureActionCapabilities({ actor: input.source.actor }).find(
    (candidate) => candidate.actionId === input.optionId
  )
  if (!capability) throw new EncounterConflictError('The declared Creature action is unavailable.')
  assertEncounterFeatureActionCapabilityCurrent({ actor: input.source.actor, capability })
  return capability
}

function compileCreatureOne(input: {
  source: Extract<LockedEncounterInitiativeActorSource, { kind: 'CREATURE' }>
  selection: InitiativeDeclarationSelection
}): Extract<InitiativeDeclarationFactsDto['primary'], { kind: 'CREATURE_FEATURE_ACTION' }> {
  if (input.selection.kind !== 'CREATURE_FEATURE_ACTION') {
    throw new EncounterValidationError(
      'Creature initiative declarations require an immutable Feature action.'
    )
  }
  const capability = currentCreatureCapability({
    source: input.source,
    optionId: input.selection.optionId
  })
  return {
    kind: 'CREATURE_FEATURE_ACTION',
    optionId: capability.actionId,
    actorId: input.source.actor.id,
    creatureSourceId: capability.creatureSourceId,
    sourceRevision: capability.sourceRevision,
    sourceVersionId: capability.sourceVersionId,
    sourceChecksum: capability.sourceChecksum,
    ownerFeatureId: capability.ownerFeatureId,
    featureOptionId: capability.featureOptionId,
    effectId: capability.effectId,
    compiledEffectChecksum: capability.compiledEffectChecksum,
    activationCode: capability.mechanicFacts.invocation.activation?.code ?? null,
    featureResourceUse: capability.featureResourceUse
  }
}

function compileCustomOne(input: {
  source: Extract<LockedEncounterInitiativeActorSource, { kind: 'CUSTOM' }>
  selection: InitiativeDeclarationSelection
}): Extract<InitiativeDeclarationFactsDto['primary'], { kind: 'GM_ADJUDICATED' }> {
  if (input.selection.kind !== 'GM_ADJUDICATED') {
    throw new EncounterValidationError('Custom initiative declarations require GM adjudication.')
  }
  return {
    kind: 'GM_ADJUDICATED',
    optionId: 'GM_ADJUDICATED',
    actorId: input.source.actor.id,
    actionFactors: [...input.selection.actionFactors].sort(),
    spellLevel: input.selection.spellLevel
  }
}

/** Compiles a controller choice into the exact locked facts consumed by System policy. */
export function compileEncounterInitiativeDeclaration(input: {
  source: LockedEncounterInitiativeActorSource
  primary: InitiativeDeclarationSelection
  bonus: InitiativeDeclarationSelection | null
}): { declaration: InitiativeDeclarationFactsDto; checksum: string } {
  const size =
    input.source.kind === 'CHARACTER'
      ? input.source.mechanics.initiativeActorFacts.effectiveSize
      : input.source.kind === 'CREATURE'
        ? creatureSize(input.source)
        : input.primary.kind === 'GM_ADJUDICATED'
          ? input.primary.actorSize
          : null
  if (!size)
    throw new EncounterValidationError(
      'The initiative source lacks an authoritative effective size.'
    )
  const compile = (selection: InitiativeDeclarationSelection) => {
    if (input.source.kind === 'CHARACTER')
      return compileCharacterOne({ source: input.source, selection })
    if (input.source.kind === 'CREATURE')
      return compileCreatureOne({ source: input.source, selection })
    return compileCustomOne({ source: input.source, selection })
  }
  const declaration = {
    actorSize: size,
    primary: compile(input.primary),
    bonus: input.bonus ? compile(input.bonus) : null
  }
  if (
    declaration.bonus?.kind === declaration.primary.kind &&
    declaration.bonus.optionId === declaration.primary.optionId
  ) {
    throw new EncounterValidationError(
      'The declared bonus source must differ from the primary source.'
    )
  }
  return { declaration, checksum: checksumRuleDocument(declaration) }
}
