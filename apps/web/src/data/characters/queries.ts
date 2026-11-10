import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import { convexQuery } from '@convex-dev/react-query'
import type { UseQueryOptions } from '@tanstack/react-query'
import type { FunctionReturnType } from 'convex/server'
import type { CharacterListResponseDto } from '@artificer-toolkit/schema/api/characterBuilder'
import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'
import { usePaginatedQuery } from 'convex/react'
import { useLoadAllPages } from '#app/data/useLoadAllPages'
import type { CharacterSheetExtraCatalogInputDto } from '@artificer-toolkit/schema/api/characterSheetData'
import type { CharacterSheetPanelTargetDto } from '@artificer-toolkit/schema/api/characterSheetPanel'
import type { CharacterSheetPanelDto } from '@artificer-toolkit/schema/api/characterSheetPanel'
import type { CharacterPreparationOptionsResponseDto } from '@artificer-toolkit/schema/api/characterPreparationOptions'
import type {
  CharacterSheetSlice,
  CharacterSheetRepairRequiredDto,
  CharacterSheetSliceReadResultDto,
  CharacterSheetSliceDtoMap
} from '@artificer-toolkit/schema/api/characterSheetSlices'

export function useGetCharacterList(enabled = true) {
  const active = usePaginatedQuery(convexApi.characters.list.list, enabled ? {} : 'skip', {
    initialNumItems: 8
  })
  const drafts = usePaginatedQuery(convexApi.characters.drafts.list, enabled ? {} : 'skip', {
    initialNumItems: 48
  })

  useLoadAllPages(active, 8, enabled)
  useLoadAllPages(drafts, 48, enabled)

  const isLoading = enabled && (active.status !== 'Exhausted' || drafts.status !== 'Exhausted')
  const activeIds = new Set(active.results.map((character) => character.id))
  const data: CharacterListResponseDto | undefined =
    !enabled || isLoading
      ? undefined
      : {
          items: [
            ...active.results,
            ...drafts.results
              .filter(
                (draft) => draft.draftState === 'DRAFT_ONLY' && !activeIds.has(draft.characterId)
              )
              .map((draft) => ({
                id: draft.characterId,
                publicId: draft.publicId,
                label: draft.label,
                status: 'DRAFT' as const,
                systemId: draft.systemId,
                streamVersion: 0,
                draft
              }))
          ],
          meta: {}
        }

  // ponytail: client filters require all summaries; add server filtering only for large lists.
  return { data, isLoading }
}

/**
 * The caller's active Character: the Builder route's first payload beside the draft, and the previous
 * Character the browser Builder evaluates an edit draft against.
 */
export function getCharacterBuilderActiveCharacter(id: string) {
  return {
    ...convexQuery(convexApi.characters.builder.activeCharacter, { id }),
    select: (character: FunctionReturnType<typeof convexApi.characters.builder.activeCharacter>) =>
      character && characterAuthoredDtoSchema.parse(character)
  }
}

export function getCharacterDraft(id: string) {
  return convexQuery(convexApi.characters.drafts.get, { id })
}

export function getCharacterSheetSlice<Slice extends CharacterSheetSlice>(
  id: string | undefined,
  slice: Slice,
  campaignId?: string | null
) {
  return {
    ...convexQuery(
      convexApi.characters.sheetSlices.get,
      id ? { id, slice, ...(campaignId ? { campaignId } : {}) } : 'skip'
    ),
    gcTime: 0,
    select: (
      response: CharacterSheetSliceReadResultDto | null
    ): CharacterSheetSliceDtoMap[Slice] | null =>
      response?.slice === slice ? (response.data as CharacterSheetSliceDtoMap[Slice]) : null
  }
}

/** The repair answer of the Sheet read, shared with getCharacterSheetSlice through one cache entry. */
export function getCharacterSheetRepairRequired(id: string) {
  return {
    ...convexQuery(convexApi.characters.sheetSlices.get, { id, slice: 'COMMON' }),
    gcTime: 0,
    select: (
      response: CharacterSheetSliceReadResultDto | null
    ): CharacterSheetRepairRequiredDto['data'] | null =>
      response?.slice === 'REPAIR_REQUIRED' ? response.data : null
  }
}

/** Non-null while a live Run holds the Character's play for its owner or the Campaign GM. */
export function getCharacterSheetLiveAuthority(id: string, campaignId: string | null | undefined) {
  return {
    ...convexQuery(
      convexApi.characters.sheetLive.liveAuthority,
      campaignId ? { id, campaignId } : 'skip'
    ),
    gcTime: 0
  }
}

/** Non-null while a live room must end this Character's Concentration for the Characters it holds. */
export function getCharacterConcentrationRoomRoute(
  id: string,
  campaignId: string | null | undefined
) {
  return {
    ...convexQuery(
      convexApi.characters.sheetLive.concentrationRoomRoute,
      campaignId ? { id, campaignId } : 'skip'
    ),
    gcTime: 0
  }
}

export function getCharacterSheetEquipmentOptions(
  id: string | undefined,
  campaignId?: string | null
) {
  return {
    ...convexQuery(
      convexApi.characters.equipmentOptions.list,
      id ? { id, ...(campaignId ? { campaignId } : {}) } : 'skip'
    ),
    retry: false
  }
}

export function getCharacterPreparationOptions(
  id: string | undefined,
  campaignId?: string | null
): UseQueryOptions<CharacterPreparationOptionsResponseDto | null> {
  const queryKey = campaignId
    ? convexQuery(
        convexApi.campaigns.characterSheet.preparationOptions,
        id ? { campaignId, characterId: id } : 'skip'
      ).queryKey
    : convexQuery(convexApi.characters.preparationOptions.get, id ? { id } : 'skip').queryKey
  return {
    queryKey,
    staleTime: Infinity,
    ...(id ? {} : { enabled: false }),
    retry: false
  }
}

export function getCharacterSheetExtraOptions(
  id: string | undefined,
  input: CharacterSheetExtraCatalogInputDto
) {
  return convexQuery(convexApi.characters.extraOptions.list, id ? { id, ...input } : 'skip')
}

export function getCharacterSheetPanel(
  id: string,
  target: CharacterSheetPanelTargetDto,
  campaignId?: string | null
): UseQueryOptions<CharacterSheetPanelDto | null> {
  const queryKey = campaignId
    ? convexQuery(convexApi.campaigns.characterSheet.panel, {
        campaignId,
        characterId: id,
        target
      }).queryKey
    : convexQuery(convexApi.characters.panels.get, { id, target }).queryKey
  return {
    queryKey,
    staleTime: Infinity,
    retry: false
  }
}
