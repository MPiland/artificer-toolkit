import { createTRPCUntypedClient, httpBatchLink, isTRPCClientError } from '@trpc/client'
import { createIsomorphicFn } from '@tanstack/react-start'
import type { AnyRouter } from '@trpc/server'
import { z } from 'zod'
import {
  authoredValidationIssueDtoSchema,
  type AuthoredDetailRequestDto,
  type AuthoredDraftDto,
  type AuthoredValidationIssueDto,
  type BackgroundListRequestDto,
  type BackgroundListResponseDto,
  type BackgroundResponseDto,
  type ClassListRequestDto,
  type ClassListResponseDto,
  type ClassResponseDto,
  type CreatureListRequestDto,
  type CreatureListResponseDto,
  type CreatureResponseDto,
  type EquipmentListRequestDto,
  type EquipmentListResponseDto,
  type EquipmentResponseDto,
  type FeatListRequestDto,
  type FeatListResponseDto,
  type FeatResponseDto,
  type RaceListRequestDto,
  type RaceListResponseDto,
  type RaceResponseDto,
  type SpellListRequestDto,
  type SpellListResponseDto,
  type SpellResponseDto,
  type VehicleListRequestDto,
  type VehicleListResponseDto,
  type VehicleResponseDto
} from '@artificer-toolkit/schema/api/content'
import type {
  AccountProfileDto,
  AccountProfileUpdateInput,
  AccountUsernameStatusDto,
  AccountUsernameStatusInput
} from '@artificer-toolkit/schema/api/account'
import type {
  AuthInvitationCompletionInput,
  AuthSessionCredentialsDto,
  AuthUsernameSignInInput
} from '@artificer-toolkit/schema/api/auth'
import type {
  CharacterBuilderCommitRequestDto,
  CharacterBuilderCommitReceiptDto,
  CharacterBuilderDraftDto,
  CharacterBuilderDraftSaveRequestDto,
  CharacterBuilderPayloadDto,
  CharacterBuilderPreviewPayloadDto,
  CharacterBuilderResolveRequestDto,
  CharacterBuilderSaveRequestDto,
  CharacterDraftRequestDto,
  CharacterHistoryResponseDto,
  CharacterListResponseDto,
  CharacterRestPreviewResponseDto,
  CharacterSheetExtraCatalogInputDto,
  CharacterSheetExtraCatalogResponseDto,
  CharacterSheetCommandInputDto,
  CharacterSheetCommandResponseDto,
  CharacterSheetResponseDto
} from '@artificer-toolkit/schema/api/characters'
import type {
  CharacterSheetPanelDto,
  CharacterSheetPanelTargetDto
} from '@artificer-toolkit/schema/api/characterSheetPanel'
import type {
  AttachImageInput,
  CreateCampaignFileUploadIntentInput,
  CreateImageUploadIntentInput,
  CreateVttMapUploadIntentInput,
  FinalizeImageUploadInput,
  FinalizeVttMapUploadOutput,
  ImageLookupInput,
  RemoveImageInput,
  SignedCampaignFileDeliveryDto,
  SignedImageDeliveryDto,
  SignedVttMapDeliveryDto
} from '@artificer-toolkit/schema/api/media'
import type {
  LiveSessionJoinOptionsDto,
  LiveSessionTicketDto
} from '@artificer-toolkit/schema/api/liveSessions'
import type {
  AttachEncounterSceneInputDto,
  AttachEncounterSceneResultDto,
  DeleteSceneDefinitionInputDto,
  EncounterSceneStateDto,
  GetEncounterSceneInputDto,
  GetSceneDefinitionInputDto,
  SceneDefinitionDto
} from '@artificer-toolkit/schema/api/vttScenes'
import type * as vttSceneContracts from '@artificer-toolkit/schema/api/vttScenes'
import type {
  NodeRuntimeNormalizeValuesRequestDto,
  NodeRuntimeNormalizeValuesResponseDto,
  NodeRuntimeResolveRequestDto,
  NodeRuntimeResolveResponseDto
} from '@artificer-toolkit/schema/api/nodeRuntime'
import type {
  RouteIdentityBySubjectRequestDto,
  RouteIdentityDto,
  RouteIdentityResolveRequestDto
} from '@artificer-toolkit/schema/api/routeIds'
import type {
  ExecuteDiceConfigurationInputDto,
  ExecuteRollInputDto,
  RollHistoryResponseDto,
  RollRecordDto,
  RollResultDto
} from '@artificer-toolkit/schema/api/rolls'
import type {
  SystemListResponseDto,
  SystemResponseDto
} from '@artificer-toolkit/schema/api/systems'
import type * as ruleContracts from '@artificer-toolkit/schema/api/rules'
import * as campaignContracts from '@artificer-toolkit/schema/api/campaigns'
import * as encounterContracts from '@artificer-toolkit/schema/api/encounters'
import * as notificationContracts from '@artificer-toolkit/schema/api/notifications'
import * as socialContracts from '@artificer-toolkit/schema/api/socialHub'
import type { BackgroundAuthoringInputDto } from '@artificer-toolkit/schema/subjects/background'
import type { ClassAuthoringInputDto } from '@artificer-toolkit/schema/subjects/class'
import type { CreatureAuthoringInputDto } from '@artificer-toolkit/schema/subjects/creature'
import type { EquipmentAuthoringInputDto } from '@artificer-toolkit/schema/subjects/equipment'
import type { FeatAuthoringInputDto } from '@artificer-toolkit/schema/subjects/feat'
import type { RaceAuthoringInputDto } from '@artificer-toolkit/schema/subjects/race'
import type { SpellAuthoringInputDto } from '@artificer-toolkit/schema/subjects/spell'
import type { VehicleAuthoringInputDto } from '@artificer-toolkit/schema/subjects/vehicle'
import { applySameOriginRequestHeader } from '../trpcRequestSecurity'

type FetchInput = Parameters<typeof fetch>[0]
type FetchInit = Parameters<typeof fetch>[1]

export interface IdProcedureInput {
  id: string
}

export interface QueryProcedure<TInput, TOutput> {
  query: (input: TInput) => Promise<TOutput>
}

export interface EmptyQueryProcedure<TOutput> {
  query: () => Promise<TOutput>
}

export interface EmptyMutationProcedure<TOutput> {
  mutate: () => Promise<TOutput>
}

export interface ProcedureRequestOptions {
  signal?: AbortSignal
}

export interface MutationProcedure<TInput, TOutput> {
  mutate: (input: TInput, options?: ProcedureRequestOptions) => Promise<TOutput>
}

export type SchemaInput<TSchema extends z.ZodTypeAny> = z.input<TSchema>

export const okResponseSchema = z.object({
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

export function parseResponse<TSchema extends z.ZodTypeAny>(
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

export interface AuthoredContentInput {
  id: string
  label: string
  status?: unknown
  userId?: string
  systemId: string
}

export type AuthoredDetailInput = string | AuthoredDetailRequestDto

export function normalizeAuthoredDetailInput(input: AuthoredDetailInput): AuthoredDetailRequestDto {
  return typeof input === 'string' ? { id: input } : input
}

export interface AuthoredDomainTransport<
  TList,
  TResponse,
  TInput extends AuthoredContentInput,
  TListInput
> {
  activate: (input: TInput) => Promise<TResponse>
  activateDraft: (id: string) => Promise<TResponse>
  deleteActive: (id: string) => Promise<unknown>
  discardDraft: (id: string) => Promise<unknown>
  duplicate: (id: string) => Promise<AuthoredDraftDto | null>
  get: (input: AuthoredDetailRequestDto) => Promise<TResponse>
  getDraft: (id: string) => Promise<AuthoredDraftDto | null>
  list: (input: TListInput) => Promise<TList>
  saveDraft: (input: TInput) => Promise<AuthoredDraftDto>
}

export interface AuthoredDomainProcedures<
  TList,
  TResponse,
  TInput extends AuthoredContentInput,
  TListInput
> {
  activate: MutationProcedure<TInput, TResponse>
  activateDraft: MutationProcedure<IdProcedureInput, TResponse>
  deleteActive: MutationProcedure<IdProcedureInput, { ok: true }>
  discardDraft: MutationProcedure<IdProcedureInput, { ok: true }>
  duplicate: MutationProcedure<IdProcedureInput, AuthoredDraftDto | null>
  get: QueryProcedure<AuthoredDetailRequestDto, TResponse>
  getDraft: QueryProcedure<IdProcedureInput, AuthoredDraftDto | null>
  list: QueryProcedure<TListInput, TList>
  saveDraft: MutationProcedure<TInput, AuthoredDraftDto>
}

export interface TrpcClient {
  notifications: {
    feed: EmptyQueryProcedure<notificationContracts.NotificationFeedDto>
    markAllSeen: EmptyMutationProcedure<{ ok: true }>
    markRead: MutationProcedure<
      SchemaInput<typeof notificationContracts.notificationFeedItemIdInputSchema>,
      { ok: true }
    >
    preferences: EmptyQueryProcedure<notificationContracts.NotificationPreferencesDto>
    updatePreferences: MutationProcedure<
      notificationContracts.UpdateNotificationPreferencesInput,
      notificationContracts.NotificationPreferencesDto
    >
  }
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
    getSettings: QueryProcedure<
      SchemaInput<typeof campaignContracts.campaignIdInputSchema>,
      campaignContracts.CampaignDetailDto
    >
    playSettings: {
      get: QueryProcedure<
        SchemaInput<typeof campaignContracts.getCampaignPlaySettingsInputSchema>,
        campaignContracts.CampaignPlaySettingsDto
      >
      save: MutationProcedure<
        campaignContracts.SaveCampaignPlaySettingsInput,
        campaignContracts.CampaignPlaySettingsDto
      >
    }
    create: MutationProcedure<
      campaignContracts.CreateCampaignInput,
      campaignContracts.CampaignDetailDto
    >
    copy: MutationProcedure<
      campaignContracts.CopyCampaignInput,
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
      listReceived: EmptyQueryProcedure<campaignContracts.CampaignInviteDto[]>
      listSent: QueryProcedure<{ listingPublicId: string }, campaignContracts.CampaignInviteDto[]>
      revoke: MutationProcedure<
        SchemaInput<typeof campaignContracts.revokeCampaignInviteInputSchema>,
        { ok: true }
      >
      accept: MutationProcedure<
        SchemaInput<typeof campaignContracts.acceptCampaignInviteInputSchema>,
        campaignContracts.CampaignDetailDto
      >
      decline: MutationProcedure<
        SchemaInput<typeof campaignContracts.declineCampaignInviteInputSchema>,
        { ok: true }
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
      ticket: MutationProcedure<LiveSessionJoinOptionsDto, LiveSessionTicketDto>
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
      finish: MutationProcedure<
        SchemaInput<typeof campaignContracts.finishCampaignSessionInputSchema>,
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
    scenes: {
      attach: MutationProcedure<AttachEncounterSceneInputDto, AttachEncounterSceneResultDto>
      create: MutationProcedure<
        SchemaInput<typeof vttSceneContracts.createSceneDefinitionInputDtoSchema>,
        SceneDefinitionDto
      >
      delete: MutationProcedure<DeleteSceneDefinitionInputDto, { ok: true }>
      get: QueryProcedure<GetSceneDefinitionInputDto, SceneDefinitionDto>
      list: QueryProcedure<{ campaignId: string }, SceneDefinitionDto[]>
      projection: QueryProcedure<GetEncounterSceneInputDto, EncounterSceneStateDto>
      update: MutationProcedure<
        SchemaInput<typeof vttSceneContracts.updateSceneDefinitionInputDtoSchema>,
        SceneDefinitionDto
      >
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
      reset: MutationProcedure<
        campaignContracts.ResetCampaignClockInput,
        campaignContracts.CampaignClockDto
      >
      reconcile: MutationProcedure<
        campaignContracts.ReconcileCampaignClockInput,
        campaignContracts.CampaignClockDto
      >
    }
    vehicles: {
      list: QueryProcedure<
        SchemaInput<typeof campaignContracts.listCampaignVehiclesInputSchema>,
        campaignContracts.CampaignVehicleDto[]
      >
      create: MutationProcedure<
        campaignContracts.CreateCampaignVehicleInput,
        campaignContracts.CampaignVehicleDto
      >
      update: MutationProcedure<
        campaignContracts.UpdateCampaignVehicleInput,
        campaignContracts.CampaignVehicleDto
      >
      delete: MutationProcedure<
        SchemaInput<typeof campaignContracts.deleteCampaignVehicleInputSchema>,
        { ok: true }
      >
    }
    attachments: {
      list: QueryProcedure<
        SchemaInput<typeof campaignContracts.listCampaignAttachmentsInputSchema>,
        campaignContracts.CampaignAttachmentDto[]
      >
      create: MutationProcedure<
        campaignContracts.CreateCampaignAttachmentInput,
        campaignContracts.CampaignAttachmentDto
      >
      delivery: QueryProcedure<
        SchemaInput<typeof campaignContracts.getCampaignAttachmentDeliveryInputSchema>,
        SignedCampaignFileDeliveryDto
      >
      delete: MutationProcedure<
        SchemaInput<typeof campaignContracts.deleteCampaignAttachmentInputSchema>,
        { ok: true }
      >
    }
    announcements: {
      list: QueryProcedure<
        SchemaInput<typeof campaignContracts.listCampaignAnnouncementsInputSchema>,
        campaignContracts.CampaignAnnouncementDto[]
      >
      get: QueryProcedure<
        SchemaInput<typeof campaignContracts.getCampaignAnnouncementInputSchema>,
        campaignContracts.CampaignAnnouncementDto
      >
      create: MutationProcedure<
        campaignContracts.CreateCampaignAnnouncementInput,
        campaignContracts.CampaignAnnouncementDto
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
      submit: MutationProcedure<
        campaignContracts.SubmitCampaignContentVersionInput,
        campaignContracts.CampaignContentBindingDto
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
  socialHub: {
    eligibility: {
      get: EmptyQueryProcedure<socialContracts.SocialEligibilityDto>
      initialize: EmptyMutationProcedure<socialContracts.SocialEligibilityDto>
    }
    preferences: {
      update: MutationProcedure<
        socialContracts.UpdateSocialContentPreferenceInput,
        socialContracts.SocialEligibilityDto
      >
    }
    profiles: {
      get: QueryProcedure<
        SchemaInput<typeof socialContracts.socialProfilePublicIdInputSchema>,
        socialContracts.SocialProfileDto
      >
    }
    discovery: {
      search: QueryProcedure<
        socialContracts.SocialDiscoveryInput,
        socialContracts.SocialDiscoveryPageDto
      >
    }
    listings: {
      get: QueryProcedure<
        SchemaInput<typeof socialContracts.socialListingPublicIdInputSchema>,
        socialContracts.SocialListingDto
      >
      getOwned: QueryProcedure<
        SchemaInput<typeof socialContracts.socialListingPublicIdInputSchema>,
        socialContracts.SocialListingDto
      >
      mine: EmptyQueryProcedure<socialContracts.SocialListingDto[]>
      create: MutationProcedure<
        socialContracts.CreateSocialListingInput,
        socialContracts.SocialListingDto
      >
      update: MutationProcedure<
        socialContracts.UpdateSocialListingInput,
        socialContracts.SocialListingDto
      >
      open: MutationProcedure<
        SchemaInput<typeof socialContracts.socialListingVersionInputSchema>,
        socialContracts.SocialListingDto
      >
      close: MutationProcedure<
        SchemaInput<typeof socialContracts.socialListingVersionInputSchema>,
        socialContracts.SocialListingDto
      >
      deleteDraft: MutationProcedure<
        SchemaInput<typeof socialContracts.socialListingVersionInputSchema>,
        { ok: true }
      >
    }
    applications: {
      mine: EmptyQueryProcedure<socialContracts.SocialApplicationDto[]>
      forListing: QueryProcedure<
        SchemaInput<typeof socialContracts.socialListingPublicIdInputSchema>,
        socialContracts.SocialApplicationDto[]
      >
      submit: MutationProcedure<
        socialContracts.SubmitSocialApplicationInput,
        socialContracts.SocialApplicationDto
      >
      withdraw: MutationProcedure<
        SchemaInput<typeof socialContracts.socialApplicationVersionInputSchema>,
        socialContracts.SocialApplicationDto
      >
      decide: MutationProcedure<
        SchemaInput<typeof socialContracts.decideSocialApplicationInputSchema>,
        socialContracts.SocialApplicationDto
      >
    }
    blocks: {
      list: EmptyQueryProcedure<socialContracts.SocialBlockDto[]>
      create: MutationProcedure<
        SchemaInput<typeof socialContracts.socialBlockInputSchema>,
        socialContracts.SocialBlockDto
      >
      remove: MutationProcedure<
        SchemaInput<typeof socialContracts.socialBlockInputSchema>,
        { ok: true }
      >
    }
    reports: {
      create: MutationProcedure<
        socialContracts.CreateSocialReportInput,
        z.infer<typeof socialContracts.socialReportReceiptDtoSchema>
      >
    }
    moderation: {
      queue: EmptyQueryProcedure<socialContracts.SocialModerationQueueItemDto[]>
      openReport: MutationProcedure<
        SchemaInput<typeof socialContracts.socialReportPublicIdInputSchema>,
        socialContracts.SocialModerationReportDto
      >
      takeAction: MutationProcedure<
        socialContracts.TakeSocialModerationActionInput,
        socialContracts.SocialModerationReportDto
      >
    }
  }
  rules: {
    listPacks: EmptyQueryProcedure<ruleContracts.RulePackSummaryDto[]>
    listRevisions: QueryProcedure<
      ruleContracts.ListRulePackRevisionsInputDto,
      ruleContracts.RulePackRevisionDto[]
    >
    getRevision: QueryProcedure<{ revisionId: string }, ruleContracts.RulePackRevisionDto>
    saveDraft: MutationProcedure<
      ruleContracts.SaveRulePackDraftInputDto,
      ruleContracts.RulePackRevisionDto
    >
    simulate: MutationProcedure<
      ruleContracts.SimulateRulePackInputDto,
      ruleContracts.SimulateRulePackResultDto
    >
    activate: MutationProcedure<
      ruleContracts.ActivateRulePackRevisionInputDto,
      ruleContracts.RulePackRevisionDto
    >
    retire: MutationProcedure<ruleContracts.RetireRulePackInputDto, { ok: true }>
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
    extraOptions: QueryProcedure<
      { id: string; input: CharacterSheetExtraCatalogInputDto },
      CharacterSheetExtraCatalogResponseDto
    >
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
      {
        id: string
        input: import('@artificer-toolkit/schema/api/characters').CharacterRestPreviewRequestDto
      },
      CharacterRestPreviewResponseDto
    >
    saveDraft: MutationProcedure<
      { id: string; input: CharacterBuilderDraftSaveRequestDto },
      CharacterBuilderDraftDto
    >
    sheet: QueryProcedure<IdProcedureInput, CharacterSheetResponseDto | null>
    upsert: MutationProcedure<CharacterBuilderCommitRequestDto, CharacterBuilderCommitReceiptDto>
  }
  content: {
    backgrounds: AuthoredDomainProcedures<
      BackgroundListResponseDto,
      BackgroundResponseDto,
      BackgroundAuthoringInputDto,
      BackgroundListRequestDto
    >
    classes: AuthoredDomainProcedures<
      ClassListResponseDto,
      ClassResponseDto,
      ClassAuthoringInputDto,
      ClassListRequestDto
    >
    creatures: AuthoredDomainProcedures<
      CreatureListResponseDto,
      CreatureResponseDto,
      CreatureAuthoringInputDto,
      CreatureListRequestDto
    >
    equipment: AuthoredDomainProcedures<
      EquipmentListResponseDto,
      EquipmentResponseDto,
      EquipmentAuthoringInputDto,
      EquipmentListRequestDto
    >
    feats: AuthoredDomainProcedures<
      FeatListResponseDto,
      FeatResponseDto,
      FeatAuthoringInputDto,
      FeatListRequestDto
    >
    races: AuthoredDomainProcedures<
      RaceListResponseDto,
      RaceResponseDto,
      RaceAuthoringInputDto,
      RaceListRequestDto
    >
    spells: AuthoredDomainProcedures<
      SpellListResponseDto,
      SpellResponseDto,
      SpellAuthoringInputDto,
      SpellListRequestDto
    >
    vehicles: AuthoredDomainProcedures<
      VehicleListResponseDto,
      VehicleResponseDto,
      VehicleAuthoringInputDto,
      VehicleListRequestDto
    >
  }
  media: {
    attachImage: MutationProcedure<AttachImageInput, { ok: true }>
    createImageUpload: MutationProcedure<
      CreateImageUploadIntentInput,
      z.infer<
        typeof import('@artificer-toolkit/schema/api/media').createImageUploadIntentOutputSchema
      >
    >
    finalizeImageUpload: MutationProcedure<
      FinalizeImageUploadInput,
      z.infer<typeof import('@artificer-toolkit/schema/api/media').finalizeImageUploadOutputSchema>
    >
    getImage: QueryProcedure<ImageLookupInput, SignedImageDeliveryDto | null>
    removeImage: MutationProcedure<RemoveImageInput, { ok: true }>
    createCampaignFileUpload: MutationProcedure<
      CreateCampaignFileUploadIntentInput,
      z.infer<
        typeof import('@artificer-toolkit/schema/api/media').createImageUploadIntentOutputSchema
      >
    >
    finalizeCampaignFileUpload: MutationProcedure<
      FinalizeImageUploadInput,
      z.infer<typeof import('@artificer-toolkit/schema/api/media').finalizeImageUploadOutputSchema>
    >
    createVttMapUpload: MutationProcedure<
      CreateVttMapUploadIntentInput,
      z.infer<
        typeof import('@artificer-toolkit/schema/api/media').createVttMapUploadIntentOutputSchema
      >
    >
    finalizeVttMapUpload: MutationProcedure<FinalizeImageUploadInput, FinalizeVttMapUploadOutput>
    getVttMapDelivery: QueryProcedure<FinalizeImageUploadInput, SignedVttMapDeliveryDto>
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

export function createTrpcClient(): TrpcClient {
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

export async function request<TSchema extends z.ZodTypeAny>(
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
