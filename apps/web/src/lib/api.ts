import { buildAccountApi } from './api/account'
import { buildCampaignsApi } from './api/campaigns'
import { buildCharactersApi } from './api/characters'
import { buildContentApi } from './api/content'
import { buildPlatformApi } from './api/platform'
import { buildNotificationsApi } from './api/notifications'
import { buildSocialHubApi } from './api/socialHub'
import { ApiError, ApiParseError, createTrpcClient } from './api/transport'

export type {
  AuthoredDetailRequestDto,
  AuthoredDraftDto,
  AuthoredDraftSaveRequestDto,
  AuthoredSubjectKindDto,
  BackgroundListItemDto,
  BackgroundListResponseDto,
  BackgroundResponseDto,
  ClassListItemDto,
  ClassListResponseDto,
  ClassResponseDto,
  CreatureListItemDto,
  CreatureListResponseDto,
  CreatureResponseDto,
  EquipmentListItemDto,
  EquipmentListResponseDto,
  EquipmentResponseDto,
  FeatListItemDto,
  FeatListResponseDto,
  FeatResponseDto,
  RaceListItemDto,
  RaceListResponseDto,
  RaceResponseDto,
  SpellListItemDto,
  SpellListResponseDto,
  SpellResponseDto,
  VehicleListItemDto,
  VehicleListResponseDto,
  VehicleResponseDto
} from '@artificer-toolkit/schema/api/content'

export type {
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
  CharacterSheetResponseDto
} from '@artificer-toolkit/schema/api/characters'

export type {
  CharacterSheetPanelDto,
  CharacterSheetPanelNumericCalculationDto,
  CharacterSheetPanelTargetDto
} from '@artificer-toolkit/schema/api/characterSheetPanel'

export type {
  NodeRuntimeNormalizeValuesRequestDto,
  NodeRuntimeNormalizeValuesResponseDto,
  NodeRuntimeResolveRequestDto,
  NodeRuntimeResolveResponseDto
} from '@artificer-toolkit/schema/api/nodeRuntime'

export type {
  RouteIdentityBySubjectRequestDto,
  RouteIdentityDto,
  RouteIdentityResolveRequestDto
} from '@artificer-toolkit/schema/api/routeIds'

export type {
  AccountProfileDto,
  AccountProfileUpdateInput,
  AccountUsernameStatusDto,
  AccountUsernameStatusInput
} from '@artificer-toolkit/schema/api/account'

export type {
  AttachImageInput,
  CreateImageUploadIntentInput,
  FinalizeImageUploadInput,
  ImageLookupInput,
  RemoveImageInput,
  SignedImageDeliveryDto
} from '@artificer-toolkit/schema/api/media'

export type { SystemListItemDto } from '@artificer-toolkit/schema/api/systems'

export type {
  CreateSocialListingInput,
  CreateSocialReportInput,
  SocialApplicationDto,
  SocialBlockDto,
  SocialDiscoveryInput,
  SocialDiscoveryPageDto,
  SocialEligibilityDto,
  SocialListingDto,
  SocialListingExpectationsDto,
  SocialListingLocationDto,
  SocialListingScheduleDto,
  SocialModerationQueueItemDto,
  SocialModerationReportDto,
  SocialProfileDto,
  SubmitSocialApplicationInput,
  TakeSocialModerationActionInput,
  UpdateSocialContentPreferenceInput,
  UpdateSocialListingInput
} from '@artificer-toolkit/schema/api/socialHub'

export type {
  ExecuteDiceConfigurationInputDto,
  ExecuteRollInputDto,
  RollHistoryResponseDto,
  RollResultDto,
  RollRecordDto
} from '@artificer-toolkit/schema/api/rolls'

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

export type { BackgroundAuthoringInputDto } from '@artificer-toolkit/schema/subjects/background'
export type { ClassAuthoringInputDto } from '@artificer-toolkit/schema/subjects/class'
export type { CreatureAuthoringInputDto } from '@artificer-toolkit/schema/subjects/creature'
export type { FeatAuthoringInputDto } from '@artificer-toolkit/schema/subjects/feat'
export type { RaceAuthoringInputDto } from '@artificer-toolkit/schema/subjects/race'
export type { SpellAuthoringInputDto } from '@artificer-toolkit/schema/subjects/spell'
export type { VehicleAuthoringInputDto } from '@artificer-toolkit/schema/subjects/vehicle'

export { ApiError, ApiParseError }

const client = createTrpcClient()
const platformApi = buildPlatformApi(client)

export const api = {
  account: buildAccountApi(client),
  campaigns: buildCampaignsApi(client),
  characters: buildCharactersApi(client),
  rolls: platformApi.rolls,
  content: buildContentApi(client),
  encounters: platformApi.encounters,
  systems: platformApi.systems,
  media: platformApi.media,
  nodeRuntime: platformApi.nodeRuntime,
  notifications: buildNotificationsApi(client),
  routeIds: platformApi.routeIds,
  socialHub: buildSocialHubApi(client)
}

export function createServerApi(_userId?: string | null) {
  return api
}

export type Api = typeof api
