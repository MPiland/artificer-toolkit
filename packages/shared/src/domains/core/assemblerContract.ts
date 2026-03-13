import type {
  CharacterAcquisitionTiming,
  CharacterFeatureSelectionRecord,
  CharacterFeatureSource,
  CharacterResourceGrantSource,
  CharacterSpellSelectionSource
} from '#authored'
import type {
  CompiledCharacter,
  CompiledCharacterIntent,
  CompiledCharacterState,
  CompiledModifierGrant
} from '#compilers'

/**
 * Phase 2 compile -> assemble -> engine contract
 *
 * These types define the handoff boundaries between:
 * 1. compiler output
 * 2. application/service assembly
 * 3. runtime engine evaluation
 *
 * Keep this contract explicit so later phases do not invent ad hoc
 * intermediate payloads between compiled character data and the engine.
 */

export interface CompileToAssembleContract {
  compiledCharacter: CompiledCharacter
  compiledIntent: CompiledCharacterIntent
  compiledState: CompiledCharacterState
}

export interface AssemblerCharacterInput {
  characterId: string
  systemId: string
  userId: string
  label: string
  description?: string
  intent: CompiledCharacterIntent
  state: CompiledCharacterState
}

/**
 * A feature that exists on the character right now.
 */
export interface AssembledCharacterFeature {
  id: string
  featureId: string
  source: CharacterFeatureSource
  timing: CharacterAcquisitionTiming
  selections?: CharacterFeatureSelectionRecord[]
}

export interface AssembledCharacterResource {
  id: string
  resourceId: string
  source: CharacterResourceGrantSource
  timing: CharacterAcquisitionTiming
}

export interface AssembledCharacterSpellAccess {
  id: string
  spellId: string
  source: CharacterSpellSelectionSource
  timing: CharacterAcquisitionTiming
}

export interface AssembledCharacterModifierGrant {
  id: string
  source: CharacterFeatureSource
  timing: CharacterAcquisitionTiming
  grant: CompiledModifierGrant
}

export interface AssembledCharacterSnapshot {
  characterId: string
  systemId: string
  userId: string
  label: string
  description?: string
  intent: CompiledCharacterIntent
  state: CompiledCharacterState
  features: AssembledCharacterFeature[]
  resources: AssembledCharacterResource[]
  spellAccess: AssembledCharacterSpellAccess[]
  modifierGrants: AssembledCharacterModifierGrant[]
}

/**
 * The engine consumes assembled runtime state plus mutable character state.
 * Keep engine input narrow and deterministic.
 */
export interface EngineCharacterInput {
  assembled: AssembledCharacterSnapshot
  state: CompiledCharacterState
}

export function buildAssemblerCharacterInput(
  compiledCharacter: CompiledCharacter
): AssemblerCharacterInput {
  return {
    characterId: compiledCharacter.id,
    systemId: compiledCharacter.systemId,
    userId: compiledCharacter.userId,
    label: compiledCharacter.label,
    description: compiledCharacter.description,
    intent: compiledCharacter.intent,
    state: compiledCharacter.state
  }
}

export function buildCompileToAssembleContract(
  compiledCharacter: CompiledCharacter
): CompileToAssembleContract {
  return {
    compiledCharacter,
    compiledIntent: compiledCharacter.intent,
    compiledState: compiledCharacter.state
  }
}

export function buildEngineCharacterInput(
  assembled: AssembledCharacterSnapshot
): EngineCharacterInput {
  return {
    assembled,
    state: assembled.state
  }
}
