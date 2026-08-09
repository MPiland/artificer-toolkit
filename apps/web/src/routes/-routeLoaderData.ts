import type { AuthoredContentReferenceData } from '#app/data/contentReferences'
import type { SpellDetailReferenceData } from '#app/data/spells/referenceData'
import type {
  AuthoredDraftDto,
  BackgroundResponseDto,
  CharacterBuilderDraftDto,
  CharacterBuilderPayloadDto,
  CharacterSheetResponseDto,
  ClassResponseDto,
  CreatureResponseDto,
  EquipmentResponseDto,
  FeatResponseDto,
  RaceResponseDto,
  SpellResponseDto,
  VehicleResponseDto
} from '#app/lib/api'
import type {
  SystemListResponseDto,
  SystemResponseDto
} from '@artificer-toolkit/schema/api/systems'

export type AuthoredRouteView = 'active' | 'draft'

export interface AuthoredFormRouteLoaderData<TData = unknown> {
  authoringData: TData
}

export interface AuthoredCreateData {
  system?: SystemResponseDto | null
  systems: SystemListResponseDto
}

export type AuthoredCreateLoaderData = AuthoredFormRouteLoaderData<AuthoredCreateData>

export interface BackgroundDetailLoaderData {
  backgroundId: string
  breadcrumbLabel: string | undefined
  draft: AuthoredDraftDto | null
  references: Pick<
    AuthoredContentReferenceData,
    'currencies' | 'equipment' | 'languages' | 'skills'
  >
  response: BackgroundResponseDto | null
  view: AuthoredRouteView
}

export interface ClassDetailLoaderData {
  breadcrumbLabel: string | undefined
  classId: string
  draft: AuthoredDraftDto | null
  references: Pick<
    AuthoredContentReferenceData,
    'classes' | 'currencies' | 'equipment' | 'languages' | 'skills'
  >
  response: ClassResponseDto | null
  view: AuthoredRouteView
}

export interface CreatureDetailLoaderData {
  breadcrumbLabel: string | undefined
  creatureId: string
  draft: AuthoredDraftDto | null
  references: Pick<
    AuthoredContentReferenceData,
    'challengeRatings' | 'conditionTypes' | 'creatureTypes' | 'damageTypes' | 'speeds'
  >
  response: CreatureResponseDto | null
  view: AuthoredRouteView
}

export interface EquipmentDetailLoaderData {
  breadcrumbLabel: string | undefined
  draft: AuthoredDraftDto | null
  equipmentId: string
  references: Pick<
    AuthoredContentReferenceData,
    'classes' | 'currencies' | 'equipment' | 'heritages' | 'rarities'
  >
  response: EquipmentResponseDto | null
  view: AuthoredRouteView
}

export interface FeatDetailLoaderData {
  breadcrumbLabel: string | undefined
  draft: AuthoredDraftDto | null
  featId: string
  response: FeatResponseDto | null
  view: AuthoredRouteView
}

export interface RaceDetailLoaderData {
  breadcrumbLabel: string | undefined
  draft: AuthoredDraftDto | null
  parentResponse: RaceResponseDto | null
  raceId: string
  references: Pick<AuthoredContentReferenceData, 'heritages' | 'races' | 'speeds'>
  response: RaceResponseDto | null
  view: AuthoredRouteView
}

export interface SpellDetailLoaderData {
  breadcrumbLabel: string | undefined
  draft: AuthoredDraftDto | null
  references: SpellDetailReferenceData
  response: SpellResponseDto | null
  spellId: string
  view: AuthoredRouteView
}

export interface VehicleDetailLoaderData {
  breadcrumbLabel: string | undefined
  draft: AuthoredDraftDto | null
  response: VehicleResponseDto | null
  vehicleId: string
  view: AuthoredRouteView
}

export interface AuthoredEditData<TResponse> {
  breadcrumbLabel: string | undefined
  draft: AuthoredDraftDto | null
  response: TResponse | null
  subjectId: string
  system?: SystemResponseDto | null
}

export type BackgroundEditLoaderData = AuthoredFormRouteLoaderData<
  AuthoredEditData<BackgroundResponseDto>
>

export type ClassEditLoaderData = AuthoredFormRouteLoaderData<AuthoredEditData<ClassResponseDto>>

export type CreatureEditLoaderData = AuthoredFormRouteLoaderData<
  AuthoredEditData<CreatureResponseDto>
>

export type EquipmentEditLoaderData = AuthoredFormRouteLoaderData<
  AuthoredEditData<EquipmentResponseDto> & {
    parentResponse?: EquipmentResponseDto | null
  }
>

export type FeatEditLoaderData = AuthoredFormRouteLoaderData<AuthoredEditData<FeatResponseDto>>

export type RaceEditLoaderData = AuthoredFormRouteLoaderData<AuthoredEditData<RaceResponseDto>>

export type SpellEditLoaderData = AuthoredFormRouteLoaderData<AuthoredEditData<SpellResponseDto>>

export type VehicleEditLoaderData = AuthoredFormRouteLoaderData<
  AuthoredEditData<VehicleResponseDto>
>

export interface CharacterCreateAuthoringData {
  payload: CharacterBuilderPayloadDto | null
  systems: SystemListResponseDto
}

export type CharacterCreateLoaderData = AuthoredFormRouteLoaderData<CharacterCreateAuthoringData>

export interface CharacterSheetLoaderData {
  breadcrumbLabel: string | null
  characterId: string
  characterPublicId: string
  draft: CharacterBuilderDraftDto | null
  fallbackCharacter: CharacterBuilderPayloadDto | null
  response: CharacterSheetResponseDto | null
}

export interface CharacterEditAuthoringData {
  breadcrumbLabel: string | null
  characterId: string
  draft: CharacterBuilderDraftDto | null
  draftPayload: CharacterBuilderPayloadDto | null
  response: CharacterBuilderPayloadDto | null
}

export type CharacterEditLoaderData = AuthoredFormRouteLoaderData<CharacterEditAuthoringData>

export type SystemListLoaderData = SystemListResponseDto

export type SystemDetailLoaderData = SystemResponseDto
