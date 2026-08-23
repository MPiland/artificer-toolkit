import {
  characterBuilderDraftDtoSchema,
  characterBuilderCommitReceiptDtoSchema,
  characterBuilderPreviewPayloadDtoSchema,
  characterBuilderPayloadDtoSchema,
  characterHistoryResponseDtoSchema,
  characterPreparationOptionsResponseDtoSchema,
  characterListResponseDtoSchema,
  characterRestPreviewResponseDtoSchema,
  characterSheetExtraCatalogResponseDtoSchema,
  characterSheetCommandResponseDtoSchema,
  characterSheetResponseDtoSchema,
  type CharacterBuilderCommitRequestDto,
  type CharacterBuilderDraftSaveRequestDto,
  type CharacterBuilderResolveRequestDto,
  type CharacterBuilderSaveRequestDto,
  type CharacterDraftRequestDto,
  type CharacterRestPreviewRequestDto,
  type CharacterSheetExtraCatalogInputDto,
  type CharacterSheetCommandInputDto
} from '@artificer-toolkit/schema/api/characters'
import {
  characterSheetPanelDtoSchema,
  type CharacterSheetPanelTargetDto
} from '@artificer-toolkit/schema/api/characterSheetPanel'
import {
  okResponseSchema,
  request,
  type ProcedureRequestOptions,
  type TrpcClient
} from './transport'

export function buildCharactersApi(client: TrpcClient) {
  return {
    command: (id: string, input: CharacterSheetCommandInputDto) =>
      request('characters.command', characterSheetCommandResponseDtoSchema, () =>
        client.characters.command.mutate({ id, input })
      ),
    discardDraft: async (id: string) => {
      await request('characters.discardDraft', okResponseSchema, () =>
        client.characters.discardDraft.mutate({ id })
      )
    },
    draft: (input: CharacterDraftRequestDto) =>
      request('characters.draft', characterBuilderPayloadDtoSchema, () =>
        client.characters.draft.mutate(input)
      ),
    get: (id: string) =>
      request('characters.get', characterBuilderPayloadDtoSchema.nullable(), () =>
        client.characters.get.query({ id })
      ),
    getDraft: (id: string) =>
      request('characters.getDraft', characterBuilderDraftDtoSchema.nullable(), () =>
        client.characters.getDraft.query({ id })
      ),
    history: (id: string) =>
      request('characters.history', characterHistoryResponseDtoSchema, () =>
        client.characters.history.query({ id })
      ),
    list: () =>
      request('characters.list', characterListResponseDtoSchema, () =>
        client.characters.list.query()
      ),
    panel: (id: string, target: CharacterSheetPanelTargetDto) =>
      request('characters.panel', characterSheetPanelDtoSchema, () =>
        client.characters.panel.query({ id, target })
      ),
    preparationOptions: (id: string) =>
      request('characters.preparationOptions', characterPreparationOptionsResponseDtoSchema, () =>
        client.characters.preparationOptions.query({ id })
      ),
    previewSave: (input: CharacterBuilderSaveRequestDto) =>
      request('characters.previewSave', characterBuilderPreviewPayloadDtoSchema, () =>
        client.characters.previewSave.mutate(input)
      ),
    resolve: (input: CharacterBuilderResolveRequestDto, options?: ProcedureRequestOptions) =>
      request('characters.resolve', characterBuilderPayloadDtoSchema, () =>
        client.characters.resolve.mutate(input, options)
      ),
    restPreview: (id: string, input: CharacterRestPreviewRequestDto) =>
      request('characters.restPreview', characterRestPreviewResponseDtoSchema, () =>
        client.characters.restPreview.mutate({ id, input })
      ),
    saveDraft: (id: string, input: CharacterBuilderDraftSaveRequestDto) =>
      request('characters.saveDraft', characterBuilderDraftDtoSchema, () =>
        client.characters.saveDraft.mutate({ id, input })
      ),
    sheet: (id: string) =>
      request('characters.sheet', characterSheetResponseDtoSchema.nullable(), () =>
        client.characters.sheet.query({ id })
      ),
    extraOptions: (id: string, input: CharacterSheetExtraCatalogInputDto) =>
      request('characters.extraOptions', characterSheetExtraCatalogResponseDtoSchema, () =>
        client.characters.extraOptions.query({ id, input })
      ),
    upsert: (input: CharacterBuilderCommitRequestDto) =>
      request('characters.upsert', characterBuilderCommitReceiptDtoSchema, () =>
        client.characters.upsert.mutate(input)
      )
  }
}

export type CharactersApi = ReturnType<typeof buildCharactersApi>
