import { z } from 'zod'
import { createTRPCUntypedClient, httpBatchLink, isTRPCClientError } from '@trpc/client'
import { createIsomorphicFn } from '@tanstack/react-start'
import type { AnyRouter } from '@trpc/server'
import {
  backgroundListResponseDtoSchema,
  backgroundResponseDtoSchema,
  authoredDraftDtoSchema,
  authoredValidationIssueDtoSchema,
  classListResponseDtoSchema,
  classResponseDtoSchema,
  creatureListResponseDtoSchema,
  creatureResponseDtoSchema,
  equipmentListResponseDtoSchema,
  equipmentResponseDtoSchema,
  featListResponseDtoSchema,
  featResponseDtoSchema,
  raceListResponseDtoSchema,
  raceResponseDtoSchema,
  spellListResponseDtoSchema,
  spellResponseDtoSchema,
  vehicleListResponseDtoSchema,
  vehicleResponseDtoSchema,
  type AuthoredDetailRequestDto,
  type AuthoredDraftDto,
  type AuthoredDraftSaveRequestDto,
  type AuthoredSubjectKindDto,
  type AuthoredValidationIssueDto,
  type BackgroundListItemDto,
  type BackgroundListResponseDto,
  type BackgroundResponseDto,
  type ClassListItemDto,
  type ClassListResponseDto,
  type ClassResponseDto,
  type CreatureListItemDto,
  type CreatureListResponseDto,
  type CreatureResponseDto,
  type EquipmentListItemDto,
  type EquipmentListResponseDto,
  type EquipmentResponseDto,
  type FeatListItemDto,
  type FeatListResponseDto,
  type FeatResponseDto,
  type RaceListItemDto,
  type RaceListResponseDto,
  type RaceResponseDto,
  type SpellListItemDto,
  type SpellListResponseDto,
  type SpellResponseDto,
  type VehicleListItemDto,
  type VehicleListResponseDto,
  type VehicleResponseDto
} from '@artificer-toolkit/schema/api/content'
import {
  characterBuilderDraftDtoSchema,
  characterBuilderPreviewPayloadDtoSchema,
  characterBuilderPayloadDtoSchema,
  characterHistoryResponseDtoSchema,
  characterListResponseDtoSchema,
  characterRestPreviewResponseDtoSchema,
  characterSheetCommandResponseDtoSchema,
  characterSheetResponseDtoSchema,
  type CharacterBuilderPayloadDto,
  type CharacterBuilderFormDto,
  type CharacterBuilderDraftDto,
  type CharacterBuilderDraftSaveRequestDto,
  type CharacterBuilderCommitRequestDto,
  type CharacterBuilderPreviewPayloadDto,
  type CharacterBuilderResolveRequestDto,
  type CharacterBuilderSaveRequestDto,
  type CharacterDraftRequestDto,
  type CharacterHistoryResponseDto,
  type CharacterListItemDto,
  type CharacterListResponseDto,
  type CharacterRestPreviewRequestDto,
  type CharacterRestPreviewResponseDto,
  type CharacterSheetCommandInputDto,
  type CharacterSheetCommandResponseDto,
  type CharacterSheetResponseDto
} from '@artificer-toolkit/schema/api/characters'
import {
  characterSheetPanelDtoSchema,
  type CharacterSheetPanelDto,
  type CharacterSheetPanelNumericCalculationDto,
  type CharacterSheetPanelTargetDto
} from '@artificer-toolkit/schema/api/characterSheetPanel'
import {
  nodeRuntimeNormalizeValuesResponseDtoSchema,
  nodeRuntimeResolveResponseDtoSchema,
  type NodeRuntimeNormalizeValuesRequestDto,
  type NodeRuntimeNormalizeValuesResponseDto,
  type NodeRuntimeResolveRequestDto,
  type NodeRuntimeResolveResponseDto
} from '@artificer-toolkit/schema/api/nodeRuntime'
import {
  routeIdentityDtoSchema,
  type RouteIdentityBySubjectRequestDto,
  type RouteIdentityDto,
  type RouteIdentityResolveRequestDto
} from '@artificer-toolkit/schema/api/routeIds'
import {
  accountProfileDtoSchema,
  accountUsernameStatusDtoSchema,
  type AccountProfileDto,
  type AccountProfileUpdateInput,
  type AccountUsernameStatusDto,
  type AccountUsernameStatusInput
} from '@artificer-toolkit/schema/api/account'
import {
  authSessionCredentialsDtoSchema,
  type AuthInvitationCompletionInput,
  type AuthSessionCredentialsDto,
  type AuthUsernameSignInInput
} from '@artificer-toolkit/schema/api/auth'
import {
  createImageUploadIntentOutputSchema,
  finalizeImageUploadOutputSchema,
  signedImageDeliveryDtoSchema,
  type AttachImageInput,
  type CreateImageUploadIntentInput,
  type FinalizeImageUploadInput,
  type ImageLookupInput,
  type RemoveImageInput,
  type SignedImageDeliveryDto
} from '@artificer-toolkit/schema/api/media'
import {
  systemListResponseDtoSchema,
  systemResponseDtoSchema,
  type SystemListItemDto,
  type SystemListResponseDto,
  type SystemResponseDto
} from '@artificer-toolkit/schema/api/systems'
import {
  executeDiceConfigurationInputDtoSchema,
  rollHistoryResponseDtoSchema,
  rollRecordDtoSchema,
  rollResultDtoSchema,
  type ExecuteDiceConfigurationInputDto,
  type ExecuteRollInputDto,
  type RollHistoryResponseDto,
  type RollRecordDto,
  type RollResultDto
} from '@artificer-toolkit/schema/api/rolls'
import * as campaignContracts from '@artificer-toolkit/schema/api/campaigns'
import * as encounterContracts from '@artificer-toolkit/schema/api/encounters'
import { applySameOriginRequestHeader } from './trpcRequestSecurity'
import type { BackgroundAuthoringInputDto } from '@artificer-toolkit/schema/subjects/background'
import type { ClassAuthoringInputDto } from '@artificer-toolkit/schema/subjects/class'
import type { CreatureAuthoringInputDto } from '@artificer-toolkit/schema/subjects/creature'
import type { EquipmentAuthoringInputDto } from '@artificer-toolkit/schema/subjects/equipment'
import type { FeatAuthoringInputDto } from '@artificer-toolkit/schema/subjects/feat'
import type { RaceAuthoringInputDto } from '@artificer-toolkit/schema/subjects/race'
import type { SpellAuthoringInputDto } from '@artificer-toolkit/schema/subjects/spell'
import type { VehicleAuthoringInputDto } from '@artificer-toolkit/schema/subjects/vehicle'

export type {
  AuthoredDetailRequestDto,
  AuthoredDraftDto,
  AuthoredDraftSaveRequestDto,
  AuthoredSubjectKindDto,
  AccountProfileDto,
  AccountProfileUpdateInput,
  AccountUsernameStatusDto,
  AccountUsernameStatusInput,
  BackgroundListItemDto,
  BackgroundListResponseDto,
  BackgroundResponseDto,
  CharacterBuilderPayloadDto,
  CharacterBuilderFormDto,
  CharacterBuilderDraftDto,
  CharacterBuilderDraftSaveRequestDto,
  CharacterBuilderCommitRequestDto,
  CharacterBuilderPreviewPayloadDto,
  CharacterBuilderResolveRequestDto,
  CharacterBuilderSaveRequestDto,
  CharacterDraftRequestDto,
  CharacterHistoryResponseDto,
  CharacterListItemDto,
  CharacterListResponseDto,
  CharacterRestPreviewRequestDto,
  CharacterRestPreviewResponseDto,
  CharacterSheetCommandInputDto,
  CharacterSheetCommandResponseDto,
  CharacterSheetPanelDto,
  CharacterSheetPanelNumericCalculationDto,
  CharacterSheetPanelTargetDto,
  CharacterSheetResponseDto,
  ClassListItemDto,
  ClassListResponseDto,
  ClassResponseDto,
  BackgroundAuthoringInputDto,
  ClassAuthoringInputDto,
  CreatureAuthoringInputDto,
  CreatureListItemDto,
  CreatureListResponseDto,
  CreatureResponseDto,
  EquipmentListItemDto,
  EquipmentListResponseDto,
  EquipmentResponseDto,
  FeatListItemDto,
  FeatListResponseDto,
  FeatAuthoringInputDto,
  FeatResponseDto,
  RaceAuthoringInputDto,
  NodeRuntimeNormalizeValuesRequestDto,
  NodeRuntimeNormalizeValuesResponseDto,
  NodeRuntimeResolveRequestDto,
  NodeRuntimeResolveResponseDto,
  RouteIdentityBySubjectRequestDto,
  RouteIdentityDto,
  RouteIdentityResolveRequestDto,
  ExecuteRollInputDto,
  ExecuteDiceConfigurationInputDto,
  RollHistoryResponseDto,
  RollResultDto,
  RollRecordDto,
  RaceListItemDto,
  RaceListResponseDto,
  RaceResponseDto,
  SpellListItemDto,
  SpellListResponseDto,
  SpellAuthoringInputDto,
  SpellResponseDto,
  SystemListItemDto,
  VehicleAuthoringInputDto,
  VehicleListItemDto,
  VehicleListResponseDto,
  VehicleResponseDto,
  AttachImageInput,
  CreateImageUploadIntentInput,
  FinalizeImageUploadInput,
  ImageLookupInput,
  RemoveImageInput,
  SignedImageDeliveryDto
}

export type {
  CampaignChatEntryDto,
  CampaignChatPageDto,
  CampaignAdjustmentDto,
  CampaignConditionDto,
  CampaignContentBindingDto,
  CampaignDetailDto,
  CampaignEventPageDto,
  CampaignInviteDto,
  CampaignNotebookSectionDto,
  CampaignSessionDto,
  CampaignSessionNoteSectionDto,
  CampaignSessionReferencePinDto,
  CampaignSummaryDto,
  CurrencySystemDto,
  EntitlementProjectionDto,
  ExecuteCampaignRollInput,
  InventoryDto,
  InventoryOwnerRefDto,
  SaveCampaignCurrencySystemInput,
  SendCampaignChatEntryInput,
  TransferCampaignInventoryInput
} from '@artificer-toolkit/schema/api/campaigns'

export type {
  EncounterCommandInputDto,
  EncounterGmProjectionDto,
  EncounterPlayerProjectionDto
} from '@artificer-toolkit/schema/api/encounters'

type FetchInput = Parameters<typeof fetch>[0]
type FetchInit = Parameters<typeof fetch>[1]

interface IdProcedureInput {
  id: string
}

interface QueryProcedure<TInput, TOutput> {
  query: (input: TInput) => Promise<TOutput>
}

interface EmptyQueryProcedure<TOutput> {
  query: () => Promise<TOutput>
}

interface EmptyMutationProcedure<TOutput> {
  mutate: () => Promise<TOutput>
}

interface ProcedureRequestOptions {
  signal?: AbortSignal
}

interface MutationProcedure<TInput, TOutput> {
  mutate: (input: TInput, options?: ProcedureRequestOptions) => Promise<TOutput>
}

type SchemaInput<TSchema extends z.ZodTypeAny> = z.input<TSchema>

const okResponseSchema = z.object({
  ok: z.literal(true)
})

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly validationIssues: readonly AuthoredValidationIssueDto[] = []
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export class ApiParseError extends Error {
  constructor(
    public readonly path: string,
    public readonly issues: z.ZodIssue[]
  ) {
    super(`API response for ${path} did not match the expected schema.`)
    this.name = 'ApiParseError'
  }
}

function parseResponse<TSchema extends z.ZodTypeAny>(
  path: string,
  schema: TSchema,
  value: unknown
): z.infer<TSchema> {
  const result = schema.safeParse(value)
  if (!result.success) {
    throw new ApiParseError(path, result.error.issues)
  }

  return result.data
}

interface AuthoredContentInput {
  id: string
  label: string
  status?: unknown
  userId?: string
  systemId: string
}

type AuthoredDetailInput = string | AuthoredDetailRequestDto

function normalizeAuthoredDetailInput(input: AuthoredDetailInput): AuthoredDetailRequestDto {
  return typeof input === 'string' ? { id: input } : input
}

interface AuthoredDomainTransport<TList, TResponse, TInput extends AuthoredContentInput> {
  activate: (input: TInput) => Promise<TResponse>
  activateDraft: (id: string) => Promise<TResponse>
  deleteActive: (id: string) => Promise<unknown>
  discardDraft: (id: string) => Promise<unknown>
  duplicate: (id: string) => Promise<AuthoredDraftDto | null>
  get: (input: AuthoredDetailRequestDto) => Promise<TResponse>
  getDraft: (id: string) => Promise<AuthoredDraftDto | null>
  list: () => Promise<TList>
  saveDraft: (input: TInput) => Promise<AuthoredDraftDto>
}

interface AuthoredDomainProcedures<TList, TResponse, TInput extends AuthoredContentInput> {
  activate: MutationProcedure<TInput, TResponse>
  activateDraft: MutationProcedure<IdProcedureInput, TResponse>
  deleteActive: MutationProcedure<IdProcedureInput, { ok: true }>
  discardDraft: MutationProcedure<IdProcedureInput, { ok: true }>
  duplicate: MutationProcedure<IdProcedureInput, AuthoredDraftDto | null>
  get: QueryProcedure<AuthoredDetailRequestDto, TResponse>
  getDraft: QueryProcedure<IdProcedureInput, AuthoredDraftDto | null>
  list: EmptyQueryProcedure<TList>
  saveDraft: MutationProcedure<TInput, AuthoredDraftDto>
}

interface TrpcClient {
  account: {
    completeInvitation: MutationProcedure<AuthInvitationCompletionInput, { ok: true }>
    entitlements: EmptyQueryProcedure<campaignContracts.EntitlementProjectionDto>
    profile: EmptyQueryProcedure<AccountProfileDto | null>
    signInWithUsername: MutationProcedure<AuthUsernameSignInInput, AuthSessionCredentialsDto>
    updateProfile: MutationProcedure<AccountProfileUpdateInput, AccountProfileDto>
    usernameStatus: QueryProcedure<AccountUsernameStatusInput, AccountUsernameStatusDto>
  }
  campaigns: {
    list: EmptyQueryProcedure<campaignContracts.CampaignSummaryDto[]>
    get: QueryProcedure<
      SchemaInput<typeof campaignContracts.campaignIdInputSchema>,
      campaignContracts.CampaignDetailDto
    >
    create: MutationProcedure<
      campaignContracts.CreateCampaignInput,
      campaignContracts.CampaignDetailDto
    >
    update: MutationProcedure<
      campaignContracts.UpdateCampaignInput,
      campaignContracts.CampaignDetailDto
    >
    archive: MutationProcedure<
      SchemaInput<typeof campaignContracts.archiveCampaignInputSchema>,
      campaignContracts.CampaignDetailDto
    >
    delete: MutationProcedure<
      SchemaInput<typeof campaignContracts.deleteCampaignInputSchema>,
      { ok: true }
    >
    invites: {
      create: MutationProcedure<
        campaignContracts.CreateCampaignInviteInput,
        campaignContracts.CampaignInviteDto
      >
      revoke: MutationProcedure<
        SchemaInput<typeof campaignContracts.revokeCampaignInviteInputSchema>,
        { ok: true }
      >
      accept: MutationProcedure<
        SchemaInput<typeof campaignContracts.acceptCampaignInviteInputSchema>,
        campaignContracts.CampaignDetailDto
      >
    }
    leave: MutationProcedure<
      SchemaInput<typeof campaignContracts.leaveCampaignInputSchema>,
      { ok: true }
    >
    removeMember: MutationProcedure<
      SchemaInput<typeof campaignContracts.removeCampaignMemberInputSchema>,
      { ok: true }
    >
    assignCharacter: MutationProcedure<
      SchemaInput<typeof campaignContracts.assignCampaignCharacterInputSchema>,
      { ok: true }
    >
    unassignCharacter: MutationProcedure<
      SchemaInput<typeof campaignContracts.unassignCampaignCharacterInputSchema>,
      { ok: true }
    >
    conversations: {
      list: QueryProcedure<
        SchemaInput<typeof campaignContracts.listCampaignConversationsInputSchema>,
        campaignContracts.CampaignConversationDto[]
      >
      markRead: MutationProcedure<
        SchemaInput<typeof campaignContracts.markCampaignConversationReadInputSchema>,
        { ok: true }
      >
    }
    chat: {
      list: QueryProcedure<
        SchemaInput<typeof campaignContracts.listCampaignChatEntriesInputSchema>,
        campaignContracts.CampaignChatPageDto
      >
      send: MutationProcedure<
        campaignContracts.SendCampaignChatEntryInput,
        campaignContracts.CampaignChatEntryDto
      >
      roll: MutationProcedure<
        campaignContracts.ExecuteCampaignRollInput,
        campaignContracts.CampaignChatEntryDto
      >
      privateRoll: MutationProcedure<
        campaignContracts.ExecuteCampaignPrivateRollInput,
        RollRecordDto
      >
      edit: MutationProcedure<
        SchemaInput<typeof campaignContracts.editCampaignChatEntryInputSchema>,
        campaignContracts.CampaignChatEntryDto
      >
      unsend: MutationProcedure<
        SchemaInput<typeof campaignContracts.unsendCampaignChatEntryInputSchema>,
        campaignContracts.CampaignChatEntryDto
      >
    }
    notebook: {
      list: QueryProcedure<
        SchemaInput<typeof campaignContracts.listCampaignNotebookSectionsInputSchema>,
        campaignContracts.CampaignNotebookSectionDto[]
      >
      create: MutationProcedure<
        SchemaInput<typeof campaignContracts.createCampaignNotebookSectionInputSchema>,
        campaignContracts.CampaignNotebookSectionDto
      >
      update: MutationProcedure<
        SchemaInput<typeof campaignContracts.updateCampaignNotebookSectionInputSchema>,
        campaignContracts.CampaignNotebookSectionDto
      >
      delete: MutationProcedure<
        SchemaInput<typeof campaignContracts.deleteCampaignNotebookSectionInputSchema>,
        { ok: true }
      >
    }
    sessions: {
      list: QueryProcedure<
        SchemaInput<typeof campaignContracts.listCampaignSessionsInputSchema>,
        campaignContracts.CampaignSessionDto[]
      >
      create: MutationProcedure<
        SchemaInput<typeof campaignContracts.createCampaignSessionInputSchema>,
        campaignContracts.CampaignSessionDto
      >
      update: MutationProcedure<
        SchemaInput<typeof campaignContracts.updateCampaignSessionInputSchema>,
        campaignContracts.CampaignSessionDto
      >
      delete: MutationProcedure<
        SchemaInput<typeof campaignContracts.deleteCampaignSessionInputSchema>,
        { ok: true }
      >
      finish: MutationProcedure<
        SchemaInput<typeof campaignContracts.finishCampaignSessionInputSchema>,
        campaignContracts.CampaignSessionDto
      >
      reopen: MutationProcedure<
        SchemaInput<typeof campaignContracts.reopenCampaignSessionInputSchema>,
        campaignContracts.CampaignSessionDto
      >
      get: QueryProcedure<
        SchemaInput<typeof campaignContracts.getCampaignSessionInputSchema>,
        campaignContracts.CampaignSessionDto
      >
      attendance: {
        list: QueryProcedure<
          SchemaInput<typeof campaignContracts.listCampaignSessionAttendanceInputSchema>,
          campaignContracts.CampaignSessionAttendanceDto[]
        >
        set: MutationProcedure<
          SchemaInput<typeof campaignContracts.setCampaignSessionAttendanceInputSchema>,
          campaignContracts.CampaignSessionAttendanceDto
        >
      }
      rsvps: {
        list: QueryProcedure<
          SchemaInput<typeof campaignContracts.listCampaignSessionRsvpsInputSchema>,
          campaignContracts.CampaignSessionRsvpDto[]
        >
        set: MutationProcedure<
          SchemaInput<typeof campaignContracts.setCampaignSessionRsvpInputSchema>,
          campaignContracts.CampaignSessionRsvpDto
        >
      }
      references: {
        list: QueryProcedure<
          SchemaInput<typeof campaignContracts.listCampaignSessionReferencePinsInputSchema>,
          campaignContracts.CampaignSessionReferencePinDto[]
        >
        create: MutationProcedure<
          SchemaInput<typeof campaignContracts.createCampaignSessionReferencePinInputSchema>,
          campaignContracts.CampaignSessionReferencePinDto
        >
        delete: MutationProcedure<
          SchemaInput<typeof campaignContracts.deleteCampaignSessionReferencePinInputSchema>,
          { ok: true }
        >
      }
      notes: {
        list: QueryProcedure<
          SchemaInput<typeof campaignContracts.listCampaignSessionNoteSectionsInputSchema>,
          campaignContracts.CampaignSessionNoteSectionDto[]
        >
        create: MutationProcedure<
          SchemaInput<typeof campaignContracts.createCampaignSessionNoteSectionInputSchema>,
          campaignContracts.CampaignSessionNoteSectionDto
        >
        update: MutationProcedure<
          SchemaInput<typeof campaignContracts.updateCampaignSessionNoteSectionInputSchema>,
          campaignContracts.CampaignSessionNoteSectionDto
        >
        delete: MutationProcedure<
          SchemaInput<typeof campaignContracts.deleteCampaignSessionNoteSectionInputSchema>,
          { ok: true }
        >
      }
    }
    clock: {
      get: QueryProcedure<
        SchemaInput<typeof campaignContracts.campaignIdInputSchema>,
        campaignContracts.CampaignClockDto | null
      >
      initialize: MutationProcedure<
        campaignContracts.InitializeCampaignClockInput,
        campaignContracts.CampaignClockDto
      >
      configure: MutationProcedure<
        campaignContracts.ConfigureCampaignClockInput,
        campaignContracts.CampaignClockDto
      >
      start: MutationProcedure<
        campaignContracts.StartCampaignClockInput,
        campaignContracts.CampaignClockDto
      >
      pause: MutationProcedure<
        campaignContracts.PauseCampaignClockInput,
        campaignContracts.CampaignClockDto
      >
      advance: MutationProcedure<
        campaignContracts.AdvanceCampaignClockInput,
        campaignContracts.CampaignClockDto
      >
      rewind: MutationProcedure<
        campaignContracts.RewindCampaignClockInput,
        campaignContracts.CampaignClockDto
      >
      reconcile: MutationProcedure<
        campaignContracts.ReconcileCampaignClockInput,
        campaignContracts.CampaignClockDto
      >
    }
    inventory: {
      currencySystems: QueryProcedure<
        SchemaInput<typeof campaignContracts.campaignIdInputSchema>,
        campaignContracts.CurrencySystemDto[]
      >
      get: QueryProcedure<
        SchemaInput<typeof campaignContracts.getCampaignInventoryInputSchema>,
        campaignContracts.InventoryDto
      >
      transfer: MutationProcedure<
        campaignContracts.TransferCampaignInventoryInput,
        campaignContracts.CampaignInventoryTransferResultDto
      >
      mutateParty: MutationProcedure<
        campaignContracts.CampaignPartyInventoryMutationInput,
        { eventId: string }
      >
      audit: QueryProcedure<
        campaignContracts.ListCampaignInventoryAuditInput,
        campaignContracts.CampaignInventoryAuditPageDto
      >
      saveCurrencySystem: MutationProcedure<
        campaignContracts.SaveCampaignCurrencySystemInput,
        campaignContracts.CurrencySystemDto
      >
      deleteCurrencySystem: MutationProcedure<
        SchemaInput<typeof campaignContracts.deleteCampaignCurrencySystemInputSchema>,
        { ok: true }
      >
    }
    content: {
      list: QueryProcedure<
        SchemaInput<typeof campaignContracts.campaignIdInputSchema>,
        campaignContracts.CampaignContentBindingDto[]
      >
      review: MutationProcedure<
        campaignContracts.ReviewCampaignContentVersionInput,
        campaignContracts.CampaignContentBindingDto
      >
    }
    gm: {
      adjustments: {
        list: QueryProcedure<
          SchemaInput<typeof campaignContracts.listCampaignAdjustmentsInputSchema>,
          campaignContracts.CampaignAdjustmentDto[]
        >
        delete: MutationProcedure<
          SchemaInput<typeof campaignContracts.deleteCampaignAdjustmentInputSchema>,
          { ok: true }
        >
      }
      conditions: {
        list: QueryProcedure<
          SchemaInput<typeof campaignContracts.listCampaignAdjustmentsInputSchema>,
          campaignContracts.CampaignConditionDto[]
        >
        save: MutationProcedure<
          campaignContracts.SaveCampaignConditionInput,
          campaignContracts.CampaignConditionDto
        >
        delete: MutationProcedure<campaignContracts.DeleteCampaignConditionInput, { ok: true }>
      }
      events: QueryProcedure<
        SchemaInput<typeof campaignContracts.listCampaignEventsInputSchema>,
        campaignContracts.CampaignEventPageDto
      >
    }
  }
  encounters: {
    templates: {
      list: QueryProcedure<
        SchemaInput<typeof encounterContracts.getCampaignEncounterTemplatesInputDtoSchema>,
        encounterContracts.EncounterTemplateDto[]
      >
      create: MutationProcedure<
        encounterContracts.CreateEncounterTemplateInputDto,
        encounterContracts.EncounterTemplateDto
      >
    }
    create: MutationProcedure<
      encounterContracts.CreateEncounterInputDto,
      encounterContracts.EncounterGmProjectionDto
    >
    get: QueryProcedure<
      SchemaInput<typeof encounterContracts.getEncounterInputDtoSchema>,
      encounterContracts.EncounterGmProjectionDto | encounterContracts.EncounterPlayerProjectionDto
    >
    active: QueryProcedure<
      SchemaInput<typeof encounterContracts.getCampaignEncounterInputDtoSchema>,
      | encounterContracts.EncounterGmProjectionDto
      | encounterContracts.EncounterPlayerProjectionDto
      | null
    >
    list: QueryProcedure<
      SchemaInput<typeof encounterContracts.getCampaignEncounterInputDtoSchema>,
      Array<
        | encounterContracts.EncounterGmProjectionDto
        | encounterContracts.EncounterPlayerProjectionDto
      >
    >
    command: MutationProcedure<
      encounterContracts.EncounterCommandInputDto,
      encounterContracts.EncounterCommandResultDto
    >
    timeline: QueryProcedure<
      SchemaInput<typeof encounterContracts.getEncounterTimelineInputDtoSchema>,
      encounterContracts.EncounterTimelineDto
    >
  }
  characters: {
    command: MutationProcedure<
      { id: string; input: CharacterSheetCommandInputDto },
      CharacterSheetCommandResponseDto
    >
    discardDraft: MutationProcedure<IdProcedureInput, { ok: true }>
    draft: MutationProcedure<CharacterDraftRequestDto, CharacterBuilderPayloadDto>
    get: QueryProcedure<IdProcedureInput, CharacterBuilderPayloadDto | null>
    getDraft: QueryProcedure<IdProcedureInput, CharacterBuilderDraftDto | null>
    history: QueryProcedure<IdProcedureInput, CharacterHistoryResponseDto>
    list: EmptyQueryProcedure<CharacterListResponseDto>
    panel: QueryProcedure<
      { id: string; target: CharacterSheetPanelTargetDto },
      CharacterSheetPanelDto
    >
    previewSave: MutationProcedure<
      CharacterBuilderSaveRequestDto,
      CharacterBuilderPreviewPayloadDto
    >
    resolve: MutationProcedure<CharacterBuilderResolveRequestDto, CharacterBuilderPayloadDto>
    restPreview: MutationProcedure<
      { id: string; input: CharacterRestPreviewRequestDto },
      CharacterRestPreviewResponseDto
    >
    saveDraft: MutationProcedure<
      { id: string; input: CharacterBuilderDraftSaveRequestDto },
      CharacterBuilderDraftDto
    >
    sheet: QueryProcedure<IdProcedureInput, CharacterSheetResponseDto | null>
    upsert: MutationProcedure<CharacterBuilderCommitRequestDto, CharacterBuilderPayloadDto>
  }
  content: {
    backgrounds: AuthoredDomainProcedures<
      BackgroundListResponseDto,
      BackgroundResponseDto,
      BackgroundAuthoringInputDto
    >
    classes: AuthoredDomainProcedures<
      ClassListResponseDto,
      ClassResponseDto,
      ClassAuthoringInputDto
    >
    creatures: AuthoredDomainProcedures<
      CreatureListResponseDto,
      CreatureResponseDto,
      CreatureAuthoringInputDto
    >
    equipment: AuthoredDomainProcedures<
      EquipmentListResponseDto,
      EquipmentResponseDto,
      EquipmentAuthoringInputDto
    >
    feats: AuthoredDomainProcedures<FeatListResponseDto, FeatResponseDto, FeatAuthoringInputDto>
    races: AuthoredDomainProcedures<RaceListResponseDto, RaceResponseDto, RaceAuthoringInputDto>
    spells: AuthoredDomainProcedures<SpellListResponseDto, SpellResponseDto, SpellAuthoringInputDto>
    vehicles: AuthoredDomainProcedures<
      VehicleListResponseDto,
      VehicleResponseDto,
      VehicleAuthoringInputDto
    >
  }
  media: {
    attachImage: MutationProcedure<AttachImageInput, { ok: true }>
    createImageUpload: MutationProcedure<
      CreateImageUploadIntentInput,
      z.infer<typeof createImageUploadIntentOutputSchema>
    >
    finalizeImageUpload: MutationProcedure<
      FinalizeImageUploadInput,
      z.infer<typeof finalizeImageUploadOutputSchema>
    >
    getImage: QueryProcedure<ImageLookupInput, SignedImageDeliveryDto | null>
    removeImage: MutationProcedure<RemoveImageInput, { ok: true }>
  }
  nodeRuntime: {
    normalizeValues: MutationProcedure<
      NodeRuntimeNormalizeValuesRequestDto,
      NodeRuntimeNormalizeValuesResponseDto
    >
    resolve: MutationProcedure<NodeRuntimeResolveRequestDto, NodeRuntimeResolveResponseDto>
  }
  rolls: {
    clearHistory: EmptyMutationProcedure<{ ok: true }>
    discard: MutationProcedure<IdProcedureInput, { ok: true }>
    executeConfiguration: MutationProcedure<ExecuteDiceConfigurationInputDto, RollResultDto>
    execute: MutationProcedure<ExecuteRollInputDto, RollRecordDto>
    history: EmptyQueryProcedure<RollHistoryResponseDto>
  }
  routeIds: {
    bySubject: QueryProcedure<RouteIdentityBySubjectRequestDto, RouteIdentityDto | null>
    resolve: QueryProcedure<RouteIdentityResolveRequestDto, RouteIdentityDto | null>
  }
  systems: {
    get: QueryProcedure<IdProcedureInput, SystemResponseDto>
    list: EmptyQueryProcedure<SystemListResponseDto>
  }
}

function createTrpcClient(): TrpcClient {
  const rawClient = createTRPCUntypedClient<AnyRouter>({
    links: [
      httpBatchLink<AnyRouter>({
        fetch: trpcFetch,
        url: '/api/trpc'
      })
    ]
  })

  return createProcedureProxy(rawClient) as TrpcClient
}

function createProcedureProxy(
  rawClient: ReturnType<typeof createTRPCUntypedClient<AnyRouter>>,
  path: string[] = []
): unknown {
  return new Proxy<Record<PropertyKey, unknown>>(
    {},
    {
      get(_target, property) {
        if (property === 'query') {
          return (input?: unknown) => rawClient.query(path.join('.'), input)
        }
        if (property === 'mutate') {
          return (input?: unknown, options?: ProcedureRequestOptions) =>
            rawClient.mutation(path.join('.'), input, options)
        }

        return createProcedureProxy(rawClient, [...path, String(property)])
      }
    }
  )
}

const getServerRequestInfo = createIsomorphicFn()
  .client(() => null)
  .server(async () => {
    const { getRequest } = await import('@tanstack/react-start/server')
    const request = getRequest()

    return {
      cookie: request.headers.get('cookie'),
      url: request.url
    }
  })

async function trpcFetch(input: FetchInput, init?: FetchInit): Promise<Response> {
  const headers = applySameOriginRequestHeader(new Headers(init?.headers))
  const serverRequestInfo = await getServerRequestInfo()

  if (serverRequestInfo) {
    if (serverRequestInfo.cookie && !headers.has('cookie')) {
      headers.set('cookie', serverRequestInfo.cookie)
    }

    const resolvedInput =
      input instanceof Request ? input : new URL(input.toString(), serverRequestInfo.url).toString()
    return fetch(resolvedInput, {
      ...init,
      headers
    })
  }

  return fetch(input, {
    ...init,
    credentials: 'same-origin',
    headers
  })
}

function mapTrpcError(error: unknown): never {
  if (isTRPCClientError<AnyRouter>(error)) {
    const status = typeof error.data?.httpStatus === 'number' ? error.data.httpStatus : 500
    const rawValidationIssues =
      error.data && typeof error.data === 'object' && 'validationIssues' in error.data
        ? error.data.validationIssues
        : undefined
    const validationIssues = authoredValidationIssueDtoSchema.array().safeParse(rawValidationIssues)
    throw new ApiError(status, error.message, validationIssues.success ? validationIssues.data : [])
  }

  throw error
}

async function request<TSchema extends z.ZodTypeAny>(
  path: string,
  schema: TSchema,
  procedure: () => Promise<unknown>
): Promise<z.infer<TSchema>> {
  try {
    return parseResponse(path, schema, await procedure())
  } catch (error) {
    mapTrpcError(error)
  }
}

function buildApi(client: TrpcClient) {
  function contentDomain<TList, TResponse, TInput extends AuthoredContentInput>(
    path: string,
    listSchema: z.ZodType<TList>,
    responseSchema: z.ZodType<TResponse>,
    transport: AuthoredDomainTransport<TList, TResponse, TInput>
  ) {
    const draftSchema = authoredDraftDtoSchema
    const nullableDraftSchema = authoredDraftDtoSchema.nullable()

    return {
      activate: (input: TInput) =>
        request(`${path}.activate`, responseSchema, () => transport.activate(input)),
      activateDraft: (id: string) =>
        request(`${path}.activateDraft`, responseSchema, () => transport.activateDraft(id)),
      deleteActive: async (id: string) => {
        await request(`${path}.deleteActive`, okResponseSchema, () => transport.deleteActive(id))
      },
      discardDraft: async (id: string) => {
        await request(`${path}.discardDraft`, okResponseSchema, () => transport.discardDraft(id))
      },
      duplicate: (id: string) =>
        request(`${path}.duplicate`, nullableDraftSchema, () => transport.duplicate(id)),
      get: (input: AuthoredDetailInput) =>
        request(`${path}.get`, responseSchema, () =>
          transport.get(normalizeAuthoredDetailInput(input))
        ),
      getDraft: (id: string) =>
        request(`${path}.getDraft`, nullableDraftSchema, () => transport.getDraft(id)),
      list: () => request(`${path}.list`, listSchema, () => transport.list()),
      saveDraft: (input: TInput) =>
        request(`${path}.saveDraft`, draftSchema, () => transport.saveDraft(input))
    }
  }

  return {
    account: {
      completeInvitation: (input: AuthInvitationCompletionInput) =>
        request('account.completeInvitation', okResponseSchema, () =>
          client.account.completeInvitation.mutate(input)
        ),
      entitlements: () =>
        request('account.entitlements', campaignContracts.entitlementProjectionDtoSchema, () =>
          client.account.entitlements.query()
        ),
      profile: () =>
        request('account.profile', accountProfileDtoSchema.nullable(), () =>
          client.account.profile.query()
        ),
      signInWithUsername: (input: AuthUsernameSignInInput) =>
        request('account.signInWithUsername', authSessionCredentialsDtoSchema, () =>
          client.account.signInWithUsername.mutate(input)
        ),
      updateProfile: (input: AccountProfileUpdateInput) =>
        request('account.updateProfile', accountProfileDtoSchema, () =>
          client.account.updateProfile.mutate(input)
        ),
      usernameStatus: (input: AccountUsernameStatusInput) =>
        request('account.usernameStatus', accountUsernameStatusDtoSchema, () =>
          client.account.usernameStatus.query(input)
        )
    },

    campaigns: {
      list: () =>
        request('campaigns.list', campaignContracts.campaignSummariesDtoSchema, () =>
          client.campaigns.list.query()
        ),
      get: (campaignId: string) =>
        request('campaigns.get', campaignContracts.campaignDetailDtoSchema, () =>
          client.campaigns.get.query({ campaignId })
        ),
      create: (input: campaignContracts.CreateCampaignInput) =>
        request('campaigns.create', campaignContracts.campaignDetailDtoSchema, () =>
          client.campaigns.create.mutate(input)
        ),
      update: (input: campaignContracts.UpdateCampaignInput) =>
        request('campaigns.update', campaignContracts.campaignDetailDtoSchema, () =>
          client.campaigns.update.mutate(input)
        ),
      archive: (campaignId: string, expectedVersion: number) =>
        request('campaigns.archive', campaignContracts.campaignDetailDtoSchema, () =>
          client.campaigns.archive.mutate({ campaignId, expectedVersion })
        ),
      delete: async (campaignId: string, expectedVersion: number) => {
        await request('campaigns.delete', okResponseSchema, () =>
          client.campaigns.delete.mutate({ campaignId, expectedVersion, confirmation: 'DELETE' })
        )
      },
      invites: {
        create: (input: campaignContracts.CreateCampaignInviteInput) =>
          request('campaigns.invites.create', campaignContracts.campaignInviteDtoSchema, () =>
            client.campaigns.invites.create.mutate(input)
          ),
        revoke: async (campaignId: string, inviteId: string) => {
          await request('campaigns.invites.revoke', okResponseSchema, () =>
            client.campaigns.invites.revoke.mutate({ campaignId, inviteId })
          )
        },
        accept: (token: string) =>
          request('campaigns.invites.accept', campaignContracts.campaignDetailDtoSchema, () =>
            client.campaigns.invites.accept.mutate({ token })
          )
      },
      leave: async (campaignId: string) => {
        await request('campaigns.leave', okResponseSchema, () =>
          client.campaigns.leave.mutate({ campaignId })
        )
      },
      removeMember: async (campaignId: string, userId: string) => {
        await request('campaigns.removeMember', okResponseSchema, () =>
          client.campaigns.removeMember.mutate({ campaignId, userId })
        )
      },
      assignCharacter: async (campaignId: string, characterId: string) => {
        await request('campaigns.assignCharacter', okResponseSchema, () =>
          client.campaigns.assignCharacter.mutate({ campaignId, characterId })
        )
      },
      unassignCharacter: async (campaignId: string, characterId?: string) => {
        await request('campaigns.unassignCharacter', okResponseSchema, () =>
          client.campaigns.unassignCharacter.mutate({ campaignId, characterId })
        )
      },
      conversations: {
        list: (campaignId: string) =>
          request(
            'campaigns.conversations.list',
            campaignContracts.campaignConversationsDtoSchema,
            () => client.campaigns.conversations.list.query({ campaignId })
          ),
        markRead: (
          input: SchemaInput<typeof campaignContracts.markCampaignConversationReadInputSchema>
        ) =>
          request('campaigns.conversations.markRead', okResponseSchema, () =>
            client.campaigns.conversations.markRead.mutate(input)
          )
      },
      chat: {
        list: (
          campaignId: string,
          room: 'TABLE' | 'PARTY' | 'DIRECT',
          cursor?: string,
          limit = 50,
          directUserId?: string
        ) =>
          request('campaigns.chat.list', campaignContracts.campaignChatPageDtoSchema, () =>
            client.campaigns.chat.list.query({ campaignId, room, cursor, limit, directUserId })
          ),
        send: (input: campaignContracts.SendCampaignChatEntryInput) =>
          request('campaigns.chat.send', campaignContracts.campaignChatEntryDtoSchema, () =>
            client.campaigns.chat.send.mutate(input)
          ),
        roll: (input: campaignContracts.ExecuteCampaignRollInput) =>
          request('campaigns.chat.roll', campaignContracts.campaignChatEntryDtoSchema, () =>
            client.campaigns.chat.roll.mutate(input)
          ),
        privateRoll: (input: campaignContracts.ExecuteCampaignPrivateRollInput) =>
          request('campaigns.chat.privateRoll', rollRecordDtoSchema, () =>
            client.campaigns.chat.privateRoll.mutate(input)
          ),
        edit: (campaignId: string, entryId: string, body: string) =>
          request('campaigns.chat.edit', campaignContracts.campaignChatEntryDtoSchema, () =>
            client.campaigns.chat.edit.mutate({ campaignId, entryId, body })
          ),
        unsend: (campaignId: string, entryId: string) =>
          request('campaigns.chat.unsend', campaignContracts.campaignChatEntryDtoSchema, () =>
            client.campaigns.chat.unsend.mutate({ campaignId, entryId })
          )
      },
      notebook: {
        list: (campaignId: string) =>
          request(
            'campaigns.notebook.list',
            campaignContracts.campaignNotebookSectionsDtoSchema,
            () => client.campaigns.notebook.list.query({ campaignId })
          ),
        create: (
          input: SchemaInput<typeof campaignContracts.createCampaignNotebookSectionInputSchema>
        ) =>
          request(
            'campaigns.notebook.create',
            campaignContracts.campaignNotebookSectionDtoSchema,
            () => client.campaigns.notebook.create.mutate(input)
          ),
        update: (
          input: SchemaInput<typeof campaignContracts.updateCampaignNotebookSectionInputSchema>
        ) =>
          request(
            'campaigns.notebook.update',
            campaignContracts.campaignNotebookSectionDtoSchema,
            () => client.campaigns.notebook.update.mutate(input)
          ),
        delete: async (campaignId: string, sectionId: string) => {
          await request('campaigns.notebook.delete', okResponseSchema, () =>
            client.campaigns.notebook.delete.mutate({ campaignId, sectionId })
          )
        }
      },
      sessions: {
        list: (campaignId: string) =>
          request('campaigns.sessions.list', campaignContracts.campaignSessionsDtoSchema, () =>
            client.campaigns.sessions.list.query({ campaignId })
          ),
        create: (input: SchemaInput<typeof campaignContracts.createCampaignSessionInputSchema>) =>
          request('campaigns.sessions.create', campaignContracts.campaignSessionDtoSchema, () =>
            client.campaigns.sessions.create.mutate(input)
          ),
        update: (input: SchemaInput<typeof campaignContracts.updateCampaignSessionInputSchema>) =>
          request('campaigns.sessions.update', campaignContracts.campaignSessionDtoSchema, () =>
            client.campaigns.sessions.update.mutate(input)
          ),
        delete: async (campaignId: string, sessionId: string) => {
          await request('campaigns.sessions.delete', okResponseSchema, () =>
            client.campaigns.sessions.delete.mutate({ campaignId, sessionId })
          )
        },
        finish: (
          input: SchemaInput<typeof campaignContracts.finishCampaignSessionInputSchema>
        ) =>
          request('campaigns.sessions.finish', campaignContracts.campaignSessionDtoSchema, () =>
            client.campaigns.sessions.finish.mutate(input)
          ),
        reopen: (
          input: SchemaInput<typeof campaignContracts.reopenCampaignSessionInputSchema>
        ) =>
          request('campaigns.sessions.reopen', campaignContracts.campaignSessionDtoSchema, () =>
            client.campaigns.sessions.reopen.mutate(input)
          ),
        get: (input: SchemaInput<typeof campaignContracts.getCampaignSessionInputSchema>) =>
          request('campaigns.sessions.get', campaignContracts.campaignSessionDtoSchema, () =>
            client.campaigns.sessions.get.query(input)
          ),
        attendance: {
          list: (
            input: SchemaInput<typeof campaignContracts.listCampaignSessionAttendanceInputSchema>
          ) =>
            request(
              'campaigns.sessions.attendance.list',
              campaignContracts.campaignSessionAttendanceDtoListSchema,
              () => client.campaigns.sessions.attendance.list.query(input)
            ),
          set: (
            input: SchemaInput<typeof campaignContracts.setCampaignSessionAttendanceInputSchema>
          ) =>
            request(
              'campaigns.sessions.attendance.set',
              campaignContracts.campaignSessionAttendanceDtoSchema,
              () => client.campaigns.sessions.attendance.set.mutate(input)
            )
        },
        rsvps: {
          list: (campaignId: string, sessionId: string) =>
            request(
              'campaigns.sessions.rsvps.list',
              campaignContracts.campaignSessionRsvpDtoListSchema,
              () => client.campaigns.sessions.rsvps.list.query({ campaignId, sessionId })
            ),
          set: (
            input: SchemaInput<typeof campaignContracts.setCampaignSessionRsvpInputSchema>
          ) =>
            request(
              'campaigns.sessions.rsvps.set',
              campaignContracts.campaignSessionRsvpDtoSchema,
              () => client.campaigns.sessions.rsvps.set.mutate(input)
            )
        },
        references: {
          list: (campaignId: string, sessionId: string) =>
            request(
              'campaigns.sessions.references.list',
              campaignContracts.campaignSessionReferencePinsDtoSchema,
              () => client.campaigns.sessions.references.list.query({ campaignId, sessionId })
            ),
          create: (
            input: SchemaInput<
              typeof campaignContracts.createCampaignSessionReferencePinInputSchema
            >
          ) =>
            request(
              'campaigns.sessions.references.create',
              campaignContracts.campaignSessionReferencePinDtoSchema,
              () => client.campaigns.sessions.references.create.mutate(input)
            ),
          delete: async (campaignId: string, sessionId: string, pinId: string) => {
            await request('campaigns.sessions.references.delete', okResponseSchema, () =>
              client.campaigns.sessions.references.delete.mutate({
                campaignId,
                sessionId,
                pinId
              })
            )
          }
        },
        notes: {
          list: (campaignId: string, sessionId: string) =>
            request(
              'campaigns.sessions.notes.list',
              campaignContracts.campaignSessionNoteSectionsDtoSchema,
              () => client.campaigns.sessions.notes.list.query({ campaignId, sessionId })
            ),
          create: (
            input: SchemaInput<typeof campaignContracts.createCampaignSessionNoteSectionInputSchema>
          ) =>
            request(
              'campaigns.sessions.notes.create',
              campaignContracts.campaignSessionNoteSectionDtoSchema,
              () => client.campaigns.sessions.notes.create.mutate(input)
            ),
          update: (
            input: SchemaInput<typeof campaignContracts.updateCampaignSessionNoteSectionInputSchema>
          ) =>
            request(
              'campaigns.sessions.notes.update',
              campaignContracts.campaignSessionNoteSectionDtoSchema,
              () => client.campaigns.sessions.notes.update.mutate(input)
            ),
          delete: async (campaignId: string, sessionId: string, sectionId: string) => {
            await request('campaigns.sessions.notes.delete', okResponseSchema, () =>
              client.campaigns.sessions.notes.delete.mutate({ campaignId, sessionId, sectionId })
            )
          }
        }
      },
      clock: {
        get: (campaignId: string) =>
          request('campaigns.clock.get', campaignContracts.campaignClockDtoSchema.nullable(), () =>
            client.campaigns.clock.get.query({ campaignId })
          ),
        initialize: (input: campaignContracts.InitializeCampaignClockInput) =>
          request('campaigns.clock.initialize', campaignContracts.campaignClockDtoSchema, () =>
            client.campaigns.clock.initialize.mutate(input)
          ),
        configure: (input: campaignContracts.ConfigureCampaignClockInput) =>
          request('campaigns.clock.configure', campaignContracts.campaignClockDtoSchema, () =>
            client.campaigns.clock.configure.mutate(input)
          ),
        start: (input: campaignContracts.StartCampaignClockInput) =>
          request('campaigns.clock.start', campaignContracts.campaignClockDtoSchema, () =>
            client.campaigns.clock.start.mutate(input)
          ),
        pause: (input: campaignContracts.PauseCampaignClockInput) =>
          request('campaigns.clock.pause', campaignContracts.campaignClockDtoSchema, () =>
            client.campaigns.clock.pause.mutate(input)
          ),
        advance: (input: campaignContracts.AdvanceCampaignClockInput) =>
          request('campaigns.clock.advance', campaignContracts.campaignClockDtoSchema, () =>
            client.campaigns.clock.advance.mutate(input)
          ),
        rewind: (input: campaignContracts.RewindCampaignClockInput) =>
          request('campaigns.clock.rewind', campaignContracts.campaignClockDtoSchema, () =>
            client.campaigns.clock.rewind.mutate(input)
          ),
        reconcile: (input: campaignContracts.ReconcileCampaignClockInput) =>
          request('campaigns.clock.reconcile', campaignContracts.campaignClockDtoSchema, () =>
            client.campaigns.clock.reconcile.mutate(input)
          )
      },
      inventory: {
        currencySystems: (campaignId: string) =>
          request(
            'campaigns.inventory.currencySystems',
            campaignContracts.currencySystemDtoSchema.array(),
            () => client.campaigns.inventory.currencySystems.query({ campaignId })
          ),
        get: (campaignId: string, owner: campaignContracts.InventoryOwnerRefDto) =>
          request('campaigns.inventory.get', campaignContracts.inventoryDtoSchema, () =>
            client.campaigns.inventory.get.query({ campaignId, owner })
          ),
        transfer: (input: campaignContracts.TransferCampaignInventoryInput) =>
          request(
            'campaigns.inventory.transfer',
            campaignContracts.campaignInventoryTransferResultDtoSchema,
            () => client.campaigns.inventory.transfer.mutate(input)
          ),
        mutateParty: (input: campaignContracts.CampaignPartyInventoryMutationInput) =>
          request(
            'campaigns.inventory.mutateParty',
            campaignContracts.campaignPartyInventoryMutationResultDtoSchema,
            () => client.campaigns.inventory.mutateParty.mutate(input)
          ),
        audit: (input: campaignContracts.ListCampaignInventoryAuditInput) =>
          request(
            'campaigns.inventory.audit',
            campaignContracts.campaignInventoryAuditPageDtoSchema,
            () => client.campaigns.inventory.audit.query(input)
          ),
        saveCurrencySystem: (input: campaignContracts.SaveCampaignCurrencySystemInput) =>
          request(
            'campaigns.inventory.saveCurrencySystem',
            campaignContracts.currencySystemDtoSchema,
            () => client.campaigns.inventory.saveCurrencySystem.mutate(input)
          ),
        deleteCurrencySystem: async (
          campaignId: string,
          systemId: string,
          expectedVersion: number
        ) => {
          await request('campaigns.inventory.deleteCurrencySystem', okResponseSchema, () =>
            client.campaigns.inventory.deleteCurrencySystem.mutate({
              campaignId,
              systemId,
              expectedVersion
            })
          )
        }
      },
      content: {
        list: (campaignId: string) =>
          request(
            'campaigns.content.list',
            campaignContracts.campaignContentBindingDtoSchema.array(),
            () => client.campaigns.content.list.query({ campaignId })
          ),
        review: (input: campaignContracts.ReviewCampaignContentVersionInput) =>
          request(
            'campaigns.content.review',
            campaignContracts.campaignContentBindingDtoSchema,
            () => client.campaigns.content.review.mutate(input)
          )
      },
      gm: {
        adjustments: {
          list: (campaignId: string, characterId: string) =>
            request(
              'campaigns.gm.adjustments.list',
              campaignContracts.campaignAdjustmentsDtoSchema,
              () => client.campaigns.gm.adjustments.list.query({ campaignId, characterId })
            ),
          delete: async (
            campaignId: string,
            characterId: string,
            adjustmentId: string,
            expectedVersion: number
          ) => {
            await request('campaigns.gm.adjustments.delete', okResponseSchema, () =>
              client.campaigns.gm.adjustments.delete.mutate({
                campaignId,
                characterId,
                adjustmentId,
                expectedVersion
              })
            )
          }
        },
        conditions: {
          list: (campaignId: string, characterId: string) =>
            request(
              'campaigns.gm.conditions.list',
              campaignContracts.campaignConditionsDtoSchema,
              () => client.campaigns.gm.conditions.list.query({ campaignId, characterId })
            ),
          save: (input: campaignContracts.SaveCampaignConditionInput) =>
            request(
              'campaigns.gm.conditions.save',
              campaignContracts.campaignConditionDtoSchema,
              () => client.campaigns.gm.conditions.save.mutate(input)
            ),
          delete: async (input: campaignContracts.DeleteCampaignConditionInput) => {
            await request('campaigns.gm.conditions.delete', okResponseSchema, () =>
              client.campaigns.gm.conditions.delete.mutate(input)
            )
          }
        },
        events: (campaignId: string, characterId: string, cursor?: string, limit = 50) =>
          request('campaigns.gm.events', campaignContracts.campaignEventPageDtoSchema, () =>
            client.campaigns.gm.events.query({ campaignId, characterId, cursor, limit })
          )
      }
    },

    characters: {
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
      upsert: (input: CharacterBuilderCommitRequestDto) =>
        request('characters.upsert', characterBuilderPayloadDtoSchema, () =>
          client.characters.upsert.mutate(input)
        )
    },

    rolls: {
      clearHistory: () =>
        request('rolls.clearHistory', okResponseSchema, () => client.rolls.clearHistory.mutate()),
      discard: (id: string) =>
        request('rolls.discard', okResponseSchema, () => client.rolls.discard.mutate({ id })),
      executeConfiguration: (input: ExecuteDiceConfigurationInputDto) =>
        request('rolls.executeConfiguration', rollResultDtoSchema, () =>
          client.rolls.executeConfiguration.mutate(
            executeDiceConfigurationInputDtoSchema.parse(input)
          )
        ),
      execute: (input: ExecuteRollInputDto) =>
        request('rolls.execute', rollRecordDtoSchema, () => client.rolls.execute.mutate(input)),
      history: () =>
        request('rolls.history', rollHistoryResponseDtoSchema, () => client.rolls.history.query())
    },

    content: {
      backgrounds: contentDomain<
        BackgroundListResponseDto,
        BackgroundResponseDto,
        BackgroundAuthoringInputDto
      >('content.backgrounds', backgroundListResponseDtoSchema, backgroundResponseDtoSchema, {
        activate: (input) => client.content.backgrounds.activate.mutate(input),
        activateDraft: (id) => client.content.backgrounds.activateDraft.mutate({ id }),
        deleteActive: (id) => client.content.backgrounds.deleteActive.mutate({ id }),
        discardDraft: (id) => client.content.backgrounds.discardDraft.mutate({ id }),
        duplicate: (id) => client.content.backgrounds.duplicate.mutate({ id }),
        get: (input) => client.content.backgrounds.get.query(input),
        getDraft: (id) => client.content.backgrounds.getDraft.query({ id }),
        list: () => client.content.backgrounds.list.query(),
        saveDraft: (input) => client.content.backgrounds.saveDraft.mutate(input)
      }),
      classes: contentDomain<ClassListResponseDto, ClassResponseDto, ClassAuthoringInputDto>(
        'content.classes',
        classListResponseDtoSchema,
        classResponseDtoSchema,
        {
          activate: (input) => client.content.classes.activate.mutate(input),
          activateDraft: (id) => client.content.classes.activateDraft.mutate({ id }),
          deleteActive: (id) => client.content.classes.deleteActive.mutate({ id }),
          discardDraft: (id) => client.content.classes.discardDraft.mutate({ id }),
          duplicate: (id) => client.content.classes.duplicate.mutate({ id }),
          get: (input) => client.content.classes.get.query(input),
          getDraft: (id) => client.content.classes.getDraft.query({ id }),
          list: () => client.content.classes.list.query(),
          saveDraft: (input) => client.content.classes.saveDraft.mutate(input)
        }
      ),
      equipment: contentDomain<
        EquipmentListResponseDto,
        EquipmentResponseDto,
        EquipmentAuthoringInputDto
      >('content.equipment', equipmentListResponseDtoSchema, equipmentResponseDtoSchema, {
        activate: (input) => client.content.equipment.activate.mutate(input),
        activateDraft: (id) => client.content.equipment.activateDraft.mutate({ id }),
        deleteActive: (id) => client.content.equipment.deleteActive.mutate({ id }),
        discardDraft: (id) => client.content.equipment.discardDraft.mutate({ id }),
        duplicate: (id) => client.content.equipment.duplicate.mutate({ id }),
        get: (input) => client.content.equipment.get.query(input),
        getDraft: (id) => client.content.equipment.getDraft.query({ id }),
        list: () => client.content.equipment.list.query(),
        saveDraft: (input) => client.content.equipment.saveDraft.mutate(input)
      }),
      feats: contentDomain<FeatListResponseDto, FeatResponseDto, FeatAuthoringInputDto>(
        'content.feats',
        featListResponseDtoSchema,
        featResponseDtoSchema,
        {
          activate: (input) => client.content.feats.activate.mutate(input),
          activateDraft: (id) => client.content.feats.activateDraft.mutate({ id }),
          deleteActive: (id) => client.content.feats.deleteActive.mutate({ id }),
          discardDraft: (id) => client.content.feats.discardDraft.mutate({ id }),
          duplicate: (id) => client.content.feats.duplicate.mutate({ id }),
          get: (input) => client.content.feats.get.query(input),
          getDraft: (id) => client.content.feats.getDraft.query({ id }),
          list: () => client.content.feats.list.query(),
          saveDraft: (input) => client.content.feats.saveDraft.mutate(input)
        }
      ),
      races: contentDomain<RaceListResponseDto, RaceResponseDto, RaceAuthoringInputDto>(
        'content.races',
        raceListResponseDtoSchema,
        raceResponseDtoSchema,
        {
          activate: (input) => client.content.races.activate.mutate(input),
          activateDraft: (id) => client.content.races.activateDraft.mutate({ id }),
          deleteActive: (id) => client.content.races.deleteActive.mutate({ id }),
          discardDraft: (id) => client.content.races.discardDraft.mutate({ id }),
          duplicate: (id) => client.content.races.duplicate.mutate({ id }),
          get: (input) => client.content.races.get.query(input),
          getDraft: (id) => client.content.races.getDraft.query({ id }),
          list: () => client.content.races.list.query(),
          saveDraft: (input) => client.content.races.saveDraft.mutate(input)
        }
      ),
      spells: contentDomain<SpellListResponseDto, SpellResponseDto, SpellAuthoringInputDto>(
        'content.spells',
        spellListResponseDtoSchema,
        spellResponseDtoSchema,
        {
          activate: (input) => client.content.spells.activate.mutate(input),
          activateDraft: (id) => client.content.spells.activateDraft.mutate({ id }),
          deleteActive: (id) => client.content.spells.deleteActive.mutate({ id }),
          discardDraft: (id) => client.content.spells.discardDraft.mutate({ id }),
          duplicate: (id) => client.content.spells.duplicate.mutate({ id }),
          get: (input) => client.content.spells.get.query(input),
          getDraft: (id) => client.content.spells.getDraft.query({ id }),
          list: () => client.content.spells.list.query(),
          saveDraft: (input) => client.content.spells.saveDraft.mutate(input)
        }
      ),
      creatures: contentDomain<
        CreatureListResponseDto,
        CreatureResponseDto,
        CreatureAuthoringInputDto
      >('content.creatures', creatureListResponseDtoSchema, creatureResponseDtoSchema, {
        activate: (input) => client.content.creatures.activate.mutate(input),
        activateDraft: (id) => client.content.creatures.activateDraft.mutate({ id }),
        deleteActive: (id) => client.content.creatures.deleteActive.mutate({ id }),
        discardDraft: (id) => client.content.creatures.discardDraft.mutate({ id }),
        duplicate: (id) => client.content.creatures.duplicate.mutate({ id }),
        get: (input) => client.content.creatures.get.query(input),
        getDraft: (id) => client.content.creatures.getDraft.query({ id }),
        list: () => client.content.creatures.list.query(),
        saveDraft: (input) => client.content.creatures.saveDraft.mutate(input)
      }),
      vehicles: contentDomain<VehicleListResponseDto, VehicleResponseDto, VehicleAuthoringInputDto>(
        'content.vehicles',
        vehicleListResponseDtoSchema,
        vehicleResponseDtoSchema,
        {
          activate: (input) => client.content.vehicles.activate.mutate(input),
          activateDraft: (id) => client.content.vehicles.activateDraft.mutate({ id }),
          deleteActive: (id) => client.content.vehicles.deleteActive.mutate({ id }),
          discardDraft: (id) => client.content.vehicles.discardDraft.mutate({ id }),
          duplicate: (id) => client.content.vehicles.duplicate.mutate({ id }),
          get: (input) => client.content.vehicles.get.query(input),
          getDraft: (id) => client.content.vehicles.getDraft.query({ id }),
          list: () => client.content.vehicles.list.query(),
          saveDraft: (input) => client.content.vehicles.saveDraft.mutate(input)
        }
      )
    },

    encounters: {
      templates: {
        list: (campaignId: string) =>
          request('encounters.templates.list', encounterContracts.encounterTemplateListDtoSchema, () =>
            client.encounters.templates.list.query({ campaignId })
          ),
        create: (input: encounterContracts.CreateEncounterTemplateInputDto) =>
          request('encounters.templates.create', encounterContracts.encounterTemplateDtoSchema, () =>
            client.encounters.templates.create.mutate(input)
          )
      },
      create: (input: encounterContracts.CreateEncounterInputDto) =>
        request('encounters.create', encounterContracts.encounterGmProjectionDtoSchema, () =>
          client.encounters.create.mutate(input)
        ),
      get: (encounterId: string) =>
        request('encounters.get', encounterContracts.encounterProjectionDtoSchema, () =>
          client.encounters.get.query({ encounterId })
        ),
      active: (campaignId: string) =>
        request(
          'encounters.active',
          encounterContracts.encounterProjectionDtoSchema.nullable(),
          () => client.encounters.active.query({ campaignId })
        ),
      list: (campaignId: string) =>
        request('encounters.list', encounterContracts.encounterProjectionListDtoSchema, () =>
          client.encounters.list.query({ campaignId })
        ),
      command: (input: encounterContracts.EncounterCommandInputDto) =>
        request('encounters.command', encounterContracts.encounterCommandResultDtoSchema, () =>
          client.encounters.command.mutate(input)
        ),
      timeline: (
        input: SchemaInput<typeof encounterContracts.getEncounterTimelineInputDtoSchema>
      ) =>
        request('encounters.timeline', encounterContracts.encounterTimelineDtoSchema, () =>
          client.encounters.timeline.query(input)
        )
    },

    systems: {
      get: (id: string) =>
        request('systems.get', systemResponseDtoSchema, () => client.systems.get.query({ id })),
      list: () =>
        request('systems.list', systemListResponseDtoSchema, () => client.systems.list.query())
    },

    media: {
      attachImage: (input: AttachImageInput) =>
        request('media.attachImage', okResponseSchema, () =>
          client.media.attachImage.mutate(input)
        ),
      createImageUpload: (input: CreateImageUploadIntentInput) =>
        request('media.createImageUpload', createImageUploadIntentOutputSchema, () =>
          client.media.createImageUpload.mutate(input)
        ),
      finalizeImageUpload: (input: FinalizeImageUploadInput) =>
        request('media.finalizeImageUpload', finalizeImageUploadOutputSchema, () =>
          client.media.finalizeImageUpload.mutate(input)
        ),
      getImage: (input: ImageLookupInput) =>
        request('media.getImage', signedImageDeliveryDtoSchema.nullable(), () =>
          client.media.getImage.query(input)
        ),
      removeImage: (input: RemoveImageInput) =>
        request('media.removeImage', okResponseSchema, () => client.media.removeImage.mutate(input))
    },

    nodeRuntime: {
      normalizeValues: (input: NodeRuntimeNormalizeValuesRequestDto) =>
        request('nodeRuntime.normalizeValues', nodeRuntimeNormalizeValuesResponseDtoSchema, () =>
          client.nodeRuntime.normalizeValues.mutate(input)
        ),
      resolve: (input: NodeRuntimeResolveRequestDto) =>
        request('nodeRuntime.resolve', nodeRuntimeResolveResponseDtoSchema, () =>
          client.nodeRuntime.resolve.mutate(input)
        )
    },

    routeIds: {
      bySubject: (input: RouteIdentityBySubjectRequestDto) =>
        request('routeIds.bySubject', routeIdentityDtoSchema.nullable(), () =>
          client.routeIds.bySubject.query(input)
        ),
      resolve: (input: RouteIdentityResolveRequestDto) =>
        request('routeIds.resolve', routeIdentityDtoSchema.nullable(), () =>
          client.routeIds.resolve.query(input)
        )
    }
  }
}

const trpcClient = createTrpcClient()

export const api = buildApi(trpcClient)

export function createServerApi(_userId?: string | null) {
  return api
}

export type Api = ReturnType<typeof buildApi>
