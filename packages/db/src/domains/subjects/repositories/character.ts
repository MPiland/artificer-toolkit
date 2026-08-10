import type { DBLike } from '#types'
import { upsertCharacter } from '../upserts/character.js'
import { createCharacterReadRepository, type CharacterRepository } from './characterRead.js'
import { patchCharacterSheetState } from './characterSheetState.js'

export {
  ConcurrencyError,
  type CharacterRow,
  type CharacterSheetStatePatch
} from './characterRead.js'
export type { CharacterRepository } from './characterRead.js'

export function createCharacterRepository(db: DBLike): CharacterRepository {
  return {
    ...createCharacterReadRepository(db),
    upsertAuthored: (character, options) => upsertCharacter(db, character, options),
    patchSheetState: (characterId, patches, options) =>
      patchCharacterSheetState(db, characterId, patches, options)
  }
}
