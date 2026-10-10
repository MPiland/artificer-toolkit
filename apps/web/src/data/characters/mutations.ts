import { useMutation } from '@tanstack/react-query'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import { useConvex, useMutation as useConvexMutation } from 'convex/react'
import {
  characterBuilderCommitInputSchema,
  characterBuilderCommitOutputSchema,
  type CharacterBuilderCommitInput,
  type CharacterBuilderCommitOutput
} from '@artificer-toolkit/schema/api/characterBuilderQueries'
import { characterBuilderDraftDtoSchema } from '@artificer-toolkit/schema/api/characterBuilder'
import {
  characterDraftCreateInputSchema,
  characterDraftDiscardInputSchema,
  characterDraftSaveInputSchema,
  type CharacterDraftCreateInput,
  type CharacterDraftDiscardInput,
  type CharacterDraftSaveInput
} from '@artificer-toolkit/schema/api/characterDrafts'
import {
  isCharacterSheetLivePlayCommand,
  type CharacterSheetLivePlayCommand
} from '@artificer-toolkit/schema/api/characterSheetLiveCommands'
import type { CharacterSheetCommandInputDto } from '@artificer-toolkit/schema/api/characterSheetCommandInputs'
import type {
  CharacterRestPreviewRequestDto,
  CharacterSheetCommandResponseDto
} from '@artificer-toolkit/schema/api/characterSheetCommands'
import {
  projectOptimisticCharacterSheetSlice,
  projectOptimisticCharacterSheetPanel
} from './optimisticSheet'

export function useCreateCharacterDraftMutation() {
  const create = useConvexMutation(convexApi.characters.drafts.create)

  return useMutation({
    mutationFn: (input: CharacterDraftCreateInput) =>
      create(characterDraftCreateInputSchema.parse(input)).then((response) =>
        characterBuilderDraftDtoSchema.parse(response)
      )
  })
}

export function useSaveCharacterDraftMutation() {
  const save = useConvexMutation(convexApi.characters.drafts.save)

  return useMutation({
    mutationFn: (input: CharacterDraftSaveInput) =>
      save(JSON.parse(JSON.stringify(characterDraftSaveInputSchema.parse(input)))).then(
        (response) => characterBuilderDraftDtoSchema.parse(response)
      )
  })
}

export function useDiscardCharacterDraftMutation() {
  const discard = useConvexMutation(convexApi.characters.drafts.discard)

  return useMutation({
    mutationFn: (input: CharacterDraftDiscardInput) =>
      discard(characterDraftDiscardInputSchema.parse(input))
  })
}

export function useCommitCharacterBuilderMutation() {
  const commit = useConvexMutation(convexApi.characters.commit.commit)

  return useMutation({
    mutationFn: (input: CharacterBuilderCommitInput): Promise<CharacterBuilderCommitOutput> =>
      commit(JSON.parse(JSON.stringify(characterBuilderCommitInputSchema.parse(input)))).then(
        (response) => characterBuilderCommitOutputSchema.parse(response)
      )
  })
}

export function useCharacterSheetCommandMutation(
  characterId: string,
  campaignId?: string | null,
  /** While a live Run holds the Character, its play commands go to the room (D73). */
  live?: {
    /** The Convex play version the Sheet's other commands are checked against. */
    checkpointVersion: number
    /** Resolves with the room's committed play version, which the next command must expect. */
    sendPlayCommand: (
      command: CharacterSheetLivePlayCommand
    ) => Promise<CharacterSheetCommandResponseDto>
  } | null,
  /** Also ends the Concentration's carried grants on the Characters a live room holds. */
  endConcentrationInRoom?:
    | ((
        command: Extract<CharacterSheetCommandInputDto, { type: 'END_CONCENTRATION' }>
      ) => Promise<CharacterSheetCommandResponseDto>)
    | null
) {
  const execute = useConvexMutation(
    convexApi.characters.sheetCommands.execute
  ).withOptimisticUpdate((localStore, { id, command }) => {
    for (const { args, value } of localStore.getAllQueries(convexApi.characters.sheetSlices.get)) {
      if (value?.data.meta.characterId === id && !args.campaignId) {
        localStore.setQuery(
          convexApi.characters.sheetSlices.get,
          args,
          projectOptimisticCharacterSheetSlice(value, command)
        )
      }
    }
    for (const { args, value } of localStore.getAllQueries(convexApi.characters.panels.get)) {
      if (value?.characterId === id) {
        localStore.setQuery(
          convexApi.characters.panels.get,
          args,
          projectOptimisticCharacterSheetPanel(value, command)
        )
      }
    }
  })
  const executeCampaign = useConvexMutation(
    convexApi.campaigns.characterSheet.execute
  ).withOptimisticUpdate((localStore, { campaignId, characterId, command }) => {
    for (const { args, value } of localStore.getAllQueries(convexApi.characters.sheetSlices.get)) {
      if (
        (!args.campaignId || args.campaignId === campaignId) &&
        value?.data.meta.characterId === characterId &&
        (value.slice === 'NOTES'
          ? args.campaignId === campaignId
          : value.data.meta.campaignId === campaignId)
      ) {
        localStore.setQuery(
          convexApi.characters.sheetSlices.get,
          args,
          projectOptimisticCharacterSheetSlice(value, command)
        )
      }
    }
    for (const { args, value } of localStore.getAllQueries(
      convexApi.campaigns.characterSheet.panel
    )) {
      if (
        args.campaignId === campaignId &&
        args.characterId === characterId &&
        value?.characterId === characterId
      ) {
        localStore.setQuery(
          convexApi.campaigns.characterSheet.panel,
          args,
          projectOptimisticCharacterSheetPanel(value, command)
        )
      }
    }
  })

  return useMutation({
    mutationKey: campaignId
      ? ['campaigns', campaignId, 'sheet', 'command', characterId]
      : ['characters', 'sheet', 'command', characterId],
    mutationFn: async (command: CharacterSheetCommandInputDto) => {
      if (!campaignId) return execute({ id: characterId, command })
      if (!live) {
        if (command.type === 'END_CONCENTRATION' && endConcentrationInRoom) {
          // Convex ends the caster's own and every outside holder's grants and skips the Run's
          // Characters; the room, under the same command id, ends those. Both replay by command id.
          const response = await executeCampaign({ campaignId, characterId, command })
          await endConcentrationInRoom(command)
          return response
        }
        return executeCampaign({ campaignId, characterId, command })
      }
      if (isCharacterSheetLivePlayCommand(command)) return live.sendPlayCommand(command)
      // Everything else stays on Convex, whose checkpointed version the room's push does not track.
      return executeCampaign({
        campaignId,
        characterId,
        command: { ...command, expectedVersion: live.checkpointVersion }
      })
    }
  })
}

export function useCharacterRestPreviewMutation(characterId: string, campaignId?: string | null) {
  const convex = useConvex()
  return useMutation({
    mutationKey: campaignId
      ? ['campaigns', campaignId, 'sheet', 'rest-preview', characterId]
      : ['characters', 'sheet', 'rest-preview', characterId],
    mutationFn: (input: CharacterRestPreviewRequestDto) =>
      campaignId
        ? convex.query(convexApi.campaigns.characterSheet.restPreview, {
            campaignId,
            characterId,
            input
          })
        : convex.query(convexApi.characters.rest.preview, { id: characterId, input })
  })
}
