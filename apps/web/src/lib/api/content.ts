import { z } from 'zod'
import {
  authoredDraftDtoSchema,
  backgroundListRequestDtoSchema,
  backgroundListResponseDtoSchema,
  backgroundResponseDtoSchema,
  classListRequestDtoSchema,
  classListResponseDtoSchema,
  classResponseDtoSchema,
  creatureListRequestDtoSchema,
  creatureListResponseDtoSchema,
  creatureResponseDtoSchema,
  equipmentListRequestDtoSchema,
  equipmentListResponseDtoSchema,
  equipmentResponseDtoSchema,
  featListRequestDtoSchema,
  featListResponseDtoSchema,
  featResponseDtoSchema,
  raceListRequestDtoSchema,
  raceListResponseDtoSchema,
  raceResponseDtoSchema,
  spellListRequestDtoSchema,
  spellListResponseDtoSchema,
  spellResponseDtoSchema,
  vehicleListRequestDtoSchema,
  vehicleListResponseDtoSchema,
  vehicleResponseDtoSchema,
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
import type { BackgroundAuthoringInputDto } from '@artificer-toolkit/schema/subjects/background'
import type { ClassAuthoringInputDto } from '@artificer-toolkit/schema/subjects/class'
import type { CreatureAuthoringInputDto } from '@artificer-toolkit/schema/subjects/creature'
import type { EquipmentAuthoringInputDto } from '@artificer-toolkit/schema/subjects/equipment'
import type { FeatAuthoringInputDto } from '@artificer-toolkit/schema/subjects/feat'
import type { RaceAuthoringInputDto } from '@artificer-toolkit/schema/subjects/race'
import type { SpellAuthoringInputDto } from '@artificer-toolkit/schema/subjects/spell'
import type { VehicleAuthoringInputDto } from '@artificer-toolkit/schema/subjects/vehicle'
import {
  normalizeAuthoredDetailInput,
  okResponseSchema,
  request,
  type AuthoredContentInput,
  type AuthoredDetailInput,
  type AuthoredDomainTransport,
  type TrpcClient
} from './transport'

function contentDomain<TList, TResponse, TInput extends AuthoredContentInput, TListInput>(
  path: string,
  listInputSchema: z.ZodType<TListInput>,
  listSchema: z.ZodType<TList>,
  responseSchema: z.ZodType<TResponse>,
  transport: AuthoredDomainTransport<TList, TResponse, TInput, TListInput>
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
    list: (input: TListInput) =>
      request(`${path}.list`, listSchema, () => transport.list(listInputSchema.parse(input))),
    saveDraft: (input: TInput) =>
      request(`${path}.saveDraft`, draftSchema, () => transport.saveDraft(input))
  }
}

export function buildContentApi(client: TrpcClient) {
  return {
    backgrounds: contentDomain<
      BackgroundListResponseDto,
      BackgroundResponseDto,
      BackgroundAuthoringInputDto,
      BackgroundListRequestDto
    >(
      'content.backgrounds',
      backgroundListRequestDtoSchema,
      backgroundListResponseDtoSchema,
      backgroundResponseDtoSchema,
      {
        activate: (input) => client.content.backgrounds.activate.mutate(input),
        activateDraft: (id) => client.content.backgrounds.activateDraft.mutate({ id }),
        deleteActive: (id) => client.content.backgrounds.deleteActive.mutate({ id }),
        discardDraft: (id) => client.content.backgrounds.discardDraft.mutate({ id }),
        duplicate: (id) => client.content.backgrounds.duplicate.mutate({ id }),
        get: (input) => client.content.backgrounds.get.query(input),
        getDraft: (id) => client.content.backgrounds.getDraft.query({ id }),
        list: (input) => client.content.backgrounds.list.query(input),
        saveDraft: (input) => client.content.backgrounds.saveDraft.mutate(input)
      }
    ),
    classes: contentDomain<
      ClassListResponseDto,
      ClassResponseDto,
      ClassAuthoringInputDto,
      ClassListRequestDto
    >(
      'content.classes',
      classListRequestDtoSchema,
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
        list: (input) => client.content.classes.list.query(input),
        saveDraft: (input) => client.content.classes.saveDraft.mutate(input)
      }
    ),
    equipment: contentDomain<
      EquipmentListResponseDto,
      EquipmentResponseDto,
      EquipmentAuthoringInputDto,
      EquipmentListRequestDto
    >(
      'content.equipment',
      equipmentListRequestDtoSchema,
      equipmentListResponseDtoSchema,
      equipmentResponseDtoSchema,
      {
        activate: (input) => client.content.equipment.activate.mutate(input),
        activateDraft: (id) => client.content.equipment.activateDraft.mutate({ id }),
        deleteActive: (id) => client.content.equipment.deleteActive.mutate({ id }),
        discardDraft: (id) => client.content.equipment.discardDraft.mutate({ id }),
        duplicate: (id) => client.content.equipment.duplicate.mutate({ id }),
        get: (input) => client.content.equipment.get.query(input),
        getDraft: (id) => client.content.equipment.getDraft.query({ id }),
        list: (input) => client.content.equipment.list.query(input),
        saveDraft: (input) => client.content.equipment.saveDraft.mutate(input)
      }
    ),
    feats: contentDomain<
      FeatListResponseDto,
      FeatResponseDto,
      FeatAuthoringInputDto,
      FeatListRequestDto
    >('content.feats', featListRequestDtoSchema, featListResponseDtoSchema, featResponseDtoSchema, {
      activate: (input) => client.content.feats.activate.mutate(input),
      activateDraft: (id) => client.content.feats.activateDraft.mutate({ id }),
      deleteActive: (id) => client.content.feats.deleteActive.mutate({ id }),
      discardDraft: (id) => client.content.feats.discardDraft.mutate({ id }),
      duplicate: (id) => client.content.feats.duplicate.mutate({ id }),
      get: (input) => client.content.feats.get.query(input),
      getDraft: (id) => client.content.feats.getDraft.query({ id }),
      list: (input) => client.content.feats.list.query(input),
      saveDraft: (input) => client.content.feats.saveDraft.mutate(input)
    }),
    races: contentDomain<
      RaceListResponseDto,
      RaceResponseDto,
      RaceAuthoringInputDto,
      RaceListRequestDto
    >('content.races', raceListRequestDtoSchema, raceListResponseDtoSchema, raceResponseDtoSchema, {
      activate: (input) => client.content.races.activate.mutate(input),
      activateDraft: (id) => client.content.races.activateDraft.mutate({ id }),
      deleteActive: (id) => client.content.races.deleteActive.mutate({ id }),
      discardDraft: (id) => client.content.races.discardDraft.mutate({ id }),
      duplicate: (id) => client.content.races.duplicate.mutate({ id }),
      get: (input) => client.content.races.get.query(input),
      getDraft: (id) => client.content.races.getDraft.query({ id }),
      list: (input) => client.content.races.list.query(input),
      saveDraft: (input) => client.content.races.saveDraft.mutate(input)
    }),
    spells: contentDomain<
      SpellListResponseDto,
      SpellResponseDto,
      SpellAuthoringInputDto,
      SpellListRequestDto
    >(
      'content.spells',
      spellListRequestDtoSchema,
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
        list: (input) => client.content.spells.list.query(input),
        saveDraft: (input) => client.content.spells.saveDraft.mutate(input)
      }
    ),
    creatures: contentDomain<
      CreatureListResponseDto,
      CreatureResponseDto,
      CreatureAuthoringInputDto,
      CreatureListRequestDto
    >(
      'content.creatures',
      creatureListRequestDtoSchema,
      creatureListResponseDtoSchema,
      creatureResponseDtoSchema,
      {
        activate: (input) => client.content.creatures.activate.mutate(input),
        activateDraft: (id) => client.content.creatures.activateDraft.mutate({ id }),
        deleteActive: (id) => client.content.creatures.deleteActive.mutate({ id }),
        discardDraft: (id) => client.content.creatures.discardDraft.mutate({ id }),
        duplicate: (id) => client.content.creatures.duplicate.mutate({ id }),
        get: (input) => client.content.creatures.get.query(input),
        getDraft: (id) => client.content.creatures.getDraft.query({ id }),
        list: (input) => client.content.creatures.list.query(input),
        saveDraft: (input) => client.content.creatures.saveDraft.mutate(input)
      }
    ),
    vehicles: contentDomain<
      VehicleListResponseDto,
      VehicleResponseDto,
      VehicleAuthoringInputDto,
      VehicleListRequestDto
    >(
      'content.vehicles',
      vehicleListRequestDtoSchema,
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
        list: (input) => client.content.vehicles.list.query(input),
        saveDraft: (input) => client.content.vehicles.saveDraft.mutate(input)
      }
    )
  }
}

export type ContentApi = ReturnType<typeof buildContentApi>
