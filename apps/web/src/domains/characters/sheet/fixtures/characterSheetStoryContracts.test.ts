import { describe, expect, it } from 'vitest'
import { characterSheetCommandResponseDtoSchema } from '@artificer-toolkit/schema/api/characterSheetCommands'
import { characterSheetResponseDtoSchema } from '@artificer-toolkit/schema/api/characterSheetData'
import { characterSheetPanelDtoSchema } from '@artificer-toolkit/schema/api/characterSheetPanel'
import { spellsPanelFixture } from '../inspector/inspector.fixtures'
import { characterSheetFixture } from './characterSheet.fixtures'

describe('character sheet story fixture contracts', () => {
  it('parses the command response fixture', () => {
    const acknowledgement = {
      characterId: characterSheetFixture.meta.characterId,
      streamVersion: characterSheetFixture.meta.streamVersion + 1
    }
    characterSheetCommandResponseDtoSchema.parse(acknowledgement)
    expect(
      characterSheetCommandResponseDtoSchema.safeParse({
        ...acknowledgement,
        sheet: characterSheetFixture
      }).success
    ).toBe(false)
  })

  it('parses the Sheet query fixture', () => {
    characterSheetResponseDtoSchema.parse(characterSheetFixture)
  })

  it('parses the spells panel fixture', () => {
    characterSheetPanelDtoSchema.parse(spellsPanelFixture)
  })
})
