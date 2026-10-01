import { convexQuery } from '@convex-dev/react-query'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import { describe, expect, it } from 'vitest'
import {
  getCharacterBuilderActiveCharacter,
  getCharacterDraft,
  getCharacterPreparationOptions,
  getCharacterSheetSlice,
  getCharacterSheetEquipmentOptions,
  getCharacterSheetExtraOptions,
  getCharacterSheetPanel
} from './queries'

const target = { kind: 'MOVEMENT' as const }

describe('native character sheet query adapters', () => {
  it('loads the active Character by the supplied route identity', () => {
    expect(getCharacterBuilderActiveCharacter('character-handle').queryKey).toEqual(
      convexQuery(convexApi.characters.builder.activeCharacter, { id: 'character-handle' }).queryKey
    )
  })

  it('uses generated references and serialized arguments', () => {
    expect(getCharacterDraft('character-1')).toEqual(
      convexQuery(convexApi.characters.drafts.get, { id: 'character-1' })
    )
    expect(getCharacterSheetSlice('character-1', 'COMMON').queryKey).toEqual(
      convexQuery(convexApi.characters.sheetSlices.get, { id: 'character-1', slice: 'COMMON' })
        .queryKey
    )
    expect(getCharacterPreparationOptions('character-1').queryKey).toEqual(
      convexQuery(convexApi.characters.preparationOptions.get, { id: 'character-1' }).queryKey
    )
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
    expect(getCharacterSheetPanel('character-1', target).queryKey).toEqual(
      convexQuery(convexApi.characters.panels.get, { id: 'character-1', target }).queryKey
    )
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

  it('uses skip for disabled sheet reads', () => {
    expect(getCharacterSheetSlice(undefined, 'COMMON').queryKey).toEqual(
      convexQuery(convexApi.characters.sheetSlices.get, 'skip').queryKey
    )
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
    expect(getCharacterSheetPanel('character-1', target, campaignId).queryKey).toEqual(
      convexQuery(convexApi.campaigns.characterSheet.panel, {
        campaignId,
        characterId: 'character-1',
        target
      }).queryKey
    )
    expect(getCharacterPreparationOptions('character-1', campaignId).queryKey).toEqual(
      convexQuery(convexApi.campaigns.characterSheet.preparationOptions, {
        campaignId,
        characterId: 'character-1'
      }).queryKey
    )
    expect(getCharacterPreparationOptions(undefined, campaignId).queryKey).toEqual(
      convexQuery(convexApi.campaigns.characterSheet.preparationOptions, 'skip').queryKey
    )
  })
})
