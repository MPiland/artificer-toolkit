import { convexQuery } from '@convex-dev/react-query'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import { describe, expect, it } from 'vitest'
import {
  getCharacter,
  getCharacterDraft,
  getCharacterPreparationOptions,
  getCharacterSheet,
  getCharacterSheetActions,
  getCharacterSheetEquipmentOptions,
  getCharacterSheetExtraOptions,
  getCharacterSheetPanel
} from './queries'

const target = { kind: 'MOVEMENT' as const }

describe('native character sheet query adapters', () => {
  it('loads the native working Builder payload by the supplied route identity', () => {
    expect(getCharacter('character-handle')).toEqual(
      convexQuery(convexApi.characters.builder.get, { id: 'character-handle' })
    )
  })

  it('uses generated references and serialized arguments', () => {
    expect(getCharacterDraft('character-1')).toEqual(
      convexQuery(convexApi.characters.drafts.get, { id: 'character-1' })
    )
    expect(getCharacterSheet('character-1')).toEqual(
      convexQuery(convexApi.characters.sheet.get, { id: 'character-1' })
    )
    expect(getCharacterPreparationOptions('character-1')).toEqual({
      ...convexQuery(convexApi.characters.preparationOptions.get, { id: 'character-1' }),
      retry: false
    })
    expect(getCharacterSheetEquipmentOptions('character-1')).toEqual({
      ...convexQuery(convexApi.characters.equipmentOptions.list, { id: 'character-1' }),
      retry: false
    })
    expect(
      getCharacterSheetEquipmentOptions('character-1', '00000000-0000-4000-8000-000000000123')
    ).toEqual({
      ...convexQuery(convexApi.characters.equipmentOptions.list, {
        id: 'character-1',
        campaignId: '00000000-0000-4000-8000-000000000123'
      }),
      retry: false
    })
    expect(getCharacterSheetPanel('character-1', target)).toEqual({
      ...convexQuery(convexApi.characters.panels.get, { id: 'character-1', target }),
      retry: false
    })
    const input = { kind: 'CREATURE' as const, limit: 25, query: 'owl' }
    expect(getCharacterSheetExtraOptions('character-1', input)).toEqual(
      convexQuery(convexApi.characters.extraOptions.list, { id: 'character-1', ...input })
    )
    const vehicleInput = {
      kind: 'VEHICLE' as const,
      limit: 10,
      cursor: { id: 'vehicle-1', label: 'Ship' }
    }
    expect(getCharacterSheetExtraOptions('character-1', vehicleInput)).toEqual(
      convexQuery(convexApi.characters.extraOptions.list, { id: 'character-1', ...vehicleInput })
    )
  })

  it('uses skip for disabled sheet reads and selects sheet actions', () => {
    expect(getCharacterSheet(undefined)).toEqual(
      convexQuery(convexApi.characters.sheet.get, 'skip')
    )
    const actions = getCharacterSheetActions(undefined)
    expect(actions.queryKey).toEqual(convexQuery(convexApi.characters.sheet.get, 'skip').queryKey)
    expect(actions.select(null)).toBeNull()
    expect(getCharacterPreparationOptions(undefined).queryKey).toEqual(
      convexQuery(convexApi.characters.preparationOptions.get, 'skip').queryKey
    )
    expect(getCharacterSheetEquipmentOptions(undefined).queryKey).toEqual(
      convexQuery(convexApi.characters.equipmentOptions.list, 'skip').queryKey
    )
    expect(getCharacterSheetExtraOptions(undefined, { kind: 'CREATURE', limit: 25 })).toEqual(
      convexQuery(convexApi.characters.extraOptions.list, 'skip')
    )
  })

  it('uses campaign-authorized panel and preparation queries for campaign sheets', () => {
    const campaignId = '00000000-0000-4000-8000-000000000123'
    expect(getCharacterSheetPanel('character-1', target, campaignId)).toEqual({
      ...convexQuery(convexApi.campaigns.characterSheet.panel, {
        campaignId,
        characterId: 'character-1',
        target
      }),
      retry: false
    })
    expect(getCharacterPreparationOptions('character-1', campaignId)).toEqual({
      ...convexQuery(convexApi.campaigns.characterSheet.preparationOptions, {
        campaignId,
        characterId: 'character-1'
      }),
      retry: false
    })
    expect(getCharacterPreparationOptions(undefined, campaignId).queryKey).toEqual(
      convexQuery(convexApi.campaigns.characterSheet.preparationOptions, 'skip').queryKey
    )
  })
})
