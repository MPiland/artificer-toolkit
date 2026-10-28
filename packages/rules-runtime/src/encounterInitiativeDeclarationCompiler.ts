import type { CompiledSpell } from '@artificer-toolkit/shared/subjects/compilers'
import type {
  CharacterRulePolicyInput,
  CharacterRulePolicyOutput
} from '@artificer-toolkit/schema/api/characterRules'
import type {
  CompiledActionEntryPoint,
  CharacterInitiativeActorFacts
} from '@artificer-toolkit/schema/projections/characterMechanics'
import type { AuthoredVersionVector } from '@artificer-toolkit/schema/projections/identity'
import type { InitiativeDeclarationModifiersDto } from '@artificer-toolkit/schema/shared/initiativePolicy'
import type { InitiativeDeclarationFactsDto } from '@artificer-toolkit/schema/shared/initiativeState'
import type { ServerInitiativeDeclarationRequestDto } from '@artificer-toolkit/schema/shared/rulesExecution'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { EncounterConflictError, EncounterValidationError } from './encounterErrors.js'
import { assertEncounterFeatureActionCapabilityCurrent } from './encounterFeatureActionCapabilityDiscovery.js'
import { discoverEncounterFeatureActionCapabilities } from './encounterFeatureActionCapabilityDiscoveryRegistry.js'

type InitiativeDeclarationSelection =
  | { kind: 'CHARACTER_ACTION'; optionId: string }
  | { kind: 'CHARACTER_SPELL_CAST'; optionId: string }
  | { kind: 'CREATURE_FEATURE_ACTION'; optionId: string }
  | {
      kind: 'GM_ADJUDICATED'
      optionId: 'GM_ADJUDICATED'
      actorSize: string
      factorIds: readonly string[]
      spellLevel: number | null
    }

type Actor = Parameters<typeof discoverEncounterFeatureActionCapabilities>[0]['actor']
type CreatureSystem = {
  conditionTypes: readonly { id: string }[]
  abilities?: readonly { id: string; code: string }[]
}
export type InitiativeDeclarationSource =
  | {
      kind: 'CHARACTER'
      actor: Actor
      mechanics: {
        rulePolicyInput: Pick<CharacterRulePolicyInput, 'actionCandidates' | 'spellCastCandidates'>
        rulePolicyOutput: Pick<CharacterRulePolicyOutput, 'spellCastMechanics'>
        compiledActionEntryPoints: readonly CompiledActionEntryPoint[]
        initiativeActorFacts: CharacterInitiativeActorFacts
        authoredVersionVector: AuthoredVersionVector
      }
    }
  | {
      kind: 'CREATURE'
      actor: Actor
      system?: CreatureSystem
      /** The Run's pinned Spells (D163). */
      spells: ReadonlyMap<string, CompiledSpell>
    }
  | { kind: 'CUSTOM'; actor: Pick<Actor, 'id'> }

type Option = ServerInitiativeDeclarationRequestDto['primaryOptions'][number]
function creatureCapabilities(source: Extract<InitiativeDeclarationSource, { kind: 'CREATURE' }>) {
  return discoverEncounterFeatureActionCapabilities({
    actor: source.actor,
    conditionDefinitionIds: source.system?.conditionTypes.map((condition) => condition.id),
    abilityDefinitions: source.system?.abilities,
    spells: source.spells
  })
}
function publishedChecksum(entry: CompiledActionEntryPoint): string {
  if (entry.compilation.kind !== 'COMPILED')
    throw new EncounterValidationError('The declared Character action is not executable.')
  return (
    entry.compilation.executionPlan.kind === 'SINGLE_GRAPH'
      ? entry.compilation.executionPlan.published
      : entry.compilation.executionPlan.test.published
  ).checksum
}

/**
 * Equipment facts a Character action declaration binds, or null when they
 * cannot be bound. A carried weapon is treated as drawn: only actions whose own
 * facts require equipping need the item in the projection's equipped set.
 * Candidates are derived from the Character's current inventory, so a removed
 * item has no candidate and is refused by the caller's candidate lookup.
 */
function declaredEquipment(
  source: Extract<InitiativeDeclarationSource, { kind: 'CHARACTER' }>,
  equipment: NonNullable<CharacterRulePolicyInput['actionCandidates']>[number]['equipment']
): { itemInstanceId: string | null; properties: string[] } | null {
  if (!equipment) return { itemInstanceId: null, properties: [] }
  const equipped = source.mechanics.initiativeActorFacts.equippedItems.find(
    (value) => value.itemInstanceId === equipment.itemInstanceId
  )
  if (equipped) return { itemInstanceId: equipped.itemInstanceId, properties: equipped.properties }
  if (equipment.requiresEquipped) return null
  return {
    itemInstanceId: equipment.itemInstanceId,
    properties: [...new Set(equipment.properties ?? [])].sort()
  }
}

function spellVersion(
  source: Extract<InitiativeDeclarationSource, { kind: 'CHARACTER' }>,
  spellId: string
) {
  const matches = source.mechanics.authoredVersionVector.filter(
    (entry) => entry.subjectKind === 'SPELL' && entry.subjectId === spellId
  )
  if (matches.length !== 1)
    throw new EncounterValidationError(
      'The declared spell lacks one exact pinned authored version.'
    )
  return matches[0]!
}
function options(
  source: InitiativeDeclarationSource,
  declarationModifiers: InitiativeDeclarationModifiersDto
) {
  if (source.kind === 'CUSTOM') {
    const primaryOptions: Option[] = [
      {
        kind: 'GM_ADJUDICATED',
        optionId: 'GM_ADJUDICATED',
        label: 'GM adjudication',
        selectionContract: checksumRuleDocument({
          kind: 'GM_ADJUDICATED',
          actorId: source.actor.id
        })
      }
    ]
    const adjudicationFields: ServerInitiativeDeclarationRequestDto['adjudicationFields'] = [
      {
        kind: 'SELECT',
        key: 'actorSize',
        label: 'Actor size',
        required: true,
        options: declarationModifiers.sizes.map(({ size }) => ({
          value: size,
          label: size.charAt(0) + size.slice(1).toLowerCase()
        }))
      },
      {
        kind: 'MULTI_SELECT',
        key: 'factorIds',
        label: 'Action factors',
        minimumSelections: 0,
        maximumSelections: declarationModifiers.factors.length,
        options: declarationModifiers.factors.map((factor) => ({
          value: factor.id,
          label: factor.label
        }))
      },
      { kind: 'NULLABLE_INTEGER', key: 'spellLevel', label: 'Spell level', minimum: 0, maximum: 99 }
    ]
    return {
      primaryOptions,
      bonusOptions: [],
      adjudicationFields,
      sourceOptionsChecksum: checksumRuleDocument({
        primaryOptions,
        bonusOptions: [],
        adjudicationFields
      })
    }
  }
  if (source.kind === 'CREATURE') {
    const primaryOptions = creatureCapabilities(source)
      .map((capability) => ({
        kind: 'CREATURE_FEATURE_ACTION' as const,
        optionId: capability.actionId,
        label: capability.label ?? 'Feature action',
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
      .sort((a, b) => a.optionId.localeCompare(b.optionId))
    if (!primaryOptions.length)
      throw new EncounterValidationError(
        'The Creature has no exact initiative declaration options.'
      )
    return {
      primaryOptions,
      bonusOptions: [],
      adjudicationFields: [],
      sourceOptionsChecksum: checksumRuleDocument({
        primaryOptions,
        bonusOptions: [],
        adjudicationFields: []
      })
    }
  }
  const choices: Array<Option & { bonus: boolean }> = []
  for (const candidate of source.mechanics.rulePolicyInput.actionCandidates) {
    const entry = source.mechanics.compiledActionEntryPoints.find(
      (value) => value.actionId === candidate.actionId
    )
    if (
      !entry ||
      entry.compilation.kind !== 'COMPILED' ||
      declaredEquipment(source, candidate.equipment) === null
    )
      continue
    const activationCode = candidate.mechanicFacts.invocation.activation?.code ?? null
    choices.push({
      kind: 'CHARACTER_ACTION',
      optionId: candidate.actionId,
      label: candidate.label,
      selectionContract: checksumRuleDocument({
        kind: 'CHARACTER_ACTION',
        optionId: candidate.actionId,
        sourceChecksum: publishedChecksum(entry),
        activationCode
      }),
      bonus: activationCode === 'BONUS_ACTION'
    })
  }
  for (const candidate of source.mechanics.rulePolicyInput.spellCastCandidates) {
    if (
      !source.mechanics.rulePolicyOutput.spellCastMechanics.some(
        (value) => value.candidateId === candidate.candidateId
      )
    )
      continue
    const version = spellVersion(source, candidate.spellId)
    choices.push({
      kind: 'CHARACTER_SPELL_CAST',
      optionId: candidate.candidateId,
      label: candidate.label ?? 'Spell cast',
      selectionContract: checksumRuleDocument({
        kind: 'CHARACTER_SPELL_CAST',
        optionId: candidate.candidateId,
        spellId: candidate.spellId,
        castLevel: candidate.castLevel,
        spellVersionId: version.versionId,
        spellVersion: version.version,
        spellChecksum: version.checksum
      }),
      bonus: false
    })
  }
  choices.sort((a, b) => a.optionId.localeCompare(b.optionId))
  const primaryOptions = choices.map(({ bonus: _bonus, ...choice }) => choice)
  const bonusOptions = choices
    .filter((choice) => choice.bonus)
    .map(({ bonus: _bonus, ...choice }) => choice)
  if (!primaryOptions.length)
    throw new EncounterValidationError('The Character has no exact initiative declaration options.')
  return {
    primaryOptions,
    bonusOptions,
    adjudicationFields: [],
    sourceOptionsChecksum: checksumRuleDocument({
      primaryOptions,
      bonusOptions,
      adjudicationFields: []
    })
  }
}
export function createEncounterInitiativeDeclarationRequest(input: {
  requestId: string
  encounterId: string
  round: number
  actorId: string
  participantExpectedVersion: number
  controllerUserId: string | null
  source: InitiativeDeclarationSource
  /** The frozen declared-action policy's authored modifiers; GM adjudication offers their sizes and factors. */
  declarationModifiers: InitiativeDeclarationModifiersDto
}): ServerInitiativeDeclarationRequestDto {
  return {
    requestId: input.requestId,
    kind: 'INITIATIVE_DECLARATION',
    encounterId: input.encounterId,
    round: input.round,
    actorId: input.actorId,
    participantExpectedVersion: input.participantExpectedVersion,
    controllerUserId: input.controllerUserId,
    ...options(input.source, input.declarationModifiers)
  }
}
export function compileEncounterInitiativeDeclaration(input: {
  source: InitiativeDeclarationSource
  declarationModifiers: InitiativeDeclarationModifiersDto
  primary: InitiativeDeclarationSelection
  bonus: InitiativeDeclarationSelection | null
}): { declaration: InitiativeDeclarationFactsDto; checksum: string } {
  const compile = (
    selection: InitiativeDeclarationSelection
  ): InitiativeDeclarationFactsDto['primary'] => {
    if (input.source.kind === 'CUSTOM') {
      if (selection.kind !== 'GM_ADJUDICATED')
        throw new EncounterValidationError(
          'Custom initiative declarations require GM adjudication.'
        )
      if (
        selection.factorIds.some(
          (id) => !input.declarationModifiers.factors.some((factor) => factor.id === id)
        )
      )
        throw new EncounterValidationError('The adjudicated action factor is not authored.')
      return {
        kind: 'GM_ADJUDICATED',
        optionId: 'GM_ADJUDICATED',
        actorId: input.source.actor.id,
        factorIds: [...selection.factorIds].sort(),
        spellLevel: selection.spellLevel
      }
    }
    if (input.source.kind === 'CREATURE') {
      if (selection.kind !== 'CREATURE_FEATURE_ACTION')
        throw new EncounterValidationError(
          'Creature initiative declarations require an immutable Feature action.'
        )
      const capability = creatureCapabilities(input.source).find(
        (value) => value.actionId === selection.optionId
      )
      if (!capability)
        throw new EncounterConflictError('The declared Creature action is unavailable.')
      assertEncounterFeatureActionCapabilityCurrent({
        actor: input.source.actor,
        capability,
        spells: input.source.spells
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
    if (selection.kind === 'CHARACTER_ACTION') {
      const candidate = input.source.mechanics.rulePolicyInput.actionCandidates.find(
        (value) => value.actionId === selection.optionId
      )
      const entry = input.source.mechanics.compiledActionEntryPoints.find(
        (value) => value.actionId === selection.optionId
      )
      if (!candidate || !entry || entry.compilation.kind !== 'COMPILED')
        throw new EncounterValidationError(
          'The declared Character action is not an exact executable option.'
        )
      const equipment = declaredEquipment(input.source, candidate.equipment)
      if (!equipment)
        throw new EncounterConflictError(
          'The declared Character action requires equipped equipment.'
        )
      return {
        kind: 'CHARACTER_ACTION',
        optionId: candidate.actionId,
        effectId: candidate.effectId,
        sourceId: candidate.sourceId,
        sourceChecksum: publishedChecksum(entry),
        activationCode: candidate.mechanicFacts.invocation.activation?.code ?? null,
        equipmentInstanceId: equipment.itemInstanceId,
        equipmentProperties: equipment.properties
      }
    }
    if (selection.kind !== 'CHARACTER_SPELL_CAST')
      throw new EncounterValidationError('Character initiative declaration source is invalid.')
    const candidate = input.source.mechanics.rulePolicyInput.spellCastCandidates.find(
      (value) => value.candidateId === selection.optionId
    )
    const mechanic = input.source.mechanics.rulePolicyOutput.spellCastMechanics.find(
      (value) => value.candidateId === selection.optionId
    )
    if (!candidate || !mechanic || mechanic.spellId !== candidate.spellId)
      throw new EncounterValidationError('The declared spell cast is not an exact current option.')
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
  const size =
    input.source.kind === 'CHARACTER'
      ? input.source.mechanics.initiativeActorFacts.effectiveSize
      : input.source.kind === 'CREATURE'
        ? (() => {
            const snapshot = input.source.actor.snapshot
            if (typeof snapshot !== 'object' || snapshot === null || Array.isArray(snapshot))
              throw new EncounterConflictError('Creature initiative source is stale.')
            const payload = (snapshot as Record<string, unknown>).payload
            if (typeof payload !== 'object' || payload === null || Array.isArray(payload))
              throw new EncounterConflictError('Creature initiative source is stale.')
            const value = (payload as Record<string, unknown>).size
            if (typeof value !== 'string')
              throw new EncounterConflictError('Creature initiative size is unavailable.')
            return value
          })()
        : input.primary.kind === 'GM_ADJUDICATED'
          ? input.primary.actorSize
          : null
  if (!size)
    throw new EncounterValidationError(
      'The initiative source lacks an authoritative effective size.'
    )
  if (
    input.source.kind === 'CUSTOM' &&
    !input.declarationModifiers.sizes.some((entry) => entry.size === size)
  )
    throw new EncounterValidationError('The adjudicated actor size is not authored.')
  const declaration = {
    actorSize: size,
    primary: compile(input.primary),
    bonus: input.bonus ? compile(input.bonus) : null
  }
  if (
    declaration.bonus?.kind === declaration.primary.kind &&
    declaration.bonus.optionId === declaration.primary.optionId
  )
    throw new EncounterValidationError(
      'The declared bonus source must differ from the primary source.'
    )
  return { declaration, checksum: checksumRuleDocument(declaration) }
}
