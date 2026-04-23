import type { CharacterProfileAuthored } from '#authored'

export type CompiledCharacterProfile = CharacterProfileAuthored

export function compileCharacterProfile(
  authored: CharacterProfileAuthored
): CompiledCharacterProfile {
  return {
    ...authored
  }
}
