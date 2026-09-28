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
import type { CharacterSheetCommandInputDto } from '@artificer-toolkit/schema/api/characterSheetCommandInputs'
import type { CharacterRestPreviewRequestDto } from '@artificer-toolkit/schema/api/characterSheetCommands'
import {
  projectOptimisticCharacterSheet,
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

export function useCharacterSheetCommandMutation(characterId: string, campaignId?: string | null) {
  const execute = useConvexMutation(
    convexApi.characters.sheetCommands.execute
  ).withOptimisticUpdate((localStore, { id, command }) => {
    for (const { args, value } of localStore.getAllQueries(convexApi.characters.sheet.get)) {
      if (value?.meta.characterId === id) {
        localStore.setQuery(
          convexApi.characters.sheet.get,
          args,
          projectOptimisticCharacterSheet(value, command)
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
    for (const { args, value } of localStore.getAllQueries(
      convexApi.campaigns.characterSheet.get
    )) {
      if (
        args.campaignId === campaignId &&
        args.characterId === characterId &&
        value?.meta.characterId === characterId
      ) {
        localStore.setQuery(
          convexApi.campaigns.characterSheet.get,
          args,
          projectOptimisticCharacterSheet(value, command)
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
    mutationFn: (command: CharacterSheetCommandInputDto) =>
      campaignId
        ? executeCampaign({ campaignId, characterId, command })
        : execute({ id: characterId, command })
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
