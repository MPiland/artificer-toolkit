import type {
  AssembledCharacterFeature,
  AssembledCharacterModifierGrant,
  AssembledCharacterResource,
  AssembledCharacterSpellAccess,
  AssembledCharacterSnapshot,
  AssemblerCharacterInput,
  CompileToAssembleContract,
  CompiledCharacter
} from '@artificer-toolkit/shared'
import {
  buildAssemblerCharacterInput,
  buildCompileToAssembleContract
} from '@artificer-toolkit/shared'

import type { CharacterAssemblyRegistry } from './types.js'

export type CharacterAssemblyInput = AssemblerCharacterInput
export type ResolvedCharacterState = AssembledCharacterSnapshot

export function buildCharacterAssemblyInput(
  compiledCharacter: CompiledCharacter
): CharacterAssemblyInput {
  return buildAssemblerCharacterInput(compiledCharacter)
}

export function buildCharacterCompileToAssembleContract(
  compiledCharacter: CompiledCharacter
): CompileToAssembleContract {
  return buildCompileToAssembleContract(compiledCharacter)
}

export function resolveCharacterState(
  input: CharacterAssemblyInput,
  registry: CharacterAssemblyRegistry
): ResolvedCharacterState {
  const features: AssembledCharacterFeature[] = input.intent.featureAcquisitions.map((acquisition) => ({
    id: acquisition.id,
    featureId: acquisition.featureId,
    source: acquisition.source,
    timing: acquisition.timing,
    selections: acquisition.selections
  }))

  const resources: AssembledCharacterResource[] = (input.intent.resourceGrants ?? []).map((grant) => ({
    id: grant.id,
    resourceId: grant.resourceId,
    source: grant.source,
    timing: grant.timing
  }))

  const spellAccess: AssembledCharacterSpellAccess[] = []
  for (const selection of input.intent.spellSelections ?? []) {
    for (const spellId of selection.spells) {
      spellAccess.push({
        id: `${selection.id}:${spellId}`,
        spellId,
        source: selection.source,
        timing: selection.timing
      })
    }
  }

  const modifierGrants: AssembledCharacterModifierGrant[] = []
  for (const featureInstance of features) {
    const systemFeature = registry.features[featureInstance.featureId]
    if (!systemFeature?.modifiers?.length) continue

    for (const grant of systemFeature.modifiers) {
      modifierGrants.push({
        id: `${featureInstance.id}:modifier:${grant.id}`,
        source: featureInstance.source,
        timing: featureInstance.timing,
        grant
      })
    }
  }

  return {
    characterId: input.characterId,
    systemId: input.systemId,
    userId: input.userId,
    label: input.label,
    description: input.description,
    profile: input.profile,
    intent: input.intent,
    state: input.state,
    features,
    resources,
    spellAccess,
    modifierGrants
  }
}
