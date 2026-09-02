import {
  createCharacterDraftForUser,
  discardCharacterBuilderDraftForUser,
  dispatchCommandForUser,
  getCharacterBuilderDraftForUser,
  getCharacterForUser,
  getCharacterHistoryForUser,
  getCharacterPreparationOptionsForUser,
  getCharacterSheetActionsForUser,
  getCharacterSheetExtraOptionsForUser,
  getCharacterSheetPanelForUser,
  getCharacterSheetForUser,
  listCharactersForUser,
  previewCharacterRestForUser,
  previewCharacterRuleUpgradeForUser,
  previewCharacterSaveForUser,
  resolveCharacterForUser,
  saveCharacterBuilderDraftForUser,
  upsertCharacterBuilderForUser
} from '@artificer-toolkit/functions'
import { z } from 'zod'
import {
  characterBuilderCommitRequestDtoSchema,
  characterBuilderCommitReceiptDtoSchema,
  characterBuilderDraftDtoSchema,
  characterBuilderDraftSaveRequestDtoSchema,
  characterBuilderPayloadDtoSchema,
  characterBuilderPreviewPayloadDtoSchema,
  characterBuilderResolveRequestDtoSchema,
  characterBuilderSaveRequestDtoSchema,
  characterDraftRequestDtoSchema,
  characterHistoryResponseDtoSchema,
  characterRestPreviewRequestDtoSchema,
  characterListResponseDtoSchema,
  characterRestPreviewResponseDtoSchema,
  characterPreparationOptionsResponseDtoSchema,
  characterRuleUpgradePreviewRequestDtoSchema,
  characterRuleUpgradePreviewResponseDtoSchema,
  characterSheetExtraCatalogInputDtoSchema,
  characterSheetExtraCatalogResponseDtoSchema,
  characterSheetActionDtoSchema,
  characterSheetCommandInputDtoSchema,
  characterSheetCommandResponseDtoSchema,
  characterSheetResponseDtoSchema
} from '@artificer-toolkit/schema/api/characters'
import {
  characterSheetPanelDtoSchema,
  characterSheetPanelTargetDtoSchema
} from '@artificer-toolkit/schema/api/characterSheetPanel'
import { withAuthenticatedDb } from './dbContext.js'

import {
  authenticatedProcedure,
  createTRPCRouter,
  idInputSchema,
  okResponseSchema
} from './procedures.js'

const characterDraftProcedureInputSchema = z.object({
  id: z.string().min(1),
  input: characterBuilderDraftSaveRequestDtoSchema
})

const characterCommandProcedureInputSchema = z.object({
  id: z.string().min(1),
  input: characterSheetCommandInputDtoSchema
})

const characterRestPreviewProcedureInputSchema = z.object({
  id: z.string().min(1),
  input: characterRestPreviewRequestDtoSchema
})

const characterRuleUpgradePreviewProcedureInputSchema = z.object({
  id: z.string().min(1),
  input: characterRuleUpgradePreviewRequestDtoSchema
})

const characterSheetPanelProcedureInputSchema = z.object({
  id: z.string().min(1),
  target: characterSheetPanelTargetDtoSchema
})

const characterSheetExtraOptionsProcedureInputSchema = z.object({
  id: z.string().min(1),
  input: characterSheetExtraCatalogInputDtoSchema
})

export const characterRouter = createTRPCRouter({
  list: authenticatedProcedure
    .output(characterListResponseDtoSchema)
    .query(({ ctx }) =>
      withAuthenticatedDb(ctx, async (db, userId) => listCharactersForUser(db, userId))
    ),

  draft: authenticatedProcedure
    .input(characterDraftRequestDtoSchema)
    .output(characterBuilderPayloadDtoSchema)
    .mutation(({ ctx, input }) =>
      withAuthenticatedDb(ctx, async (db, userId) => createCharacterDraftForUser(db, input, userId))
    ),

  get: authenticatedProcedure
    .input(idInputSchema)
    .output(characterBuilderPayloadDtoSchema.nullable())
    .query(({ ctx, input }) =>
      withAuthenticatedDb(ctx, async (db, userId) => getCharacterForUser(db, input.id, userId))
    ),

  getDraft: authenticatedProcedure
    .input(idInputSchema)
    .output(characterBuilderDraftDtoSchema.nullable())
    .query(({ ctx, input }) =>
      withAuthenticatedDb(ctx, async (db, userId) =>
        getCharacterBuilderDraftForUser(db, input.id, userId)
      )
    ),

  saveDraft: authenticatedProcedure
    .input(characterDraftProcedureInputSchema)
    .output(characterBuilderDraftDtoSchema)
    .mutation(({ ctx, input }) =>
      withAuthenticatedDb(ctx, async (db, userId) =>
        saveCharacterBuilderDraftForUser(db, input.id, input.input, userId)
      )
    ),

  discardDraft: authenticatedProcedure
    .input(idInputSchema)
    .output(okResponseSchema)
    .mutation(({ ctx, input }) =>
      withAuthenticatedDb(ctx, async (db, userId) =>
        discardCharacterBuilderDraftForUser(db, input.id, userId)
      )
    ),

  sheet: authenticatedProcedure
    .input(idInputSchema)
    .output(characterSheetResponseDtoSchema.nullable())
    .query(({ ctx, input }) =>
      withAuthenticatedDb(ctx, async (db, userId) => getCharacterSheetForUser(db, input.id, userId))
    ),

  actions: authenticatedProcedure
    .input(idInputSchema)
    .output(z.array(characterSheetActionDtoSchema).nullable())
    .query(({ ctx, input }) =>
      withAuthenticatedDb(ctx, async (db, userId) =>
        getCharacterSheetActionsForUser(db, input.id, userId)
      )
    ),

  preparationOptions: authenticatedProcedure
    .input(idInputSchema)
    .output(characterPreparationOptionsResponseDtoSchema)
    .query(({ ctx, input }) =>
      withAuthenticatedDb(ctx, async (db, userId) =>
        getCharacterPreparationOptionsForUser(db, input.id, userId)
      )
    ),

  extraOptions: authenticatedProcedure
    .input(characterSheetExtraOptionsProcedureInputSchema)
    .output(characterSheetExtraCatalogResponseDtoSchema)
    .query(({ ctx, input }) =>
      withAuthenticatedDb(ctx, async (db, userId) =>
        getCharacterSheetExtraOptionsForUser(db, input.id, input.input, userId)
      )
    ),

  restPreview: authenticatedProcedure
    .input(characterRestPreviewProcedureInputSchema)
    .output(characterRestPreviewResponseDtoSchema)
    .mutation(({ ctx, input }) =>
      withAuthenticatedDb(ctx, async (db, userId) =>
        previewCharacterRestForUser(db, input.id, input.input, userId)
      )
    ),

  ruleUpgradePreview: authenticatedProcedure
    .input(characterRuleUpgradePreviewProcedureInputSchema)
    .output(characterRuleUpgradePreviewResponseDtoSchema)
    .query(({ ctx, input }) =>
      withAuthenticatedDb(ctx, async (db, userId) =>
        previewCharacterRuleUpgradeForUser(db, input.id, input.input, userId)
      )
    ),

  panel: authenticatedProcedure
    .input(characterSheetPanelProcedureInputSchema)
    .output(characterSheetPanelDtoSchema)
    .query(({ ctx, input }) =>
      withAuthenticatedDb(ctx, async (db, userId) =>
        getCharacterSheetPanelForUser(db, input.id, input.target, userId)
      )
    ),

  resolve: authenticatedProcedure
    .input(characterBuilderResolveRequestDtoSchema)
    .output(characterBuilderPayloadDtoSchema)
    .mutation(({ ctx, input }) =>
      withAuthenticatedDb(ctx, async (db, userId) => resolveCharacterForUser(db, input, userId))
    ),

  previewSave: authenticatedProcedure
    .input(characterBuilderSaveRequestDtoSchema)
    .output(characterBuilderPreviewPayloadDtoSchema)
    .mutation(({ ctx, input }) =>
      withAuthenticatedDb(ctx, async (db, userId) => previewCharacterSaveForUser(db, input, userId))
    ),

  upsert: authenticatedProcedure
    .input(characterBuilderCommitRequestDtoSchema)
    .output(characterBuilderCommitReceiptDtoSchema)
    .mutation(({ ctx, input }) =>
      withAuthenticatedDb(ctx, async (db, userId) =>
        upsertCharacterBuilderForUser(db, input, userId)
      )
    ),

  history: authenticatedProcedure
    .input(idInputSchema)
    .output(characterHistoryResponseDtoSchema)
    .query(({ ctx, input }) =>
      withAuthenticatedDb(ctx, async (db, userId) =>
        getCharacterHistoryForUser(db, input.id, userId)
      )
    ),

  command: authenticatedProcedure
    .input(characterCommandProcedureInputSchema)
    .output(characterSheetCommandResponseDtoSchema)
    .mutation(({ ctx, input }) =>
      withAuthenticatedDb(ctx, async (db, userId) =>
        dispatchCommandForUser(db, input.id, input.input, userId)
      )
    )
})
