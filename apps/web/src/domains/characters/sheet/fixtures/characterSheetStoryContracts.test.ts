import { describe, it } from 'vitest'
import { characterSheetCommandResponseDtoSchema } from '@artificer-toolkit/schema/api/characterSheetCommands'
import { characterSheetPanelDtoSchema } from '@artificer-toolkit/schema/api/characterSheetPanel'
import { spellsPanelFixture } from '../inspector/inspector.fixtures'
import { characterSheetFixture } from './characterSheet.fixtures'

describe('character sheet story fixture contracts', () => {
  it('parses the command response fixture', () => {
    characterSheetCommandResponseDtoSchema.parse({
      characterId: characterSheetFixture.meta.characterId,
      streamVersion: characterSheetFixture.meta.streamVersion + 1,
      sheet: {
        ...characterSheetFixture,
        meta: {
          ...characterSheetFixture.meta,
          streamVersion: characterSheetFixture.meta.streamVersion + 1
        }
      }
    })
  })

  it('parses the spells panel fixture', () => {
    characterSheetPanelDtoSchema.parse(spellsPanelFixture)
  })
})
